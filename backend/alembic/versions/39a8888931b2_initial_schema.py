"""initial schema

Revision ID: 39a8888931b2
Revises:
Create Date: 2026-04-04 17:30:56.470396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39a8888931b2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables from scratch (squashed initial schema)."""
    op.create_table(
        'properties',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('source_url', sa.String(2048), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('address', sa.String(500), nullable=False),
        sa.Column('city', sa.String(255), nullable=False),
        sa.Column('state', sa.String(2), nullable=False),
        sa.Column('zip_code', sa.String(10), nullable=False),
        sa.Column('listing_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('estimated_value', sa.Numeric(12, 2), nullable=True),
        sa.Column('beds', sa.Integer(), nullable=False),
        sa.Column('baths', sa.Float(), nullable=False),
        sa.Column('sqft', sa.Integer(), nullable=False),
        sa.Column('lot_sqft', sa.Integer(), nullable=True),
        sa.Column('year_built', sa.Integer(), nullable=True),
        sa.Column('property_type', sa.String(50), nullable=False),
        sa.Column('hoa_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('annual_taxes', sa.Numeric(10, 2), nullable=False),
        sa.Column('tax_rate', sa.Numeric(6, 4), nullable=True),
        sa.Column('is_homestead_tax', sa.Boolean(), nullable=False),
        sa.Column('nonhomestead_annual_taxes', sa.Numeric(10, 2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('is_archived', sa.Boolean(), nullable=False),
        sa.Column('in_portfolio', sa.Boolean(), nullable=False),
        sa.Column('cached_monthly_cashflow', sa.Numeric(10, 2), nullable=True),
        sa.Column('cached_cash_on_cash_return', sa.Numeric(10, 4), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'mortgage_scenarios',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('property_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('loan_type', sa.String(20), nullable=False),
        sa.Column('purchase_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('down_payment_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('down_payment_amt', sa.Numeric(12, 2), nullable=False),
        sa.Column('interest_rate', sa.Numeric(6, 3), nullable=False),
        sa.Column('loan_term_years', sa.Integer(), nullable=False),
        sa.Column('closing_cost_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('closing_cost_amt', sa.Numeric(12, 2), nullable=False),
        sa.Column('renovation_cost', sa.Numeric(12, 2), nullable=False),
        sa.Column('furniture_cost', sa.Numeric(12, 2), nullable=False),
        sa.Column('other_upfront_costs', sa.Numeric(12, 2), nullable=False),
        sa.Column('pmi_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('origination_points_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('io_period_years', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'str_assumptions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('property_id', sa.String(36), nullable=False),
        sa.Column('avg_nightly_rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('occupancy_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('cleaning_fee_per_stay', sa.Numeric(10, 2), nullable=False),
        sa.Column('avg_stay_length_nights', sa.Numeric(6, 2), nullable=False),
        sa.Column('platform_fee_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('cleaning_cost_per_turn', sa.Numeric(10, 2), nullable=False),
        sa.Column('property_mgmt_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('utilities_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('insurance_annual', sa.Numeric(10, 2), nullable=False),
        sa.Column('maintenance_reserve_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('capex_reserve_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('damage_reserve_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('supplies_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('lawn_snow_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('other_monthly_expense', sa.Numeric(10, 2), nullable=False),
        sa.Column('vacancy_reserve_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('marketing_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('software_monthly', sa.Numeric(10, 2), nullable=False),
        sa.Column('accounting_annual', sa.Numeric(10, 2), nullable=False),
        sa.Column('legal_annual', sa.Numeric(10, 2), nullable=False),
        sa.Column('rental_delay_months', sa.Integer(), nullable=False),
        sa.Column('state_rooms_tax_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('str_surcharge_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('local_option_tax_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('local_str_registration_fee', sa.Numeric(10, 2), nullable=False),
        sa.Column('local_gross_receipts_tax_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('platform_remits_tax', sa.Boolean(), nullable=False),
        sa.Column('land_value_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('property_appreciation_pct_annual', sa.Numeric(6, 2), nullable=False),
        sa.Column('revenue_growth_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('expense_growth_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('marginal_tax_rate_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('use_seasonal_occupancy', sa.Boolean(), nullable=False),
        sa.Column('peak_months', sa.Integer(), nullable=False),
        sa.Column('peak_occupancy_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('off_peak_occupancy_pct', sa.Numeric(6, 2), nullable=False),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'user_settings',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('default_peak_months', sa.Integer(), nullable=False),
        sa.Column('default_peak_occupancy_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('default_off_peak_occupancy_pct', sa.Numeric(6, 2), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('user_settings')
    op.drop_table('str_assumptions')
    op.drop_table('mortgage_scenarios')
    op.drop_table('properties')
