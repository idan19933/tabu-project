"""Add percentage-based cost fields and data_sources to cost_parameters

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'g7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Percentage-based cost columns (as % of construction cost)
    op.add_column('cost_parameters',
                  sa.Column('planning_consultants_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('permits_fees_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('bank_supervision_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('engineering_management_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('tenant_supervision_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('management_overhead_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('marketing_advertising_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('tenant_lawyer_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('developer_lawyer_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('contingency_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('cost_parameters',
                  sa.Column('initiation_fee_pct', sa.Numeric(5, 2), nullable=True))
    # Data sources JSON for traceability
    op.add_column('cost_parameters',
                  sa.Column('data_sources', JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('cost_parameters', 'data_sources')
    op.drop_column('cost_parameters', 'initiation_fee_pct')
    op.drop_column('cost_parameters', 'contingency_pct')
    op.drop_column('cost_parameters', 'developer_lawyer_pct')
    op.drop_column('cost_parameters', 'tenant_lawyer_pct')
    op.drop_column('cost_parameters', 'marketing_advertising_pct')
    op.drop_column('cost_parameters', 'management_overhead_pct')
    op.drop_column('cost_parameters', 'tenant_supervision_pct')
    op.drop_column('cost_parameters', 'engineering_management_pct')
    op.drop_column('cost_parameters', 'bank_supervision_pct')
    op.drop_column('cost_parameters', 'permits_fees_pct')
    op.drop_column('cost_parameters', 'planning_consultants_pct')
