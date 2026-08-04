"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { buildNeighbourhoodList } from "@/lib/board/neighbourhood-list";
import type { BoardCategory } from "../board-data";
import { useBoard } from "../board-state";
import { categorySubline } from "./NeighbourhoodCategoryCard";

/**
 * Kategorisiden (Unit 4) — steg to i navigasjonsstakken.
 *
 * ## Hvorfor dette ikke er «sitt eget kart»
 *
 * Det ser ut som en fullskjerms push med eget kart, men det ER det ikke og kan
 * ikke være det: den persistente `gmp-map-3d`-instansen kan aldri unmountes
 * (WebGL-context-lekk), så begge trinn deler ÉN montert kartinstans. Siden er
 * en innholdsflate som legger seg over det samme kartet og bytter kamera-ramme.
 *
 * ## Hvorfor lista her ignorerer kartutsnittet (R16)
 *
 * Nabolagslista svarer på «hva er i nærheten av det jeg ser på». Kategorisiden
 * svarer på «hva finnes i denne kategorien» — et annet spørsmål, med et annet
 * svar. Å filtrere den på utsnittet ville gjort «se alle 17» til en løgn.
 * Modellen gjenbrukes uendret, bare uten rektangel og uten rad-tak.
 */

/** Andel av flaten innholdspanelet dekker. Resten er kart — kategorien skal
 *  kunne SEES, ikke bare leses. */
const PANEL_FRACTION = 0.58;

export function CategoryPage({
  category,
  onBack,
  onHeightChange,
}: {
  category: BoardCategory;
  onBack: () => void;
  /** Panelets målte høyde → kartets bottom-padding, så innrammingen av
   *  kategorien ikke legger punkter bak panelet. */
  onHeightChange: (heightPx: number) => void;
}) {
  const { mapCamera } = useBoard();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Hele kategorien, gangtidssortert: samme modell som nabolagslista, men uten
  // utsnitt (R16) og uten rad-tak.
  const page = useMemo(
    () =>
      buildNeighbourhoodList([category], null, {
        rowsPerCategory: Number.POSITIVE_INFINITY,
      }).categories[0],
    [category],
  );

  // Prosaen som gjør siden til en STEDSBESKRIVELSE og ikke en trefliste.
  // Samme kilde som desktop-sidebarens `CategoryDetailView`: kuratert
  // strøk-editorial (nivå 2) hvis den finnes, ellers den deterministisk
  // genererte minimums-teksten (nivå 1). Faller tilbake på kategoriens
  // korte lead når ingen av delene finnes.
  const paragraphs = useMemo(() => {
    const source = category.editorial?.body?.trim() || category.lead?.trim() || "";
    return source
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [category.editorial?.body, category.lead]);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () =>
      onHeightChange(Math.round(el.clientHeight * PANEL_FRACTION));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  // Ramm inn kategorien når siden er montert. Kjøres som passiv effekt, ikke i
  // klikk-handleren: markørsettet snevres først inn av `activeCategoryId` og
  // viewport-scopet slippes først når nabolagslista unmountes — begge er
  // state-endringer som må ha landet før kameraet vet hva det skal ramme.
  // Programmatisk bevegelse → ingen `originalEvent` → ingen re-scoping (R12).
  useEffect(() => {
    mapCamera?.fitVisible();
  }, [mapCamera, category.id]);

  if (!page) return null;
  const Icon = getIcon(category.icon);

  return (
    <div ref={frameRef} className="pointer-events-none absolute inset-0 z-40">
      {/* R27: veien tilbake er alltid synlig. Ligger over kartet, ikke over
          panelet, så den ikke konkurrerer med lista. */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Tilbake til nabolagslista"
        className="pointer-events-auto absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 items-center gap-1.5 rounded-full bg-white/95 pl-2 pr-3.5 text-[14px] font-semibold text-stone-900 shadow-lg backdrop-blur-sm active:scale-95"
      >
        <ChevronLeft size={20} />
        <span>Tilbake</span>
      </button>

      <div
        ref={panelRef}
        data-testid="category-panel"
        data-category={category.id}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl bg-[#f5f1ea] shadow-[0_-8px_32px_rgba(28,25,23,0.22)]"
        style={{ height: `${PANEL_FRACTION * 100}%` }}
      >
        <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-4">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${category.color}1f`,
              color: category.color,
            }}
          >
            <Icon size={19} />
          </span>
          <span className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-stone-900">
              {category.label}
            </h2>
            <p className="truncate text-[12.5px] tabular-nums text-stone-500">
              {categorySubline(page)}
            </p>
          </span>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {/* Prosaen scroller SAMMEN med lista, ikke over den. Panelet er 58 %
              av en telefonskjerm: en fastlåst tekstblokk ville spist halve
              lista, og teksten er kontekst man leser én gang — ikke et
              kontrollelement man trenger tilgang til hele veien ned. */}
          {paragraphs.length > 0 && (
            <div data-testid="category-prose" className="space-y-2.5 pb-1 pt-1">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[14px] leading-relaxed text-stone-600">
                  {p}
                </p>
              ))}
            </div>
          )}

          <ul
            data-testid="category-poi-list"
            className={paragraphs.length > 0 ? "mt-3 border-t border-black/5 pt-1" : undefined}
          >
            {page.rows.map((row) => (
              <li
                key={row.poi.id}
                className="flex items-baseline gap-3 border-b border-black/5 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-stone-800">
                  {row.poi.name}
                </span>
                {row.walkMinutes !== undefined && (
                  <span className="shrink-0 text-[13px] tabular-nums text-stone-500">
                    {row.walkMinutes} min
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
