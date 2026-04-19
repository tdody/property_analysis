interface SparklineAmortProps {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  ioPeriodYears?: number;
  className?: string;
  height?: number;
}

function computeBalances(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  ioPeriodYears: number
): number[] {
  const totalMonths = termYears * 12;
  const ioMonths = Math.max(0, Math.min(ioPeriodYears * 12, totalMonths));
  const monthlyRate = annualRate / 100 / 12;
  const balances: number[] = [loanAmount];
  let balance = loanAmount;

  if (monthlyRate <= 0) {
    const flat = loanAmount / Math.max(1, totalMonths - ioMonths);
    for (let m = 1; m <= totalMonths; m++) {
      if (m <= ioMonths) {
        balances.push(balance);
      } else {
        balance = Math.max(0, balance - flat);
        balances.push(balance);
      }
    }
    return balances;
  }

  for (let m = 1; m <= totalMonths; m++) {
    if (m <= ioMonths) {
      balances.push(balance);
      continue;
    }
    const remainingMonths = totalMonths - m + 1;
    const payment =
      (balance * (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths))) /
      (Math.pow(1 + monthlyRate, remainingMonths) - 1);
    const interest = balance * monthlyRate;
    const principal = payment - interest;
    balance = Math.max(0, balance - principal);
    balances.push(balance);
  }
  return balances;
}

export function SparklineAmort({
  loanAmount,
  interestRate,
  termYears,
  ioPeriodYears = 0,
  className = "",
  height = 80,
}: SparklineAmortProps) {
  if (loanAmount <= 0 || termYears <= 0) {
    return (
      <div
        className={`w-full border-b border-rule text-[12px] text-ink-3 flex items-end pb-2 ${className}`}
        style={{ height }}
      >
        No loan amount.
      </div>
    );
  }

  const balances = computeBalances(
    loanAmount,
    interestRate,
    termYears,
    ioPeriodYears
  );
  const width = 600;
  const peak = Math.max(...balances, 1);

  const points = balances
    .map((bal, i) => {
      const x = (i / (balances.length - 1)) * width;
      const y = height - (bal / peak) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      aria-label="Loan balance over time"
    >
      <defs>
        <linearGradient id="amort-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#amort-fill)"
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="sparkline-stroke"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
