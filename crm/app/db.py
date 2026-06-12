from sqlmodel import SQLModel, Session, create_engine

from .config import settings

# Railway hands out URLs starting with "postgresql://"; SQLModel/psycopg3 wants the
# "+psycopg" driver suffix. Normalise so either form works.
_url = settings.database_url
if _url.startswith("postgresql://"):
    _url = _url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(_url, pool_pre_ping=True)


def init_db() -> None:
    """Create tables for any imported SQLModel models. Safe to call on startup."""
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
