from __future__ import annotations

import asyncio
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AppSetting, Call
from app.db.schemas import CallConsoleSettings
from app.services.luron import LuronService
from app.services.settings import SettingsService


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    AppSetting.__table__.create(engine)
    Call.__table__.create(engine)
    return Session(engine)


def test_call_console_settings_round_trip() -> None:
    session = make_session()
    service = SettingsService()

    defaults = service.get_call_console_settings(session)
    assert defaults.voice == "callie"

    updated = service.save_call_console_settings(
        session,
        CallConsoleSettings(
            voice="burcin",
            country_code="+1",
            local_number="5551112222",
            base_prompt="You are a banker with a specific collections task.",
            welcome_message="Hello from Call Bank.",
            inject_knowledge_base=True,
            inject_fx=False,
            inject_weather=True,
            top_k=6,
        ),
    )

    assert updated.voice == "burcin"
    reloaded = service.get_call_console_settings(session)
    assert reloaded.local_number == "5551112222"
    assert reloaded.top_k == 6


def test_luron_refresh_status_gracefully_degrades_when_provider_lookup_is_missing() -> None:
    service = LuronService()

    payload = asyncio.run(service.refresh_call_status("call_123"))

    assert payload["provider_status_available"] is False
    assert payload["status"] == "status_unavailable"
    assert "LURON_CALL_STATUS_URL_TEMPLATE" in payload["detail"]


def test_luron_refresh_status_uses_configured_status_endpoint(monkeypatch) -> None:
    class FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"status": "ringing", "message": "Call is currently ringing."}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            self.last_url: str | None = None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def get(self, url: str, headers: dict[str, str] | None = None) -> FakeResponse:
            self.last_url = url
            return FakeResponse()

    monkeypatch.setattr(settings, "luron_call_status_url_template", "https://provider.test/calls/{call_id}")
    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    service = LuronService()
    payload = asyncio.run(service.refresh_call_status("call_123"))

    assert payload["provider_status_available"] is True
    assert payload["status"] == "in_progress"
    assert payload["detail"] == "Call is currently ringing."
