"""add branding fields to user_settings

Revision ID: 2df4a8530b18
Revises: c3d4e5f6g7h8
Create Date: 2026-04-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2df4a8530b18"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_settings', sa.Column('company_name', sa.String(255), nullable=True))
    op.add_column('user_settings', sa.Column('logo_filename', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('user_settings', 'logo_filename')
    op.drop_column('user_settings', 'company_name')
