
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "DataMind - AI Data Scientist"
    app_env: str = "development"

    gemini_api_key: str
    gemini_model: str = "gemini-3.8-flash"

    max_upload_mb: int = 20
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
