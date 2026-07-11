"""Database dependencies for FastAPI."""

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db


async def get_session(db: Session = Depends(get_db)) -> Session:
    """Get database session dependency.

    Args:
        db: Database session.

    Returns:
        Database session.
    """
    return db
