from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import IntegrationSnapshot


WEATHER_LABELS = {
    0: "clear skies",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "foggy",
    48: "depositing rime fog",
    51: "light drizzle",
    61: "light rain",
    63: "moderate rain",
    71: "light snow",
    80: "rain showers",
    95: "thunderstorm",
}


class IntegrationService:
    async def get_fx_snapshot(self, db: Session) -> IntegrationSnapshot:
        cached = self._get_cached_snapshot(db, "fx_rates", "try_usd_eur_gbp", settings.fx_cache_minutes)
        if cached:
            return cached

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                settings.fx_api_url,
                params={"base": "TRY", "symbols": "USD,EUR,GBP"},
            )
            response.raise_for_status()
            payload = response.json()

        rates = payload.get("rates", {})
        summary = (
            "FX context for the call: "
            f"1 TRY equals {rates.get('USD', 'n/a')} USD, "
            f"{rates.get('EUR', 'n/a')} EUR, and {rates.get('GBP', 'n/a')} GBP."
        )

        snapshot = IntegrationSnapshot(
            provider="fx_rates",
            snapshot_key="try_usd_eur_gbp",
            summary=summary,
            payload_json=payload,
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    async def get_weather_snapshot(self, db: Session, city: str | None = None) -> IntegrationSnapshot:
        requested_city = city or settings.default_weather_city
        cached = self._get_cached_snapshot(db, "weather", requested_city.lower(), settings.weather_cache_minutes)
        if cached:
            return cached

        coords = await self._resolve_coordinates(requested_city)

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                settings.weather_api_url,
                params={
                    "latitude": coords["lat"],
                    "longitude": coords["lon"],
                    "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
                    "timezone": "auto",
                },
            )
            response.raise_for_status()
            payload = response.json()

        current = payload.get("current", {})
        weather_code = current.get("weather_code")
        summary = (
            f"Weather context for {coords['city']}: "
            f"{current.get('temperature_2m', 'n/a')}C, feels like {current.get('apparent_temperature', 'n/a')}C, "
            f"{WEATHER_LABELS.get(weather_code, 'mixed conditions')}, "
            f"wind {current.get('wind_speed_10m', 'n/a')} km/h."
        )

        snapshot = IntegrationSnapshot(
            provider="weather",
            snapshot_key=coords["city"].lower(),
            summary=summary,
            payload_json={"city": coords["city"], **payload},
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    def status(self, db: Session) -> list[dict[str, Any]]:
        providers = []
        for provider, detail in (
            ("fx_rates", "TRY benchmark exchange rates"),
            ("weather", f"Current weather for {settings.default_weather_city}"),
        ):
            snapshot = db.execute(
                select(IntegrationSnapshot)
                .where(IntegrationSnapshot.provider == provider)
                .order_by(desc(IntegrationSnapshot.fetched_at))
                .limit(1)
            ).scalar_one_or_none()
            providers.append(
                {
                    "provider": provider,
                    "healthy": True,
                    "cached_at": snapshot.fetched_at if snapshot else None,
                    "detail": detail,
                }
            )
        return providers

    def _get_cached_snapshot(
        self,
        db: Session,
        provider: str,
        snapshot_key: str,
        freshness_minutes: int,
    ) -> IntegrationSnapshot | None:
        snapshot = db.execute(
            select(IntegrationSnapshot)
            .where(
                IntegrationSnapshot.provider == provider,
                IntegrationSnapshot.snapshot_key == snapshot_key,
            )
            .order_by(desc(IntegrationSnapshot.fetched_at))
            .limit(1)
        ).scalar_one_or_none()
        if snapshot is None:
            return None
        if snapshot.fetched_at >= datetime.now(timezone.utc) - timedelta(minutes=freshness_minutes):
            return snapshot
        return None

    async def _resolve_coordinates(self, city: str) -> dict[str, Any]:
        if city.lower() == settings.default_weather_city.lower():
            return {"city": settings.default_weather_city, "lat": settings.default_weather_lat, "lon": settings.default_weather_lon}

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                settings.weather_geocode_api_url,
                params={"name": city, "count": 1, "language": "en", "format": "json"},
            )
            response.raise_for_status()
            payload = response.json()

        results = payload.get("results") or []
        if not results:
            return {"city": settings.default_weather_city, "lat": settings.default_weather_lat, "lon": settings.default_weather_lon}

        first = results[0]
        return {"city": first["name"], "lat": first["latitude"], "lon": first["longitude"]}
