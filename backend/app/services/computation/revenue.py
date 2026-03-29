def compute_occupied_nights(occupancy_pct: float) -> float:
    return 365 * (occupancy_pct / 100)


def compute_annual_turnovers(occupied_nights: float, avg_stay_length_nights: float) -> float:
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
