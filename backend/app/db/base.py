"""SQLAlchemy base configuration."""

from sqlalchemy import DateTime, func
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from datetime import datetime


Base = declarative_base()


class BaseModel(Base):
    """Base model with common fields."""

    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )
