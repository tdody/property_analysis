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

export function CurrencyInput({
  label,
  value,
  onChange,
  tooltip,
  className = "",
  tag,
}: CurrencyInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(val);
    },
    [onChange]
  );

  const badgeText =
    tag === "redfin"
      ? "Redfin"
      : tag === "redfin-edited"
      ? "Redfin (edited)"
      : null;

  const badgeClass =
    tag === "redfin" ? "text-accent" : tag === "redfin-edited" ? "text-ink-3" : "";

  const missing = tag === "missing";

  return (
    <div className={`relative ${className}`}>
      <label className="field-label flex items-center gap-1">
        <span>{label}</span>
        {tooltip && <TooltipIcon text={tooltip} />}
      </label>
      {badgeText && (
        <span
          className={`absolute top-0 right-0 text-[9px] tracking-[0.1em] uppercase font-semibold ${badgeClass}`}
        >
          {badgeText}
        </span>
      )}
      <div className="flex items-baseline">
        <span className="text-ink-3 font-mono text-[15px] mr-1">$</span>
        <input
          type="number"
          value={value || ""}
          onChange={handleChange}
          className="field"
          style={missing ? { borderBottomColor: "var(--warn)" } : undefined}
        />
      </div>
      {missing && (
        <div className="text-[12px] text-warn mt-1">Not found — enter manually</div>
      )}
    </div>
  );
}
