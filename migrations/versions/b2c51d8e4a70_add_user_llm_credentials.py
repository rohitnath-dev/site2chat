"""store encrypted per-user LLM credentials

Revision ID: b2c51d8e4a70
Revises: 8afd2d190133
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b2c51d8e4a70"
down_revision: Union[str, Sequence[str], None] = "8afd2d190133"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_llm_credentials",
        sa.Column("owner_id", sa.String(length=255), primary_key=True),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_llm_credentials")
