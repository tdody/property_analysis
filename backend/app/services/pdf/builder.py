"""PDF builder for lender packets using fpdf2."""

import io
import tempfile
from datetime import date
from pathlib import Path

import httpx
from fpdf import FPDF

# Indigo-600 RGB
ACCENT = (79, 70, 229)
DARK = (30, 41, 59)       # slate-800
MUTED = (100, 116, 139)   # slate-500
LIGHT_BG = (248, 250, 252) # slate-50

LOGO_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads" / "logos"


def _fmt_currency(val: float) -> str:
    if val < 0:
        return f"-${abs(val):,.0f}"
    return f"${val:,.0f}"


def _fmt_pct(val: float) -> str:
    return f"{val:.1f}%"


class LenderPacketPDF(FPDF):
    """Custom FPDF subclass for generating professional lender packets."""

    def __init__(self, company_name: str | None = None, logo_filename: str | None = None):
        super().__init__()
        self.company_name = company_name
        self.logo_path: Path | None = None
        if logo_filename:
            p = LOGO_DIR / logo_filename
            if p.exists():
                self.logo_path = p
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() == 1:
            return  # First page has custom header
        y_start = 8
        if self.logo_path:
            self.image(str(self.logo_path), x=10, y=y_start, h=10)
            x_text = 25
        else:
            x_text = 10
        if self.company_name:
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*MUTED)
            self.set_xy(x_text, y_start + 2)
            self.cell(0, 6, self.company_name)
        # Accent line
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.5)
        self.line(10, 20, self.w - 10, 20)
        self.set_y(24)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="R")

    def _section_title(self, title: str):
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*DARK)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.4)
        self.line(self.l_margin, self.get_y(), self.l_margin + 40, self.get_y())
        self.ln(4)

    def _label_value_row(self, label: str, value: str, bold_value: bool = False):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        self.cell(70, 5, label)
        self.set_font("Helvetica", "B" if bold_value else "", 9)
        self.set_text_color(*DARK)
        self.cell(0, 5, value, new_x="LMARGIN", new_y="NEXT")

    def _table_header(self, cols: list[tuple[str, int]], align: str = "L"):
        self.set_font("Helvetica", "B", 8)
        self.set_fill_color(*LIGHT_BG)
        self.set_text_color(*DARK)
        for label, w in cols:
            self.cell(w, 6, label, border=0, fill=True, align=align)
        self.ln()

    def _table_row(self, values: list[tuple[str, int]], bold: bool = False, align: str = "L"):
        self.set_font("Helvetica", "B" if bold else "", 8)
        self.set_text_color(*DARK)
        for val, w in values:
            self.cell(w, 5, val, border=0, align=align)
        self.ln()

    def add_cover_header(self, prop, scenario):
        """First-page header with property info and branding."""
        y_start = 10
        if self.logo_path:
            self.image(str(self.logo_path), x=10, y=y_start, h=14)
            x_text = 30
        else:
            x_text = 10

        if self.company_name:
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(*ACCENT)
            self.set_xy(x_text, y_start + 2)
            self.cell(0, 6, self.company_name)
            self.ln(6)

        # Accent line
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.6)
        y_line = max(self.get_y() + 4, y_start + 18)
        self.line(10, y_line, self.w - 10, y_line)
        self.set_y(y_line + 6)

        # Title
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*DARK)
        self.cell(0, 10, "Property Analysis - Lender Packet", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*MUTED)
        self.cell(0, 6, f"Generated {date.today().strftime('%B %d, %Y')}  |  Scenario: {scenario.name}", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def add_property_summary(self, prop, scenario):
        """Section 1: Property summary."""
        self._section_title("1. Property Summary")

        # Try to include property photo
        if prop.image_url:
            tmp_path = None
            try:
                resp = httpx.get(prop.image_url, timeout=5, follow_redirects=True)
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                    suffix = ".jpg" if "jpeg" in resp.headers.get("content-type", "") else ".png"
                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                        tmp.write(resp.content)
                        tmp_path = tmp.name
                    self.image(tmp_path, x=self.l_margin, w=60, h=40)
                    self.ln(42)
            except Exception:
                pass  # Skip photo on any error
            finally:
                if tmp_path:
                    Path(tmp_path).unlink(missing_ok=True)

        self._label_value_row("Property Name", prop.name, bold_value=True)
        address = f"{prop.address}, {prop.city}, {prop.state} {prop.zip_code}"
        self._label_value_row("Address", address)
        self._label_value_row("Listing Price", _fmt_currency(float(prop.listing_price)))
        self._label_value_row("Type", prop.property_type or "N/A")
        details = f"{prop.beds} bed / {float(prop.baths):.1f} bath / {prop.sqft:,} sqft"
        self._label_value_row("Details", details)
        if prop.year_built:
            self._label_value_row("Year Built", str(prop.year_built))
        if prop.hoa_monthly and float(prop.hoa_monthly) > 0:
            self._label_value_row("HOA", f"{_fmt_currency(float(prop.hoa_monthly))}/mo")
        self._label_value_row("Annual Taxes", _fmt_currency(float(prop.annual_taxes)))
        self.ln(4)

    def add_financing_terms(self, mortgage_results, scenario):
        """Section 2: Financing terms."""
        self._section_title("2. Financing Terms")
        self._label_value_row("Loan Type", scenario.loan_type.upper())
        self._label_value_row("Purchase Price", _fmt_currency(float(scenario.purchase_price)))
        self._label_value_row("Down Payment", f"{_fmt_currency(float(scenario.down_payment_amt))} ({float(scenario.down_payment_pct):.0f}%)")
        self._label_value_row("Loan Amount", _fmt_currency(mortgage_results.loan_amount))
        self._label_value_row("Interest Rate", f"{float(scenario.interest_rate):.2f}%")
        self._label_value_row("Loan Term", f"{scenario.loan_term_years} years")
        if scenario.io_period_years and scenario.io_period_years > 0:
            self._label_value_row("Interest-Only Period", f"{scenario.io_period_years} years")
        self._label_value_row("Monthly P&I", _fmt_currency(mortgage_results.monthly_pi))
        self._label_value_row("Total Monthly Housing", _fmt_currency(mortgage_results.total_monthly_housing), bold_value=True)
        self._label_value_row("Total Cash Invested", _fmt_currency(mortgage_results.total_cash_invested), bold_value=True)

        # Upfront cost breakdown
        if float(scenario.renovation_cost) > 0:
            self._label_value_row("  Renovation Cost", _fmt_currency(float(scenario.renovation_cost)))
        if float(scenario.furniture_cost) > 0:
            self._label_value_row("  Furniture Cost", _fmt_currency(float(scenario.furniture_cost)))
        if float(scenario.closing_cost_amt) > 0:
            self._label_value_row("  Closing Costs", _fmt_currency(float(scenario.closing_cost_amt)))
        self.ln(4)

    def add_revenue_assumptions_str(self, revenue_results, assumptions):
        """Section 3: STR revenue assumptions."""
        self._section_title("3. Revenue Assumptions (STR)")
        self._label_value_row("Avg Nightly Rate", _fmt_currency(float(assumptions.avg_nightly_rate)))
        if assumptions.use_seasonal_occupancy:
            self._label_value_row("Occupancy Model", "Seasonal")
            self._label_value_row("  Peak Months", str(assumptions.peak_months))
            self._label_value_row("  Peak Occupancy", _fmt_pct(float(assumptions.peak_occupancy_pct)))
            self._label_value_row("  Off-Peak Occupancy", _fmt_pct(float(assumptions.off_peak_occupancy_pct)))
        else:
            self._label_value_row("Occupancy", _fmt_pct(float(assumptions.occupancy_pct)))
        self._label_value_row("Cleaning Fee / Stay", _fmt_currency(float(assumptions.cleaning_fee_per_stay)))
        self._label_value_row("Avg Stay Length", f"{float(assumptions.avg_stay_length_nights):.1f} nights")
        self._label_value_row("Platform Fee", _fmt_pct(float(assumptions.platform_fee_pct)))
        self._label_value_row("Gross Annual Revenue", _fmt_currency(revenue_results.gross_annual), bold_value=True)
        self._label_value_row("Net Annual Revenue", _fmt_currency(revenue_results.net_annual), bold_value=True)
        self.ln(4)

    def add_revenue_assumptions_ltr(self, revenue_results, assumptions):
        """Section 3: LTR revenue assumptions."""
        self._section_title("3. Revenue Assumptions (LTR)")
        self._label_value_row("Monthly Rent", _fmt_currency(float(assumptions.monthly_rent)))
        if float(assumptions.pet_rent_monthly) > 0:
            self._label_value_row("Pet Rent", f"{_fmt_currency(float(assumptions.pet_rent_monthly))}/mo")
        self._label_value_row("Vacancy Rate", _fmt_pct(float(assumptions.vacancy_rate_pct)))
        self._label_value_row("Lease Duration", f"{int(assumptions.lease_duration_months)} months")
        self._label_value_row("Gross Annual Revenue", _fmt_currency(revenue_results["gross_annual"]), bold_value=True)
        self._label_value_row("Effective Annual Revenue", _fmt_currency(revenue_results["effective_annual"]), bold_value=True)
        self.ln(4)

    def add_expense_breakdown_str(self, expense_results):
        """Section 4: STR expense breakdown table."""
        self._section_title("4. Expense Breakdown")
        breakdown = expense_results.breakdown
        col_w = [100, 40]
        self._table_header([("Expense Item", col_w[0]), ("Annual", col_w[1])])

        items = [
            ("Cleaning Costs", breakdown.annual_cleaning_cost),
            ("Property Management", breakdown.property_mgmt_cost),
            ("Maintenance Reserve", breakdown.maintenance_reserve),
            ("CapEx Reserve", breakdown.capex_reserve),
            ("Damage Reserve", breakdown.damage_reserve),
            ("Insurance", breakdown.insurance_annual),
            ("Utilities", breakdown.utilities_annual),
            ("Supplies", breakdown.supplies_annual),
            ("Lawn & Snow", breakdown.lawn_snow_annual),
            ("Marketing", breakdown.marketing_annual),
            ("Software", breakdown.software_annual),
            ("Accounting", breakdown.accounting_annual),
            ("Legal", breakdown.legal_annual),
            ("STR Registration", breakdown.registration_annual),
            ("Gross Receipts Tax", breakdown.gross_receipts_tax),
            ("Other", breakdown.other_annual),
        ]
        for name, val in items:
            if val and val > 0:
                self._table_row([(name, col_w[0]), (_fmt_currency(val), col_w[1])])

        # Total row
        self.set_draw_color(*ACCENT)
        self.line(self.l_margin, self.get_y(), self.l_margin + sum(col_w), self.get_y())
        self.ln(1)
        self._table_row([("Total Operating Expenses", col_w[0]), (_fmt_currency(expense_results.total_annual_operating), col_w[1])], bold=True)
        self.ln(4)

    def add_expense_breakdown_ltr(self, expense_results):
        """Section 4: LTR expense breakdown table."""
        self._section_title("4. Expense Breakdown")
        breakdown = expense_results["breakdown"]
        col_w = [100, 40]
        self._table_header([("Expense Item", col_w[0]), ("Annual", col_w[1])])

        for name, key in [
            ("Property Management", "property_mgmt_cost"),
            ("Maintenance Reserve", "maintenance_reserve"),
            ("CapEx Reserve", "capex_reserve"),
            ("Turnover (Amortized)", "turnover_amortized"),
            ("Insurance", "insurance_annual"),
            ("Landlord Repairs", "landlord_repairs_annual"),
            ("Utilities", "utilities_annual"),
            ("Lawn & Snow", "lawn_snow_annual"),
            ("Accounting", "accounting_annual"),
            ("Legal", "legal_annual"),
            ("Other", "other_annual"),
        ]:
            val = breakdown.get(key, 0)
            if val and val > 0:
                self._table_row([(name, col_w[0]), (_fmt_currency(val), col_w[1])])

        self.set_draw_color(*ACCENT)
        self.line(self.l_margin, self.get_y(), self.l_margin + sum(col_w), self.get_y())
        self.ln(1)
        self._table_row([("Total Operating Expenses", col_w[0]), (_fmt_currency(expense_results["total_annual_operating"]), col_w[1])], bold=True)
        self.ln(4)

    def add_key_metrics(self, metrics, is_ltr: bool = False):
        """Section 5: Key metrics summary grid."""
        self._section_title("5. Key Metrics")

        # Access metrics - handle both dict and Pydantic model
        def _get(key: str, default=0):
            if isinstance(metrics, dict):
                return metrics.get(key, default)
            return getattr(metrics, key, default)

        grid = [
            ("Monthly Cashflow", _fmt_currency(_get("monthly_cashflow"))),
            ("Annual Cashflow", _fmt_currency(_get("annual_cashflow"))),
            ("Cash-on-Cash Return", _fmt_pct(_get("cash_on_cash_return"))),
            ("Cap Rate", _fmt_pct(_get("cap_rate"))),
            ("NOI", _fmt_currency(_get("noi"))),
            ("DSCR", f"{_get('dscr'):.2f}x"),
            ("Gross Yield", _fmt_pct(_get("gross_yield"))),
            ("Total ROI (Year 1)", _fmt_pct(_get("total_roi_year1"))),
        ]

        if is_ltr:
            grid.append(("Break-Even Vacancy", _fmt_pct(_get("break_even_vacancy_pct", 0))))
        else:
            grid.append(("Break-Even Occupancy", _fmt_pct(_get("break_even_occupancy", 0))))

        # After-tax metrics
        grid.append(("After-Tax Annual Cashflow", _fmt_currency(_get("after_tax_annual_cashflow", 0))))

        # Render as 2-column grid
        col_w = 90
        for i in range(0, len(grid), 2):
            self.set_font("Helvetica", "", 8)
            self.set_text_color(*MUTED)
            self.cell(col_w, 4, grid[i][0])
            if i + 1 < len(grid):
                self.cell(col_w, 4, grid[i + 1][0], new_x="LMARGIN", new_y="NEXT")
            else:
                self.ln()
            self.set_font("Helvetica", "B", 10)
            self.set_text_color(*DARK)
            self.cell(col_w, 6, grid[i][1])
            if i + 1 < len(grid):
                self.cell(col_w, 6, grid[i + 1][1], new_x="LMARGIN", new_y="NEXT")
            else:
                self.ln()
            self.ln(2)

        # DSCR warning
        dscr_warning = _get("dscr_warning")
        if dscr_warning:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(220, 38, 38)  # red-600
            self.multi_cell(0, 4, f"WARNING: {dscr_warning}")
            self.set_text_color(*DARK)
        self.ln(4)

    def add_amortization_summary(self, amortization: list[dict]):
        """Section 6: First 12 months + yearly summaries."""
        self._section_title("6. Amortization Schedule")

        if not amortization:
            self.set_font("Helvetica", "I", 9)
            self.set_text_color(*MUTED)
            self.cell(0, 5, "No amortization data available.", new_x="LMARGIN", new_y="NEXT")
            self.ln(4)
            return

        col_w = [25, 40, 40, 55]
        self._table_header([
            ("Month", col_w[0]),
            ("Principal", col_w[1]),
            ("Interest", col_w[2]),
            ("Remaining Balance", col_w[3]),
        ])

        # First 12 months
        for entry in amortization[:12]:
            self._table_row([
                (str(entry["month"]), col_w[0]),
                (_fmt_currency(entry["principal"]), col_w[1]),
                (_fmt_currency(entry["interest"]), col_w[2]),
                (_fmt_currency(entry["remaining_balance"]), col_w[3]),
            ])

        # Year summaries (years 2-5)
        self.ln(2)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*DARK)
        self.cell(0, 5, "Yearly Summary (Years 2-5)", new_x="LMARGIN", new_y="NEXT")
        self._table_header([
            ("Year", col_w[0]),
            ("Principal", col_w[1]),
            ("Interest", col_w[2]),
            ("End Balance", col_w[3]),
        ])
        for year in range(2, 6):
            start = (year - 1) * 12
            end = year * 12
            year_entries = amortization[start:end]
            if not year_entries:
                break
            principal = sum(e["principal"] for e in year_entries)
            interest = sum(e["interest"] for e in year_entries)
            end_balance = year_entries[-1]["remaining_balance"]
            self._table_row([
                (str(year), col_w[0]),
                (_fmt_currency(principal), col_w[1]),
                (_fmt_currency(interest), col_w[2]),
                (_fmt_currency(end_balance), col_w[3]),
            ])
        self.ln(4)

    def add_projection_chart(self, png_bytes: bytes):
        """Section 7: Multi-year projection chart."""
        self._section_title("7. Multi-Year Projections")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(png_bytes)
            tmp_path = tmp.name
        try:
            self.image(tmp_path, x=self.l_margin, w=self.w - 2 * self.l_margin)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
        self.ln(4)

    def add_sensitivity_chart(self, png_bytes: bytes):
        """Section 8: Sensitivity analysis chart."""
        self._section_title("8. Sensitivity Analysis")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(png_bytes)
            tmp_path = tmp.name
        try:
            self.image(tmp_path, x=self.l_margin, w=self.w - 2 * self.l_margin)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
        self.ln(4)

    def add_disclaimer(self):
        """Section 9: Disclaimer footer."""
        self.ln(4)
        self.set_draw_color(*LIGHT_BG)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*MUTED)
        disclaimer = (
            "DISCLAIMER: This analysis is based on assumptions and estimates provided by the user. "
            "Actual results may vary. This document does not constitute financial advice, an offer, "
            "or a guarantee of investment performance. All projections are forward-looking and subject "
            "to market conditions, property-specific factors, and other risks. Consult with qualified "
            "financial, tax, and legal advisors before making investment decisions."
        )
        self.multi_cell(0, 3.5, disclaimer)

    def generate(self) -> bytes:
        """Return the PDF as bytes."""
        self.alias_nb_pages()
        return self.output()
