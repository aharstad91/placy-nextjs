"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useBoard, useActiveCategory } from "../board-state";
import type { BoardCategory } from "../board-data";
import { BoardTabs } from "../mobile/BoardTabs";
import { BoardPOIAccordion } from "./BoardPOIAccordion";
import { BoardCategoryInfoTab } from "../BoardCategoryInfoTab";

/**
 * Desktop midt-panel (400px). Rendrer kategori-detalj med Info/Punkter-tabs.
 * Punkter-tabben bruker accordion (BoardPOIAccordion) — ingen dedikert POI-subview.
 * Default-phase viser eiendomsbilde + intro.
 */
export function BoardDetailPanel() {
  const { state } = useBoard();
  const cat = useActiveCategory();

  // Tab-state lokal: "info" | "punkter".
  // OPEN_POI (active→poi via accordion): sett til "punkter" så retur lander der.
  // SELECT_CATEGORY (kategori-bytte): reset til "info".
  const [tab, setTab] = useState<"info" | "punkter">("info");
  const prevCategoryRef = useRef(state.activeCategoryId);

  useEffect(() => {
    const categoryChanged = prevCategoryRef.current !== state.activeCategoryId;
    if (categoryChanged) {
      setTab("info");
    } else if (state.phase === "poi") {
      setTab("punkter");
    }
    prevCategoryRef.current = state.activeCategoryId;
  }, [state.phase, state.activeCategoryId]);

  return (
    <section
      aria-label="Kategori-detaljer"
      className="flex h-full w-[400px] flex-col border-r border-stone-200/80 bg-stone-50"
    >
      {state.phase === "default" || !cat ? (
        <DefaultEmptyState />
      ) : (
        <CategoryDetail category={cat} tab={tab} onTabChange={setTab} />
      )}
    </section>
  );
}

function DefaultEmptyState() {
  const { data } = useBoard();
  const { home } = data;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {home.heroImage && (
        <div className="relative aspect-[4/3] w-full flex-none bg-stone-200">
          <Image
            src={home.heroImage}
            alt={home.name}
            fill
            sizes="400px"
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="flex flex-col gap-3 px-6 py-6">
        {home.address && (
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {home.address}
          </div>
        )}
        <h2 className="text-2xl font-bold leading-tight text-stone-900">
          {home.name}
        </h2>
        {home.heroIntro && (
          <p className="text-[15px] leading-relaxed text-stone-700">
            {home.heroIntro}
          </p>
        )}
        <p className="pt-2 text-sm text-stone-500">
          Velg en kategori for å utforske nabolaget.
        </p>
      </div>
    </div>
  );
}

function CategoryDetail({
  category,
  tab,
  onTabChange,
}: {
  category: BoardCategory;
  tab: "info" | "punkter";
  onTabChange: (t: "info" | "punkter") => void;
}) {
  const { data } = useBoard();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
      <header className="pb-5">
        <h2 className="text-2xl font-bold leading-tight text-stone-900">
          {category.label}
        </h2>
      </header>

      <BoardTabs
        value={tab}
        onChange={(v) => onTabChange(v as "info" | "punkter")}
        fullWidth
        tabs={[
          { id: "info", label: "Beliggenhet" },
          { id: "punkter", label: `Punkter (${category.pois.length})` },
        ]}
      />

      {tab === "info" && (
        <div className="pb-6">
          <BoardCategoryInfoTab
            category={category}
            poisById={data.poisById}
            imageSizes="400px"
          />
        </div>
      )}

      {tab === "punkter" && (
        <div className="pb-6">
          <BoardPOIAccordion category={category} />
        </div>
      )}
    </div>
  );
}
