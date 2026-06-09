"use client";

import { CalendarDays, Clock, MapPin, RotateCcw } from "lucide-react";
import { useBoard } from "../board-state";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardPOIId,
} from "../board-data";
import {
  useKompassSelections,
  useKompassActions,
} from "@/lib/kompass-store";
import { formatEventDay } from "@/lib/hooks/useEventDayFilter";
import type { EventBoardFilterResult } from "@/lib/event-board/useEventBoardFilter";
import {
  TIME_BUCKETS,
  TIMELESS_BUCKET_LABEL,
} from "@/lib/event-board/event-filter-constants";
import type { EventDaySection } from "@/lib/event-board/event-day-sections";

/**
 * Event-board filter-panel (Unit 4) — den DELTE sidebar-overflaten som surfacer
 * de felles interaksjonsreglene begge varianter arver:
 *
 * - Tema-chips (R3) → `useKompassFilter` via kompass-store `selectedThemes`.
 * - Tid-chips (R3) → `selectedTimeSlots`; fail-open (R14: events uten starttid
 *   filtreres ikke bort, og samles i en "Tidspunkt ikke oppgitt"-gruppe).
 * - Dag-kontroll (R13): fler-dags → klikkbare dag-chips; én-dags (Kulturnatt) →
 *   READ-ONLY dato-label (vises, ikke skjult — beholder kontekst).
 * - Liste (D6/R16): dato-bevisst sorterte events, gruppert i dag-seksjoner
 *   (`eventFilter.sections`). Udatert gruppe sist.
 * - Tomtilstand (R12): når filtrert antall = 0 OG minst ett filter er aktivt →
 *   tekst + "Nullstill filter"-CTA.
 *
 * Variant-spesifikt innhold (filter-liste vs. tidslinje-toggle) leveres i
 * varianter-planen; dette panelet er den felles basisen.
 */
export function EventFilterPanel({
  filter,
  categories,
}: {
  filter: EventBoardFilterResult;
  /** Board-kategoriene (for tema-chip-etiketter/farger). */
  categories: BoardCategory[];
}) {
  const { state, dispatch } = useBoard();
  const activePoiId = state.activePOIId;
  const { selectedThemes, selectedDay, selectedTimeSlots } =
    useKompassSelections();
  const { toggleTheme, setSelectedDay, toggleTimeSlot, resetKompass } =
    useKompassActions();

  const openPoi = (poiId: string, categoryId: string) =>
    dispatch({
      type: "OPEN_POI",
      id: poiId as BoardPOIId,
      categoryId: categoryId as BoardCategoryId,
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filter-kontroller — sticky topp så lista scroller under dem. */}
      <div className="shrink-0 space-y-3 px-6 pb-3 pt-1">
        {/* Dag-kontroll (R13). */}
        <DayControl
          days={filter.days}
          isSingleDay={filter.isSingleDay}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />

        {/* Tema-chips (R3). */}
        {categories.length > 0 && (
          <ChipGroup label="Tema">
            {categories.map((c) => (
              <Chip
                key={c.id}
                active={selectedThemes.includes(c.id)}
                color={c.color}
                onClick={() => toggleTheme(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </ChipGroup>
        )}

        {/* Tid-chips (R3, fail-open R14). */}
        <ChipGroup label="Tid på døgnet" icon={<Clock size={13} />}>
          {TIME_BUCKETS.map((b) => (
            <Chip
              key={b.slot}
              active={selectedTimeSlots.includes(b.slot)}
              onClick={() => toggleTimeSlot(b.slot)}
            >
              {b.label}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      {/* Resultat-liste / tomtilstand. */}
      {filter.filteredCount === 0 ? (
        <EmptyState
          hasActiveFilter={filter.hasActiveFilter}
          onReset={resetKompass}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filter.sections.map((section) => (
            <DaySectionBlock
              key={section.dateKey}
              section={section}
              categories={categories}
              activePoiId={activePoiId}
              onOpenPoi={openPoi}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dag-kontroll (R13). Én event-dag → read-only dato-label (kontekst, ikke skjult).
 * Fler-dags → "Alle dager" + klikkbare dag-chips (toggle av/på).
 */
function DayControl({
  days,
  isSingleDay,
  selectedDay,
  onSelectDay,
}: {
  days: string[];
  isSingleDay: boolean;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}) {
  if (days.length === 0) return null;

  if (isSingleDay) {
    // R13: read-only dato-label. Ikke en velger — bare kontekst om hvilken dag
    // programmet gjelder (f.eks. Kulturnatt = én kveld).
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-[13px] font-semibold text-stone-700 ring-1 ring-black/5">
        <CalendarDays size={15} className="shrink-0 text-stone-400" />
        <span>{formatEventDay(days[0])}</span>
      </div>
    );
  }

  return (
    <ChipGroup label="Dag" icon={<CalendarDays size={13} />}>
      <Chip active={selectedDay === null} onClick={() => onSelectDay(null)}>
        Alle dager
      </Chip>
      {days.map((d) => (
        <Chip
          key={d}
          active={selectedDay === d}
          onClick={() => onSelectDay(selectedDay === d ? null : d)}
        >
          {formatEventDay(d)}
        </Chip>
      ))}
    </ChipGroup>
  );
}

/** Tomtilstand (R12). CTA vises kun når et filter faktisk er aktivt. */
function EmptyState({
  hasActiveFilter,
  onReset,
}: {
  hasActiveFilter: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <p className="text-sm font-semibold text-stone-700">
        {hasActiveFilter
          ? "Ingen arrangementer matcher filteret"
          : "Ingen arrangementer å vise"}
      </p>
      <p className="mt-1 text-[13px] text-stone-500">
        {hasActiveFilter
          ? "Prøv å justere tema, dag eller tidspunkt."
          : "Programmet er ikke lagt inn ennå."}
      </p>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-700"
        >
          <RotateCcw size={14} />
          Nullstill filter
        </button>
      )}
    </div>
  );
}

/**
 * Én dag-seksjon (D6). Overskrift = dato-label (eller "Tidspunkt ikke oppgitt"
 * for udaterte, R14), deretter de dato-/tid-sorterte event-radene (R16).
 */
function DaySectionBlock({
  section,
  categories,
  activePoiId,
  onOpenPoi,
}: {
  section: EventDaySection;
  categories: BoardCategory[];
  activePoiId: string | null;
  onOpenPoi: (poiId: string, categoryId: string) => void;
}) {
  const heading = section.isUndated
    ? TIMELESS_BUCKET_LABEL
    : formatEventDay(section.dateKey);

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
        {heading}
      </h3>
      <div className="flex flex-col gap-2">
        {section.pois.map((poi) => {
          const cat = categories.find((c) => c.id === poi.category.id);
          const color = cat?.color ?? poi.category.color ?? "#94a3b8";
          const time = poi.eventTimeStart
            ? poi.eventTimeEnd
              ? `${poi.eventTimeStart}–${poi.eventTimeEnd}`
              : poi.eventTimeStart
            : "Tidspunkt ikke oppgitt";
          return (
            <button
              key={poi.id}
              type="button"
              onClick={() => onOpenPoi(poi.id, poi.category.id)}
              aria-current={activePoiId === poi.id}
              className={`group flex w-full cursor-pointer items-start gap-3 rounded-2xl border bg-white/60 p-2.5 text-left transition-all duration-150 hover:bg-white ${
                activePoiId === poi.id
                  ? "border-stone-900 ring-1 ring-stone-900"
                  : "border-black/5 hover:border-stone-500 hover:ring-1 hover:ring-stone-500"
              }`}
            >
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: color }}
              >
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-stone-900">
                  {poi.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-stone-500">
                  <Clock size={12} className="shrink-0 text-stone-400" />
                  {time}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Liten chip-gruppe-wrapper med valgfri etikett/ikon. */
function ChipGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
        {icon}
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Toggle-chip. `color` (hex) farger en liten prikk når kategori-spesifikk. */
function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "bg-stone-900 text-white"
          : "bg-white/60 text-stone-600 ring-1 ring-black/5 hover:bg-white"
      }`}
    >
      {color && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: active ? "#ffffff" : color }}
        />
      )}
      {children}
    </button>
  );
}
