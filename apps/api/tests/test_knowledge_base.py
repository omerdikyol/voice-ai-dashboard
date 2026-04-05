from __future__ import annotations

from io import BytesIO

from fastapi import UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.services.knowledge_base as knowledge_base_module
from app.core.config import settings
from app.db.models import Base, Document
from app.services.knowledge_base import KnowledgeBaseService


def make_session_factory():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


def test_document_processing_transitions_to_indexed(monkeypatch, tmp_path) -> None:
    test_session_local = make_session_factory()
    monkeypatch.setattr(knowledge_base_module, "SessionLocal", test_session_local)
    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    monkeypatch.setattr(
        knowledge_base_module,
        "extract_text_from_file",
        lambda path: "alpha bravo charlie " * 220,
    )

    service = KnowledgeBaseService()
    with test_session_local() as session:
        document = service.create_document(
            session,
            UploadFile(filename="policy.pdf", file=BytesIO(b"fake-pdf")),
        )
        assert document.status == "uploaded"
        assert document.status_message == "File stored. Waiting to start extraction."

    service.process_document(document.id)

    with test_session_local() as verify_session:
        stored = verify_session.get(Document, document.id)
        assert stored is not None
        assert stored.status == "indexed"
        assert stored.chunk_count > 0
        assert stored.processing_started_at is not None
        assert stored.processed_at is not None
        assert stored.status_message == f"Indexed {stored.chunk_count} chunk(s) and ready for retrieval."


def test_resume_pending_documents_replays_incomplete_uploads(monkeypatch, tmp_path) -> None:
    test_session_local = make_session_factory()
    monkeypatch.setattr(knowledge_base_module, "SessionLocal", test_session_local)
    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    monkeypatch.setattr(
        knowledge_base_module,
        "extract_text_from_file",
        lambda path: "bank policy update " * 200,
    )

    service = KnowledgeBaseService()
    with test_session_local() as session:
        document = service.create_document(
            session,
            UploadFile(filename="faq.docx", file=BytesIO(b"fake-docx")),
        )
        assert document.status == "uploaded"

    service.resume_pending_documents()

    with test_session_local() as verify_session:
        resumed = verify_session.get(Document, document.id)
        assert resumed is not None
        assert resumed.status == "indexed"
        assert resumed.processed_at is not None
