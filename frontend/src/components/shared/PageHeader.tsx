import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  hero?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  hero = false,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div>
        {eyebrow && <p className="caps-eyebrow mb-2">{eyebrow}</p>}
        <h1 className={hero ? "hero" : "h1"}>{title}</h1>
        {subtitle && (
          <p className="text-ink-2 text-[15px] leading-relaxed mt-3 max-w-[440px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
