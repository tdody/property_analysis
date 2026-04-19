import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

export type FieldTag = "redfin" | "redfin-edited" | "missing" | null;

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "prefix" | "className" | "onChange"
>;

interface FieldProps extends NativeInputProps {
  label: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  scraped?: boolean;
  scrapedLabel?: string;
  hint?: ReactNode;
  className?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  tag?: FieldTag;
}

export function Field({
  label,
  prefix,
  suffix,
  scraped = false,
  scrapedLabel = "Redfin",
  hint,
  className = "",
  tag,
  ...inputProps
}: FieldProps) {
  const showBadge = tag === "redfin" || tag === "redfin-edited" || scraped;
  const badgeText =
    tag === "redfin-edited" ? "Redfin (edited)" : tag === "redfin" ? "Redfin" : scrapedLabel;
  const badgeClass = tag === "redfin-edited" ? "text-ink-3" : "text-accent";
  const missing = tag === "missing";
  const resolvedHint =
    hint ?? (missing ? "Not found — enter manually" : undefined);

  return (
    <div className={`relative ${className}`}>
      <label className="field-label">{label}</label>
      {showBadge && (
        <span
          className={`absolute top-0 right-0 text-[9px] tracking-[0.1em] uppercase font-semibold ${badgeClass}`}
          aria-hidden
        >
          {badgeText}
        </span>
      )}
      <div className="flex items-baseline">
        {prefix && (
          <span className="text-ink-3 font-mono text-[15px] mr-1">{prefix}</span>
        )}
        <input
          className="field"
          style={missing ? { borderBottomColor: "var(--warn)" } : undefined}
          {...inputProps}
        />
        {suffix && (
          <span className="text-ink-3 font-mono text-[15px] ml-1">{suffix}</span>
        )}
      </div>
      {resolvedHint && (
        <div className={`text-[12px] mt-1 ${missing ? "text-warn" : "text-ink-3"}`}>
          {resolvedHint}
        </div>
      )}
    </div>
  );
}
