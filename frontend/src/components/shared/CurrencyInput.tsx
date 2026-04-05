import { useCallback } from "react";
import { TooltipIcon } from "./TooltipIcon";

export type FieldTag = "redfin" | "redfin-edited" | "missing" | null;

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  className?: string;
  /** Field source tag — controls badge and border styling */
  tag?: FieldTag;
}

export function CurrencyInput({ label, value, onChange, tooltip, className = "", tag }: CurrencyInputProps) {
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
        {tag === "redfin" && (
          <span className="ml-1.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded font-medium">
            Redfin
          </span>
        )}
        {tag === "redfin-edited" && (
          <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
            Redfin (edited)
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
            tag === "missing" ? "border-amber-300 dark:border-amber-500" : "border-slate-200 dark:border-slate-600"
          }`}
        />
      </div>
      {tag === "missing" && (
        <p className="text-xs text-amber-500 mt-1">Not found — enter manually</p>
      )}
    </div>
  );
}
