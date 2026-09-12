from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    """
    Centralized configuration for the AI Service.
    Loads from environment variables automatically.
    """
    cors_origins: str = "*"
    osrm_base_url: str = "http://router.project-osrm.org"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

# Instantiate singleton config
settings = AppSettings()
