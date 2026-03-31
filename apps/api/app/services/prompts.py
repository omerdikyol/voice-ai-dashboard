from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.schemas import PromptPreviewRequest
from app.services.integrations import IntegrationService
from app.services.knowledge_base import KnowledgeBaseService


class PromptAssemblyService:
    def __init__(self) -> None:
        self.knowledge_base_service = KnowledgeBaseService()
        self.integration_service = IntegrationService()

    async def preview(self, db: Session, request: PromptPreviewRequest) -> dict:
        sections = [
            {
                "title": "Base system prompt",
                "type": "base",
                "content": request.prompt.strip(),
                "meta": {"voice": request.voice},
            }
        ]
        citations = []
        snapshot_refs = []

        if request.inject_knowledge_base:
            kb_sections, kb_citations = self.knowledge_base_service.retrieve_context(db, request.prompt, request.top_k)
            sections.extend(kb_sections)
            citations.extend(kb_citations)

        if request.inject_fx:
            snapshot = await self.integration_service.get_fx_snapshot(db)
            sections.append(
                {
                    "title": "FX market context",
                    "type": "integration",
                    "content": snapshot.summary,
                    "meta": {"provider": snapshot.provider, "snapshot_id": snapshot.id},
                }
            )
            snapshot_refs.append({"provider": snapshot.provider, "snapshot_id": snapshot.id})

        if request.inject_weather:
            snapshot = await self.integration_service.get_weather_snapshot(db)
            sections.append(
                {
                    "title": "Weather context",
                    "type": "integration",
                    "content": snapshot.summary,
                    "meta": {"provider": snapshot.provider, "snapshot_id": snapshot.id},
                }
            )
            snapshot_refs.append({"provider": snapshot.provider, "snapshot_id": snapshot.id})

        sections.append(
            {
                "title": "Conversation guardrail",
                "type": "guardrail",
                "content": (
                    "Keep the call concise, professional, compliant, and specific. "
                    "Use only the provided context, and do not fabricate account details."
                ),
                "meta": {},
            }
        )

        final_prompt = "\n\n".join(
            f"{section['title']}:\n{section['content']}" for section in sections if section["content"].strip()
        )
        return {
            "final_prompt": final_prompt,
            "sections": sections,
            "citations": citations,
            "snapshot_refs": snapshot_refs,
        }
