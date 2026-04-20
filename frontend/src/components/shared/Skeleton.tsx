interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonLine({ className = "" }: SkeletonProps) {
  return <div className={`skeleton h-[14px] ${className}`} aria-hidden="true" />;
}
