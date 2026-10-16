"""add ingestion jobs table for observable background jobs

Revision ID: c3a4f891b2e1
Revises: b2c51d8e4a70
Create Date: 2026-10-16 15:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3a4f891b2e1"
down_revision: Union[str, Sequence[str], None] = "b2c51d8e4a70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("chatbot_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="queued", nullable=False),
        sa.Column("stage", sa.String(length=50), server_default="discovering", nullable=True),
        sa.Column("pages_discovered", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pages_saved", sa.Integer(), server_default="0", nullable=False),
        sa.Column("chunks_saved", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pages_failed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["chatbot_id"], ["chatbots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ingestion_jobs_chatbot_id", "ingestion_jobs", ["chatbot_id"], unique=False)
    op.create_index("ix_ingestion_jobs_status", "ingestion_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ingestion_jobs_status", table_name="ingestion_jobs")
    op.drop_index("ix_ingestion_jobs_chatbot_id", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")
