"""Add staged document processing metadata."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003_doc_processing"
down_revision = "0002_call_status_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("status_message", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("documents", sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE documents
            SET
              status = CASE WHEN status = 'processing' THEN 'uploaded' ELSE status END,
              status_message = CASE
                WHEN status = 'indexed' THEN 'Document indexed and ready for retrieval.'
                WHEN status = 'failed' THEN 'Document processing failed.'
                ELSE 'Document stored and waiting for processing.'
              END
            """
        )
    )


def downgrade() -> None:
    op.drop_column("documents", "processed_at")
    op.drop_column("documents", "processing_started_at")
    op.drop_column("documents", "status_message")
