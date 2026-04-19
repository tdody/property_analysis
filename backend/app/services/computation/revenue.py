def compute_occupied_nights(occupancy_pct: float) -> float:
    return 365 * (occupancy_pct / 100)


def compute_annual_turnovers(
    occupied_nights: float, avg_stay_length_nights: float
) -> float:
    if avg_stay_length_nights <= 0:
        return 0
    return occupied_nights / avg_stay_length_nights


def compute_gross_revenue(
    avg_nightly_rate: float,
    occupancy_pct: float,
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
) -> dict:
    occupied_nights = compute_occupied_nights(occupancy_pct)
    turnovers = compute_annual_turnovers(occupied_nights, avg_stay_length_nights)
    gross_nightly = occupied_nights * avg_nightly_rate
    cleaning_revenue = turnovers * cleaning_fee_per_stay
    return {
        "gross_nightly_revenue": gross_nightly,
        "cleaning_fee_revenue": cleaning_revenue,
        "total_gross_revenue": gross_nightly + cleaning_revenue,
        "annual_turnovers": turnovers,
        "occupied_nights": occupied_nights,
    }


def compute_net_revenue(total_gross_revenue: float, platform_fee_pct: float) -> dict:
    fees = total_gross_revenue * (platform_fee_pct / 100)
    return {"platform_fees": fees, "net_revenue": total_gross_revenue - fees}


def compute_effective_occupancy(
    peak_months: int, peak_occupancy_pct: float, off_peak_occupancy_pct: float
) -> float:
    return (
        peak_months * peak_occupancy_pct + (12 - peak_months) * off_peak_occupancy_pct
    ) / 12


def compute_year1_revenue(annual_revenue: float, rental_delay_months: int) -> float:
    if rental_delay_months >= 12:
        return 0
    return annual_revenue * (12 - rental_delay_months) / 12


def compute_monthly_revenue(
    profile: list[dict],
    cleaning_fee_per_stay: float,
    avg_stay_length_nights: float,
) -> list[dict]:
    from app.services.computation.profile_templates import DAYS_IN_MONTH

    results = []
    for entry in sorted(profile, key=lambda e: e["month"]):
        m = entry["month"]
        rate = entry["nightly_rate"]
        occ = entry["occupancy_pct"]
        days = DAYS_IN_MONTH[m - 1]
        occupied_nights = days * (occ / 100)
        turnovers = (
            occupied_nights / avg_stay_length_nights
            if avg_stay_length_nights > 0
            else 0
        )
        gross_nightly = occupied_nights * rate
        cleaning_revenue = turnovers * cleaning_fee_per_stay
        results.append(
            {
                "month": m,
                "nightly_rate": rate,
                "occupancy_pct": occ,
                "occupied_nights": occupied_nights,
                "turnovers": turnovers,
                "gross_nightly_revenue": gross_nightly,
                "cleaning_fee_revenue": cleaning_revenue,
                "total_gross_revenue": gross_nightly + cleaning_revenue,
            }
        )
    return results


def compute_annual_from_monthly(monthly_results: list[dict]) -> dict:
    total_gross_nightly = sum(m["gross_nightly_revenue"] for m in monthly_results)
    total_cleaning = sum(m["cleaning_fee_revenue"] for m in monthly_results)
    total_gross = sum(m["total_gross_revenue"] for m in monthly_results)
    total_turnovers = sum(m["turnovers"] for m in monthly_results)
    total_occupied = sum(m["occupied_nights"] for m in monthly_results)
    return {
        "gross_nightly_revenue": total_gross_nightly,
        "cleaning_fee_revenue": total_cleaning,
        "total_gross_revenue": total_gross,
        "annual_turnovers": total_turnovers,
        "occupied_nights": total_occupied,
    }
