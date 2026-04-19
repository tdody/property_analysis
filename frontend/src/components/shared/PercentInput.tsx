import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

interface PercentInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
}

export function PercentInput({
  label,
  value,
  onChange,
  tooltip,
  className = "",
}: PercentInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={`relative ${className}`}>
      <label className="field-label flex items-center gap-1">
        <span>{label}</span>
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      <div className="flex items-baseline">
        <input
          type="number"
          step="0.1"
          value={value || ""}
          onChange={handleChange}
          className="field"
        />
        <span className="text-ink-3 font-mono text-[15px] ml-1">%</span>
      </div>
    </div>
  );
}
