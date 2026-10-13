"""add chatbot owner id

Revision ID: 8afd2d190133
Revises: 6bd4e8f9bd7d
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8afd2d190133"
down_revision: Union[str, Sequence[str], None] = "6bd4e8f9bd7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chatbots",
        sa.Column("owner_id", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_chatbots_owner_id",
        "chatbots",
        ["owner_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chatbots_owner_id", table_name="chatbots")
    op.drop_column("chatbots", "owner_id")
