"""Focused tests for per-workout session state isolation in gym_trainer and main."""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

import gym_trainer as gt
from main import app
from app.db.session import get_db
from app.models.base import Base

# Setup in-memory SQLite for testing (/stats and /get_set_feedback now require
# an owned WorkoutSession DB row — see the live-endpoint auth fix).
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def register_and_get_headers(client: TestClient, email: str) -> dict:
    payload = {"name": "Isolation Tester", "email": email, "password": "TestPassword123!"}
    client.post("/api/v1/auth/register", json=payload)
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "TestPassword123!"})
    token = login_res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestSessionIsolation(unittest.TestCase):

    def setUp(self):
        # Reset any active sessions
        for sid in list(gt._sessions.keys()):
            if sid != gt.DEFAULT_SESSION_ID:
                gt.delete_session(sid)
        gt.reset_state(session_id=gt.DEFAULT_SESSION_ID)
        app.dependency_overrides[get_db] = override_get_db
        Base.metadata.create_all(bind=engine)

    def tearDown(self):
        db = TestingSessionLocal()
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
        db.close()

    def test_session_state_independence(self):
        """Verify two sessions maintain completely separate rep counts, exercises, and form metrics."""
        sid_a = "session_A"
        sid_b = "session_B"

        # Start Session A (Squat, 5 reps)
        gt.start_session("squat", target_reps=5, target_sets=2, session_id=sid_a)
        
        # Start Session B (Pushup, 10 reps)
        gt.start_session("pushup", target_reps=10, target_sets=3, session_id=sid_b)

        sess_a = gt.get_session_state(sid_a)
        sess_b = gt.get_session_state(sid_b)

        # 1. Exercise configuration independence
        self.assertEqual(sess_a.state["current_exercise"], "squat")
        self.assertEqual(sess_b.state["current_exercise"], "pushup")
        self.assertEqual(sess_a.session["target_reps"], 5)
        self.assertEqual(sess_b.session["target_reps"], 10)

        # 2. Separate MediaPipe Pose tracker instances
        self.assertIsNot(sess_a.pose, sess_b.pose)

        # 3. Mutate rep counter & stage in Session A
        sess_a.state["counter"] = 3
        sess_a.state["stage"] = "down"
        sess_a.state["form_metrics"] = {"knee_cave": 12.5}
        sess_a.state["form_violations"] = [{"check": "knee_cave", "value": 12.5, "message": "Knee cave detected"}]

        # 4. Verify Session B is completely untouched
        self.assertEqual(sess_b.state["counter"], 0)
        self.assertIsNone(sess_b.state["stage"])
        self.assertEqual(sess_b.state["form_metrics"], {})
        self.assertEqual(sess_b.state["form_violations"], [])

        # 5. Mutate Session B
        sess_b.state["counter"] = 7
        sess_b.state["stage"] = "up"

        # 6. Re-verify Session A remains unchanged
        self.assertEqual(sess_a.state["counter"], 3)
        self.assertEqual(sess_a.state["stage"], "down")

    def test_session_cleanup(self):
        """Verify explicit ending and deletion of sessions."""
        sid = "temp_session_cleanup_test"
        gt.start_session("deadlift", target_reps=5, target_sets=1, session_id=sid)
        
        self.assertIn(sid, gt._sessions)
        initial_count = gt.get_active_session_count()

        # End session
        gt.end_session(sid)
        self.assertNotIn(sid, gt._sessions)
        self.assertEqual(gt.get_active_session_count(), initial_count - 1)

    def test_api_session_isolation_endpoints(self):
        """Verify FastAPI endpoints pass and isolate session_id correctly.

        Uses the authenticated /api/v1/sessions/start flow (not the legacy
        /start_session) because /stats now requires the caller to own the
        session's WorkoutSession DB row — see the live-endpoint auth fix.
        """
        client = TestClient(app)
        headers1 = register_and_get_headers(client, "isolation_user1@example.com")
        headers2 = register_and_get_headers(client, "isolation_user2@example.com")

        # Start Session 1 (owned by user 1)
        res1 = client.post(
            "/api/v1/sessions/start",
            json={"exercise": "lunge", "target_reps": 8, "target_sets": 2},
            headers=headers1,
        )
        self.assertEqual(res1.status_code, 201)
        sid1 = res1.json()["data"]["session_id"]

        # Start Session 2 (owned by user 2)
        res2 = client.post(
            "/api/v1/sessions/start",
            json={"exercise": "bicep_curl", "target_reps": 12, "target_sets": 3},
            headers=headers2,
        )
        self.assertEqual(res2.status_code, 201)
        sid2 = res2.json()["data"]["session_id"]

        self.assertNotEqual(sid1, sid2)

        # Each user can fetch their own live stats
        stats1 = client.get(f"/stats?session_id={sid1}", headers=headers1).json()
        self.assertEqual(stats1["exercise"], "lunge")
        self.assertEqual(stats1["target_reps"], 8)
        self.assertEqual(stats1["session_id"], sid1)

        stats2 = client.get(f"/stats?session_id={sid2}", headers=headers2).json()
        self.assertEqual(stats2["exercise"], "bicep_curl")
        self.assertEqual(stats2["target_reps"], 12)
        self.assertEqual(stats2["session_id"], sid2)

        # Cross-user access to live stats is rejected
        cross_res = client.get(f"/stats?session_id={sid1}", headers=headers2)
        self.assertEqual(cross_res.status_code, 404)

        # Unauthenticated access to live stats is rejected
        anon_res = client.get(f"/stats?session_id={sid1}")
        self.assertEqual(anon_res.status_code, 401)

        # End Session 1
        end_res = client.post(f"/api/v1/sessions/{sid1}/stop", headers=headers1)
        self.assertEqual(end_res.status_code, 200)
        self.assertNotIn(sid1, gt._sessions)

    def test_ws_webcam_requires_authorization(self):
        """/ws/webcam must reject connections with no/invalid token or a token for the wrong user."""
        client = TestClient(app)
        headers1 = register_and_get_headers(client, "ws_owner@example.com")
        headers2 = register_and_get_headers(client, "ws_intruder@example.com")

        start_res = client.post(
            "/api/v1/sessions/start",
            json={"exercise": "squat", "target_reps": 5, "target_sets": 1},
            headers=headers1,
        )
        sid = start_res.json()["data"]["session_id"]
        token1 = headers1["Authorization"].split(" ")[1]
        token2 = headers2["Authorization"].split(" ")[1]

        # No token at all
        with self.assertRaises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/webcam?session_id={sid}"):
                pass

        # Valid token, but belongs to a different user (not session owner)
        with self.assertRaises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/webcam?session_id={sid}&token={token2}"):
                pass

        # Correct owner's token is accepted (connection opens without raising)
        with client.websocket_connect(f"/ws/webcam?session_id={sid}&token={token1}"):
            pass


if __name__ == "__main__":
    unittest.main()
