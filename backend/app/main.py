import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import router
from backend.app.core.config import get_settings
from backend.app.services.mqtt_service import MQTTIngestor
from backend.app.storage.database import initialize_database


logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s %(levelname)s "
        "%(name)s: %(message)s"
    ),
)

logger = logging.getLogger(__name__)

settings = get_settings()
mqtt_ingestor = MQTTIngestor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()

    logger.info("Database initialized")

    if settings.mqtt_enabled:
        try:
            mqtt_ingestor.start()

        except Exception:
            logger.exception(
                "MQTT startup failed. "
                "The HTTP API will remain available."
            )

    yield

    mqtt_ingestor.stop()
    logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Industrial machine telemetry, "
        "monitoring and alert management API."
    ),
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=[
        "Content-Type",
        "X-API-Key",
    ],
)


app.include_router(router)


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"


if FRONTEND_DIR.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=FRONTEND_DIR),
        name="static",
    )


@app.get("/", include_in_schema=False)
def dashboard():
    index_file = FRONTEND_DIR / "index.html"

    if index_file.is_file():
        return FileResponse(index_file)

    return {
        "message": "Machine Health API is running",
        "docs": "/docs",
    }


@app.get("/api/v1/health/details")
def health_details():
    return {
        "status": "ok",
        "app": settings.app_name,
        "mqtt_enabled": settings.mqtt_enabled,
        "database": settings.database_path,
    }