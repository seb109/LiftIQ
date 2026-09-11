import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.workout_session import WorkoutSession


class ExerciseMetric(Base):
    __tablename__ = "exercise_metrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    rep_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stage: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    form_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    left_knee_angle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    right_knee_angle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    left_elbow_angle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    right_elbow_angle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    left_shoulder_angle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    right_shoulder_angle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    correction_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    session: Mapped["WorkoutSession"] = relationship(
        "WorkoutSession", back_populates="exercise_metrics"
    )
