from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


VoiceLiteral = Literal["burcin", "callie"]
StatusLiteral = Literal["completed", "no_answer", "busy", "voicemail", "failed", "in_progress"]
SentimentLiteral = Literal["positive", "neutral", "negative", "mixed"]
DirectionLiteral = Literal["inbound", "outbound"]


class PromptSection(BaseModel):
    title: str
    type: str
    content: str
    meta: dict = Field(default_factory=dict)


class RetrievedCitation(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    score: float
    excerpt: str


class PromptPreviewRequest(BaseModel):
    voice: VoiceLiteral
    prompt: str = Field(min_length=10)
    welcome_message: str = Field(min_length=2)
    phone_number: str | None = None
    inject_knowledge_base: bool = False
    inject_fx: bool = True
    inject_weather: bool = True
    top_k: int = Field(default=4, ge=1, le=8)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return value
        if not value.startswith("+") or not value[1:].isdigit() or len(value) < 8 or len(value) > 16:
            raise ValueError("Phone number must be in E.164 format.")
        return value


class CreateCallRequest(PromptPreviewRequest):
    phone_number: str = Field(min_length=8)


class CallRecordResponse(BaseModel):
    id: str
    external_call_id: str | None
    source: str
    contact_name: str | None
    phone_number: str | None
    direction: str | None
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    duration_seconds: int | None
    duration_display: str | None
    sentiment: str | None
    sentiment_score: float | None
    topic: str | None
    outcome: str | None
    agent_name: str | None
    voice_used: str | None
    transcript_preview: str | None
    recording_url: str | None
    tags: list[str]
    cost_credits: float | None
    provider_response: dict | None = None
    status_detail: str | None = None
    status_last_checked_at: datetime | None = None
    provider_status_available: bool = False

    model_config = {"from_attributes": True}


class PromptPreviewResponse(BaseModel):
    final_prompt: str
    sections: list[PromptSection]
    citations: list[RetrievedCitation]
    snapshot_refs: list[dict]


class CreateCallResponse(BaseModel):
    call: CallRecordResponse
    prompt_preview: PromptPreviewResponse
    provider_response: dict


class DocumentResponse(BaseModel):
    id: str
    filename: str
    mime_type: str
    byte_size: int
    status: str
    chunk_count: int
    error_message: str | None
    uploaded_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MetricCard(BaseModel):
    label: str
    value: float | int | str
    delta: float | None = None
    tone: str = "default"


class DashboardSummaryResponse(BaseModel):
    generated_at: datetime
    synced_at: datetime | None
    cards: list[MetricCard]
    by_status: list[dict]
    by_sentiment: list[dict]
    by_direction: list[dict]
    recent_calls: list[CallRecordResponse]
    filters: dict


class DashboardTimeseriesResponse(BaseModel):
    generated_at: datetime
    calls_over_time: list[dict]
    status_by_day: list[dict]
    top_topics: list[dict]
    tag_breakdown: list[dict]
    sentiment_by_topic: list[dict]
    scatter: list[dict]
    outcome_breakdown: list[dict]


class IntegrationProviderStatus(BaseModel):
    provider: str
    healthy: bool
    cached_at: datetime | None
    detail: str


class IntegrationStatusResponse(BaseModel):
    providers: list[IntegrationProviderStatus]


class HealthResponse(BaseModel):
    status: str


class CallConsoleSettings(BaseModel):
    voice: VoiceLiteral = "callie"
    country_code: str = "+90"
    local_number: str = "5551234567"
    base_prompt: str = Field(
        default=(
            "You are Call Bank's outbound assistant. Keep the conversation warm, efficient, "
            "and practical. Help the customer understand why you called and guide them to the "
            "next best banking action."
        ),
        min_length=10,
    )
    welcome_message: str = Field(
        default="Hello from Call Bank. I have a quick update for you today.",
        min_length=2,
    )
    inject_knowledge_base: bool = False
    inject_fx: bool = True
    inject_weather: bool = True
    top_k: int = Field(default=4, ge=1, le=8)


class CallConsoleSettingsResponse(CallConsoleSettings):
    updated_at: datetime | None = None
