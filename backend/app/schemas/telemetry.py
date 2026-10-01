from datetime import datetime, timezone

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class TelemetryIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    machine_id: str = Field(
        default="MOTOR_01",
        min_length=1,
        max_length=64,
    )

    temperature_c: float | None = Field(
        default=None,
        ge=-40,
        le=200,
    )

    humidity_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    vibration_event: int | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    gas_raw: int | None = Field(
        default=None,
        ge=0,
        le=65535,
    )

    timestamp_ms: int | None = Field(
        default=None,
        ge=0,
    )

    timestamp: datetime | None = None

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)

        return value

    def timestamp_iso(self) -> str:
        if self.timestamp is not None:
            return self.timestamp.astimezone(
                timezone.utc
            ).isoformat()

        if self.timestamp_ms is not None:
            return datetime.fromtimestamp(
                self.timestamp_ms / 1000,
                tz=timezone.utc,
            ).isoformat()

        return datetime.now(timezone.utc).isoformat()