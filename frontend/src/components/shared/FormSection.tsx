import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FormSection({
  title,
  subtitle,
  children,
  className = "",
  contentClassName = "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5",
}: FormSectionProps) {
  return (
    <section
      className={`grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 ${className}`}
    >
      <div>
        <h2 className="font-serif text-[22px] leading-none mb-2 text-ink">{title}</h2>
        {subtitle && (
          <div className="text-ink-3 text-[13px] leading-snug">{subtitle}</div>
        )}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
