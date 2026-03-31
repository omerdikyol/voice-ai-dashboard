from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class LuronService:
    async def fetch_mock_calls(self, count: int) -> dict[str, Any]:
        headers = {"x-api-key": settings.luron_api_key}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{settings.luron_base_url}/mock-calls",
                params={"count": count},
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def make_call(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "x-api-key": settings.luron_api_key,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.luron_base_url}/make-call",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def refresh_call_status(self, external_call_id: str | None) -> dict[str, Any]:
        return {
            "provider_status_available": False,
            "status": None,
            "detail": (
                "Luron does not expose a documented status lookup endpoint in the provided brief, "
                "so live refresh is unavailable for this call."
                if external_call_id
                else "The provider did not return a call identifier, so live refresh is unavailable for this call."
            ),
        }
