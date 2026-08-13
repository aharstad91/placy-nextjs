"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { POIRealtimeSection } from "../blocks/POIRealtimeSection";
import { markerCircleStyle } from "../board/marker-style";

/**
 * «Verdt å merke seg» — meglerens utvalgte steder i en kategori (2026-08-13).
 *
 * ## Hvorfor kollapset
 *
 * Seksjonen sto tidligere alltid utfoldet øverst i kategori-panelet og spiste
 * høyden den viewport-scopede lista under trenger. Ved to eller flere punkter
 * samles de derfor i én kompakt, tydelig klikkbar rad: ikon-klyngen viser hva
 * som ligger bak, tallet hvor mange, og hele raden er én toggle (klikk åpner,
 * nytt klikk lukker). Ved PRESIS ett punkt finnes det ingenting å kollapse, og
 * raden rendres direkte — en toggle med ett element leser som en feil.
 *
 * Terskelen er data-derivert (`highlights.length >= 2`), ikke en prop noen kan
 * glemme å sette (`transit-dashboard-card-accordion-tabs-20260416`).
 *
 * ## Hvorfor den ALDRI utsnitts-filtreres
 *
 * Dette er et redaksjonelt utvalg for strøket, ikke et svar på «hva ser jeg
 * nå». At brukeren har panorert vestover skal ikke fjerne meglerens
 * anbefalinger. Bare den dynamiske lista under følger kartet.
 */

/** Render-klar highlight fra `board-data` (identitet alt avledet). */
export interface SidebarHighlight {
  id: string;
  name: string;
  /** POI-ens eget sub-kategori-ikon og dempede farge — samme derivasjon
   *  kartmarkøren bruker, så raden og pinnen ser like ut. */
  icon: string;
  color: string;
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  hyreStationId?: string;
}

/** Ikon-sirkelen som gir raden samme visuelle identitet som kartmarkøren. */
function HighlightIcon({
  highlight,
  size = 28,
}: {
  highlight: SidebarHighlight;
  size?: number;
}) {
  const Icon = getFilledIcon(highlight.icon);
  const circle = markerCircleStyle(highlight.color);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        backgroundColor: circle.backgroundColor,
        borderColor: circle.borderColor,
        borderWidth: 1.5,
        borderStyle: "solid",
        color: circle.borderColor,
      }}
    >
      <Icon size={Math.round(size * 0.48)} weight="fill" />
    </span>
  );
}

/**
 * En «Verdt å merke seg»-rad. Klikkbar header (åpner POI på kartet) + — for
 * transport-POI-er (buss/bysykkel/tog/bildeling) — en live sanntidstabell under,
 * samme data og komponent som kart-popupene bruker. For næringseiendom er
 * jobbreisen et kjøpsargument, så avgangstider rett i sidebaren er høy verdi.
 *
 * Ikke-transport-highlights rendrer kun header (sanntidsseksjonen returnerer
 * null), så raden ser ut som før utenfor transport-kategorien.
 */
function POIHighlightRow({
  highlight,
  onOpen,
}: {
  highlight: SidebarHighlight;
  onOpen: () => void;
}) {
  const isTransport = !!(
    highlight.enturStopplaceId ||
    highlight.bysykkelStationId ||
    highlight.hyreStationId
  );
  // Hooket er null-trygt: ikke-transport-rader poller ikke.
  const realtimeData = useRealtimeData(isTransport ? highlight : null);

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white/60 transition-colors duration-150 hover:border-stone-400 hover:bg-white">
      <button
        type="button"
        onClick={onOpen}
        data-testid="highlight-row"
        className="group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <HighlightIcon highlight={highlight} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-stone-800">
          {highlight.name}
        </span>
        <ChevronRight
          size={16}
          className="shrink-0 text-stone-300 transition-colors duration-150 group-hover:text-stone-600"
          aria-hidden
        />
      </button>
      {isTransport && (
        <div className="px-3 pb-2.5">
          <POIRealtimeSection realtimeData={realtimeData} />
        </div>
      )}
    </div>
  );
}

export function HighlightsDisclosure({
  highlights,
  onOpenPoi,
}: {
  highlights: SidebarHighlight[];
  onOpenPoi?: (poiId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (highlights.length === 0) return null;

  const heading = (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
      Verdt å merke seg
    </p>
  );

  // Ett punkt: ingen toggle, raden står åpen.
  if (highlights.length === 1) {
    return (
      <section data-testid="highlights-section" className="mt-5">
        {heading}
        <POIHighlightRow
          highlight={highlights[0]}
          onOpen={() => onOpenPoi?.(highlights[0].id)}
        />
      </section>
    );
  }

  return (
    <section data-testid="highlights-section" className="mt-5">
      {heading}

      {/* Toggle-raden. Ikon-klyngen overlapper svakt så den leses som «en
          samling», og hele raden er trykkflaten. De interaktive POI-radene
          ligger UTENFOR denne knappen (søsken, ikke barn) — nøstede knapper er
          ugyldig markup og fanger klikk feil. */}
      <button
        type="button"
        data-testid="highlights-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-black/5 bg-white/60 px-3 py-2.5 text-left transition-colors duration-150 hover:border-stone-400 hover:bg-white"
      >
        <span aria-hidden className="flex shrink-0 items-center -space-x-2">
          {highlights.slice(0, 4).map((h) => (
            <span key={h.id} className="rounded-lg ring-2 ring-[#f5f1ea]">
              <HighlightIcon highlight={h} size={24} />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-stone-800">
            {highlights.length} steder å merke seg
          </span>
          <span className="block truncate text-[11.5px] text-stone-500">
            {expanded ? "Skjul lista" : "Se hvilke"}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-stone-400 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Begge tilstander står i DOM og veksles med CSS — husets
          expand/collapse-oppskrift (`trip-desktop-accordion-sidebar-20260209`).
          Ingen auto-scroll ved åpning: høyde-animasjonen er signal nok. */}
      <div
        id={panelId}
        data-testid="highlights-panel"
        data-expanded={expanded}
        aria-hidden={!expanded}
        className={`flex flex-col gap-2 overflow-hidden transition-all duration-300 ease-out ${
          expanded ? "mt-2 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {highlights.map((h) => (
          <POIHighlightRow
            key={h.id}
            highlight={h}
            onOpen={() => onOpenPoi?.(h.id)}
          />
        ))}
      </div>
    </section>
  );
}
