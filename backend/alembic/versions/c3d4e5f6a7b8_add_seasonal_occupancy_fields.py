"""add seasonal occupancy fields

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-30 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('str_assumptions', sa.Column('use_seasonal_occupancy', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('str_assumptions', sa.Column('peak_months', sa.Integer(), nullable=False, server_default='6'))
    op.add_column('str_assumptions', sa.Column('peak_occupancy_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='80.0'))
    op.add_column('str_assumptions', sa.Column('off_peak_occupancy_pct', sa.Numeric(precision=6, scale=2), nullable=False, server_default='45.0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('str_assumptions', 'off_peak_occupancy_pct')
    op.drop_column('str_assumptions', 'peak_occupancy_pct')
    op.drop_column('str_assumptions', 'peak_months')
    op.drop_column('str_assumptions', 'use_seasonal_occupancy')
