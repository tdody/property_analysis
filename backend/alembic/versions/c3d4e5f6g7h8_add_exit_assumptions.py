"""add exit assumption columns to str_assumptions

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-04-05 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6g7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "str_assumptions",
        sa.Column("hold_period_years", sa.Integer(), nullable=True, server_default="5"),
    )
    op.add_column(
        "str_assumptions",
        sa.Column(
            "selling_cost_pct", sa.Numeric(6, 2), nullable=True, server_default="8.0"
        ),
    )
    op.add_column(
        "str_assumptions",
        sa.Column(
            "capital_gains_rate_pct",
            sa.Numeric(6, 2),
            nullable=True,
            server_default="20.0",
        ),
    )
    op.add_column(
        "str_assumptions",
        sa.Column(
            "depreciation_recapture_rate_pct",
            sa.Numeric(6, 2),
            nullable=True,
            server_default="25.0",
        ),
    )


def downgrade() -> None:
    op.drop_column("str_assumptions", "depreciation_recapture_rate_pct")
    op.drop_column("str_assumptions", "capital_gains_rate_pct")
    op.drop_column("str_assumptions", "selling_cost_pct")
    op.drop_column("str_assumptions", "hold_period_years")
