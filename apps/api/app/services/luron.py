from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


STATUS_ALIASES = {
    "submitted": "submitted",
    "queued": "submitted",
    "requested": "submitted",
    "pending": "submitted",
    "created": "submitted",
    "accepted": "accepted",
    "acknowledged": "accepted",
    "approved": "accepted",
    "dialing": "in_progress",
    "ringing": "in_progress",
    "connecting": "in_progress",
    "processing": "in_progress",
    "started": "in_progress",
    "active": "in_progress",
    "ongoing": "in_progress",
    "in_progress": "in_progress",
    "running": "in_progress",
    "completed": "completed",
    "complete": "completed",
    "succeeded": "completed",
    "success": "completed",
    "finished": "completed",
    "done": "completed",
    "failed": "failed",
    "error": "failed",
    "cancelled": "failed",
    "canceled": "failed",
    "rejected": "failed",
    "declined": "failed",
    "busy": "failed",
    "no_answer": "failed",
    "voicemail": "failed",
    "unavailable": "status_unavailable",
    "status_unavailable": "status_unavailable",
}


class LuronService:
    def can_refresh_status(self) -> bool:
        return bool(settings.luron_call_status_url_template)

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
        if not external_call_id:
            return {
                "provider_status_available": False,
                "status": "status_unavailable",
                "detail": "The provider did not return a call identifier, so live refresh is unavailable for this call.",
            }

        if not settings.luron_call_status_url_template:
            return {
                "provider_status_available": False,
                "status": "status_unavailable",
                "detail": (
                    "No provider status URL template is configured. Set LURON_CALL_STATUS_URL_TEMPLATE to enable "
                    "live manual-call refresh."
                ),
            }

        url = settings.luron_call_status_url_template.format(
            call_id=external_call_id,
            external_call_id=external_call_id,
        )
        headers = {"x-api-key": settings.luron_api_key}

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(url, headers=headers)
                if response.status_code in {404, 405, 501}:
                    return {
                        "provider_status_available": False,
                        "status": "status_unavailable",
                        "detail": (
                            f"The configured provider status lookup returned {response.status_code}, "
                            "so live refresh is unavailable for this call."
                        ),
                    }
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                return {
                    "provider_status_available": True,
                    "status": None,
                    "detail": f"Provider status lookup failed with HTTP {exc.response.status_code}.",
                }
            except httpx.HTTPError as exc:
                return {
                    "provider_status_available": True,
                    "status": None,
                    "detail": f"Provider status lookup failed: {exc}",
                }

        payload = response.json()
        return {
            "provider_status_available": True,
            "status": self.derive_status(payload, success_fallback="accepted"),
            "detail": self.derive_detail(payload, "Provider status refreshed."),
            "provider_payload": payload,
        }

    def extract_external_call_id(self, payload: dict[str, Any]) -> str | None:
        for key in ("call_id", "id", "callId", "external_call_id"):
            value = payload.get(key)
            if value:
                return str(value)
        nested = payload.get("data")
        if isinstance(nested, dict):
            return self.extract_external_call_id(nested)
        return None

    def derive_status(self, payload: dict[str, Any], success_fallback: str = "accepted") -> str:
        for candidate in self._status_candidates(payload):
            normalized = self._normalize_status(candidate)
            if normalized:
                return normalized
        if payload.get("success") is False:
            return "failed"
        if payload.get("success") is True:
            return success_fallback
        return success_fallback

    def derive_detail(self, payload: dict[str, Any], fallback: str) -> str:
        for key in ("detail", "message", "description", "reason"):
            value = payload.get(key)
            if value:
                return str(value)
        nested = payload.get("data")
        if isinstance(nested, dict):
            return self.derive_detail(nested, fallback)
        return fallback

    def _status_candidates(self, payload: dict[str, Any]) -> list[str]:
        candidates: list[str] = []
        for key in ("status", "call_status", "state", "result"):
            value = payload.get(key)
            if isinstance(value, str):
                candidates.append(value)
        nested = payload.get("data")
        if isinstance(nested, dict):
            candidates.extend(self._status_candidates(nested))
        return candidates

    def _normalize_status(self, value: str) -> str | None:
        normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
        return STATUS_ALIASES.get(normalized)
