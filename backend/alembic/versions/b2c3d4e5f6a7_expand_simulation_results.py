"""Expand simulation_results with intermediate calculation values

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('simulation_results', sa.Column('total_revenue', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('net_revenue', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_costs', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('construction_cost', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('planning_cost', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('levies_cost', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_units', sa.Integer(), nullable=True))
    op.add_column('simulation_results', sa.Column('total_residential_area', sa.Numeric(10, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('residential_revenue', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('commercial_revenue', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('monthly_cash_flows', JSON, nullable=True))
    op.add_column('simulation_results', sa.Column('calculation_details', JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('simulation_results', 'calculation_details')
    op.drop_column('simulation_results', 'monthly_cash_flows')
    op.drop_column('simulation_results', 'commercial_revenue')
    op.drop_column('simulation_results', 'residential_revenue')
    op.drop_column('simulation_results', 'total_residential_area')
    op.drop_column('simulation_results', 'total_units')
    op.drop_column('simulation_results', 'levies_cost')
    op.drop_column('simulation_results', 'planning_cost')
    op.drop_column('simulation_results', 'construction_cost')
    op.drop_column('simulation_results', 'total_costs')
    op.drop_column('simulation_results', 'net_revenue')
    op.drop_column('simulation_results', 'total_revenue')
