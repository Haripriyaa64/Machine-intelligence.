import sqlite3
from contextlib import contextmanager
from pathlib import Path

from backend.app.core.config import get_settings


SCHEMA = """
CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    temperature_c REAL,
    humidity_percent REAL,
    vibration_event INTEGER,
    gas_raw INTEGER,
    recorded_at TEXT NOT NULL,
    status TEXT NOT NULL,
    alert_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time
ON telemetry(machine_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    telemetry_id INTEGER,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (telemetry_id) REFERENCES telemetry(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_time
ON alerts(recorded_at DESC);
"""


def db_path() -> Path:
    path = Path(
        get_settings().database_path
    ).expanduser()

    if not path.is_absolute():
        path = Path.cwd() / path

    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connection():
    conn = sqlite3.connect(
        db_path(),
        timeout=10,
    )

    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")

    try:
        yield conn
        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


def initialize_database():
    with connection() as conn:
        conn.executescript(SCHEMA)


def insert_telemetry(
    payload: dict,
    recorded_at: str,
    status: str,
    message: str | None,
) -> dict:
    with connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO telemetry (
                machine_id,
                temperature_c,
                humidity_percent,
                vibration_event,
                gas_raw,
                recorded_at,
                status,
                alert_message
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["machine_id"],
                payload.get("temperature_c"),
                payload.get("humidity_percent"),
                payload.get("vibration_event"),
                payload.get("gas_raw"),
                recorded_at,
                status,
                message,
            ),
        )

        reading_id = cursor.lastrowid

        if message:
            severity = (
                "critical"
                if status == "CRITICAL"
                else "warning"
            )

            conn.execute(
                """
                INSERT INTO alerts (
                    machine_id,
                    recorded_at,
                    severity,
                    message,
                    telemetry_id
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    payload["machine_id"],
                    recorded_at,
                    severity,
                    message,
                    reading_id,
                ),
            )

        row = conn.execute(
            "SELECT * FROM telemetry WHERE id = ?",
            (reading_id,),
        ).fetchone()

        return dict(row)


def list_telemetry(
    machine_id: str | None = None,
    limit: int = 100,
) -> list[dict]:
    with connection() as conn:
        if machine_id:
            rows = conn.execute(
                """
                SELECT * FROM telemetry
                WHERE machine_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (machine_id, limit),
            ).fetchall()

        else:
            rows = conn.execute(
                """
                SELECT * FROM telemetry
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [dict(row) for row in rows]


def list_alerts(
    limit: int = 100,
    unacknowledged_only: bool = False,
) -> list[dict]:
    query = "SELECT * FROM alerts"

    if unacknowledged_only:
        query += " WHERE acknowledged = 0"

    query += " ORDER BY id DESC LIMIT ?"

    with connection() as conn:
        rows = conn.execute(
            query,
            (limit,),
        ).fetchall()

        return [dict(row) for row in rows]


def acknowledge_alert(alert_id: int) -> bool:
    with connection() as conn:
        cursor = conn.execute(
            """
            UPDATE alerts
            SET acknowledged = 1
            WHERE id = ?
            """,
            (alert_id,),
        )

        return cursor.rowcount > 0


def get_stats() -> dict:
    with connection() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM telemetry"
        ).fetchone()["n"]

        active = conn.execute(
            """
            SELECT COUNT(*) AS n
            FROM alerts
            WHERE acknowledged = 0
            """
        ).fetchone()["n"]

        latest = conn.execute(
            """
            SELECT * FROM telemetry
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()

        return {
            "total_readings": total,
            "active_alerts": active,
            "latest": dict(latest) if latest else None,
        }