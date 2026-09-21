import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.db.session import get_db
from app.models import Base, User, RefreshToken, WorkoutSession, ExerciseMetric, AIReport
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
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
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    db = TestingSessionLocal()
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    db.close()




def test_successful_registration():
    payload = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "SecurePassword123!",
        "accept_terms": True
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["user"]["email"] == "test@example.com"
    assert data["data"]["user"]["name"] == "Test User"
    assert "password" not in data["data"]["user"]
    assert "hashed_password" not in data["data"]["user"]


def test_registration_records_terms_acceptance_time():
    before = datetime.now(timezone.utc)
    res = client.post("/api/v1/auth/register", json={
        "name": "Terms User",
        "email": "terms@example.com",
        "password": "SecurePassword123!",
        "accept_terms": True,
    })
    assert res.status_code == 201

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "terms@example.com").first()
    db.close()
    assert user is not None
    accepted = user.terms_accepted_at
    assert accepted is not None
    if accepted.tzinfo is None:  # SQLite drops tzinfo; Postgres keeps it
        accepted = accepted.replace(tzinfo=timezone.utc)
    assert before - timedelta(seconds=1) <= accepted <= datetime.now(timezone.utc) + timedelta(seconds=1)


@pytest.mark.parametrize("extra", [{}, {"accept_terms": False}])
def test_registration_requires_terms_acceptance(extra):
    payload = {
        "name": "No Terms",
        "email": "noterms@example.com",
        "password": "SecurePassword123!",
        **extra,
    }
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 422

    db = TestingSessionLocal()
    created = db.query(User).filter(User.email == "noterms@example.com").first()
    db.close()
    assert created is None


def test_duplicate_email_rejection():
    payload = {
        "name": "User One",
        "email": "duplicate@example.com",
        "password": "SecurePassword123!",
        "accept_terms": True
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409


def test_password_is_hashed_and_never_stored_plaintext():
    payload = {
        "name": "Hash User",
        "email": "hash@example.com",
        "password": "MySecretPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=payload)

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "hash@example.com").first()
    db.close()

    assert user is not None
    assert user.password_hash != "MySecretPassword123!"
    assert verify_password("MySecretPassword123!", user.password_hash) is True


def test_successful_login():
    reg_payload = {
        "email": "login@example.com",
        "password": "LoginPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "login@example.com",
        "password": "LoginPassword123!",
        "accept_terms": True
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["token_type"] == "bearer"


def test_invalid_password_rejection():
    reg_payload = {
        "email": "wrongpwd@example.com",
        "password": "LoginPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "wrongpwd@example.com",
        "password": "WrongPassword123!",
        "accept_terms": True
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 401


def test_access_jwt_claims():
    reg_payload = {
        "email": "jwt@example.com",
        "password": "JwtPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    res = client.post("/api/v1/auth/login", json=reg_payload)
    access_token = res.json()["data"]["access_token"]

    payload = decode_access_token(access_token)
    assert "sub" in payload
    assert payload["type"] == "access"
    assert "exp" in payload


def test_protected_dependency_valid_token():
    reg_payload = {
        "name": "Protected User",
        "email": "protected@example.com",
        "password": "ProtectedPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    res = client.post("/api/v1/auth/login", json=reg_payload)
    access_token = res.json()["data"]["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = client.get("/api/v1/users/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["success"] is True
    assert me_data["data"]["email"] == "protected@example.com"
    assert me_data["data"]["name"] == "Protected User"


def test_invalid_access_token_rejected():
    headers = {"Authorization": "Bearer invalid.token.value"}
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 401


def test_expired_access_token_rejected():
    reg_payload = {
        "email": "expired@example.com",
        "password": "ExpiredPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "expired@example.com").first()
    db.close()

    expired_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(seconds=-10)
    )

    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 401


def test_refresh_token_rotation_and_invalidation():
    reg_payload = {
        "email": "refresh@example.com",
        "password": "RefreshPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    orig_refresh = login_res.json()["data"]["refresh_token"]

    # 1. Use refresh token to get new token
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": orig_refresh})
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    new_access = ref_data["data"]["access_token"]
    new_refresh = ref_data["data"]["refresh_token"]

    assert new_refresh != orig_refresh
    assert new_access is not None

    # Verify old refresh token is revoked in DB
    db = TestingSessionLocal()
    old_hash = hash_refresh_token(orig_refresh)
    old_record = db.query(RefreshToken).filter(RefreshToken.token_hash == old_hash).first()
    db.close()
    assert old_record is not None
    assert old_record.revoked is True

    # 2. Trying to reuse old refresh token must be rejected
    reuse_res = client.post("/api/v1/auth/refresh", json={"refresh_token": orig_refresh})
    assert reuse_res.status_code == 401


def test_revoked_refresh_token_rejected():
    reg_payload = {
        "email": "revoked@example.com",
        "password": "RevokedPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    refresh_token = login_res.json()["data"]["refresh_token"]

    # Manually revoke in DB
    db = TestingSessionLocal()
    tf_hash = hash_refresh_token(refresh_token)
    rf_record = db.query(RefreshToken).filter(RefreshToken.token_hash == tf_hash).first()
    rf_record.revoked = True
    db.commit()
    db.close()

    res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 401


def test_logout_revokes_refresh_token():
    reg_payload = {
        "email": "logout@example.com",
        "password": "LogoutPassword123!",
        "accept_terms": True
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    refresh_token = login_res.json()["data"]["refresh_token"]

    logout_res = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True

    # Attempting to refresh after logout should fail
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 401
