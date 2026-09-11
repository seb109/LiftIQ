"""Focused database tests for SQLAlchemy 2.0 models, relationships, and repositories."""

import sys
import unittest
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from app.models import Base, User, WorkoutSession, ExerciseMetric, AIReport, RefreshToken
from app.repositories import (
    UserRepository,
    WorkoutSessionRepository,
    ExerciseMetricRepository,
    AIReportRepository,
    RefreshTokenRepository,
)


class TestDatabaseFoundation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Use in-memory SQLite engine for fast, isolated ORM & repository testing
        cls.engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_model_imports_and_metadata_registration(self):
        """1 & 2: Verify all 5 models are imported and registered on Base.metadata."""
        registered_tables = Base.metadata.tables.keys()
        expected_tables = {
            "users",
            "workout_sessions",
            "exercise_metrics",
            "ai_reports",
            "refresh_tokens",
        }
        for table in expected_tables:
            self.assertIn(table, registered_tables)

    def test_user_ownership_and_relationships(self):
        """3 & 6: Verify User owns WorkoutSessions and relationships function cleanly."""
        user_repo = UserRepository(self.db)
        workout_repo = WorkoutSessionRepository(self.db)

        # Create user
        user = User(
            name="Test Lifter",
            email=f"lifter_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed_pw_secret"
        )
        user_repo.create(user)
        self.assertIsNotNone(user.id)

        # Create session owned by user
        session1 = WorkoutSession(
            user_id=user.id,
            exercise="squat",
            total_reps=10,
            average_form_score=92.5
        )
        session2 = WorkoutSession(
            user_id=user.id,
            exercise="pushup",
            total_reps=15,
            average_form_score=88.0
        )
        workout_repo.create(session1)
        workout_repo.create(session2)

        # Verify relationships
        self.db.refresh(user)
        self.assertEqual(len(user.workout_sessions), 2)
        self.assertIn(session1, user.workout_sessions)
        self.assertIn(session2, user.workout_sessions)

    def test_workout_session_and_exercise_metrics_persistence(self):
        """4: Verify WorkoutSession can be persisted with associated ExerciseMetric records."""
        workout_repo = WorkoutSessionRepository(self.db)
        metric_repo = ExerciseMetricRepository(self.db)

        session = WorkoutSession(
            exercise="deadlift",
            total_reps=5,
            average_form_score=85.0
        )
        workout_repo.create(session)

        metrics = [
            ExerciseMetric(
                session_id=session.id,
                rep_number=1,
                stage="up",
                form_score=90.0,
                left_knee_angle=170.0,
                right_knee_angle=172.0
            ),
            ExerciseMetric(
                session_id=session.id,
                rep_number=2,
                stage="down",
                form_score=80.0,
                left_knee_angle=95.0,
                right_knee_angle=94.0,
                correction_message="Keep spine neutral"
            )
        ]
        metric_repo.create_batch(metrics)

        # Retrieve and verify
        fetched_metrics = metric_repo.get_by_session_id(session.id)
        self.assertEqual(len(fetched_metrics), 2)
        self.assertEqual(fetched_metrics[0].rep_number, 1)
        self.assertEqual(fetched_metrics[1].correction_message, "Keep spine neutral")

    def test_ai_report_association(self):
        """5: Verify AIReport can be associated with a WorkoutSession (1-to-1)."""
        workout_repo = WorkoutSessionRepository(self.db)
        ai_repo = AIReportRepository(self.db)

        session = WorkoutSession(
            exercise="bicep_curl",
            total_reps=12,
            average_form_score=95.0
        )
        workout_repo.create(session)

        report = AIReport(
            session_id=session.id,
            overall_score=94.0,
            form_score=95.0,
            strengths=["Consistent elbow positioning", "Full extension at bottom"],
            mistakes=["Minor torso sway on rep 10"],
            improvements=["Keep core tight throughout entire set"],
            coach_summary="Excellent bicep curl performance overall!",
            next_session_focus="Maintain tempo on final reps",
            motivation="Keep up the great progress!"
        )
        ai_repo.create(report)

        # Verify retrievability
        fetched_report = ai_repo.get_by_session_id(session.id)
        self.assertIsNotNone(fetched_report)
        self.assertEqual(fetched_report.session_id, session.id)
        self.assertEqual(fetched_report.coach_summary, "Excellent bicep curl performance overall!")
        self.assertEqual(fetched_report.session, session)

    def test_refresh_token_user_reference(self):
        """7: Verify RefreshToken references a User."""
        user_repo = UserRepository(self.db)
        token_repo = RefreshTokenRepository(self.db)

        user = User(
            name="Token User",
            email=f"token_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="secret_hash"
        )
        user_repo.create(user)

        token = RefreshToken(
            user_id=user.id,
            token_hash="sha256_hashed_refresh_token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        token_repo.create(token)

        fetched_tokens = token_repo.get_by_user_id(user.id)
        self.assertEqual(len(fetched_tokens), 1)
        self.assertEqual(fetched_tokens[0].token_hash, "sha256_hashed_refresh_token")
        self.assertEqual(fetched_tokens[0].user, user)

    def test_repository_crud_operations(self):
        """8: Test basic repository persistence operations."""
        user_repo = UserRepository(self.db)

        # Create
        email = f"crud_{uuid.uuid4().hex[:8]}@example.com"
        user = User(name="CRUD User", email=email, password_hash="hash")
        user_repo.create(user)

        # Read
        fetched = user_repo.get_by_email(email)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.name, "CRUD User")

        # Update
        fetched.name = "Updated CRUD User"
        user_repo.update(fetched)
        re_fetched = user_repo.get_by_id(user.id)
        self.assertEqual(re_fetched.name, "Updated CRUD User")

        # Delete
        success = user_repo.delete(user.id)
        self.assertTrue(success)
        self.assertIsNone(user_repo.get_by_id(user.id))


if __name__ == "__main__":
    unittest.main()
