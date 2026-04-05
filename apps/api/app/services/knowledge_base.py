from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Document, DocumentChunk, utcnow
from app.db.session import SessionLocal
from app.services.embeddings import EmbeddingService
from app.utils.text import chunk_text, extract_text_from_file

PENDING_DOCUMENT_STATUSES = {"uploaded", "extracting", "chunking", "embedding", "processing"}


class KnowledgeBaseService:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()

    def list_documents(self, db: Session) -> list[Document]:
        return list(db.execute(select(Document).order_by(Document.uploaded_at.desc())).scalars())

    def create_document(self, db: Session, upload: UploadFile) -> Document:
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in {".pdf", ".docx"}:
            raise ValueError("Only PDF and DOCX files are supported.")

        payload = upload.file.read()
        target_document = Document(
            filename=upload.filename or "untitled",
            mime_type=upload.content_type or "application/octet-stream",
            byte_size=len(payload),
            status="uploaded",
            chunk_count=0,
            storage_path="",
            status_message="File stored. Waiting to start extraction.",
            error_message=None,
            processing_started_at=None,
            processed_at=None,
        )
        db.add(target_document)
        db.flush()

        target_path = settings.uploads_dir / f"{target_document.id}{suffix}"
        target_path.write_bytes(payload)
        target_document.storage_path = str(target_path)
        db.commit()
        db.refresh(target_document)
        return target_document

    def process_document(self, document_id: str, *, restarted: bool = False) -> None:
        with SessionLocal() as db:
            document = db.get(Document, document_id)
            if document is None:
                return

            if restarted:
                document.status = "uploaded"
                document.status_message = "Restart detected. Replaying the document processing pipeline."
                document.error_message = None
                db.commit()

            try:
                storage_path = Path(document.storage_path)
                if not storage_path.exists():
                    raise FileNotFoundError("Stored file is missing from the uploads directory.")

                self._set_document_status(
                    db,
                    document,
                    status="extracting",
                    message="Extracting text from the uploaded file.",
                    started=True,
                )
                text = extract_text_from_file(storage_path)
                if not text.strip():
                    raise ValueError("No extractable text was found in the uploaded file.")

                self._set_document_status(
                    db,
                    document,
                    status="chunking",
                    message="Splitting extracted text into retrieval chunks.",
                )
                chunks = chunk_text(text)

                self._set_document_status(
                    db,
                    document,
                    status="embedding",
                    message=f"Embedding {len(chunks)} chunk(s) for retrieval.",
                )
                embeddings = self.embedding_service.embed_many([item["text"] for item in chunks]) if chunks else []

                db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
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
                document.status_message = f"Indexed {len(chunks)} chunk(s) and ready for retrieval."
                document.error_message = None
                document.processed_at = utcnow()
                db.commit()
            except Exception as exc:
                db.rollback()
                document = db.get(Document, document_id)
                if document is None:
                    return
                db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
                document.chunk_count = 0
                document.status = "failed"
                document.status_message = "Document processing failed."
                document.error_message = str(exc)
                document.processed_at = utcnow()
                db.commit()

    def resume_pending_documents(self) -> None:
        with SessionLocal() as db:
            pending_ids = list(
                db.execute(select(Document.id).where(Document.status.in_(PENDING_DOCUMENT_STATUSES))).scalars()
            )

        for document_id in pending_ids:
            self.process_document(document_id, restarted=True)

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
        chunks = list(
            db.execute(
                select(DocumentChunk)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(Document.status == "indexed")
            ).scalars()
        )
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

    def _set_document_status(
        self,
        db: Session,
        document: Document,
        *,
        status: str,
        message: str,
        started: bool = False,
    ) -> None:
        document.status = status
        document.status_message = message
        document.error_message = None
        if started and document.processing_started_at is None:
            document.processing_started_at = utcnow()
        document.processed_at = None
        db.commit()
