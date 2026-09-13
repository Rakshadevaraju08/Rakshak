from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    """
    Centralized configuration for the AI Service.
    Loads from environment variables automatically.
    """
    cors_origins: str = (
        "http://localhost:3000,http://localhost:3006,http://localhost:3007,"
        "http://127.0.0.1:3000,http://127.0.0.1:3006,http://127.0.0.1:3007"
    )
    osrm_base_url: str = "http://router.project-osrm.org"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

# Instantiate singleton config
settings = AppSettings()
