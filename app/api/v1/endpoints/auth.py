import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    APIResponse,
    RefreshTokenRequest,
    UserLoginRequest,
    UserRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    user_repo = UserRepository(db)
    normalized_email = req.email.strip().lower()

    if user_repo.get_by_email(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists."
        )

    display_name = req.name or req.full_name or normalized_email.split("@")[0]
    hashed_pw = hash_password(req.password)

    user = User(
        id=uuid.uuid4(),
        name=display_name,
        email=normalized_email,
        password_hash=hashed_pw,
        is_active=True,
        is_verified=False
    )
    created_user = user_repo.create(user)

    return APIResponse(
        success=True,
        message="Registration successful.",
        data={
            "user": {
                "id": str(created_user.id),
                "name": created_user.name,
                "email": created_user.email
            }
        }
    )


@router.post("/login", status_code=status.HTTP_200_OK)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticate user credentials and issue access + refresh tokens."""
    user_repo = UserRepository(db)
    refresh_repo = RefreshTokenRepository(db)

    normalized_email = req.email.strip().lower()
    user = user_repo.get_by_email(normalized_email)

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive."
        )

    access_token = create_access_token(subject=user.id)
    raw_refresh = generate_refresh_token()
    rf_hash = hash_refresh_token(raw_refresh)

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh_entity = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=rf_hash,
        expires_at=expires_at,
        revoked=False
    )
    refresh_repo.create(refresh_entity)

    user.last_login = datetime.now(timezone.utc)
    user_repo.update(user)

    return APIResponse(
        success=True,
        data={
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": str(user.id),
                "name": user.name,
                "email": user.email
            }
        }
    )


@router.post("/refresh", status_code=status.HTTP_200_OK)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Rotate refresh token and issue new access token."""
    refresh_repo = RefreshTokenRepository(db)
    user_repo = UserRepository(db)

    raw_input = req.refresh_token.strip()
    input_hash = hash_refresh_token(raw_input)

    stored_token = refresh_repo.get_by_hash(input_hash)
    now = datetime.now(timezone.utc)

    if not stored_token or stored_token.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token."
        )

    expires_at = stored_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token."
        )

    user = user_repo.get_by_id(stored_token.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token is inactive or deleted."
        )

    # 1. Revoke old refresh token (Rotation)
    refresh_repo.revoke(stored_token.id)

    # 2. Issue new refresh token
    new_raw = generate_refresh_token()
    new_hash = hash_refresh_token(new_raw)
    new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_refresh = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=new_hash,
        expires_at=new_expires_at,
        revoked=False
    )
    refresh_repo.create(new_refresh)

    # 3. Issue new access token
    new_access = create_access_token(subject=user.id)

    return APIResponse(
        success=True,
        data={
            "access_token": new_access,
            "refresh_token": new_raw,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Revoke refresh token on user logout."""
    refresh_repo = RefreshTokenRepository(db)
    raw_input = req.refresh_token.strip()
    input_hash = hash_refresh_token(raw_input)

    refresh_repo.revoke_by_hash(input_hash)

    return APIResponse(
        success=True,
        message="Logout successful."
    )
