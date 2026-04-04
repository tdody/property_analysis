"""add on delete cascade to foreign keys

Revision ID: be542e0a5a22
Revises: 02670f9459b4
Create Date: 2026-04-04 17:12:48.047924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be542e0a5a22'
down_revision: Union[str, Sequence[str], None] = '02670f9459b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


def upgrade() -> None:
    """Upgrade schema."""
    # mortgage_scenarios FK
    with op.batch_alter_table("mortgage_scenarios", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_mortgage_scenarios_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_mortgage_scenarios_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # str_assumptions FK
    with op.batch_alter_table("str_assumptions", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_str_assumptions_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_str_assumptions_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("mortgage_scenarios", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_mortgage_scenarios_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_mortgage_scenarios_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
        )

    with op.batch_alter_table("str_assumptions", naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint(
            "fk_str_assumptions_property_id_properties", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_str_assumptions_property_id_properties",
            "properties",
            ["property_id"],
            ["id"],
        )
