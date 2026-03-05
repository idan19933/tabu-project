"""Add audit gap fields: planning_stage, revenue extras, CPI, delta snapshot

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # planning_parameters: planning_stage
    op.add_column('planning_parameters',
                  sa.Column('planning_stage', sa.String(50), nullable=True))

    # revenue_parameters: sales_pace, marketing_discount, parking price, storage price
    op.add_column('revenue_parameters',
                  sa.Column('sales_pace_per_month', sa.Numeric(8, 2), nullable=True))
    op.add_column('revenue_parameters',
                  sa.Column('marketing_discount_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('revenue_parameters',
                  sa.Column('price_per_sqm_parking', sa.Numeric(12, 2), nullable=True))
    op.add_column('revenue_parameters',
                  sa.Column('price_per_sqm_storage', sa.Numeric(12, 2), nullable=True))

    # cost_parameters: CPI linkage
    op.add_column('cost_parameters',
                  sa.Column('cpi_linkage_pct', sa.Numeric(5, 2), nullable=True))

    # simulation_results: previous results snapshot for delta analysis
    op.add_column('simulation_results',
                  sa.Column('previous_results_snapshot', JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('simulation_results', 'previous_results_snapshot')
    op.drop_column('cost_parameters', 'cpi_linkage_pct')
    op.drop_column('revenue_parameters', 'price_per_sqm_storage')
    op.drop_column('revenue_parameters', 'price_per_sqm_parking')
    op.drop_column('revenue_parameters', 'marketing_discount_pct')
    op.drop_column('revenue_parameters', 'sales_pace_per_month')
    op.drop_column('planning_parameters', 'planning_stage')
