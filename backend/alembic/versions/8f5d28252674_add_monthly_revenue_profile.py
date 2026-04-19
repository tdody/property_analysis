"""add monthly revenue profile columns

Revision ID: 8f5d28252674
Revises: 2df4a8530b18
Create Date: 2026-04-05
"""

import json
from alembic import op
import sqlalchemy as sa

revision = "8f5d28252674"
down_revision = "2df4a8530b18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "str_assumptions",
        sa.Column("monthly_revenue_profile", sa.Text(), nullable=True),
    )
    op.add_column(
        "str_assumptions",
        sa.Column("profile_template_name", sa.String(50), nullable=True),
    )

    # Convert existing seasonal occupancy rows into 12-month profiles
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, use_seasonal_occupancy, peak_months, peak_occupancy_pct, "
            "off_peak_occupancy_pct, avg_nightly_rate FROM str_assumptions "
            "WHERE use_seasonal_occupancy = 1"
        )
    ).fetchall()

    for row in rows:
        id_, _, peak_months, peak_occ, off_peak_occ, nightly_rate = row
        profile = []
        for m in range(1, 13):
            is_peak = m <= peak_months
            occ = float(peak_occ) if is_peak else float(off_peak_occ)
            profile.append(
                {
                    "month": m,
                    "nightly_rate": float(nightly_rate),
                    "occupancy_pct": occ,
                }
            )
        conn.execute(
            sa.text(
                "UPDATE str_assumptions SET monthly_revenue_profile = :profile "
                "WHERE id = :id"
            ),
            {"profile": json.dumps(profile), "id": id_},
        )


def downgrade() -> None:
    op.drop_column("str_assumptions", "profile_template_name")
    op.drop_column("str_assumptions", "monthly_revenue_profile")
