"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface ReportMapPreviewCardProps {
  /** Tema-tittel eller samlekart-tittel */
  title: string;
  /** POI-antall */
  count: number;
  /** Default "steder på kartet" — samlekart kan f.eks. bruke "steder i nabolaget" */
  countLabel?: string;
  /** Path til watercolor-illustrasjon i info-stripen */
  illustrationSrc: string;
  illustrationAlt: string;
  /** Klikk-handler — åpner tilhørende kart-modal */
  onClick: () => void;
  /** Aria-label for hele preview-kortet */
  ariaLabel?: string;
  /** Kart-slot — typisk <ReportThemeMap previewMode ... /> */
  children: ReactNode;
}

/**
 * ReportMapPreviewCard — delt preview-card-komponent for rapport-map-previews.
 *
 * Brukes av både samlekart (ReportOverviewMap) og per-tema-kart (ReportThemeSection).
 * Kart-slot rommer en preview-modus ReportThemeMap (single-tone POI-prikker, fast view,
 * forstørret prosjekt-pin). Under kartet vises en hvit info-stripe med tema-tittel,
 * antall, watercolor-illustrasjon og pil-i-sirkel-CTA.
 *
 * Hele kortet er én klikk-target. Hover triggrer subtile animasjoner via Tailwind
 * `group-hover:` — prosjekt-pinen i ReportThemeMap responderer på samme group-state.
 */
export default function ReportMapPreviewCard({
  title,
  count,
  countLabel = "steder på kartet",
  illustrationSrc,
  illustrationAlt,
  onClick,
  ariaLabel,
  children,
}: ReportMapPreviewCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${title} — ${count} ${countLabel}. Åpne kart.`}
      className="group block w-full text-left rounded-2xl overflow-hidden border border-[#eae6e1] bg-white cursor-pointer"
    >
      {/* Kart-slot — høyde redusert ~35% fra opprinnelig (320/440 → 210/285) for at
          info-stripen skal få mer visuell vekt og at hele kortet føles mer kompakt. */}
      <div className="relative h-[210px] md:h-[285px]">
        {children}
        {/* Gradient-overlay — kontrast-enhancer mot info-stripen og demper kart-fokus */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#f5f1ec]/90 via-[#f5f1ec]/10 to-transparent pointer-events-none z-10" />
      </div>

      {/* Info-stripe — hvit bakgrunn, 24px padding, illustrasjon høyre */}
      <div className="p-6 flex items-stretch gap-4 md:gap-6">
        {/* Venstre kolonne: tittel, meta, pil-CTA */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-[#1a1a1a] leading-tight">
              {title}
            </h3>
            <p className="text-sm text-[#5d5348] mt-1.5">
              {count} {countLabel}
            </p>
          </div>
          <div className="mt-4 flex">
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1a1a] text-white group-hover:bg-[#2a2a2a] transition-colors duration-200"
            >
              <ArrowUpRight className="w-5 h-5" />
            </span>
          </div>
        </div>

        {/* Høyre kolonne: watercolor-illustrasjon */}
        <div className="relative shrink-0 w-[40%] sm:w-[45%] md:w-[55%] aspect-[16/9] rounded-xl overflow-hidden bg-[#f5f1ec]">
          <Image
            src={illustrationSrc}
            alt={illustrationAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 45vw, 55vw"
          />
        </div>
      </div>
    </button>
  );
}
