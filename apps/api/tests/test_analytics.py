from datetime import datetime, timezone

from app.services.analytics import AnalyticsService


class StubCall:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def test_build_summary_counts_and_filters() -> None:
    service = AnalyticsService()
    calls = [
        StubCall(
            id="1",
            status="completed",
            direction="outbound",
            sentiment="positive",
            duration_seconds=240,
            cost_credits=1.2,
            started_at=datetime(2026, 3, 29, tzinfo=timezone.utc),
            created_at=datetime(2026, 3, 29, tzinfo=timezone.utc),
            voice_used="callie",
            topic="Upgrade inquiry",
            tags=["vip"],
            phone_number="+905551234567",
            contact_name="A",
            ended_at=None,
            duration_display="4m 0s",
            sentiment_score=0.7,
            outcome="Sale closed",
            agent_name="Callie AI",
            transcript_preview="Hi",
            recording_url=None,
            provider_response=None,
        ),
        StubCall(
            id="2",
            status="failed",
            direction="inbound",
            sentiment=None,
            duration_seconds=60,
            cost_credits=0.5,
            started_at=datetime(2026, 3, 30, tzinfo=timezone.utc),
            created_at=datetime(2026, 3, 30, tzinfo=timezone.utc),
            voice_used="burcin",
            topic="Complaint",
            tags=["urgent"],
            phone_number="+905551111111",
            contact_name="B",
            ended_at=None,
            duration_display="1m 0s",
            sentiment_score=None,
            outcome=None,
            agent_name="Burcin AI",
            transcript_preview="Hi",
            recording_url=None,
            provider_response=None,
        ),
    ]

    payload = service.build_summary(calls, synced_at=None)

    assert payload["cards"][0]["value"] == 2
    assert payload["cards"][1]["value"] == "50.0%"
    assert payload["filters"]["voices"] == ["burcin", "callie"]
    assert any(item["key"] == "completed" and item["count"] == 1 for item in payload["by_status"])


def test_build_timeseries_includes_sentiment_by_topic() -> None:
    service = AnalyticsService()
    calls = [
        StubCall(
            id="1",
            status="completed",
            direction="outbound",
            sentiment="positive",
            duration_seconds=240,
            cost_credits=1.2,
            started_at=datetime(2026, 3, 29, tzinfo=timezone.utc),
            created_at=datetime(2026, 3, 29, tzinfo=timezone.utc),
            voice_used="callie",
            topic="Upgrade inquiry",
            tags=["vip"],
            phone_number="+905551234567",
            contact_name="A",
            ended_at=None,
            duration_display="4m 0s",
            sentiment_score=0.7,
            outcome="Sale closed",
            agent_name="Callie AI",
            transcript_preview="Hi",
            recording_url=None,
            provider_response=None,
        ),
        StubCall(
            id="2",
            status="completed",
            direction="outbound",
            sentiment="positive",
            duration_seconds=180,
            cost_credits=1.0,
            started_at=datetime(2026, 3, 30, tzinfo=timezone.utc),
            created_at=datetime(2026, 3, 30, tzinfo=timezone.utc),
            voice_used="callie",
            topic="Upgrade inquiry",
            tags=["vip"],
            phone_number="+905551234568",
            contact_name="B",
            ended_at=None,
            duration_display="3m 0s",
            sentiment_score=0.5,
            outcome="Sale closed",
            agent_name="Callie AI",
            transcript_preview="Hi",
            recording_url=None,
            provider_response=None,
        ),
    ]

    payload = service.build_timeseries(calls)

    assert payload["sentiment_by_topic"] == [{"topic": "Upgrade inquiry", "average_score": 0.6, "calls": 2}]


def test_build_timeseries_includes_activity_heatmap() -> None:
    service = AnalyticsService()
    calls = [
        StubCall(
            id="1",
            status="completed",
            direction="outbound",
            sentiment="positive",
            duration_seconds=120,
            cost_credits=0.8,
            started_at=datetime(2026, 3, 30, 9, 0, tzinfo=timezone.utc),
            created_at=datetime(2026, 3, 30, 9, 0, tzinfo=timezone.utc),
            voice_used="callie",
            topic="Upgrade inquiry",
            tags=["vip"],
            phone_number="+905551234567",
            contact_name="A",
            ended_at=None,
            duration_display="2m 0s",
            sentiment_score=0.4,
            outcome="Sale closed",
            agent_name="Callie AI",
            transcript_preview="Hi",
            recording_url=None,
            provider_response=None,
        ),
        StubCall(
            id="2",
            status="completed",
            direction="outbound",
            sentiment="neutral",
            duration_seconds=90,
            cost_credits=0.7,
            started_at=datetime(2026, 4, 1, 17, 0, tzinfo=timezone.utc),
            created_at=datetime(2026, 4, 1, 17, 0, tzinfo=timezone.utc),
            voice_used="burcin",
            topic="Complaint",
            tags=["urgent"],
            phone_number="+905551111111",
            contact_name="B",
            ended_at=None,
            duration_display="1m 30s",
            sentiment_score=0.1,
            outcome="Escalated",
            agent_name="Burcin AI",
            transcript_preview="Hi",
            recording_url=None,
            provider_response=None,
        ),
    ]

    payload = service.build_timeseries(calls)

    monday_nine = next(cell for cell in payload["activity_heatmap"] if cell["weekday"] == 0 and cell["hour"] == 9)
    wednesday_seventeen = next(
        cell for cell in payload["activity_heatmap"] if cell["weekday"] == 2 and cell["hour"] == 17
    )

    assert monday_nine["count"] == 1
    assert monday_nine["weekday_label"] == "Mon"
    assert wednesday_seventeen["count"] == 1
    assert len(payload["activity_heatmap"]) == 168
