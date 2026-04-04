"""add cached metric columns to properties

Revision ID: ccde7f0b427b
Revises: be542e0a5a22
Create Date: 2026-04-04 17:16:46.852408

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ccde7f0b427b'
down_revision: Union[str, Sequence[str], None] = 'be542e0a5a22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("properties", sa.Column("cached_monthly_cashflow", sa.Numeric(10, 2), nullable=True))
    op.add_column("properties", sa.Column("cached_cash_on_cash_return", sa.Numeric(10, 4), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("properties", "cached_monthly_cashflow")
    op.drop_column("properties", "cached_cash_on_cash_return")
