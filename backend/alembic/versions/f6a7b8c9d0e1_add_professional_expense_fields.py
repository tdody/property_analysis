"""add marketing, software, accounting, legal expense fields

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-30 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('str_assumptions', sa.Column('marketing_monthly', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))
    op.add_column('str_assumptions', sa.Column('software_monthly', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))
    op.add_column('str_assumptions', sa.Column('accounting_annual', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))
    op.add_column('str_assumptions', sa.Column('legal_annual', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('str_assumptions', 'legal_annual')
    op.drop_column('str_assumptions', 'accounting_annual')
    op.drop_column('str_assumptions', 'software_monthly')
    op.drop_column('str_assumptions', 'marketing_monthly')
