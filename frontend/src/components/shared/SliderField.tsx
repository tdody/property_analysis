import { useId } from "react";
import type { ReactNode } from "react";

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  sub?: ReactNode;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  sub,
  onChange,
  className = "",
  disabled = false,
}: SliderFieldProps) {
  const inputId = useId();
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1">
        <label htmlFor={inputId} className="field-label mb-0">{label}</label>
        <span className="font-mono text-[14px] tabular-nums text-ink">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-ink"
      />
      {sub && (
        <div className="text-ink-3 text-[12px] mt-1 font-mono">{sub}</div>
      )}
    </div>
  );
}
