import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, Any
from sqlalchemy import Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.workout_session import WorkoutSession


class AIReport(Base):
    __tablename__ = "ai_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    form_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    strengths: Mapped[Optional[Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    mistakes: Mapped[Optional[Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    improvements: Mapped[Optional[Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    coach_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_session_focus: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_response: Mapped[Optional[Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    session: Mapped["WorkoutSession"] = relationship(
        "WorkoutSession", back_populates="ai_report"
    )
