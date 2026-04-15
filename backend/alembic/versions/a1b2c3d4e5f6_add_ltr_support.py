"""add LTR support

Revision ID: a1b2c3d4e5f6
Revises: 0ba6456e1927
Create Date: 2026-04-04 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "0ba6456e1927"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add active_rental_type column to properties
    op.add_column(
        "properties",
        sa.Column(
            "active_rental_type", sa.String(10), server_default="str", nullable=False
        ),
    )

    # Create ltr_assumptions table
    op.create_table(
        "ltr_assumptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "property_id",
            sa.String(36),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        # Revenue
        sa.Column(
            "monthly_rent", sa.Numeric(10, 2), server_default="1500", nullable=False
        ),
        sa.Column(
            "lease_duration_months", sa.Integer, server_default="12", nullable=False
        ),
        sa.Column(
            "pet_rent_monthly", sa.Numeric(10, 2), server_default="0", nullable=False
        ),
        sa.Column(
            "late_fee_monthly", sa.Numeric(10, 2), server_default="0", nullable=False
        ),
        sa.Column(
            "vacancy_rate_pct", sa.Numeric(6, 2), server_default="5.0", nullable=False
        ),
        sa.Column(
            "lease_up_period_months", sa.Integer, server_default="1", nullable=False
        ),
        # Expenses
        sa.Column(
            "property_mgmt_pct", sa.Numeric(6, 2), server_default="8.0", nullable=False
        ),
        sa.Column(
            "insurance_annual", sa.Numeric(10, 2), server_default="2500", nullable=False
        ),
        sa.Column(
            "maintenance_reserve_pct",
            sa.Numeric(6, 2),
            server_default="5.0",
            nullable=False,
        ),
        sa.Column(
            "capex_reserve_pct", sa.Numeric(6, 2), server_default="5.0", nullable=False
        ),
        sa.Column(
            "landlord_repairs_annual",
            sa.Numeric(10, 2),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "tenant_turnover_cost",
            sa.Numeric(10, 2),
            server_default="1500",
            nullable=False,
        ),
        sa.Column(
            "utilities_monthly", sa.Numeric(10, 2), server_default="0", nullable=False
        ),
        sa.Column(
            "lawn_snow_monthly", sa.Numeric(10, 2), server_default="0", nullable=False
        ),
        sa.Column(
            "other_monthly_expense",
            sa.Numeric(10, 2),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "accounting_annual", sa.Numeric(10, 2), server_default="0", nullable=False
        ),
        sa.Column(
            "legal_annual", sa.Numeric(10, 2), server_default="0", nullable=False
        ),
        # Growth / Depreciation
        sa.Column(
            "land_value_pct", sa.Numeric(6, 2), server_default="20.0", nullable=False
        ),
        sa.Column(
            "property_appreciation_pct_annual",
            sa.Numeric(6, 2),
            server_default="2.5",
            nullable=False,
        ),
        sa.Column(
            "revenue_growth_pct", sa.Numeric(6, 2), server_default="3.0", nullable=False
        ),
        sa.Column(
            "expense_growth_pct", sa.Numeric(6, 2), server_default="3.0", nullable=False
        ),
        sa.Column(
            "marginal_tax_rate_pct",
            sa.Numeric(6, 2),
            server_default="0",
            nullable=False,
        ),
    )

    # Bulk-insert default LTR rows for existing properties
    op.execute(
        """
        INSERT INTO ltr_assumptions (id, property_id)
        SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
               id
        FROM properties
        WHERE id NOT IN (SELECT property_id FROM ltr_assumptions)
        """
    )


def downgrade() -> None:
    op.drop_table("ltr_assumptions")
    op.drop_column("properties", "active_rental_type")
