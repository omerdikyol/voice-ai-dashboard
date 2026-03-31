"""Initial schema for the voice AI dashboard."""

from __future__ import annotations

from alembic import op
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "calls",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("external_call_id", sa.String(length=128), nullable=True, unique=True),
        sa.Column("source", sa.String(length=20), nullable=False, index=True),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("phone_number", sa.String(length=32), nullable=True),
        sa.Column("direction", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("duration_display", sa.String(length=64), nullable=True),
        sa.Column("sentiment", sa.String(length=32), nullable=True),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=True),
        sa.Column("outcome", sa.String(length=255), nullable=True),
        sa.Column("agent_name", sa.String(length=255), nullable=True),
        sa.Column("voice_used", sa.String(length=32), nullable=True),
        sa.Column("transcript_preview", sa.Text(), nullable=True),
        sa.Column("recording_url", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("cost_credits", sa.Float(), nullable=True),
        sa.Column("provider_response", sa.JSON(), nullable=True),
    )
    op.create_index("ix_calls_started_at", "calls", ["started_at"])

    op.create_table(
        "call_prompt_contexts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("call_id", sa.String(length=36), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("raw_prompt", sa.Text(), nullable=False),
        sa.Column("enriched_prompt", sa.Text(), nullable=False),
        sa.Column("kb_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fx_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("weather_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("retrieved_chunk_ids", sa.JSON(), nullable=False),
        sa.Column("prompt_sections", sa.JSON(), nullable=False),
        sa.Column("snapshot_refs", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=36), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "integration_snapshots",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("snapshot_key", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_integration_snapshots_provider_key",
        "integration_snapshots",
        ["provider", "snapshot_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_integration_snapshots_provider_key", table_name="integration_snapshots")
    op.drop_table("integration_snapshots")
    op.drop_table("app_settings")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_table("documents")
    op.drop_table("call_prompt_contexts")
    op.drop_index("ix_calls_started_at", table_name="calls")
    op.drop_table("calls")
