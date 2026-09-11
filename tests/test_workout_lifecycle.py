import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
import gym_trainer as gt
from app.db.session import get_db
from app.models.base import Base
from app.models.user import User
from app.models.workout_session import WorkoutSession
from app.models.exercise_metric import ExerciseMetric

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


def test_unauthenticated_request_rejected():
    res = client.post("/api/v1/sessions/start", json={"exercise": "squat"})
    assert res.status_code == 401


def test_authenticated_start_workout():
    user = register_and_get_token("user1@example.com", "User One")
    start_res = client.post(
        "/api/v1/sessions/start",
        json={"exercise": "squat", "target_reps": 10, "target_sets": 3},
        headers=user["headers"]
    )
    assert start_res.status_code == 201
    data = start_res.json()
    assert data["success"] is True
    session_id = data["data"]["session_id"]
    assert session_id is not None

    # Verify DB record created and owned by user
    db = TestingSessionLocal()
    session_uuid = uuid.UUID(session_id)
    ws = db.query(WorkoutSession).filter(WorkoutSession.id == session_uuid).first()
    db.close()

    assert ws is not None
    assert str(ws.user_id) == user["user_id"]
    assert ws.exercise == "squat"
    assert ws.ended_at is None

    # Verify in-memory session initialized
    assert session_id in gt._sessions
    sess = gt.get_session_state(session_id)
    assert sess.state["current_exercise"] == "squat"


def test_authenticated_complete_workout_persistence():
    user = register_and_get_token("user2@example.com", "User Two")
    start_res = client.post(
        "/api/v1/sessions/start",
        json={"exercise": "bicep_curl", "target_reps": 5, "target_sets": 1},
        headers=user["headers"]
    )
    session_id = start_res.json()["data"]["session_id"]

    # Simulate CV exercise reps in-memory
    sess = gt.get_session_state(session_id)
    sess.state["counter"] = 5
    sess.session["completed_sets"] = [{
        "set_number": 1,
        "reps": 5,
        "depths": [85.0, 90.0, 92.0, 88.0, 95.0],
        "rep_times": [2.1, 2.0, 1.9, 2.2, 2.0]
    }]

    # Stop workout
    stop_res = client.post(f"/api/v1/sessions/{session_id}/stop", headers=user["headers"])
    assert stop_res.status_code == 200
    stop_data = stop_res.json()
    assert stop_data["success"] is True
    assert stop_data["data"]["total_reps"] == 5
    assert stop_data["data"]["average_form_score"] == 90.0

    # Verify DB persistence of session and ExerciseMetric records
    db = TestingSessionLocal()
    ws = db.query(WorkoutSession).filter(WorkoutSession.id == uuid.UUID(session_id)).first()
    metrics = db.query(ExerciseMetric).filter(ExerciseMetric.session_id == uuid.UUID(session_id)).all()
    db.close()

    assert ws is not None
    assert ws.ended_at is not None
    assert ws.total_reps == 5
    assert ws.average_form_score == 90.0
    assert len(metrics) == 5

    # Verify in-memory session cleaned up
    assert session_id not in gt._sessions


def test_cannot_complete_already_completed_workout():
    user = register_and_get_token("user3@example.com")
    start_res = client.post(
        "/api/v1/sessions/start",
        json={"exercise": "pushup"},
        headers=user["headers"]
    )
    session_id = start_res.json()["data"]["session_id"]

    stop_res1 = client.post(f"/api/v1/sessions/{session_id}/stop", headers=user["headers"])
    assert stop_res1.status_code == 200

    stop_res2 = client.post(f"/api/v1/sessions/{session_id}/stop", headers=user["headers"])
    assert stop_res2.status_code == 400


def test_user_cannot_access_or_stop_another_users_workout():
    user1 = register_and_get_token("u1@example.com")
    user2 = register_and_get_token("u2@example.com")

    start_res = client.post(
        "/api/v1/sessions/start",
        json={"exercise": "deadlift"},
        headers=user1["headers"]
    )
    session_id = start_res.json()["data"]["session_id"]

    # User 2 attempts to stop User 1's workout
    stop_res = client.post(f"/api/v1/sessions/{session_id}/stop", headers=user2["headers"])
    assert stop_res.status_code == 404

    # User 2 attempts to view User 1's workout detail
    detail_res = client.get(f"/api/v1/sessions/{session_id}", headers=user2["headers"])
    assert detail_res.status_code == 404


def test_workout_history_ownership_and_isolation():
    user1 = register_and_get_token("history1@example.com")
    user2 = register_and_get_token("history2@example.com")

    s1 = client.post("/api/v1/sessions/start", json={"exercise": "squat"}, headers=user1["headers"]).json()["data"]["session_id"]
    client.post(f"/api/v1/sessions/{s1}/stop", headers=user1["headers"])

    s2 = client.post("/api/v1/sessions/start", json={"exercise": "pushup"}, headers=user2["headers"]).json()["data"]["session_id"]
    client.post(f"/api/v1/sessions/{s2}/stop", headers=user2["headers"])

    # Fetch User 1 history
    h1_res = client.get("/api/v1/sessions", headers=user1["headers"])
    assert h1_res.status_code == 200
    h1_items = h1_res.json()["data"]["items"]
    assert len(h1_items) == 1
    assert h1_items[0]["id"] == s1

    # Fetch User 2 history
    h2_res = client.get("/api/v1/sessions", headers=user2["headers"])
    assert h2_res.status_code == 200
    h2_items = h2_res.json()["data"]["items"]
    assert len(h2_items) == 1
    assert h2_items[0]["id"] == s2


def test_invalid_exercise_rejected():
    user = register_and_get_token("invalid_ex@example.com")
    res = client.post("/api/v1/sessions/start", json={"exercise": "invalid_exercise_name"}, headers=user["headers"])
    assert res.status_code == 422



def test_multiple_simultaneous_users_and_sessions_isolated():
    user1 = register_and_get_token("multi1@example.com")
    user2 = register_and_get_token("multi2@example.com")

    # Start simultaneous workouts
    s1 = client.post("/api/v1/sessions/start", json={"exercise": "lunge"}, headers=user1["headers"]).json()["data"]["session_id"]
    s2 = client.post("/api/v1/sessions/start", json={"exercise": "bicep_curl"}, headers=user2["headers"]).json()["data"]["session_id"]

    sess1 = gt.get_session_state(s1)
    sess2 = gt.get_session_state(s2)

    sess1.state["counter"] = 8
    sess2.state["counter"] = 15

    assert sess1.state["counter"] == 8
    assert sess2.state["counter"] == 15

    client.post(f"/api/v1/sessions/{s1}/stop", headers=user1["headers"])
    client.post(f"/api/v1/sessions/{s2}/stop", headers=user2["headers"])

    db = TestingSessionLocal()
    ws1 = db.query(WorkoutSession).filter(WorkoutSession.id == uuid.UUID(s1)).first()
    ws2 = db.query(WorkoutSession).filter(WorkoutSession.id == uuid.UUID(s2)).first()
    db.close()

    assert ws1.total_reps == 8
    assert ws2.total_reps == 15
