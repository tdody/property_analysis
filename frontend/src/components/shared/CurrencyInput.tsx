import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
}

export function CurrencyInput({ label, value, onChange, tooltip, className = "" }: CurrencyInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
        <input
          type="number"
          value={value || ""}
          onChange={handleChange}
          className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
