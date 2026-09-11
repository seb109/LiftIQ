import asyncio
import json
import uuid
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
import gym_trainer as gt
from app.db.session import get_db
from app.models.base import Base
from app.models.ai_report import AIReport
from app.models.workout_session import WorkoutSession
from app.services.ai_service import (
    build_compact_workout_input,
    generate_fallback_report,
    generate_structured_ai_report,
    generate_and_persist_ai_report
)

# Setup in-memory SQLite for testing
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


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    gt._sessions.clear()


def register_and_get_token(email: str, name: str = "Test User") -> dict:
    reg_payload = {"name": name, "email": email, "password": "TestPassword123!"}
    client.post("/api/v1/auth/register", json=reg_payload)
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "TestPassword123!"})
    data = login_res.json()["data"]
    return {
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"}
    }


def test_compact_workout_input_generation():
    ws = WorkoutSession(
        id=uuid.uuid4(),
        exercise="squat",
        total_reps=12,
        duration_seconds=120,
        average_form_score=88.5,
        overall_score=88.5
    )
    sets = [{
        "set_number": 1,
        "reps": 12,
        "depths": [85.0, 90.0, 92.0],
        "rep_times": [2.0, 2.1, 1.9]
    }]

    input_data = build_compact_workout_input(ws, sets)
    assert input_data["exercise"] == "squat"
    assert input_data["total_reps"] == 12
    assert input_data["average_form_score"] == 88.5
    assert len(input_data["completed_sets"]) == 1
    assert input_data["completed_sets"][0]["avg_depth_score"] == 89.0


def test_successful_ai_response_validated():
    async def _run():
        valid_json = json.dumps({
            "overall_score": 92,
            "form_score": 89,
            "strengths": ["Great depth on squats"],
            "mistakes": ["Slight chest lean"],
            "improvements": ["Keep core braced"],
            "coach_summary": "Great workout session with solid consistency.",
            "next_session_focus": "Maintain upright chest posture.",
            "motivation": "Keep pushing forward!"
        })

        mock_resp = AsyncMock()
        mock_resp.choices = [AsyncMock(message=AsyncMock(content=valid_json))]

        with patch("app.services.ai_service.groq_client.chat.completions.create", return_value=mock_resp):
            workout_data = {"exercise": "squat", "total_reps": 10, "average_form_score": 89.0}
            report = await generate_structured_ai_report(workout_data)
            assert report.overall_score == 92.0
            assert report.form_score == 89.0
            assert "Great depth on squats" in report.strengths

    asyncio.run(_run())


def test_malformed_ai_response_triggers_one_retry_and_persists():
    async def _run():
        invalid_json = "Not a JSON string"
        valid_json = json.dumps({
            "overall_score": 85,
            "form_score": 85,
            "strengths": ["Consistent rep tempo"],
            "mistakes": ["None"],
            "improvements": ["Increase weight next set"],
            "coach_summary": "Good effort on your sets.",
            "next_session_focus": "Increase weight slightly.",
            "motivation": "Well done!"
        })

        resp_invalid = AsyncMock()
        resp_invalid.choices = [AsyncMock(message=AsyncMock(content=invalid_json))]

        resp_valid = AsyncMock()
        resp_valid.choices = [AsyncMock(message=AsyncMock(content=valid_json))]

        mock_create = AsyncMock(side_effect=[resp_invalid, resp_valid])

        with patch("app.services.ai_service.groq_client.chat.completions.create", mock_create):
            workout_data = {"exercise": "pushup", "total_reps": 15, "average_form_score": 85.0}
            report = await generate_structured_ai_report(workout_data)
            assert mock_create.call_count == 2
            assert report.overall_score == 85.0
            assert "Consistent rep tempo" in report.strengths

    asyncio.run(_run())


def test_provider_failure_uses_safe_fallback_based_only_on_metrics():
    async def _run():
        mock_create = AsyncMock(side_effect=Exception("API connection timeout"))

        with patch("app.services.ai_service.groq_client.chat.completions.create", mock_create):
            workout_data = {"exercise": "bicep_curl", "total_reps": 10, "average_form_score": 90.0}
            report = await generate_structured_ai_report(workout_data)

            assert report.overall_score == 90.0
            assert report.form_score == 90.0
            assert "bicep_curl" in report.coach_summary
            # Verify fallback contains no medical claims/injury diagnoses
            for text in report.strengths + report.mistakes + report.improvements + [report.coach_summary]:
                assert "injury" not in text.lower()
                assert "medical" not in text.lower()
                assert "doctor" not in text.lower()

    asyncio.run(_run())


def test_idempotent_one_report_per_workout():
    async def _run():
        user_db = TestingSessionLocal()
        ws = WorkoutSession(
            id=uuid.uuid4(),
            exercise="deadlift",
            total_reps=8,
            duration_seconds=90,
            average_form_score=87.0
        )
        user_db.add(ws)
        user_db.commit()

        mock_fallback = generate_fallback_report({"exercise": "deadlift", "total_reps": 8, "average_form_score": 87.0})

        with patch("app.services.ai_service.generate_structured_ai_report", AsyncMock(return_value=mock_fallback)):
            r1 = await generate_and_persist_ai_report(user_db, ws)
            r2 = await generate_and_persist_ai_report(user_db, ws)

            assert r1.id == r2.id

            count = user_db.query(AIReport).filter(AIReport.session_id == ws.id).count()
            assert count == 1

        user_db.close()

    asyncio.run(_run())


def test_authenticated_user_report_retrieval_and_ownership():
    u1 = register_and_get_token("report_u1@example.com")
    u2 = register_and_get_token("report_u2@example.com")

    # User 1 starts and stops workout
    start_res = client.post("/api/v1/sessions/start", json={"exercise": "squat"}, headers=u1["headers"])
    s_id = start_res.json()["data"]["session_id"]

    mock_fallback = generate_fallback_report({"exercise": "squat", "total_reps": 10, "average_form_score": 90.0})

    with patch("app.services.ai_service.generate_structured_ai_report", AsyncMock(return_value=mock_fallback)):
        stop_res = client.post(f"/api/v1/sessions/{s_id}/stop", headers=u1["headers"])
        assert stop_res.status_code == 200

        report_id = stop_res.json()["data"].get("report_id")
        assert report_id is not None

        # User 1 retrieves their own report by report_id
        r1_res = client.get(f"/api/v1/reports/{report_id}", headers=u1["headers"])
        assert r1_res.status_code == 200
        assert r1_res.json()["success"] is True
        assert r1_res.json()["data"]["session_id"] == s_id

        # User 1 retrieves their own report by session_id
        r1_sess_res = client.get(f"/api/v1/reports/{s_id}", headers=u1["headers"])
        assert r1_sess_res.status_code == 200

        # User 1 lists reports
        list_res = client.get("/api/v1/reports", headers=u1["headers"])
        assert list_res.status_code == 200
        assert list_res.json()["data"]["count"] == 1

        # User 2 attempts to retrieve User 1's report -> 404 Not Found
        u2_res = client.get(f"/api/v1/reports/{report_id}", headers=u2["headers"])
        assert u2_res.status_code == 404


def test_unauthenticated_report_access_rejected():
    res = client.get("/api/v1/reports")
    assert res.status_code == 401


def test_ai_failure_does_not_fail_workout_completion():
    u = register_and_get_token("ai_fail@example.com")
    start_res = client.post("/api/v1/sessions/start", json={"exercise": "lunge"}, headers=u["headers"])
    s_id = start_res.json()["data"]["session_id"]

    with patch("app.services.ai_service.generate_and_persist_ai_report", AsyncMock(side_effect=Exception("Database crash on report"))):
        stop_res = client.post(f"/api/v1/sessions/{s_id}/stop", headers=u["headers"])
        assert stop_res.status_code == 200
        assert stop_res.json()["success"] is True
        assert stop_res.json()["data"]["session_id"] == s_id

    # Verify workout session is marked completed in DB regardless
    db = TestingSessionLocal()
    ws = db.query(WorkoutSession).filter(WorkoutSession.id == uuid.UUID(s_id)).first()
    db.close()

    assert ws is not None
    assert ws.ended_at is not None
