from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import (
    analytics_service,
    integration_service,
    knowledge_base_service,
    luron_service,
    prompt_service,
    settings_service,
)
from app.db.models import Call, CallPromptContext
from app.db.schemas import (
    CallRecordResponse,
    CallConsoleSettings,
    CallConsoleSettingsResponse,
    CreateCallRequest,
    CreateCallResponse,
    DashboardSummaryResponse,
    DashboardTimeseriesResponse,
    DocumentResponse,
    HealthResponse,
    IntegrationStatusResponse,
    PromptPreviewRequest,
    PromptPreviewResponse,
)
from app.db.session import get_db

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/ready", response_model=HealthResponse)
def ready(db: Session = Depends(get_db)) -> HealthResponse:
    db.execute(text("SELECT 1"))
    return HealthResponse(status="ready")


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    days: int = Query(default=30, ge=1, le=365),
    refresh: bool = False,
    status: str | None = None,
    voice: str | None = None,
    direction: str | None = None,
    sentiment: str | None = None,
    topic: str | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    synced_at = await analytics_service.sync_mock_calls(db, force=refresh)
    calls = analytics_service.get_filtered_calls(
        db,
        days=days,
        status=status,
        voice=voice,
        direction=direction,
        sentiment=sentiment,
        topic=topic,
        tag=tag,
        source="mock",
    )
    return DashboardSummaryResponse.model_validate(analytics_service.build_summary(calls, synced_at))


@router.get("/dashboard/timeseries", response_model=DashboardTimeseriesResponse)
async def dashboard_timeseries(
    days: int = Query(default=30, ge=1, le=365),
    refresh: bool = False,
    status: str | None = None,
    voice: str | None = None,
    direction: str | None = None,
    sentiment: str | None = None,
    topic: str | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
) -> DashboardTimeseriesResponse:
    await analytics_service.sync_mock_calls(db, force=refresh)
    calls = analytics_service.get_filtered_calls(
        db,
        days=days,
        status=status,
        voice=voice,
        direction=direction,
        sentiment=sentiment,
        topic=topic,
        tag=tag,
        source="mock",
    )
    return DashboardTimeseriesResponse.model_validate(analytics_service.build_timeseries(calls))


@router.get("/calls", response_model=list[CallRecordResponse])
async def list_calls(
    source: str | None = None,
    days: int = Query(default=90, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=250),
    db: Session = Depends(get_db),
) -> list[CallRecordResponse]:
    if source != "manual":
        await analytics_service.sync_mock_calls(db, force=False)
    calls = analytics_service.get_filtered_calls(db, source=source, days=days, limit=limit)
    return [CallRecordResponse.model_validate(call) for call in calls]


@router.get("/calls/{call_id}", response_model=CallRecordResponse)
def get_call(call_id: str, db: Session = Depends(get_db)) -> CallRecordResponse:
    call = db.get(Call, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Call not found.")
    return CallRecordResponse.model_validate(call)


@router.post("/calls/{call_id}/refresh-status", response_model=CallRecordResponse)
async def refresh_call_status(call_id: str, db: Session = Depends(get_db)) -> CallRecordResponse:
    call = db.get(Call, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Call not found.")
    if call.source != "manual":
        raise HTTPException(status_code=400, detail="Only manual calls can be refreshed.")

    status_payload = await luron_service.refresh_call_status(call.external_call_id)
    call.status_last_checked_at = datetime.now(timezone.utc)
    call.provider_status_available = bool(status_payload.get("provider_status_available", False))
    call.status_detail = status_payload.get("detail")
    if status_payload.get("status") is not None:
        call.status = str(status_payload["status"])
    db.commit()
    db.refresh(call)
    return CallRecordResponse.model_validate(call)


@router.post("/prompts/preview", response_model=PromptPreviewResponse)
async def preview_prompt(payload: PromptPreviewRequest, db: Session = Depends(get_db)) -> PromptPreviewResponse:
    preview = await prompt_service.preview(db, payload)
    return PromptPreviewResponse.model_validate(preview)


@router.post("/calls", response_model=CreateCallResponse)
async def create_call(payload: CreateCallRequest, db: Session = Depends(get_db)) -> CreateCallResponse:
    preview = await prompt_service.preview(db, payload)
    request_payload = {
        "voice": payload.voice,
        "prompt": preview["final_prompt"],
        "welcome_message": payload.welcome_message,
        "phone_number": payload.phone_number,
    }
    try:
        provider_response = await luron_service.make_call(request_payload)
        external_call_id = luron_service.extract_external_call_id(provider_response)
        status = luron_service.derive_status(
            provider_response,
            success_fallback="accepted" if external_call_id else "submitted",
        )
        status_detail = luron_service.derive_detail(
            provider_response,
            "Provider accepted the call request and returned an acknowledgement.",
        )
    except Exception as exc:
        provider_response = {"success": False, "error": str(exc)}
        external_call_id = None
        status = "failed"
        status_detail = str(exc)

    call = Call(
        external_call_id=external_call_id,
        source="manual",
        phone_number=payload.phone_number,
        direction="outbound",
        status=status,
        started_at=datetime.now(timezone.utc),
        duration_display="Pending",
        agent_name="Call Bank Agent",
        voice_used=payload.voice,
        transcript_preview=payload.welcome_message,
        tags=["manual-console"],
        provider_response=provider_response,
        status_detail=status_detail,
        provider_status_available=bool(external_call_id and luron_service.can_refresh_status()),
    )
    if external_call_id is None and status != "failed":
        call.status_detail = (
            "Provider accepted the call request but did not return a call identifier, so live refresh is unavailable."
        )
    db.add(call)
    db.flush()

    db.add(
        CallPromptContext(
            call_id=call.id,
            raw_prompt=payload.prompt,
            enriched_prompt=preview["final_prompt"],
            kb_enabled=payload.inject_knowledge_base,
            fx_enabled=payload.inject_fx,
            weather_enabled=payload.inject_weather,
            retrieved_chunk_ids=[item["chunk_id"] for item in preview["citations"]],
            prompt_sections=preview["sections"],
            snapshot_refs=preview["snapshot_refs"],
        )
    )
    db.commit()
    db.refresh(call)

    return CreateCallResponse(
        call=CallRecordResponse.model_validate(call),
        prompt_preview=PromptPreviewResponse.model_validate(preview),
        provider_response=provider_response,
    )


@router.get("/knowledge/documents", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentResponse]:
    documents = knowledge_base_service.list_documents(db)
    return [DocumentResponse.model_validate(document) for document in documents]


@router.post("/knowledge/documents", response_model=DocumentResponse)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    try:
        document = knowledge_base_service.create_document(db, file)
        background_tasks.add_task(knowledge_base_service.process_document, document.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return DocumentResponse.model_validate(document)


@router.delete("/knowledge/documents/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db)) -> None:
    knowledge_base_service.delete_document(db, document_id)


@router.get("/integrations/status", response_model=IntegrationStatusResponse)
def integrations_status(db: Session = Depends(get_db)) -> IntegrationStatusResponse:
    return IntegrationStatusResponse(providers=integration_service.status(db))


@router.get("/settings/call-console", response_model=CallConsoleSettingsResponse)
def get_call_console_settings(db: Session = Depends(get_db)) -> CallConsoleSettingsResponse:
    return settings_service.get_call_console_settings(db)


@router.put("/settings/call-console", response_model=CallConsoleSettingsResponse)
def put_call_console_settings(payload: CallConsoleSettings, db: Session = Depends(get_db)) -> CallConsoleSettingsResponse:
    return settings_service.save_call_console_settings(db, payload)
