"use client";

interface GoogleRatingProps {
  rating: number;
  reviewCount?: number;
  /** xs = compact (single star + number), sm = 5-star row, md = larger 5-star row */
  size?: "xs" | "sm" | "md";
  /** light = for white backgrounds, dark = for dark tooltip backgrounds */
  variant?: "light" | "dark";
  /** Show "anmeldelser" label after review count (for expanded cards) */
  showLabel?: boolean;
  className?: string;
}

const STAR_FILLED = "#FBBC04";
const STAR_EMPTY_LIGHT = "#dadce0";
const STAR_EMPTY_DARK = "rgba(255,255,255,0.2)";

const SIZES = {
  xs: { star: 12, gap: 1, textClass: "text-[11px]" },
  sm: { star: 12, gap: 1, textClass: "text-xs" },
  md: { star: 16, gap: 1.5, textClass: "text-sm" },
} as const;

function getStarFills(rating: number): ("full" | "half" | "empty")[] {
  const fills: ("full" | "half" | "empty")[] = [];
  for (let i = 1; i <= 5; i++) {
    const diff = rating - (i - 1);
    if (diff >= 0.75) fills.push("full");
    else if (diff >= 0.25) fills.push("half");
    else fills.push("empty");
  }
  return fills;
}

function StarIcon({
  fill,
  size,
  emptyColor,
}: {
  fill: "full" | "half" | "empty";
  size: number;
  emptyColor: string;
}) {
  const id = `half-${Math.random().toString(36).slice(2, 8)}`;

  if (fill === "full") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={STAR_FILLED}
        />
      </svg>
    );
  }

  if (fill === "half") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor={STAR_FILLED} />
            <stop offset="50%" stopColor={emptyColor} />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={`url(#${id})`}
        />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={emptyColor}
      />
    </svg>
  );
}

export function GoogleRating({
  rating,
  reviewCount,
  size = "sm",
  variant = "light",
  showLabel = false,
  className,
}: GoogleRatingProps) {
  if (!rating || rating <= 0) return null;

  const s = SIZES[size];
  const emptyColor = variant === "dark" ? STAR_EMPTY_DARK : STAR_EMPTY_LIGHT;
  const textColor = variant === "dark" ? "text-gray-200" : "text-gray-600";
  const countColor = variant === "dark" ? "text-gray-400" : "text-gray-400";

  const ariaLabel = reviewCount && reviewCount > 0
    ? `${rating.toFixed(1)} av 5 stjerner, ${reviewCount} anmeldelser`
    : `${rating.toFixed(1)} av 5 stjerner`;

  // xs: compact single star + number (for tooltips)
  if (size === "xs") {
    return (
      <span
        className={`inline-flex items-center gap-1 ${className ?? ""}`}
        role="img"
        aria-label={ariaLabel}
      >
        <StarIcon fill="full" size={s.star} emptyColor={emptyColor} />
        <span className={`${s.textClass} font-medium ${textColor}`}>
          {rating.toFixed(1)}
        </span>
        {reviewCount != null && reviewCount > 0 && (
          <span className={`${s.textClass} ${countColor}`}>
            ({reviewCount})
          </span>
        )}
      </span>
    );
  }

  // sm / md: full 5-star row
  const fills = getStarFills(rating);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className ?? ""}`}
      role="img"
      aria-label={ariaLabel}
    >
      <span className="inline-flex items-center" style={{ gap: s.gap }}>
        {fills.map((fill, i) => (
          <StarIcon key={i} fill={fill} size={s.star} emptyColor={emptyColor} />
        ))}
      </span>
      <span className={`${s.textClass} font-medium ${textColor}`}>
        {rating.toFixed(1)}
      </span>
      {reviewCount != null && reviewCount > 0 && (
        <span className={`${s.textClass} ${countColor}`}>
          ({reviewCount}{showLabel ? " anmeldelser" : ""})
        </span>
      )}
    </span>
  );
}
