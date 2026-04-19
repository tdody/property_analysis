import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

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
}

export function Field({
  label,
  prefix,
  suffix,
  scraped = false,
  scrapedLabel = "Redfin",
  hint,
  className = "",
  ...inputProps
}: FieldProps) {
  return (
    <div className={`relative ${className}`}>
      <label className="field-label">{label}</label>
      {scraped && (
        <span
          className="absolute top-0 right-0 text-[9px] tracking-[0.1em] uppercase text-accent font-semibold"
          aria-hidden
        >
          {scrapedLabel}
        </span>
      )}
      <div className="flex items-baseline">
        {prefix && (
          <span className="text-ink-3 font-mono text-[15px] mr-1">{prefix}</span>
        )}
        <input className="field" {...inputProps} />
        {suffix && (
          <span className="text-ink-3 font-mono text-[15px] ml-1">{suffix}</span>
        )}
      </div>
      {hint && <div className="text-ink-3 text-[12px] mt-1">{hint}</div>}
    </div>
  );
}
