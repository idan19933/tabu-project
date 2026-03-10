"""Add market_research_data and market_research_status to projects

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects',
                  sa.Column('market_research_data', JSON, nullable=True))
    op.add_column('projects',
                  sa.Column('market_research_status', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'market_research_status')
    op.drop_column('projects', 'market_research_data')
