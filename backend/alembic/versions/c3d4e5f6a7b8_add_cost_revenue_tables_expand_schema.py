"""Add cost_parameters, revenue_parameters tables and expand planning/results

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Create cost_parameters table ---
    op.create_table(
        'cost_parameters',
        sa.Column('simulation_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('simulations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('construction_duration_months', sa.Integer(), nullable=True),
        sa.Column('cost_per_sqm_residential', sa.Numeric(12, 2), nullable=True),
        sa.Column('cost_per_sqm_service', sa.Numeric(12, 2), nullable=True),
        sa.Column('cost_per_sqm_commercial', sa.Numeric(12, 2), nullable=True),
        sa.Column('cost_per_sqm_balcony', sa.Numeric(12, 2), nullable=True),
        sa.Column('cost_per_sqm_development', sa.Numeric(12, 2), nullable=True),
        sa.Column('betterment_levy', sa.Numeric(14, 2), nullable=True),
        sa.Column('purchase_tax', sa.Numeric(14, 2), nullable=True),
        sa.Column('planning_consultants', sa.Numeric(14, 2), nullable=True),
        sa.Column('permits_fees', sa.Numeric(14, 2), nullable=True),
        sa.Column('electricity_connection', sa.Numeric(14, 2), nullable=True),
        sa.Column('bank_supervision', sa.Numeric(14, 2), nullable=True),
        sa.Column('engineering_management', sa.Numeric(14, 2), nullable=True),
        sa.Column('tenant_supervision', sa.Numeric(14, 2), nullable=True),
        sa.Column('management_overhead', sa.Numeric(14, 2), nullable=True),
        sa.Column('marketing_advertising', sa.Numeric(14, 2), nullable=True),
        sa.Column('tenant_lawyer', sa.Numeric(14, 2), nullable=True),
        sa.Column('initiation_fee', sa.Numeric(14, 2), nullable=True),
        sa.Column('rent_subsidy', sa.Numeric(14, 2), nullable=True),
        sa.Column('evacuation_cost', sa.Numeric(14, 2), nullable=True),
        sa.Column('moving_cost', sa.Numeric(14, 2), nullable=True),
        sa.Column('contingency', sa.Numeric(14, 2), nullable=True),
        sa.Column('developer_lawyer', sa.Numeric(14, 2), nullable=True),
        sa.Column('demolition', sa.Numeric(14, 2), nullable=True),
        sa.Column('construction_total', sa.Numeric(14, 2), nullable=True),
        sa.Column('parking_construction', sa.Numeric(14, 2), nullable=True),
        sa.Column('financing_interest_rate', sa.Numeric(5, 2), nullable=True),
        sa.Column('vat_rate', sa.Numeric(5, 2), nullable=True, server_default='17'),
        sa.Column('ai_extraction_metadata', JSON, nullable=True),
    )

    # --- Create revenue_parameters table ---
    op.create_table(
        'revenue_parameters',
        sa.Column('simulation_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('simulations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('price_per_unit_by_type', JSON, nullable=True),
        sa.Column('price_per_sqm_residential', sa.Numeric(12, 2), nullable=True),
        sa.Column('price_per_sqm_commercial', sa.Numeric(12, 2), nullable=True),
        sa.Column('ai_extraction_metadata', JSON, nullable=True),
    )

    # --- Add new columns to planning_parameters ---
    op.add_column('planning_parameters', sa.Column('return_area_per_apt', sa.Numeric(8, 2), nullable=True))
    op.add_column('planning_parameters', sa.Column('service_area_percent', sa.Numeric(5, 2), nullable=True))
    op.add_column('planning_parameters', sa.Column('public_area_sqm', sa.Numeric(10, 2), nullable=True))
    op.add_column('planning_parameters', sa.Column('parking_floor_area', sa.Numeric(10, 2), nullable=True))
    op.add_column('planning_parameters', sa.Column('balcony_area_per_unit', sa.Numeric(8, 2), nullable=True))
    op.add_column('planning_parameters', sa.Column('blue_line_area', sa.Numeric(10, 2), nullable=True))

    # Make existing NOT NULL columns nullable for flexibility
    op.alter_column('planning_parameters', 'returns_percent', nullable=True)
    op.alter_column('planning_parameters', 'multiplier_far', nullable=True)
    op.alter_column('planning_parameters', 'avg_apt_size_sqm', nullable=True)
    op.alter_column('planning_parameters', 'service_area_sqm', nullable=True)
    op.alter_column('planning_parameters', 'number_of_floors', nullable=True)
    op.alter_column('planning_parameters', 'coverage_above_ground', nullable=True)
    op.alter_column('planning_parameters', 'coverage_underground', nullable=True)
    op.alter_column('planning_parameters', 'gross_area_per_parking', nullable=True)
    op.alter_column('planning_parameters', 'parking_standard_ratio', nullable=True)
    op.alter_column('planning_parameters', 'typ_floor_area_min', nullable=True)
    op.alter_column('planning_parameters', 'typ_floor_area_max', nullable=True)
    op.alter_column('planning_parameters', 'apts_per_floor_min', nullable=True)
    op.alter_column('planning_parameters', 'apts_per_floor_max', nullable=True)

    # Make existing NOT NULL columns on simulation_results nullable
    op.alter_column('simulation_results', 'profit', nullable=True)
    op.alter_column('simulation_results', 'profitability_rate', nullable=True)
    op.alter_column('simulation_results', 'irr', nullable=True)
    op.alter_column('simulation_results', 'npv', nullable=True)

    # --- Add new columns to simulation_results ---
    # מצב יוצא
    op.add_column('simulation_results', sa.Column('total_return_floorplate', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_new_units', sa.Integer(), nullable=True))
    op.add_column('simulation_results', sa.Column('total_floorplate', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('developer_units', sa.Integer(), nullable=True))
    op.add_column('simulation_results', sa.Column('developer_floorplate', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('avg_developer_unit_size', sa.Numeric(10, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('combination_ratio', sa.Numeric(5, 2), nullable=True))
    # פרוגרמה
    op.add_column('simulation_results', sa.Column('service_areas', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_above_ground', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('floor_area', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('max_buildings', sa.Integer(), nullable=True))
    op.add_column('simulation_results', sa.Column('above_ground_per_building', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('development_land', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('residential_per_building', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('return_units_per_building', sa.Numeric(8, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('developer_units_per_building', sa.Numeric(8, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('developer_floorplate_per_building', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_parking_spots', sa.Integer(), nullable=True))
    op.add_column('simulation_results', sa.Column('total_parking_area', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('parking_floors', sa.Numeric(8, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_balcony_area', sa.Numeric(14, 2), nullable=True))
    # Financial
    op.add_column('simulation_results', sa.Column('financing_cost', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_costs_excl_vat', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('total_costs_incl_vat', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('expected_profit', sa.Numeric(14, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('profit_percent', sa.Numeric(8, 2), nullable=True))
    op.add_column('simulation_results', sa.Column('profit_percent_standard21', sa.Numeric(8, 2), nullable=True))
    # Breakdowns
    op.add_column('simulation_results', sa.Column('cost_breakdown', JSON, nullable=True))
    op.add_column('simulation_results', sa.Column('revenue_breakdown', JSON, nullable=True))
    op.add_column('simulation_results', sa.Column('area_breakdown', JSON, nullable=True))


def downgrade() -> None:
    # Drop new columns from simulation_results
    for col in [
        'total_return_floorplate', 'total_new_units', 'total_floorplate',
        'developer_units', 'developer_floorplate', 'avg_developer_unit_size',
        'combination_ratio', 'service_areas', 'total_above_ground', 'floor_area',
        'max_buildings', 'above_ground_per_building', 'development_land',
        'residential_per_building', 'return_units_per_building',
        'developer_units_per_building', 'developer_floorplate_per_building',
        'total_parking_spots', 'total_parking_area', 'parking_floors',
        'total_balcony_area', 'financing_cost', 'total_costs_excl_vat',
        'total_costs_incl_vat', 'expected_profit', 'profit_percent',
        'profit_percent_standard21', 'cost_breakdown', 'revenue_breakdown',
        'area_breakdown',
    ]:
        op.drop_column('simulation_results', col)

    # Drop new columns from planning_parameters
    for col in ['return_area_per_apt', 'service_area_percent', 'public_area_sqm',
                'parking_floor_area', 'balcony_area_per_unit', 'blue_line_area']:
        op.drop_column('planning_parameters', col)

    # Drop new tables
    op.drop_table('revenue_parameters')
    op.drop_table('cost_parameters')
