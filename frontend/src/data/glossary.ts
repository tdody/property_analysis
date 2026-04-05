export interface GlossaryEntry {
  term: string;
  definition: string;
  formula?: string;
  relatedTerms?: string[];
  category: "metrics" | "revenue" | "expenses" | "financing" | "tax";
}

export const GLOSSARY: GlossaryEntry[] = [
  // ── Metrics ──────────────────────────────────────────────
  {
    term: "Annual Cashflow",
    definition:
      "Monthly cashflow multiplied by 12. Your annual profit from the property after all operating expenses, debt service, and reserves.",
    formula: "Monthly Cashflow × 12",
    relatedTerms: ["Monthly Cashflow", "Cash-on-Cash Return"],
    category: "metrics",
  },
  {
    term: "Break-Even Occupancy",
    definition:
      "The minimum occupancy percentage needed to cover all costs (operating expenses + debt service). A good STR should break even at 40-55%. Above 65% means thin margins.",
    formula: "(Total Annual Costs) / (Gross Revenue at 100% Occupancy)",
    relatedTerms: ["Occupancy Rate", "NOI"],
    category: "metrics",
  },
  {
    term: "Cap Rate",
    definition:
      "Net Operating Income divided by the purchase price. A financing-independent measure of property value — useful for comparing deals regardless of loan terms. Good STR cap rates: 6-10%.",
    formula: "NOI / Purchase Price",
    relatedTerms: ["NOI", "Cash-on-Cash Return", "Purchase Price"],
    category: "metrics",
  },
  {
    term: "Cash-on-Cash Return",
    definition:
      "Annual cashflow divided by total cash invested. Measures the return on the actual cash you put into the deal (down payment, closing costs, renovation, etc.). A good STR target is 8-12%.",
    formula: "Annual Cashflow / Total Cash Invested",
    relatedTerms: ["Annual Cashflow", "Total Cash Invested", "Cap Rate"],
    category: "metrics",
  },
  {
    term: "DSCR",
    definition:
      "Debt Service Coverage Ratio. NOI divided by annual debt service (mortgage payments). Greater than 1.0 means income covers debt. Lenders typically require >= 1.25 for DSCR loans.",
    formula: "NOI / Annual Debt Service",
    relatedTerms: ["NOI", "DSCR Loan"],
    category: "metrics",
  },
  {
    term: "Gross Yield",
    definition:
      "Gross annual revenue divided by purchase price. A quick screening metric before accounting for expenses or financing. Good STR gross yields: 12-20%.",
    formula: "Gross Annual Revenue / Purchase Price",
    relatedTerms: ["Cap Rate", "Cash-on-Cash Return"],
    category: "metrics",
  },
  {
    term: "Monthly Cashflow",
    definition:
      "Net monthly income after all expenses, debt service, taxes, and reserves. Positive means the property pays you. Target: > $200/mo for a viable STR investment.",
    formula: "(Net Revenue - Operating Expenses - Monthly Housing) / 12",
    relatedTerms: ["Annual Cashflow", "NOI"],
    category: "metrics",
  },
  {
    term: "NOI",
    definition:
      "Net Operating Income. Gross revenue minus all operating expenses, before debt service. Used to calculate cap rate and DSCR. The key profitability metric independent of financing.",
    formula: "Gross Revenue - Operating Expenses",
    relatedTerms: ["Cap Rate", "DSCR", "Monthly Cashflow"],
    category: "metrics",
  },
  {
    term: "Total Cash Invested",
    definition:
      "The total upfront cash required to acquire and prepare the property. Includes down payment, closing costs, renovation, furniture, and other upfront costs.",
    formula: "Down Payment + Closing Costs + Renovation + Furniture + Other Upfront Costs",
    relatedTerms: ["Cash-on-Cash Return", "Down Payment"],
    category: "metrics",
  },
  {
    term: "Year-1 Total ROI",
    definition:
      "First-year return on investment including both cashflow and equity buildup from principal paydown. More complete than Cash-on-Cash because it accounts for the portion of each mortgage payment that builds equity.",
    formula: "(Annual Cashflow + Year-1 Equity Buildup) / Total Cash Invested",
    relatedTerms: ["Cash-on-Cash Return", "Year-1 ROI with Appreciation"],
    category: "metrics",
  },
  {
    term: "Year-1 ROI with Appreciation",
    definition:
      "First-year return including cashflow, equity buildup, and property appreciation. An optimistic ROI that includes unrealized gains from property value increase.",
    formula:
      "(Annual Cashflow + Equity Buildup + Property Appreciation) / Total Cash Invested",
    relatedTerms: ["Year-1 Total ROI", "Property Appreciation"],
    category: "metrics",
  },

  // ── Revenue (STR) ────────────────────────────────────────
  {
    term: "Average Nightly Rate",
    definition:
      "Your expected average nightly rate across all seasons. Research comparable STR listings in the area on Airbnb/VRBO. Look at similar bed count, amenities, and location.",
    relatedTerms: ["Occupancy Rate", "Gross Yield"],
    category: "revenue",
  },
  {
    term: "Average Stay Length",
    definition:
      "Average number of nights per booking. Urban STRs average 2-3 nights. Vacation/resort areas: 4-7 nights. Longer stays mean fewer turnovers and lower cleaning costs.",
    relatedTerms: ["Cleaning Fee per Stay", "Cleaning Cost per Turnover"],
    category: "revenue",
  },
  {
    term: "Cleaning Fee per Stay",
    definition:
      "Fee charged to the guest per booking. US averages by bedroom count: 1BR ~$100, 2BR ~$155, 3BR ~$175, 4BR+ ~$200-$300+. Set competitively relative to your market.",
    relatedTerms: ["Average Stay Length", "Cleaning Cost per Turnover"],
    category: "revenue",
  },
  {
    term: "Expense Growth Rate",
    definition:
      "Expected annual expense growth rate for multi-year projections. Covers inflation on operating costs (cleaning, utilities, supplies, maintenance). General inflation: 2-4%.",
    relatedTerms: ["Revenue Growth Rate"],
    category: "revenue",
  },
  {
    term: "Late Fee Income",
    definition:
      "Average monthly late fee income across all months (LTR). Most landlords charge $50-$100 per late payment; multiply by expected frequency.",
    category: "revenue",
  },
  {
    term: "Lease Duration",
    definition:
      "Length of the lease in months (LTR). Standard is 12 months. Shorter leases (6-9 months) may command higher rent but increase turnover costs.",
    relatedTerms: ["Tenant Turnover Cost", "Vacancy Rate"],
    category: "revenue",
  },
  {
    term: "Lease-Up Period",
    definition:
      "Months to find the first tenant after purchase (LTR). Typically 1-2 months. Only affects Year 1 calculations.",
    relatedTerms: ["Rental Delay", "Vacancy Rate"],
    category: "revenue",
  },
  {
    term: "Monthly Rent",
    definition:
      "Expected monthly rent for the property (LTR). Research comparable long-term rentals in the area on Zillow, Apartments.com, or local listings.",
    relatedTerms: ["Vacancy Rate", "Gross Yield"],
    category: "revenue",
  },
  {
    term: "Occupancy Rate",
    definition:
      "Percentage of nights booked per year. 65% is a solid benchmark for established STR markets. New listings typically start at 40-50% and ramp up over 6-12 months. Top performers hit 75-85%.",
    relatedTerms: ["Break-Even Occupancy", "Average Nightly Rate", "Seasonal Occupancy"],
    category: "revenue",
  },
  {
    term: "Off-Peak Occupancy",
    definition:
      "Expected occupancy during off-peak months. Winter/shoulder months in non-ski markets typically see 30-50%.",
    relatedTerms: ["Peak Occupancy", "Seasonal Occupancy"],
    category: "revenue",
  },
  {
    term: "Peak Months",
    definition:
      "Number of peak-season months per year. For Vermont: June-November (summer + foliage) = 6 months. Adjust based on your market's high season.",
    relatedTerms: ["Peak Occupancy", "Seasonal Occupancy"],
    category: "revenue",
  },
  {
    term: "Peak Occupancy",
    definition:
      "Expected occupancy during peak months. Top STR markets see 75-90% during peak season.",
    relatedTerms: ["Off-Peak Occupancy", "Peak Months"],
    category: "revenue",
  },
  {
    term: "Pet Rent",
    definition:
      "Additional monthly pet rent (LTR). Typical range: $25-$50 per pet. Set to $0 if not accepting pets.",
    category: "revenue",
  },
  {
    term: "Platform Fee",
    definition:
      "Airbnb's split-fee model charges hosts 3% per booking. VRBO charges 5-8%. If using Airbnb's host-only model (required if using channel managers), the fee is 14-15%.",
    relatedTerms: ["Average Nightly Rate"],
    category: "revenue",
  },
  {
    term: "Property Appreciation",
    definition:
      "Expected annual property value appreciation. US historical average is ~3-4%. Conservative: 2%. Set to 0% to exclude appreciation from ROI calculations.",
    relatedTerms: ["Year-1 ROI with Appreciation"],
    category: "revenue",
  },
  {
    term: "Rental Delay",
    definition:
      "Months between property acquisition and first guest booking (STR). Covers renovation, furnishing, permits, and listing setup. During this period you pay all carrying costs with zero revenue. Default: 1 month.",
    relatedTerms: ["Lease-Up Period"],
    category: "revenue",
  },
  {
    term: "Revenue Growth Rate",
    definition:
      "Expected annual revenue growth rate for multi-year projections. Accounts for nightly rate increases, market growth, and improved occupancy over time. US STR average: 3-5%.",
    relatedTerms: ["Expense Growth Rate"],
    category: "revenue",
  },
  {
    term: "Seasonal Occupancy",
    definition:
      "Peak/off-peak occupancy modeling. When enabled, occupancy varies by season. A weighted effective occupancy is computed for all annual metrics.",
    relatedTerms: ["Peak Occupancy", "Off-Peak Occupancy", "Peak Months"],
    category: "revenue",
  },
  {
    term: "Vacancy Rate",
    definition:
      "Ongoing vacancy rate as a percentage (LTR). Accounts for time between tenants after the initial lease-up. US average: 5-8%. Hot markets: 2-4%.",
    relatedTerms: ["Lease-Up Period", "Occupancy Rate"],
    category: "revenue",
  },

  // ── Expenses ─────────────────────────────────────────────
  {
    term: "Accounting Costs",
    definition:
      "Annual tax preparation, bookkeeping, and financial reporting. STR taxes are more complex than W-2. Typical range: $1,000-$3,000/yr for a CPA familiar with rental properties.",
    category: "expenses",
  },
  {
    term: "CapEx Reserve",
    definition:
      "Percentage of gross revenue reserved for major capital expenditures (roof, HVAC system, water heater, appliances). 5% is standard. Some investors use 10% total (combined maintenance + capex).",
    relatedTerms: ["Maintenance Reserve"],
    category: "expenses",
  },
  {
    term: "Cleaning Cost per Turnover",
    definition:
      "What you pay your cleaner each turnover. Typical ranges: 1BR $50-$90, 2BR $70-$130, 3BR $100-$150, 4BR+ $150-$300. Rule of thumb: $50/bathroom + $35/bedroom.",
    relatedTerms: ["Cleaning Fee per Stay", "Average Stay Length"],
    category: "expenses",
  },
  {
    term: "Damage Reserve",
    definition:
      "Percentage of gross revenue set aside for guest damage repairs (broken furniture, stains, wall holes). 2% is typical. Airbnb's Host Guarantee covers some damage but not everything.",
    relatedTerms: ["Maintenance Reserve", "CapEx Reserve"],
    category: "expenses",
  },
  {
    term: "Insurance",
    definition:
      "Total annual insurance policy cost. Standard homeowner's insurance does NOT cover STR use — you need a specialized STR or landlord policy. Typical range: $1,500-$3,000/yr.",
    category: "expenses",
  },
  {
    term: "Landlord Repairs",
    definition:
      "Annual budget for landlord-responsible repairs not covered by reserves (LTR). Includes plumbing, electrical, and appliance repairs.",
    relatedTerms: ["Maintenance Reserve", "CapEx Reserve"],
    category: "expenses",
  },
  {
    term: "Lawn & Snow",
    definition:
      "Landscaping, mowing, leaf cleanup, snow removal. Highly seasonal in Vermont. Enter a monthly average across the year, e.g., $100-$150. Set to $0 for condos.",
    category: "expenses",
  },
  {
    term: "Legal Costs",
    definition:
      "Legal counsel, compliance reviews, lease/contract templates, permit applications. Typical: $500-$1,500/yr. Higher in heavily regulated markets.",
    category: "expenses",
  },
  {
    term: "Maintenance Reserve",
    definition:
      "Percentage of gross revenue set aside for routine maintenance (plumbing, HVAC repairs, appliance fixes). Industry standard is 5%. Alternative: 1% of property value per year.",
    relatedTerms: ["CapEx Reserve"],
    category: "expenses",
  },
  {
    term: "Marketing",
    definition:
      "Photography, listing optimization, social media, direct booking website. Initial setup $200-$500, ongoing $50-$200/mo. Set to $0 if relying solely on platform traffic.",
    category: "expenses",
  },
  {
    term: "Other Monthly Expense",
    definition:
      "Catch-all for anything not covered by other line items: pest control, pool/hot tub maintenance, security monitoring, common area maintenance, etc.",
    category: "expenses",
  },
  {
    term: "Property Management",
    definition:
      "Fee paid to a property manager. STR: typically 20-25% of net revenue for full-service, 10-15% for co-hosting. LTR: typically 8-12% of collected rent. 0% if self-managing.",
    relatedTerms: ["NOI"],
    category: "expenses",
  },
  {
    term: "Software / PMS",
    definition:
      "PMS (Hospitable, Guesty), dynamic pricing (PriceLabs, Beyond), channel manager, smart lock software. Typical total: $30-$80/mo.",
    category: "expenses",
  },
  {
    term: "Supplies",
    definition:
      "Consumables replaced regularly: toiletries, paper products, coffee, cleaning supplies, light bulbs, batteries, small linens. Budget $50-$100 for a 1-2BR, $100-$200 for a 3-4BR.",
    category: "expenses",
  },
  {
    term: "Tenant Turnover Cost",
    definition:
      "Cost to prepare the unit between tenants (LTR): cleaning, painting, minor repairs, listing fees. Typical: $1,000-$3,000.",
    relatedTerms: ["Lease Duration", "Vacancy Rate"],
    category: "expenses",
  },
  {
    term: "Utilities",
    definition:
      "Total monthly utilities: electric, gas, water, sewer, internet, trash, streaming services. STRs run higher utility costs than typical homes. Budget $150-$250 for a 1-2BR, $250-$400 for a 3-4BR. Many LTR tenants pay their own utilities.",
    category: "expenses",
  },

  // ── Financing ────────────────────────────────────────────
  {
    term: "Closing Costs",
    definition:
      "Typical range: 2-5% of purchase price. Includes lender fees, title insurance, appraisal, attorney fees, recording fees, and prepaid items.",
    relatedTerms: ["Total Cash Invested", "Purchase Price"],
    category: "financing",
  },
  {
    term: "Down Payment",
    definition:
      "Investment property loans typically require 20-25% down. DSCR loans usually require 20-25%. Conventional loans with < 20% down trigger PMI.",
    relatedTerms: ["PMI", "Total Cash Invested", "Purchase Price"],
    category: "financing",
  },
  {
    term: "DSCR Loan",
    definition:
      "A loan that qualifies based on the property's income rather than borrower's personal income. Rates are typically 1-2% higher than conventional. Common terms: 25-30yr, 20-25% down, 1-3 origination points.",
    relatedTerms: ["DSCR", "Interest Rate", "Origination Points"],
    category: "financing",
  },
  {
    term: "Furniture Cost",
    definition:
      "One-time cost to furnish the property for STR guests. Rule of thumb: $3K-$5K per bedroom for mid-range furnishing. A 3BR property typically runs $10K-$20K fully furnished.",
    relatedTerms: ["Total Cash Invested", "Renovation Cost"],
    category: "financing",
  },
  {
    term: "Interest Rate",
    definition:
      "Current market rate for investment property loans. Investment properties typically carry rates 0.5-0.75% higher than primary residence loans. DSCR loans run 1-2% higher than conventional.",
    relatedTerms: ["DSCR Loan", "Loan Term"],
    category: "financing",
  },
  {
    term: "Interest-Only Period",
    definition:
      "Interest-only period in years. During IO, you pay only interest (no principal), resulting in a lower monthly payment. Common for DSCR loans: 1-5 years. After IO ends, payments increase to fully amortize the remaining balance over the remaining term.",
    relatedTerms: ["DSCR Loan", "Interest Rate"],
    category: "financing",
  },
  {
    term: "Land Value",
    definition:
      "Percentage of the purchase price attributable to land (non-depreciable). Typical range: 15-30%. Check your county tax assessment for the land/building split. Used for depreciation calculations.",
    category: "financing",
  },
  {
    term: "Loan Term",
    definition:
      "Common options: 15yr (higher payment, faster equity, lower total interest), 20yr, 25yr (common for DSCR), 30yr (lowest payment, most common).",
    relatedTerms: ["Interest Rate", "Down Payment"],
    category: "financing",
  },
  {
    term: "Loan Type",
    definition:
      "Conventional: Best rates, 15/20/30yr, PMI if < 20% down. DSCR: Qualifies on property income, rates ~1-2% higher. FHA: 3.5% down, requires owner-occupancy. Cash: No loan.",
    relatedTerms: ["DSCR Loan", "PMI", "Interest Rate"],
    category: "financing",
  },
  {
    term: "Origination Points",
    definition:
      "Loan origination points charged by the lender at closing. Each point = 1% of the loan amount. DSCR and portfolio loans often charge 1-3 points. Conventional loans typically charge 0-1 points.",
    relatedTerms: ["Closing Costs", "DSCR Loan"],
    category: "financing",
  },
  {
    term: "PMI",
    definition:
      "Private Mortgage Insurance, required for conventional loans with < 20% down. Typically 0.5-1.0% of loan amount per year. Not applicable for DSCR or cash purchases.",
    relatedTerms: ["Down Payment", "Loan Type"],
    category: "financing",
  },
  {
    term: "Purchase Price",
    definition:
      "Your offer price. May be above or below the listing price depending on market conditions and negotiation.",
    relatedTerms: ["Listing Price", "Down Payment", "Cap Rate"],
    category: "financing",
  },
  {
    term: "Renovation Cost",
    definition:
      "One-time cost to get the property rental-ready. Includes any remodeling, repairs, painting, landscaping. Even turnkey properties often need $5K-$15K in updates for STR use.",
    relatedTerms: ["Total Cash Invested", "Furniture Cost"],
    category: "financing",
  },

  // ── Tax ──────────────────────────────────────────────────
  {
    term: "Annual Taxes",
    definition:
      "Annual property taxes shown on the listing. This is almost certainly the homestead rate. Investment/STR properties in Vermont are taxed at the higher nonhomestead rate.",
    relatedTerms: ["Non-Homestead Taxes"],
    category: "tax",
  },
  {
    term: "Estimated Value",
    definition:
      "Zestimate or Redfin estimate. Useful as a sanity check against asking price, but don't rely on it — these estimates can be off by 5-15%.",
    relatedTerms: ["Listing Price", "Purchase Price"],
    category: "tax",
  },
  {
    term: "HOA",
    definition:
      "Monthly HOA or condo association fee. Common for condos and townhouses. Verify whether the HOA allows short-term rentals — many don't.",
    category: "tax",
  },
  {
    term: "Listing Price",
    definition:
      "The asking price from the listing. Your purchase price (set in Financing) may differ based on your offer.",
    relatedTerms: ["Purchase Price", "Estimated Value"],
    category: "tax",
  },
  {
    term: "Local Gross Receipts Tax",
    definition:
      "Burlington, VT levies a 9% gross receipts tax on STR revenue. Unlike rooms tax, this is an operator expense that directly reduces your cashflow. Set to 0% outside Burlington.",
    relatedTerms: ["VT Rooms Tax", "STR Surcharge"],
    category: "tax",
  },
  {
    term: "Local Option Tax",
    definition:
      "Additional municipal tax adopted by some Vermont towns. Currently 1% where adopted (Burlington, Stowe, Killington, and others). Set to 0% if your town hasn't adopted it.",
    relatedTerms: ["VT Rooms Tax", "STR Surcharge"],
    category: "tax",
  },
  {
    term: "Marginal Tax Rate",
    definition:
      "Your combined marginal income tax rate (federal + state). Used to estimate after-tax cashflow. Common ranges: 22-37% federal + 0-13% state. Set to 0 to hide tax analysis.",
    relatedTerms: ["Annual Cashflow"],
    category: "tax",
  },
  {
    term: "Non-Homestead Taxes",
    definition:
      "The actual annual tax you'll pay as a non-owner-occupant. Look up your town's nonhomestead education tax rate on the VT Dept of Taxes website, or call the town assessor. Typically 15-40% higher than the homestead amount shown on listings.",
    relatedTerms: ["Annual Taxes"],
    category: "tax",
  },
  {
    term: "Platform Remits Tax",
    definition:
      "If Yes (Airbnb, VRBO), the platform collects all VT rooms/meals taxes from guests and remits to the state on your behalf. These taxes are pass-through, not your expense.",
    relatedTerms: ["VT Rooms Tax", "STR Surcharge"],
    category: "tax",
  },
  {
    term: "STR Registration Fee",
    definition:
      "Annual municipal registration fee. Not all towns require it. Examples: Stowe $100/unit/yr, Dover $125/yr. Check your specific town's requirements.",
    category: "tax",
  },
  {
    term: "STR Surcharge",
    definition:
      "Additional surcharge on STR rents enacted by Act 183 of 2024. Collected from the guest on top of the 9% rooms tax. Also remitted by major platforms.",
    relatedTerms: ["VT Rooms Tax", "Local Option Tax"],
    category: "tax",
  },
  {
    term: "VT Rooms Tax",
    definition:
      "Vermont Meals & Rooms Tax applied to all STR bookings of < 30 nights. Collected from the guest. If you use Airbnb or VRBO, the platform collects and remits this for you automatically.",
    relatedTerms: ["STR Surcharge", "Local Option Tax", "Platform Remits Tax"],
    category: "tax",
  },
].sort((a, b) => a.term.localeCompare(b.term));
