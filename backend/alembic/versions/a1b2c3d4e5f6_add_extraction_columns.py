"""Add extraction columns for smart agentic flow

Revision ID: a1b2c3d4e5f6
Revises: d38eed28976a
Create Date: 2026-02-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd38eed28976a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ExtractionStatus enum type (values must match Python enum .name)
    extraction_status_enum = sa.Enum(
        'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED',
        name='extractionstatus'
    )
    extraction_status_enum.create(op.get_bind(), checkfirst=True)

    # Projects: add tabu_data JSON column
    op.add_column('projects', sa.Column('tabu_data', JSON, nullable=True))

    # Documents: add extraction tracking columns
    op.add_column('documents', sa.Column(
        'extraction_status',
        extraction_status_enum,
        nullable=False,
        server_default='PENDING'
    ))
    op.add_column('documents', sa.Column('extraction_error', sa.Text(), nullable=True))
    op.add_column('documents', sa.Column('extracted_data', JSON, nullable=True))

    # Simulations: add extraction_progress JSON column
    op.add_column('simulations', sa.Column('extraction_progress', JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('simulations', 'extraction_progress')
    op.drop_column('documents', 'extracted_data')
    op.drop_column('documents', 'extraction_error')
    op.drop_column('documents', 'extraction_status')
    op.drop_column('projects', 'tabu_data')

    # Drop enum type
    sa.Enum(name='extractionstatus').drop(op.get_bind(), checkfirst=True)
