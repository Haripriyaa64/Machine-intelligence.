from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.core.security import require_api_key
from backend.app.schemas.telemetry import TelemetryIn
from backend.app.services.ingestion import ingest_telemetry
from backend.app.storage.database import (
    acknowledge_alert,
    get_stats,
    list_alerts,
    list_telemetry,
)


router = APIRouter(prefix="/api/v1")


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "machine-health-api",
    }


@router.post(
    "/telemetry",
    dependencies=[Depends(require_api_key)],
)
def create_telemetry(item: TelemetryIn):
    return ingest_telemetry(item)


@router.get("/telemetry/latest")
def latest_telemetry(
    machine_id: str | None = None,
):
    rows = list_telemetry(
        machine_id=machine_id,
        limit=1,
    )

    return rows[0] if rows else None


@router.get("/telemetry")
def telemetry_history(
    machine_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
):
    return list_telemetry(
        machine_id=machine_id,
        limit=limit,
    )


@router.get("/alerts")
def alerts(
    limit: int = Query(default=100, ge=1, le=1000),
    unacknowledged_only: bool = False,
):
    return list_alerts(
        limit=limit,
        unacknowledged_only=unacknowledged_only,
    )


@router.post(
    "/alerts/{alert_id}/acknowledge",
    dependencies=[Depends(require_api_key)],
)
def acknowledge(alert_id: int):
    updated = acknowledge_alert(alert_id)

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Alert not found",
        )

    return {
        "status": "acknowledged",
        "alert_id": alert_id,
    }


@router.get("/stats")
def stats():
    return get_stats()