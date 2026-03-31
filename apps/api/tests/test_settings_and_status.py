from __future__ import annotations

import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

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
    assert payload["status"] is None
    assert "status lookup endpoint" in payload["detail"]
