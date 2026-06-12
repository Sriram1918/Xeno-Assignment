from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables (.env locally)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres connection string (Railway provides DATABASE_URL).
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/tacotown"

    # Public base URL of the channel stub service, e.g. https://channel-xxxx.up.railway.app
    channel_service_url: str = "http://localhost:8100"

    # Public base URL of THIS crm service, so the channel can call our receipt API back.
    crm_public_url: str = "http://localhost:8000"

    # Anthropic API key for the AI agent (added when we build the agent).
    anthropic_api_key: str = ""

    environment: str = "local"


settings = Settings()
