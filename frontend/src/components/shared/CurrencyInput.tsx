import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
  /** Highlight input with amber border (field not found during scrape) */
  missing?: boolean;
  /** Show Redfin badge next to label (field successfully scraped) */
  scraped?: boolean;
}

export function CurrencyInput({ label, value, onChange, tooltip, className = "", missing, scraped }: CurrencyInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
        {tooltip && <TooltipIcon text={tooltip} />}
        {scraped && (
          <span className="ml-1.5 text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">
            Redfin
          </span>
        )}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
        <input
          type="number"
          value={value || ""}
          onChange={handleChange}
          className={`w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 ${
            missing ? "border-amber-300" : "border-slate-200 dark:border-slate-600"
          }`}
        />
      </div>
      {missing && (
        <p className="text-xs text-amber-500 mt-1">Not found — enter manually</p>
      )}
    </div>
  );
}
