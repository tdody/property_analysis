interface OccupancyGaugeProps {
  value: number;
  target?: number;
  className?: string;
}

export function OccupancyGauge({
  value,
  target,
  className = "",
}: OccupancyGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const good = target === undefined ? true : value >= target;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="tabular-nums text-ink text-[14px]">{value}%</span>
      <div className="w-14 h-[6px] bg-rule rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full ${
            good ? "bg-accent" : "bg-negative"
          }`}
          style={{ width: `${clampedValue}%` }}
        />
        {target !== undefined && (
          <div
            className="absolute top-[-2px] w-px h-[10px] bg-ink"
            style={{ left: `${Math.max(0, Math.min(100, target))}%` }}
          />
        )}
      </div>
    </div>
  );
}
