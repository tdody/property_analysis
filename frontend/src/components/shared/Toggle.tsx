interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
  className = "",
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
        value ? "bg-ink" : "bg-rule-strong"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-canvas transition-transform ${
          value ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
