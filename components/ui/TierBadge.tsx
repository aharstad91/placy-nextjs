import { Award, Gem } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { t } from "@/lib/i18n/strings";

interface TierBadgeProps {
  poiTier?: 1 | 2 | 3 | null;
  isLocalGem?: boolean;
  variant: "card" | "inline";
}

/**
 * Subtle editorial badge for quality POIs.
 *
 * - variant="card"   → pill with icon + text (overlay on photo cards)
 * - variant="inline" → icon only (compact rows)
 *
 * Returns null for Tier 2/3 without Local Gem status.
 */
export function TierBadge({ poiTier, isLocalGem, variant }: TierBadgeProps) {
  const { locale } = useLocale();

  const isTier1 = poiTier === 1;
  const showRecommended = isTier1;
  const showLocalGem = isLocalGem && !isTier1; // Don't double-badge — Tier 1 takes priority

  if (!showRecommended && !showLocalGem) return null;

  if (variant === "card") {
    if (showRecommended) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50/90 text-emerald-700 backdrop-blur-sm">
          <Award className="w-3 h-3" />
          {t(locale, "recommended")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50/90 text-amber-700 backdrop-blur-sm">
        <Gem className="w-3 h-3" />
        {t(locale, "localGem")}
      </span>
    );
  }

  // variant === "inline" — icon only
  if (showRecommended) {
    return <Award className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />;
  }
  return <Gem className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />;
}
