import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL
engine_kwargs = {}

if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

try:
    engine = create_engine(db_url, **engine_kwargs)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
except Exception as err:
    if not db_url.startswith("sqlite"):
        logger.warning(f"PostgreSQL connection unavailable ({err}). Falling back to local SQLite database.")
        db_url = "sqlite:///./liftiq_dev.db"
        engine_kwargs = {"connect_args": {"check_same_thread": False}}
        engine = create_engine(db_url, **engine_kwargs)
    else:
        raise err

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

