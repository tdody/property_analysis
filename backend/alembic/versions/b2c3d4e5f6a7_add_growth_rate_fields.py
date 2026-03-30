"""add revenue and expense growth rate fields for multi-year projections

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('str_assumptions', sa.Column('revenue_growth_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='3.0'))
    op.add_column('str_assumptions', sa.Column('expense_growth_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='3.0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('str_assumptions', 'expense_growth_pct')
    op.drop_column('str_assumptions', 'revenue_growth_pct')
