from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Machine Health Monitoring"
    app_env: str = "development"

    database_path: str = "./data/machine_health.db"

    api_key: str = "replace-with-a-long-random-secret"
    cors_origins: str = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:8000,"
    "http://localhost:8000"
)

    mqtt_enabled: bool = False
    mqtt_host: str = "127.0.0.1"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_topic: str = "factory/motor01/telemetry"
    mqtt_client_id: str = "machine-health-backend"
    mqtt_tls: bool = False

    temperature_warning_c: float = 60.0
    temperature_critical_c: float = 80.0

    gas_raw_warning: int = 2500
    gas_raw_critical: int = 3200

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()