"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useBoard, useActiveCategory } from "../board-state";
import type { BoardCategory } from "../board-data";
import { BoardTabs } from "../mobile/BoardTabs";
import { BoardPOIAccordion } from "./BoardPOIAccordion";
import { truncateBody } from "../body-truncate";

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
  // Reset disclosure-state ved kategori-bytte.
  const [bodyExpanded, setBodyExpanded] = useState(false);
  useEffect(() => {
    setBodyExpanded(false);
  }, [category.id]);

  const truncated = category.body ? truncateBody(category.body) : null;

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
          {truncated && (
            <CategoryBodyDisclosure
              truncated={truncated}
              expanded={bodyExpanded}
              onToggle={() => setBodyExpanded((v) => !v)}
            />
          )}
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

/**
 * Disclosure-blokk for category.body. Viser truncated tekst + "Les mer"-knapp;
 * ekspanderer til full tekst med grid-rows max-height-animasjon (ingen
 * auto-scroll, jf. memory `feedback_disclosure_animations.md`).
 *
 * Mønster: vi rendrer "extra" innhold (rest-paragrafene som er kuttet bort)
 * i en grid-container som animerer fra `grid-template-rows: 0fr` til `1fr`.
 * Truncated paragrafer er alltid synlige. Hvis første paragraf er trunkert
 * (kuttet midt i), vises rest-delen av den paragrafen som ekstra rad — slik
 * får leseren full tekst når expanded uten teksten flytter seg.
 */
function CategoryBodyDisclosure({
  truncated,
  expanded,
  onToggle,
}: {
  truncated: ReturnType<typeof truncateBody>;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Beregn hvilke paragrafer som er "rest" (kun synlig når expanded).
  // Hvis første paragraf er kuttet (slutter med … eller er kortere enn full),
  // tar vi tail-delen av den + alle resterende paragrafer.
  const restParagraphs: string[] = [];
  const truncatedFirst = truncated.truncatedParagraphs[0] ?? "";
  const fullFirst = truncated.fullParagraphs[0] ?? "";
  const firstIsCut = truncatedFirst !== fullFirst;

  if (firstIsCut) {
    // Trim trailing "…" fra truncated for matching, og bruk full-tail.
    const matchPart = truncatedFirst.replace(/…$/, "").trimEnd();
    const tail = fullFirst.startsWith(matchPart)
      ? fullFirst.slice(matchPart.length).trimStart()
      : fullFirst;
    if (tail) restParagraphs.push(tail);
    restParagraphs.push(...truncated.fullParagraphs.slice(1));
  } else {
    restParagraphs.push(
      ...truncated.fullParagraphs.slice(truncated.truncatedParagraphs.length),
    );
  }

  return (
    <div className="space-y-3 text-stone-800">
      <div className="space-y-3">
        {truncated.truncatedParagraphs.map((p, i) => {
          // Hvis første paragraf er kuttet OG vi er expanded, vis full første paragraf
          // ved å droppe truncated-versjonen og la rest ta over.
          if (i === 0 && firstIsCut && expanded) return null;
          return (
            <p key={`t-${i}`} className="text-[15px] leading-relaxed">
              {p}
            </p>
          );
        })}
        {firstIsCut && expanded && (
          <p key="full-first" className="text-[15px] leading-relaxed">
            {fullFirst}
          </p>
        )}
      </div>

      {restParagraphs.length > 0 && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          aria-hidden={!expanded}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 pt-3">
              {(firstIsCut ? restParagraphs.slice(1) : restParagraphs).map(
                (p, i) => (
                  <p key={`r-${i}`} className="text-[15px] leading-relaxed">
                    {p}
                  </p>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {truncated.needsTruncation && (
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-200/70"
          aria-expanded={expanded}
        >
          {expanded ? "Vis mindre" : "Les mer"}
        </button>
      )}
    </div>
  );
}
