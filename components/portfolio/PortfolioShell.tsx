"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { PortfolioPageData } from "@/lib/portfolio/rows";
import { PortfolioList } from "./PortfolioList";
import { PortfolioMap } from "./PortfolioMap";

/**
 * Skallet: kart og liste rundt ett valg.
 *
 * Desktop-kolonne og mobil-bunnpanel er SAMME komponenttre, skilt med
 * responsive klasser. En gren-splitt på `useMediaQuery` ville vært en felle:
 * hooken starter som «false» før første effekt, så desktop hadde rendret
 * mobil-layouten først og deretter byttet — og et bytte som flytter kartets
 * forelder remonterer 3D-motoren. `gmp-map-3d` kan ikke frigi WebGL-konteksten
 * sin, så en remount lekker en av nettleserens ~16.
 *
 * `order`-klassene bytter bare VISUELL rekkefølge; DOM-posisjonen står stille.
 * Hooken brukes derfor bare til oppførsel: hvor mye av lista som må rulles for
 * at en rad valgt fra kartet blir synlig.
 */

export interface PortfolioShellProps {
  data: PortfolioPageData;
}

export function PortfolioShell({ data }: PortfolioShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Valg fra kartet må rulles inn i syne i lista (AE9). Bunnpanelet er lavt, så
  // der sentreres raden; desktop-kolonnen er høy, og «nærmeste» gir minst
  // uventet bevegelse.
  useEffect(() => {
    if (!selectedId) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-project-row="${CSS.escape(selectedId)}"]`,
    );
    row?.scrollIntoView({ block: isDesktop ? "nearest" : "center", behavior: "smooth" });
  }, [selectedId, isDesktop]);

  const boardCount = data.rows.filter((r) => r.hasBoard).length;

  return (
    <div className="flex h-dvh flex-col bg-white lg:flex-row">
      <aside className="order-2 flex min-h-0 flex-1 flex-col border-t border-stone-200 lg:order-1 lg:h-full lg:w-[360px] lg:flex-none lg:border-r lg:border-t-0">
        <header className="shrink-0 border-b border-stone-200 px-4 py-3">
          <h1 className="text-base font-semibold text-stone-900">
            {data.chainName} — prosjekter
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            {data.rows.length} prosjekter, {boardCount} med nabolagskart
          </p>
        </header>
        <PortfolioList
          rows={data.rows}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onHover={setHoveredId}
          scrollRef={listRef}
        />
      </aside>

      <div className="order-1 h-[45dvh] shrink-0 lg:order-2 lg:h-full lg:flex-1">
        <PortfolioMap
          projects={data.projects}
          camera={data.camera}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={setSelectedId}
          onHover={setHoveredId}
        />
      </div>
    </div>
  );
}
