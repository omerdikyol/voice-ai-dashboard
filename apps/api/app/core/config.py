from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Voice AI Dashboard API"
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/voice_ai_dashboard",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    luron_base_url: str = Field(default="https://luron-backend.onrender.com/api/v1", alias="LURON_BASE_URL")
    luron_api_key: str = Field(default="", alias="LURON_API_KEY")
    luron_call_status_url_template: str = Field(default="", alias="LURON_CALL_STATUS_URL_TEMPLATE")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_embedding_model: str = Field(default="text-embedding-3-small", alias="OPENAI_EMBEDDING_MODEL")
    fx_api_url: str = Field(default="https://api.frankfurter.dev/v1/latest", alias="FX_API_URL")
    weather_api_url: str = Field(default="https://api.open-meteo.com/v1/forecast", alias="WEATHER_API_URL")
    weather_geocode_api_url: str = Field(
        default="https://geocoding-api.open-meteo.com/v1/search",
        alias="WEATHER_GEOCODE_API_URL",
    )
    default_weather_city: str = Field(default="Istanbul", alias="DEFAULT_WEATHER_CITY")
    default_weather_lat: float = Field(default=41.0082, alias="DEFAULT_WEATHER_LAT")
    default_weather_lon: float = Field(default=28.9784, alias="DEFAULT_WEATHER_LON")
    uploads_dir: Path = Path(__file__).resolve().parents[2] / "data" / "uploads"
    default_sync_count: int = 120
    mock_refresh_minutes: int = 5
    fx_cache_minutes: int = 30
    weather_cache_minutes: int = 30
    retrieval_top_k: int = 4
    embedding_dimensions: int = 1536

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
