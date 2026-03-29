interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  variant?: "positive" | "negative" | "neutral";
  large?: boolean;
}

export function MetricCard({ label, value, tooltip, variant = "neutral", large }: MetricCardProps) {
  const colorMap = {
    positive: "text-green-600",
    negative: "text-red-600",
    neutral: "text-gray-900",
  };

  return (
    <div className={`bg-white rounded-lg border p-4 ${large ? "col-span-2" : ""}`}>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`${large ? "text-2xl" : "text-lg"} font-semibold ${colorMap[variant]}`}>
        {value}
      </div>
    </div>
  );
}
