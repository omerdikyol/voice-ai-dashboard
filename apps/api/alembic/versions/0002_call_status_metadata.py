"""Add manual call status metadata columns."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_call_status_metadata"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calls", sa.Column("status_detail", sa.Text(), nullable=True))
    op.add_column("calls", sa.Column("status_last_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "calls",
        sa.Column("provider_status_available", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("calls", "provider_status_available", server_default=None)


def downgrade() -> None:
    op.drop_column("calls", "provider_status_available")
    op.drop_column("calls", "status_last_checked_at")
    op.drop_column("calls", "status_detail")
