import { useRef } from "react";

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
  ariaLabel,
}: SegmentedProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`seg ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
