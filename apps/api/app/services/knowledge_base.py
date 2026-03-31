from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Document, DocumentChunk
from app.services.embeddings import EmbeddingService
from app.utils.text import chunk_text, extract_text_from_file


class KnowledgeBaseService:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()

    def list_documents(self, db: Session) -> list[Document]:
        return list(db.execute(select(Document).order_by(Document.uploaded_at.desc())).scalars())

    def upload_document(self, db: Session, upload: UploadFile) -> Document:
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in {".pdf", ".docx"}:
            raise ValueError("Only PDF and DOCX files are supported.")

        document = Document(
            filename=upload.filename or "untitled",
            mime_type=upload.content_type or "application/octet-stream",
            byte_size=0,
            status="processing",
            chunk_count=0,
            storage_path="",
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        target_path = settings.uploads_dir / f"{document.id}{suffix}"
        payload = upload.file.read()
        target_path.write_bytes(payload)

        document.storage_path = str(target_path)
        document.byte_size = len(payload)
        db.commit()

        try:
            text = extract_text_from_file(target_path)
            chunks = chunk_text(text)
            embeddings = self.embedding_service.embed_many([item["text"] for item in chunks]) if chunks else []

            for chunk, embedding in zip(chunks, embeddings, strict=False):
                db.add(
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=chunk["index"],
                        text=chunk["text"],
                        token_count=chunk["token_count"],
                        metadata_json={"fingerprint": chunk["fingerprint"]},
                        embedding=embedding,
                    )
                )

            document.chunk_count = len(chunks)
            document.status = "indexed"
            document.error_message = None
            db.commit()
            db.refresh(document)
            return document
        except Exception as exc:
            document.status = "failed"
            document.error_message = str(exc)
            db.commit()
            db.refresh(document)
            raise

    def delete_document(self, db: Session, document_id: str) -> None:
        document = db.get(Document, document_id)
        if document is None:
            return

        storage_path = Path(document.storage_path)
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
        db.delete(document)
        db.commit()
        if storage_path.exists():
            storage_path.unlink()

    def retrieve_context(self, db: Session, query: str, top_k: int) -> tuple[list[dict], list[dict]]:
        chunks = list(db.execute(select(DocumentChunk)).scalars())
        if not chunks:
            return [], []

        query_embedding = self.embedding_service.embed_text(query)
        ranked = []
        for chunk in chunks:
            similarity = sum(a * b for a, b in zip(query_embedding, chunk.embedding, strict=False))
            ranked.append((similarity, chunk))

        ranked.sort(key=lambda item: item[0], reverse=True)
        selected = ranked[:top_k]

        sections = []
        citations = []
        for similarity, chunk in selected:
            document = db.get(Document, chunk.document_id)
            if document is None:
                continue
            sections.append(
                {
                    "title": f"Knowledge Base: {document.filename}",
                    "type": "knowledge_base",
                    "content": chunk.text,
                    "meta": {"document_id": document.id, "chunk_id": chunk.id},
                }
            )
            citations.append(
                {
                    "chunk_id": chunk.id,
                    "document_id": document.id,
                    "document_name": document.filename,
                    "score": round(float(similarity), 3),
                    "excerpt": f"{chunk.text[:180]}...",
                }
            )

        return sections, citations
