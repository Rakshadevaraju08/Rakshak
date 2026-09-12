from pydantic_settings import BaseSettings

class RedisSettings(BaseSettings):
    """
    Configuration placeholder for future Redis integration.
    Variables can be populated from environment variables (e.g. REDIS_URL=redis://localhost:6379).
    """
    redis_url: str = "redis://localhost:6379"
    events_channel: str = "disaster_events"
    pubsub_enabled: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Instantiate singleton config
redis_config = RedisSettings()
