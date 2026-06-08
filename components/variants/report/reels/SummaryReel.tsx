"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import type { SummaryReelCard } from "./reels-data";

interface Props {
  card: SummaryReelCard;
  isActive: boolean;
  /** Desktop: kortet fyller venstre kolonne. Mobil: full skjerm. Påvirker
   *  kun maks-bredde på innholdet (lesbarhet på brede skjermer). */
  desktopMode?: boolean;
}

/**
 * Visuelt oppsummerings-kort på slutten av reels-feeden — speiler den
 * redaksjonelle ReportSummarySection (headline + insight-punkter + CTA), men
 * i mørk reel-estetikk. Statisk (ingen audio). Vises kun for prosjekter med
 * strukturert summary-data; ellers er finalen outro-recap + megler.
 */
export function SummaryReel({ card, desktopMode = false }: Props) {
  const { label, headline, insights, cta, broker } = card;

  const ctaLabel = cta?.primaryLabel || "Ta kontakt med megler";
  const ctaHref =
    cta?.leadUrl ||
    (broker?.email
      ? `mailto:${broker.email}${
          cta?.primarySubject
            ? `?subject=${encodeURIComponent(cta.primarySubject)}`
            : ""
        }`
      : undefined);

  return (
    <div className="relative h-full w-full overflow-hidden bg-stone-950">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-stone-950 to-black" />
      <div className="relative h-full w-full overflow-y-auto px-6 py-12 [&::-webkit-scrollbar]:hidden">
        <div
          className={
            desktopMode ? "mx-auto flex max-w-md flex-col" : "flex flex-col"
          }
        >
          <span
            className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
          >
            {label}
          </span>

          <h2 className="text-2xl font-bold leading-snug text-white">
            {headline}
          </h2>

          {insights.length > 0 && (
            <ul className="mt-7 flex flex-col gap-4">
              {insights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-[15px] text-white/90">
                  <Sparkles
                    className="mt-0.5 h-4 w-4 shrink-0 text-white/60"
                    aria-hidden="true"
                  />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          )}

          {ctaHref && (
            <a
              href={ctaHref}
              className="mt-9 inline-flex items-center justify-center gap-2 self-start rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-stone-900 shadow-xl transition-transform active:scale-[0.98]"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
