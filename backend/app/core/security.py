import hmac

from fastapi import Header, HTTPException

from backend.app.core.config import get_settings


async def require_api_key(
    x_api_key: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    expected_key = settings.api_key

    if (
        not expected_key
        or expected_key == "replace-with-a-long-random-secret"
    ):
        raise HTTPException(
            status_code=503,
            detail="Configure a unique API_KEY in the .env file.",
        )

    if x_api_key is None or not hmac.compare_digest(
        x_api_key, expected_key
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key.",
        )