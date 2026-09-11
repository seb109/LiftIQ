import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.workout_session import WorkoutSession


class WorkoutSessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, session: WorkoutSession) -> WorkoutSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_by_id(self, session_id: uuid.UUID) -> Optional[WorkoutSession]:
        return self.db.query(WorkoutSession).filter(WorkoutSession.id == session_id).first()

    def get_by_user_id(self, user_id: uuid.UUID, limit: int = 50) -> List[WorkoutSession]:
        return (
            self.db.query(WorkoutSession)
            .filter(WorkoutSession.user_id == user_id)
            .order_by(WorkoutSession.started_at.desc())
            .limit(limit)
            .all()
        )

    def update(self, session: WorkoutSession) -> WorkoutSession:
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete(self, session_id: uuid.UUID) -> bool:
        session = self.get_by_id(session_id)
        if session:
            self.db.delete(session)
            self.db.commit()
            return True
        return False
