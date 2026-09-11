import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, token: RefreshToken) -> RefreshToken:
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_by_user_id(self, user_id: uuid.UUID) -> List[RefreshToken]:
        return (
            self.db.query(RefreshToken)
            .filter(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
            .all()
        )

    def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        return (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token_hash == token_hash)
            .first()
        )

    def revoke(self, token_id: uuid.UUID) -> bool:
        token = self.db.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        if token:
            token.revoked = True
            self.db.commit()
            return True
        return False

    def revoke_by_hash(self, token_hash: str) -> bool:
        token = self.get_by_hash(token_hash)
        if token and not token.revoked:
            token.revoked = True
            self.db.commit()
            return True
        return False

