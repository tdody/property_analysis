import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  body: string;
  actions?: ReactNode;
}

export function EmptyState({ title, body, actions }: EmptyStateProps) {
  return (
    <div className="border-2 border-dashed border-rule-strong rounded py-16 px-6 text-center">
      <p className="font-serif text-[22px] text-ink mb-2">{title}</p>
      <p className="text-[13px] text-ink-3 mb-6">{body}</p>
      {actions}
    </div>
  );
}
