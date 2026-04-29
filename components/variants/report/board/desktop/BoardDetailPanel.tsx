"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import {
  useBoard,
  useActiveCategory,
  useActivePOI,
} from "../board-state";
import type { BoardCategory, BoardPOI } from "../board-data";
import { BoardTabs } from "../mobile/BoardTabs";
import { BoardRelatedPOICard } from "../mobile/BoardRelatedPOICard";

/**
 * Desktop midt-panel (400px). Rendrer kategori-detalj med Info/Punkter-tabs,
 * eller POI-detail som subview når phase=poi. Default-phase viser tom-tilstand.
 */
export function BoardDetailPanel() {
  const { state } = useBoard();
  const cat = useActiveCategory();
  const poi = useActivePOI();

  // Tab-state lokal: "info" | "punkter".
  // Regler:
  // - SELECT_CATEGORY (default→active eller swap kategori): reset til "info"
  // - OPEN_POI (active→poi): sett til "punkter" (slik at retur lander på Punkter)
  // - BACK_TO_ACTIVE (poi→active): behold "punkter" (per Cluster 5 doc-review)
  const [tab, setTab] = useState<"info" | "punkter">("info");
  const prevPhaseRef = useRef(state.phase);
  const prevCategoryRef = useRef(state.activeCategoryId);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevCategory = prevCategoryRef.current;
    const categoryChanged = prevCategory !== state.activeCategoryId;

    if (state.phase === "poi") {
      setTab("punkter");
    } else if (state.phase === "active") {
      // Behold "punkter" hvis vi kommer fra POI (BACK_TO_ACTIVE).
      // Ellers (SELECT_CATEGORY på default eller bytte mellom kategorier): reset til "info".
      if (prevPhase === "poi" && !categoryChanged) {
        // keep tab — most likely "punkter"
      } else {
        setTab("info");
      }
    }

    prevPhaseRef.current = state.phase;
    prevCategoryRef.current = state.activeCategoryId;
  }, [state.phase, state.activeCategoryId]);

  return (
    <section
      aria-label="Kategori-detaljer"
      className="flex h-full w-[400px] flex-col border-r border-stone-200/80 bg-stone-50"
    >
      {state.phase === "default" || !cat ? (
        <DefaultEmptyState />
      ) : state.phase === "poi" && poi ? (
        <POISubview category={cat} poi={poi} />
      ) : (
        <CategoryDetail category={cat} tab={tab} onTabChange={setTab} />
      )}
    </section>
  );
}

function DefaultEmptyState() {
  return (
    <div className="flex h-full flex-col justify-center px-6 py-8">
      <h2 className="text-2xl font-bold leading-tight text-stone-900">
        Hva lurer du på?
      </h2>
      <p className="mt-3 text-base leading-relaxed text-stone-600">
        Velg en kategori i raden til venstre for å utforske nabolaget.
      </p>
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
  const { dispatch } = useBoard();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
      <header className="space-y-2 pb-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {category.label}
        </div>
        <h2 className="text-2xl font-bold leading-tight text-stone-900">
          {category.question || category.label}
        </h2>
        {category.lead && (
          <p className="text-base leading-relaxed text-stone-700">
            {category.lead}
          </p>
        )}
      </header>

      <BoardTabs
        value={tab}
        onChange={(v) => onTabChange(v as "info" | "punkter")}
        tabs={[
          { id: "info", label: "Info" },
          { id: "punkter", label: `Punkter (${category.pois.length})` },
        ]}
      />

      {tab === "info" && (
        <div className="space-y-4 pb-6">
          {category.illustration && (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-stone-200">
              <Image
                src={category.illustration.src}
                alt=""
                fill
                sizes="400px"
                className="object-cover"
              />
            </div>
          )}
          {category.body && (
            <div className="space-y-3 text-stone-800">
              {category.body.split(/\n+/).map((p, i) => (
                <p key={i} className="text-[15px] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "punkter" && (
        <div className="space-y-2.5 pb-6">
          {category.pois.map((p) => (
            <BoardRelatedPOICard
              key={p.id}
              poi={p}
              categoryColor={category.color}
              onClick={() =>
                dispatch({ type: "OPEN_POI", id: p.id, categoryId: category.id })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function POISubview({
  category,
  poi,
}: {
  category: BoardCategory;
  poi: BoardPOI;
}) {
  const { dispatch } = useBoard();
  const Icon = getFilledIcon(poi.raw.category.icon);
  const related = category.pois.filter((p) => p.id !== poi.id);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
      <button
        type="button"
        onClick={() => dispatch({ type: "BACK_TO_ACTIVE" })}
        className="mb-4 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-200/70"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        <span>Tilbake til {category.label}</span>
      </button>

      <header className="flex items-start gap-3.5 pb-4 pr-2">
        <div
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full shadow-md"
          style={{ backgroundColor: category.color }}
        >
          <Icon className="h-6 w-6 text-white" weight="fill" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-xl font-bold leading-tight text-stone-900">
            {poi.name}
          </h2>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-stone-500">
            {category.label}
          </div>
        </div>
      </header>

      {poi.address && (
        <div className="border-b border-stone-200/80 pb-4 text-sm text-stone-600">
          {poi.address}
        </div>
      )}

      {poi.body && (
        <div className="space-y-3 pt-4 text-stone-800">
          {poi.body.split(/\n+/).map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <section className="pt-6">
          <h3 className="pb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Andre i kategorien
          </h3>
          <div className="space-y-2.5 pb-6">
            {related.map((other) => (
              <BoardRelatedPOICard
                key={other.id}
                poi={other}
                categoryColor={category.color}
                onClick={() =>
                  dispatch({
                    type: "OPEN_POI",
                    id: other.id,
                    categoryId: category.id,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
