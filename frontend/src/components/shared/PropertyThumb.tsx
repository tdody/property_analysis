import { useId } from "react";

export type PropertyThumbKind = "multi-unit" | "cape" | "duplex" | "default";

interface PropertyThumbProps {
  kind?: PropertyThumbKind;
  className?: string;
}

const HUE_MAP: Record<PropertyThumbKind, number> = {
  "multi-unit": 210,
  cape: 30,
  duplex: 175,
  default: 200,
};

function Shape({ kind, shapeColor }: { kind: PropertyThumbKind; shapeColor: string }) {
  if (kind === "multi-unit") {
    return (
      <g fill={shapeColor}>
        <rect x="18" y="20" width="18" height="30" />
        <rect x="40" y="24" width="16" height="26" />
        <rect x="60" y="14" width="18" height="36" />
      </g>
    );
  }
  if (kind === "cape") {
    return (
      <g fill={shapeColor}>
        <polygon points="50,14 80,36 20,36" />
        <rect x="28" y="36" width="44" height="16" />
      </g>
    );
  }
  if (kind === "duplex") {
    return (
      <g fill={shapeColor}>
        <polygon points="28,18 46,34 10,34" />
        <rect x="10" y="34" width="36" height="16" />
        <polygon points="72,18 90,34 54,34" />
        <rect x="54" y="34" width="36" height="16" />
      </g>
    );
  }
  return (
    <g fill={shapeColor}>
      <rect x="24" y="22" width="52" height="28" />
      <polygon points="24,22 50,8 76,22" />
    </g>
  );
}

export function PropertyThumb({ kind = "default", className = "" }: PropertyThumbProps) {
  const patternId = useId();
  const hue = HUE_MAP[kind] ?? HUE_MAP.default;
  const bgColor = `oklch(0.92 0.018 ${hue})`;
  const hatchColor = `oklch(0.82 0.02 ${hue})`;
  const shapeColor = `oklch(0.72 0.03 ${hue})`;

  return (
    <div
      className={`w-full h-full relative ${className}`}
      style={{ background: bgColor }}
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke={hatchColor} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100" height="60" fill={`url(#${patternId})`} opacity="0.6" />
        <Shape kind={kind} shapeColor={shapeColor} />
      </svg>
    </div>
  );
}
