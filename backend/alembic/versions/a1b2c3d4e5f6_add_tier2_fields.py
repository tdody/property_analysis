"""add tier 2 fields: damage reserve, origination points, depreciation, appreciation

Revision ID: a1b2c3d4e5f6
Revises: 54f3c5c1bb6d
Create Date: 2026-03-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '54f3c5c1bb6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Task 1: Guest Damage Reserve
    op.add_column('str_assumptions', sa.Column('damage_reserve_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='2.0'))
    # Task 2: Loan Origination Points
    op.add_column('mortgage_scenarios', sa.Column('origination_points_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='0'))
    # Task 3: Depreciation (land value %)
    op.add_column('str_assumptions', sa.Column('land_value_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='20.0'))
    # Task 4: Property Appreciation
    op.add_column('str_assumptions', sa.Column('property_appreciation_pct_annual', sa.Numeric(precision=6, scale=2), nullable=False, server_default='2.5'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('str_assumptions', 'property_appreciation_pct_annual')
    op.drop_column('str_assumptions', 'land_value_pct')
    op.drop_column('mortgage_scenarios', 'origination_points_pct')
    op.drop_column('str_assumptions', 'damage_reserve_pct')
