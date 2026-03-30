interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  variant?: "positive" | "negative" | "neutral";
  large?: boolean;
}

export function MetricCard({ label, value, tooltip, variant = "neutral", large }: MetricCardProps) {
  const colorMap = {
    positive: "text-emerald-600",
    negative: "text-red-500",
    neutral: "text-slate-900",
  };

  const bgMap = {
    positive: "bg-emerald-50",
    negative: "bg-red-50",
    neutral: "bg-white",
  };

  const barColorMap = {
    positive: "bg-emerald-400",
    negative: "bg-red-400",
    neutral: "bg-slate-200",
  };

  return (
    <div className={`${bgMap[variant]} rounded-2xl shadow-sm p-4 ${large ? "col-span-2" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1" title={tooltip}>{label}</div>
      <div className={`${large ? "text-2xl font-bold tracking-tight" : "text-xl font-bold"} ${colorMap[variant]}`}>
        {value}
      </div>
      <div className={`mt-2 h-1 rounded-full ${barColorMap[variant]} w-12`} />
    </div>
  );
}
