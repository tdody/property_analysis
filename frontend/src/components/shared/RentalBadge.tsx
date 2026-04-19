interface RentalBadgeProps {
  type: string;
  className?: string;
}

export function RentalBadge({ type, className = "" }: RentalBadgeProps) {
  return (
    <span
      className={`caps px-2 py-0.5 border border-rule-strong rounded ${className}`}
    >
      {type}
    </span>
  );
}
