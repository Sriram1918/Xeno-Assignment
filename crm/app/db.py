from sqlmodel import SQLModel, Session, create_engine

from .config import settings

# Hosts hand out "postgres://" or "postgresql://"; SQLAlchemy needs an explicit psycopg3
# driver ("postgresql+psycopg://"). Normalise both forms so the URL always loads the v3 driver.
def _normalise(url: str) -> str:
    url = url.strip()  # env values can carry a stray trailing newline; drop it
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


engine = create_engine(_normalise(settings.database_url), pool_pre_ping=True)


def init_db() -> None:
    """Create tables for any imported SQLModel models. Safe to call on startup."""
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
