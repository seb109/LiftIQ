import logging
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

_db_url = settings.DATABASE_URL
_app_env = os.getenv("APP_ENV", "")
_engine_kwargs: dict = {}

if _db_url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_pre_ping"] = True

try:
    engine = create_engine(_db_url, **_engine_kwargs)
    with engine.connect() as _conn:
        _conn.execute(text("SELECT 1"))
    _log_url = _db_url.split("@")[-1] if "@" in _db_url else _db_url
    logger.info("Database connection established: %s", _log_url)
except Exception as _err:
    if not _db_url.startswith("sqlite") and _app_env != "docker":
        # Non-Docker local dev: fall back to SQLite so the server starts
        # without a running PostgreSQL instance.
        logger.warning(
            "PostgreSQL unavailable (%s). Falling back to SQLite for local dev.", _err
        )
        _db_url = "sqlite:///./liftiq_dev.db"
        _engine_kwargs = {"connect_args": {"check_same_thread": False}}
        engine = create_engine(_db_url, **_engine_kwargs)
    else:
        # Inside Docker (APP_ENV=docker): PostgreSQL must be healthy before
        # the backend starts. Any connection failure is a hard error.
        logger.error(
            "Database connection failed (APP_ENV=%s). Check compose healthcheck: %s",
            _app_env, _err,
        )
        raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
