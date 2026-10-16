"""Repair missing required tables without dropping live data.

Revision ID: f6a1c2d8e9b4
Revises: c3a4f891b2e1
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f6a1c2d8e9b4"
down_revision: Union[str, Sequence[str], None] = "c3a4f891b2e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.user_llm_credentials (
            owner_id VARCHAR(255) PRIMARY KEY,
            encrypted_api_key TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
            id UUID PRIMARY KEY,
            chatbot_id UUID NOT NULL
                REFERENCES public.chatbots(id) ON DELETE CASCADE,
            status VARCHAR(30) NOT NULL DEFAULT 'queued',
            stage VARCHAR(50) DEFAULT 'discovering',
            pages_discovered INTEGER NOT NULL DEFAULT 0,
            pages_saved INTEGER NOT NULL DEFAULT 0,
            chunks_saved INTEGER NOT NULL DEFAULT 0,
            pages_failed INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_ingestion_jobs_chatbot_id
        ON public.ingestion_jobs(chatbot_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_ingestion_jobs_status
        ON public.ingestion_jobs(status)
    """)


def downgrade() -> None:
    # Intentionally do not delete tables that may contain live data.
    pass
