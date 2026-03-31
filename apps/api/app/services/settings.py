from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import AppSetting
from app.db.schemas import CallConsoleSettings, CallConsoleSettingsResponse


CALL_CONSOLE_SETTINGS_KEY = "call_console_defaults"


class SettingsService:
    def get_call_console_settings(self, db: Session) -> CallConsoleSettingsResponse:
        setting = db.get(AppSetting, CALL_CONSOLE_SETTINGS_KEY)
        payload = setting.value if setting else CallConsoleSettings().model_dump()
        updated_at = setting.updated_at if setting else None
        return CallConsoleSettingsResponse(**payload, updated_at=updated_at)

    def save_call_console_settings(
        self,
        db: Session,
        payload: CallConsoleSettings,
    ) -> CallConsoleSettingsResponse:
        setting = db.get(AppSetting, CALL_CONSOLE_SETTINGS_KEY)
        if setting is None:
            setting = AppSetting(key=CALL_CONSOLE_SETTINGS_KEY, value=payload.model_dump())
            db.add(setting)
        else:
            setting.value = payload.model_dump()
        db.commit()
        db.refresh(setting)
        return CallConsoleSettingsResponse(**setting.value, updated_at=setting.updated_at)
