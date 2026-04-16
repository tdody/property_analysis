"""Server-side chart rendering for PDF export using matplotlib."""

import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker


# Consistent color palette
COLORS = {
    "primary": "#4f46e5",  # indigo-600
    "secondary": "#7c3aed",  # violet-600
    "positive": "#059669",  # emerald-600
    "negative": "#dc2626",  # red-600
    "neutral": "#64748b",  # slate-500
    "light": "#e2e8f0",  # slate-200
}


def _currency_formatter(x: float, _pos: int | None = None) -> str:
    if abs(x) >= 1_000_000:
        return f"${x / 1_000_000:.1f}M"
    if abs(x) >= 1_000:
        return f"${x / 1_000:.0f}K"
    return f"${x:,.0f}"


def render_projection_chart(projections: list[dict]) -> bytes:
    """Render a 5-year projection chart as PNG bytes.

    Shows annual cashflow (bars) and equity (line) over 5 years.
    """
    years = [p["year"] for p in projections]
    cashflows = [p["annual_cashflow"] for p in projections]
    equities = [p["equity"] for p in projections]
    prop_values = [p["property_value"] for p in projections]

    fig, ax1 = plt.subplots(figsize=(7, 3.5), dpi=150)

    # Cashflow bars
    bar_colors = [
        COLORS["positive"] if cf >= 0 else COLORS["negative"] for cf in cashflows
    ]
    ax1.bar(
        years,
        cashflows,
        width=0.5,
        color=bar_colors,
        alpha=0.85,
        label="Annual Cashflow",
        zorder=3,
    )
    ax1.set_xlabel("Year", fontsize=9, color="#475569")
    ax1.set_ylabel("Annual Cashflow", fontsize=9, color="#475569")
    ax1.yaxis.set_major_formatter(mticker.FuncFormatter(_currency_formatter))
    ax1.axhline(y=0, color=COLORS["light"], linewidth=0.8, zorder=1)
    ax1.set_xticks(years)
    ax1.tick_params(labelsize=8)

    # Equity line on secondary axis
    ax2 = ax1.twinx()
    ax2.plot(
        years,
        equities,
        color=COLORS["primary"],
        marker="o",
        markersize=5,
        linewidth=2,
        label="Equity",
        zorder=4,
    )
    ax2.plot(
        years,
        prop_values,
        color=COLORS["secondary"],
        marker="s",
        markersize=4,
        linewidth=1.5,
        linestyle="--",
        label="Property Value",
        zorder=4,
    )
    ax2.set_ylabel("Value", fontsize=9, color="#475569")
    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(_currency_formatter))
    ax2.tick_params(labelsize=8)

    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(
        lines1 + lines2, labels1 + labels2, fontsize=7, loc="upper left", framealpha=0.9
    )

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def render_sensitivity_chart(
    occupancy_sweep: list[dict], rate_sweep: list[dict]
) -> bytes:
    """Render sensitivity analysis as two line charts (occupancy and rate sweeps)."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7, 3), dpi=150)

    # Occupancy sweep
    occ_pcts = [p["occupancy_pct"] for p in occupancy_sweep]
    occ_cfs = [p["monthly_cashflow"] for p in occupancy_sweep]
    ax1.plot(
        occ_pcts,
        occ_cfs,
        color=COLORS["primary"],
        linewidth=2,
        marker="o",
        markersize=3,
    )
    ax1.axhline(y=0, color=COLORS["negative"], linewidth=0.8, linestyle="--", alpha=0.6)
    ax1.fill_between(
        occ_pcts,
        occ_cfs,
        0,
        where=[cf >= 0 for cf in occ_cfs],
        alpha=0.1,
        color=COLORS["positive"],
    )
    ax1.fill_between(
        occ_pcts,
        occ_cfs,
        0,
        where=[cf < 0 for cf in occ_cfs],
        alpha=0.1,
        color=COLORS["negative"],
    )
    ax1.set_xlabel("Occupancy %", fontsize=8, color="#475569")
    ax1.set_ylabel("Monthly Cashflow", fontsize=8, color="#475569")
    ax1.set_title(
        "Occupancy Sensitivity", fontsize=9, fontweight="bold", color="#1e293b"
    )
    ax1.yaxis.set_major_formatter(mticker.FuncFormatter(_currency_formatter))
    ax1.tick_params(labelsize=7)

    # Rate sweep
    rates = [p["nightly_rate"] for p in rate_sweep]
    rate_cfs = [p["monthly_cashflow"] for p in rate_sweep]
    ax2.plot(
        rates,
        rate_cfs,
        color=COLORS["secondary"],
        linewidth=2,
        marker="o",
        markersize=3,
    )
    ax2.axhline(y=0, color=COLORS["negative"], linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.fill_between(
        rates,
        rate_cfs,
        0,
        where=[cf >= 0 for cf in rate_cfs],
        alpha=0.1,
        color=COLORS["positive"],
    )
    ax2.fill_between(
        rates,
        rate_cfs,
        0,
        where=[cf < 0 for cf in rate_cfs],
        alpha=0.1,
        color=COLORS["negative"],
    )
    ax2.set_xlabel("Nightly Rate ($)", fontsize=8, color="#475569")
    ax2.set_ylabel("Monthly Cashflow", fontsize=8, color="#475569")
    ax2.set_title("Rate Sensitivity", fontsize=9, fontweight="bold", color="#1e293b")
    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(_currency_formatter))
    ax2.tick_params(labelsize=7)

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def render_ltr_sensitivity_chart(
    vacancy_sweep: list[dict], rent_sweep: list[dict]
) -> bytes:
    """Render LTR sensitivity analysis as two line charts."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7, 3), dpi=150)

    # Vacancy sweep
    vac_pcts = [p["vacancy_pct"] for p in vacancy_sweep]
    vac_cfs = [p["monthly_cashflow"] for p in vacancy_sweep]
    ax1.plot(
        vac_pcts,
        vac_cfs,
        color=COLORS["primary"],
        linewidth=2,
        marker="o",
        markersize=3,
    )
    ax1.axhline(y=0, color=COLORS["negative"], linewidth=0.8, linestyle="--", alpha=0.6)
    ax1.fill_between(
        vac_pcts,
        vac_cfs,
        0,
        where=[cf >= 0 for cf in vac_cfs],
        alpha=0.1,
        color=COLORS["positive"],
    )
    ax1.fill_between(
        vac_pcts,
        vac_cfs,
        0,
        where=[cf < 0 for cf in vac_cfs],
        alpha=0.1,
        color=COLORS["negative"],
    )
    ax1.set_xlabel("Vacancy %", fontsize=8, color="#475569")
    ax1.set_ylabel("Monthly Cashflow", fontsize=8, color="#475569")
    ax1.set_title("Vacancy Sensitivity", fontsize=9, fontweight="bold", color="#1e293b")
    ax1.yaxis.set_major_formatter(mticker.FuncFormatter(_currency_formatter))
    ax1.tick_params(labelsize=7)

    # Rent sweep
    rents = [p["monthly_rent"] for p in rent_sweep]
    rent_cfs = [p["monthly_cashflow"] for p in rent_sweep]
    ax2.plot(
        rents,
        rent_cfs,
        color=COLORS["secondary"],
        linewidth=2,
        marker="o",
        markersize=3,
    )
    ax2.axhline(y=0, color=COLORS["negative"], linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.fill_between(
        rents,
        rent_cfs,
        0,
        where=[cf >= 0 for cf in rent_cfs],
        alpha=0.1,
        color=COLORS["positive"],
    )
    ax2.fill_between(
        rents,
        rent_cfs,
        0,
        where=[cf < 0 for cf in rent_cfs],
        alpha=0.1,
        color=COLORS["negative"],
    )
    ax2.set_xlabel("Monthly Rent ($)", fontsize=8, color="#475569")
    ax2.set_ylabel("Monthly Cashflow", fontsize=8, color="#475569")
    ax2.set_title("Rent Sensitivity", fontsize=9, fontweight="bold", color="#1e293b")
    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(_currency_formatter))
    ax2.tick_params(labelsize=7)

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf.read()
