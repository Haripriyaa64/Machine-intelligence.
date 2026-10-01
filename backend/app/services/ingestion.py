from backend.app.schemas.telemetry import TelemetryIn
from backend.app.services.assessment import assess_reading
from backend.app.storage.database import insert_telemetry


def ingest_telemetry(item: TelemetryIn) -> dict:
    payload = item.model_dump()

    status, message = assess_reading(payload)

    return insert_telemetry(
        payload=payload,
        recorded_at=item.timestamp_iso(),
        status=status,
        message=message,
    )