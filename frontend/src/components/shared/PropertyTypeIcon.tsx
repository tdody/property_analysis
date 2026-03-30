interface PropertyTypeIconProps {
  propertyType: string;
  className?: string;
}

export function PropertyTypeIcon({ propertyType, className = "" }: PropertyTypeIconProps) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${className}`}>
      <svg viewBox="0 0 64 64" className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {propertyType === "condo" || propertyType === "apartment" ? (
          <>
            {/* Building */}
            <rect x="16" y="12" width="32" height="44" rx="1" />
            <line x1="16" y1="56" x2="48" y2="56" />
            {/* Windows */}
            <rect x="22" y="18" width="6" height="5" />
            <rect x="36" y="18" width="6" height="5" />
            <rect x="22" y="28" width="6" height="5" />
            <rect x="36" y="28" width="6" height="5" />
            <rect x="22" y="38" width="6" height="5" />
            <rect x="36" y="38" width="6" height="5" />
            {/* Door */}
            <rect x="28" y="48" width="8" height="8" />
          </>
        ) : propertyType === "townhouse" ? (
          <>
            {/* Row of connected houses */}
            <rect x="6" y="24" width="16" height="32" rx="1" />
            <polygon points="6,24 14,14 22,24" />
            <rect x="24" y="20" width="16" height="36" rx="1" />
            <polygon points="24,20 32,10 40,20" />
            <rect x="42" y="24" width="16" height="32" rx="1" />
            <polygon points="42,24 50,14 58,24" />
            <line x1="6" y1="56" x2="58" y2="56" />
            {/* Doors */}
            <rect x="11" y="44" width="6" height="12" />
            <rect x="29" y="40" width="6" height="16" />
            <rect x="47" y="44" width="6" height="12" />
          </>
        ) : propertyType === "multi_family" ? (
          <>
            {/* Wide building */}
            <rect x="10" y="16" width="44" height="40" rx="1" />
            <line x1="10" y1="56" x2="54" y2="56" />
            {/* Windows row 1 */}
            <rect x="16" y="22" width="5" height="4" />
            <rect x="26" y="22" width="5" height="4" />
            <rect x="36" y="22" width="5" height="4" />
            <rect x="46" y="22" width="5" height="4" />
            {/* Windows row 2 */}
            <rect x="16" y="32" width="5" height="4" />
            <rect x="26" y="32" width="5" height="4" />
            <rect x="36" y="32" width="5" height="4" />
            <rect x="46" y="32" width="5" height="4" />
            {/* Doors */}
            <rect x="18" y="44" width="8" height="12" />
            <rect x="38" y="44" width="8" height="12" />
          </>
        ) : (
          <>
            {/* Single family house */}
            <rect x="14" y="30" width="36" height="26" rx="1" />
            <polygon points="10,30 32,12 54,30" />
            <line x1="10" y1="56" x2="54" y2="56" />
            {/* Door */}
            <rect x="27" y="42" width="10" height="14" />
            {/* Windows */}
            <rect x="18" y="36" width="6" height="6" />
            <rect x="40" y="36" width="6" height="6" />
            {/* Chimney */}
            <rect x="42" y="16" width="5" height="14" />
          </>
        )}
      </svg>
    </div>
  );
}
