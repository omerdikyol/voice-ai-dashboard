from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AppSetting, Call
from app.services.luron import LuronService


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def format_duration(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    minutes, remainder = divmod(seconds, 60)
    return f"{minutes}m {remainder}s"


class AnalyticsService:
    def __init__(self) -> None:
        self.luron_service = LuronService()

    async def sync_mock_calls(self, db: Session, force: bool = False, count: int | None = None) -> datetime | None:
        state = db.get(AppSetting, "mock_sync_state")
        now = datetime.now(timezone.utc)
        if state and not force:
            last_synced_at = parse_iso(state.value.get("last_synced_at"))
            if last_synced_at and last_synced_at >= now - timedelta(minutes=settings.mock_refresh_minutes):
                return last_synced_at

        payload = await self.luron_service.fetch_mock_calls(count or settings.default_sync_count)
        for item in payload.get("calls", []):
            existing = db.execute(select(Call).where(Call.external_call_id == item["id"])).scalar_one_or_none()
            record = existing or Call(
                external_call_id=item["id"],
                source="mock",
                status=item["status"],
            )
            record.contact_name = item.get("contact_name")
            record.phone_number = item.get("phone_number")
            record.direction = item.get("direction")
            record.status = item.get("status", "failed")
            record.started_at = parse_iso(item.get("started_at"))
            record.ended_at = parse_iso(item.get("ended_at"))
            record.duration_seconds = item.get("duration_seconds")
            record.duration_display = item.get("duration_display") or format_duration(item.get("duration_seconds"))
            record.sentiment = item.get("sentiment")
            record.sentiment_score = item.get("sentiment_score")
            record.topic = item.get("topic")
            record.outcome = item.get("outcome")
            record.agent_name = item.get("agent_name")
            record.voice_used = item.get("voice_used")
            record.transcript_preview = item.get("transcript_preview")
            record.recording_url = item.get("recording_url")
            record.tags = item.get("tags", [])
            record.cost_credits = item.get("cost_credits")
            record.provider_response = item
            if existing is None:
                db.add(record)

        synced_at = parse_iso(payload.get("generated_at")) or now
        if state is None:
            state = AppSetting(key="mock_sync_state", value={"last_synced_at": synced_at.isoformat()})
            db.add(state)
        else:
            state.value = {"last_synced_at": synced_at.isoformat()}
        db.commit()
        return synced_at

    def get_filtered_calls(
        self,
        db: Session,
        days: int = 30,
        status: str | None = None,
        voice: str | None = None,
        direction: str | None = None,
        sentiment: str | None = None,
        topic: str | None = None,
        tag: str | None = None,
        source: str | None = None,
        limit: int | None = None,
    ) -> list[Call]:
        stmt = select(Call)
        if status:
            stmt = stmt.where(Call.status == status)
        if voice:
            stmt = stmt.where(Call.voice_used == voice)
        if direction:
            stmt = stmt.where(Call.direction == direction)
        if sentiment:
            stmt = stmt.where(Call.sentiment == sentiment)
        if topic:
            stmt = stmt.where(Call.topic == topic)
        if source:
            stmt = stmt.where(Call.source == source)

        calls = list(db.execute(stmt.order_by(desc(Call.started_at), desc(Call.created_at))).scalars())
        if days:
            floor = datetime.now(timezone.utc) - timedelta(days=days)
            calls = [call for call in calls if (call.started_at or call.created_at) >= floor]
        if tag:
            calls = [call for call in calls if tag in (call.tags or [])]
        if limit:
            calls = calls[:limit]
        return calls

    def build_summary(self, calls: list[Call], synced_at: datetime | None) -> dict:
        by_status = Counter(call.status for call in calls if call.status)
        by_sentiment = Counter(call.sentiment for call in calls if call.sentiment)
        by_direction = Counter(call.direction for call in calls if call.direction)
        total_duration = sum(call.duration_seconds or 0 for call in calls)
        completed = by_status.get("completed", 0)
        completion_rate = round((completed / len(calls)) * 100, 1) if calls else 0.0

        cards = [
            {"label": "Total calls", "value": len(calls), "tone": "default"},
            {"label": "Completion rate", "value": f"{completion_rate}%", "tone": "success"},
            {
                "label": "Average duration",
                "value": format_duration(int(total_duration / len(calls))) if calls else "0m 0s",
                "tone": "default",
            },
            {"label": "Total cost", "value": round(sum(call.cost_credits or 0 for call in calls), 2), "tone": "default"},
            {
                "label": "Outbound share",
                "value": f"{round((by_direction.get('outbound', 0) / len(calls)) * 100, 1) if calls else 0}%",
                "tone": "default",
            },
        ]

        filters = {
            "statuses": sorted(by_status.keys()),
            "voices": sorted({call.voice_used for call in calls if call.voice_used}),
            "directions": sorted(by_direction.keys()),
            "sentiments": sorted(by_sentiment.keys()),
            "topics": sorted({call.topic for call in calls if call.topic}),
            "tags": sorted({tag for call in calls for tag in (call.tags or [])}),
        }

        return {
            "generated_at": datetime.now(timezone.utc),
            "synced_at": synced_at,
            "cards": cards,
            "by_status": [{"key": key, "count": value} for key, value in by_status.items()],
            "by_sentiment": [{"key": key, "count": value} for key, value in by_sentiment.items()],
            "by_direction": [{"key": key, "count": value} for key, value in by_direction.items()],
            "recent_calls": calls[:8],
            "filters": filters,
        }

    def build_timeseries(self, calls: list[Call]) -> dict:
        calls_over_time = defaultdict(int)
        status_by_day: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        topic_counts = Counter()
        tag_counts = Counter()
        outcome_counts = Counter()
        sentiment_totals: dict[str, dict[str, float | int]] = defaultdict(lambda: {"total": 0.0, "count": 0})
        scatter = []

        for call in calls:
            day = (call.started_at or call.created_at).astimezone(timezone.utc).strftime("%Y-%m-%d")
            calls_over_time[day] += 1
            status_by_day[day][call.status] += 1
            if call.topic:
                topic_counts[call.topic] += 1
                if call.sentiment_score is not None:
                    sentiment_totals[call.topic]["total"] += call.sentiment_score
                    sentiment_totals[call.topic]["count"] += 1
            if call.outcome:
                outcome_counts[call.outcome] += 1
            for current_tag in call.tags or []:
                tag_counts[current_tag] += 1
            if call.sentiment_score is not None and call.duration_seconds is not None:
                scatter.append(
                    {
                        "id": call.id,
                        "sentiment_score": call.sentiment_score,
                        "duration_seconds": call.duration_seconds,
                        "cost_credits": call.cost_credits or 0,
                        "topic": call.topic or "Unknown",
                        "status": call.status,
                    }
                )

        return {
            "generated_at": datetime.now(timezone.utc),
            "calls_over_time": [{"day": day, "count": count} for day, count in sorted(calls_over_time.items())],
            "status_by_day": [
                {"day": day, **values}
                for day, values in sorted(status_by_day.items())
            ],
            "top_topics": [{"key": key, "count": value} for key, value in topic_counts.most_common(8)],
            "tag_breakdown": [{"key": key, "count": value} for key, value in tag_counts.most_common(8)],
            "sentiment_by_topic": [
                {
                    "topic": topic,
                    "average_score": round(float(values["total"]) / int(values["count"]), 3),
                    "calls": int(values["count"]),
                }
                for topic, values in sorted(
                    sentiment_totals.items(),
                    key=lambda item: (float(item[1]["total"]) / int(item[1]["count"])),
                    reverse=True,
                )[:8]
                if int(values["count"]) > 0
            ],
            "scatter": scatter,
            "outcome_breakdown": [{"key": key, "count": value} for key, value in outcome_counts.most_common(8)],
        }
