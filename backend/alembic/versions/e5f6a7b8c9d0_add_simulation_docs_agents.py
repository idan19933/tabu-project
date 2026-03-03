"""Add simulation_id/doc_type to documents, agent_status to simulations, scenarios to results

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # documents: add simulation_id FK and doc_type
    op.add_column('documents',
                  sa.Column('simulation_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_documents_simulation_id',
        'documents', 'simulations',
        ['simulation_id'], ['id'],
        ondelete='SET NULL',
    )
    op.add_column('documents',
                  sa.Column('doc_type', sa.String(50), nullable=True))

    # simulations: add agent_status JSON
    op.add_column('simulations',
                  sa.Column('agent_status', JSON, nullable=True))

    # simulation_results: add scenarios, optimizations, ai_validation_notes
    op.add_column('simulation_results',
                  sa.Column('scenarios', JSON, nullable=True))
    op.add_column('simulation_results',
                  sa.Column('optimizations', JSON, nullable=True))
    op.add_column('simulation_results',
                  sa.Column('ai_validation_notes', sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column('simulation_results', 'ai_validation_notes')
    op.drop_column('simulation_results', 'optimizations')
    op.drop_column('simulation_results', 'scenarios')
    op.drop_column('simulations', 'agent_status')
    op.drop_constraint('fk_documents_simulation_id', 'documents', type_='foreignkey')
    op.drop_column('documents', 'doc_type')
    op.drop_column('documents', 'simulation_id')
