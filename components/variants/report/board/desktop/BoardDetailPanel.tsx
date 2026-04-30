"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  useBoard,
  useActiveCategory,
  useFilteredActiveCategory,
} from "../board-state";
import type { BoardCategory } from "../board-data";
import { BoardTabs } from "../mobile/BoardTabs";
import { BoardPOIAccordion } from "./BoardPOIAccordion";
import { BoardCategoryInfoTab } from "../BoardCategoryInfoTab";
import { SubCategoryFilter } from "../SubCategoryFilter";
import { deriveSubCategories } from "../use-sub-category-filter";

/**
 * Desktop midt-panel (400px). Rendrer kategori-detalj med Beliggenhet/Punkter-tabs.
 * Punkter-tabben bruker accordion (BoardPOIAccordion) — ingen dedikert POI-subview.
 * Default-phase viser eiendomsbilde + intro.
 */
export function BoardDetailPanel() {
  const { state } = useBoard();
  const cat = useActiveCategory();
  const filteredCat = useFilteredActiveCategory();

  // Tab-state lokal: "info" | "punkter".
  // OPEN_POI (kart-marker eller accordion): alltid "punkter" — også når POI-en
  // tilhører en annen kategori enn aktiv (da byttes kategori samtidig).
  // SELECT_CATEGORY (rent kategori-bytte uten POI-kontekst): reset til "info".
  const [tab, setTab] = useState<"info" | "punkter">("info");
  const prevCategoryRef = useRef(state.activeCategoryId);

  useEffect(() => {
    const categoryChanged = prevCategoryRef.current !== state.activeCategoryId;
    if (state.phase === "poi") {
      setTab("punkter");
    } else if (categoryChanged) {
      setTab("info");
    }
    prevCategoryRef.current = state.activeCategoryId;
  }, [state.phase, state.activeCategoryId]);

  return (
    <section
      aria-label="Kategori-detaljer"
      className="flex h-full w-[400px] flex-col border-r border-stone-200/80 bg-stone-50"
    >
      {state.phase === "default" || !cat || !filteredCat ? (
        <DefaultEmptyState />
      ) : (
        <CategoryDetail
          category={cat}
          filteredCategory={filteredCat}
          tab={tab}
          onTabChange={setTab}
        />
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
  filteredCategory,
  tab,
  onTabChange,
}: {
  /** Original kategori — brukt for stabile felter (label, info, illustration). */
  category: BoardCategory;
  /** Kategori med sub-kategori-filter applisert — brukt for poi-listen. */
  filteredCategory: BoardCategory;
  tab: "info" | "punkter";
  onTabChange: (t: "info" | "punkter") => void;
}) {
  const { data, subFilter } = useBoard();

  // Sub-kategorier deriveres fra ufiltrert kategori — filteret skal kunne
  // skjule/vise selv om aktuelt ingen er synlige.
  const subCategories = useMemo(
    () => deriveSubCategories(category),
    [category],
  );

  const hasFilter = subCategories.length >= 2;
  const punkterLabel =
    hasFilter && subFilter.hiddenIds.size > 0
      ? `Punkter (${filteredCategory.pois.length}/${category.pois.length})`
      : `Punkter (${filteredCategory.pois.length})`;

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
          { id: "punkter", label: punkterLabel },
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
          {hasFilter && (
            <div className="pb-3">
              <SubCategoryFilter
                subCategories={subCategories}
                hiddenIds={subFilter.hiddenIds}
                onToggle={subFilter.toggle}
                onToggleAll={subFilter.toggleAll}
                variant="desktop"
              />
            </div>
          )}
          {filteredCategory.pois.length === 0 ? (
            <EmptyFilterState onShowAll={subFilter.reset} />
          ) : (
            <BoardPOIAccordion category={filteredCategory} />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyFilterState({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-white/40 px-4 py-8 text-center">
      <p className="text-sm text-stone-600">
        Ingen punkter matcher det aktuelle filteret.
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-3 text-sm font-semibold text-stone-700 underline underline-offset-2 hover:text-stone-900"
      >
        Vis alle igjen
      </button>
    </div>
  );
}
