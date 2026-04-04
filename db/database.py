import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./grader.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

Base = declarative_base()


def init_db() -> None:
    from db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def ensure_runtime_dirs() -> None:
    upload_dir = Path(os.getenv("UPLOAD_DIR", "data/uploads"))
    export_dir = Path(os.getenv("EXPORT_DIR", "data/exports"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)

# Auto-initialize
init_db()
ensure_runtime_dirs()

# Log application startup
with open("restart_log.txt", "a") as f:
    from datetime import datetime
    f.write(f"App started/restarted at {datetime.now().isoformat()}\n")

@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    except BaseException as e:
        if type(e).__name__ in ("RerunException", "StopException"):
            session.commit()
        else:
            session.rollback()
        raise
    finally:
        session.close()
