import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

interface PercentInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
}

export function PercentInput({ label, value, onChange, tooltip, className = "" }: PercentInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          value={value || ""}
          onChange={handleChange}
          className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
      </div>
    </div>
  );
}
