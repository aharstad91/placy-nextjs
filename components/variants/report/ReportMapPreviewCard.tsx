"use client";

import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface ReportMapPreviewCardProps {
  /** CTA-label — typisk "Vis på kart". Tema-/samlekart-navn ligger allerede i H2 over,
   *  så tittelen her fungerer som handlingsuttrykk, ikke kategori-navn. */
  title: string;
  /** POI-antall */
  count: number;
  /** Default "steder" — samlekart overrider med f.eks. "steder i nabolaget" */
  countLabel?: string;
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
 * forstørret prosjekt-pin). Nederst over kartet ligger et hvitt info-kort med
 * CTA-label, antall og pil-i-sirkel-CTA på høyre side.
 *
 * Hele kortet er én klikk-target. Hover triggrer subtile animasjoner via Tailwind
 * `group-hover:` — prosjekt-pinen i ReportThemeMap responderer på samme group-state.
 */
export default function ReportMapPreviewCard({
  title,
  count,
  countLabel = "steder",
  onClick,
  ariaLabel,
  children,
}: ReportMapPreviewCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${title} — ${count} ${countLabel}. Åpne kart.`}
      className="group relative block w-full text-left rounded-2xl overflow-hidden border border-[#eae6e1] bg-[#f5f1ec] cursor-pointer h-[400px] md:h-[480px]"
    >
      {/* Kart-slot — fyller hele kontaineren. Info-kortet ligger oppå med padding
          slik at kartet vises rundt kortet på sider og under (jf. skisse). */}
      <div className="absolute inset-0">{children}</div>

      {/* "Grønn sone" — jevn dempe-overlay over hele kartet (mindre detalj-støy) */}
      <div className="absolute inset-0 bg-[#f5f1ec]/30 pointer-events-none z-10" />

      {/* "Rød sone" — bunn-gradient fra solid #f5f1ec (100%) til transparent (0%).
          Når rød fader til 0% i toppen av sonen, ligger kun grønn overlay igjen
          → sømløs overgang. Mapbox-attribusjon (lovpålagt) lander dermed på en
          solid flate i bunn og blir en del av designet i stedet for å støye. */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#f5f1ec] from-0% to-transparent to-100% pointer-events-none z-10" />

      {/* Info-kort — overlaid nederst med padding rundt; rounded-xl på selve kortet */}
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 z-20">
        <div className="rounded-xl bg-white p-6 flex items-center justify-between gap-4 shadow-sm">
          {/* Venstre: tittel + meta */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl md:text-2xl font-bold text-[#1a1a1a] leading-tight">
              {title}
            </h3>
            <p className="text-sm text-[#5d5348] mt-1.5">
              {count} {countLabel}
            </p>
          </div>

          {/* Høyre: pil-CTA-sirkel — vertikalt sentrert som balanseanker */}
          <span
            aria-hidden="true"
            className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1a1a1a] text-white group-hover:bg-[#2a2a2a] transition-colors duration-200"
          >
            <ArrowUpRight className="w-5 h-5" />
          </span>
        </div>
      </div>
    </button>
  );
}
