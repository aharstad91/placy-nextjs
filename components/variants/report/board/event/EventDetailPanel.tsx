"use client";

import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
} from "lucide-react";
import type { BoardPOI } from "../board-data";
import { formatEventDay } from "@/lib/hooks/useEventDayFilter";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { POIRealtimeSection } from "../../blocks/POIRealtimeSection";
import type { BoardCollectionApi } from "@/lib/event-board/use-board-collection";

/**
 * Per-event drill-in detalj-panel (Unit 6, R15). NET-NEW — bevisst IKKE en
 * gjenbruk av `CategoryDetailView` (DesktopStorySidebar), som er gated på
 * `activeCat.editorial` og viser KATEGORI-kuratering. Event-adapteren utelater
 * editorial, og dette panelet viser ÉT arrangement: tittel, dato, tid, sted,
 * beskrivelse + "legg i samling".
 *
 * Surfaces fra `EventFilterPanel` når et event er åpnet (`OPEN_POI` → board-
 * state phase "poi"). Klikk på en event-rad, en kart-markør eller (senere) en
 * tidslinje-blokk dispatcher `OPEN_POI` → kameraet flyr til venuen via den
 * eksisterende board-kamera-maskineriet (3D: `use-board-3d-camera.ts`s
 * `activePOI`-intent; 2D: marker-popup) — INGEN ny fly-to-søm her.
 *
 * D7 — live transport ARVET, ikke net-new: venues med
 * `enturStopplaceId`/`bysykkelStationId`/`hyreStationId` får en sanntidsrad via
 * den samme `useRealtimeData` + `POIRealtimeSection`-stien som boligrapportens
 * highlight-rader og kart-popupene. Ikke-transport-venues poller ikke (hooket er
 * null-trygt) → ingen rad.
 *
 * Degraderer pent: mangler beskrivelse → ingen brødtekst; mangler tid →
 * "Tidspunkt ikke oppgitt"; mangler dato/adresse → meta-radene utelates.
 */
export function EventDetailPanel({
  poi,
  color,
  collection,
  onBack,
}: {
  /** Det aktive event-et (resolvet av kalleren via `useActivePOI`). */
  poi: BoardPOI;
  /** Kategori-farge (hex) for ikon-aksenten. */
  color: string;
  /** Unit 5: "Min samling"-søm. Når satt vises en lagre/fjern-knapp som speiler
   *  rad-toggelen i lista. Null/undefined → ingen lagre-knapp. */
  collection?: BoardCollectionApi | null;
  /** Tilbake → board-state BACK_TO_DEFAULT (lukker POI-overlay, beholder filter). */
  onBack: () => void;
}) {
  const raw = poi.raw;

  // D7: transport-venue? Les koblings-IDene fra raw-POIen (samme felter som
  // boligrapportens highlights). Hooket er null-trygt — ikke-transport poller ikke.
  const isTransport = !!(
    raw.enturStopplaceId ||
    raw.bysykkelStationId ||
    raw.hyreStationId
  );
  const realtimeData = useRealtimeData(isTransport ? raw : null);

  const time = poi.eventTimeStart
    ? poi.eventTimeEnd
      ? `${poi.eventTimeStart}–${poi.eventTimeEnd}`
      : poi.eventTimeStart
    : "Tidspunkt ikke oppgitt";

  // Dato-label (første event-dato). Udatert event → ingen dato-rad.
  const dateLabel =
    poi.eventDates && poi.eventDates.length > 0
      ? formatEventDay(poi.eventDates[0])
      : null;

  // Dobbelt linjeskift = nytt avsnitt (body er editorialHook/insight eller
  // event-beskrivelse, satt av event-adapteren).
  const paragraphs = (poi.body ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const tags = raw.eventTags?.filter(Boolean) ?? [];
  const saved = collection?.has(poi.id) ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Tilbake-rad → tilbake til filter-lista (lukker POI-overlay). */}
      <button
        type="button"
        onClick={onBack}
        className="mb-3 -ml-1 inline-flex w-fit items-center gap-1.5 rounded-full px-1.5 py-1 text-[13px] font-semibold text-stone-600 transition hover:bg-black/5 hover:text-stone-900"
      >
        <ArrowLeft size={16} />
        Tilbake til programmet
      </button>

      {/* Tittel-rad: kategori-farget ikon + navn. */}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: color }}
        >
          <MapPin size={18} />
        </span>
        <h3 className="text-lg font-bold leading-tight text-stone-900">
          {poi.name}
        </h3>
      </div>

      {/* Meta: dato, tid, sted. Udaterte/adresseløse rader utelates. */}
      <div className="mt-3 space-y-1.5">
        {dateLabel && (
          <MetaRow icon={<CalendarDays size={14} />}>{dateLabel}</MetaRow>
        )}
        <MetaRow icon={<Clock size={14} />}>{time}</MetaRow>
        {poi.address && (
          <MetaRow icon={<MapPin size={14} />}>{poi.address}</MetaRow>
        )}
      </div>

      {/* Event-tags (f.eks. "Gratis", "Barnevennlig"). */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-stone-600 ring-1 ring-black/5"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* "Min samling"-knapp (Unit 5-søm). */}
      {collection && (
        <button
          type="button"
          onClick={() => collection.toggle(poi.id)}
          aria-pressed={saved}
          aria-label={
            saved ? `Fjern ${poi.name} fra samling` : `Legg ${poi.name} i samling`
          }
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
            saved
              ? "bg-sky-500 text-white hover:bg-sky-600"
              : "bg-white/70 text-stone-700 ring-1 ring-black/5 hover:bg-white"
          }`}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
          {saved ? "Lagret i samling" : "Legg i samling"}
        </button>
      )}

      {/* Beskrivelse — degraderer til ingenting når body mangler. */}
      {paragraphs.length > 0 && (
        <div className="mt-4 space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-stone-600">
              {p}
            </p>
          ))}
        </div>
      )}

      {/* D7: live transport-rad — kun for venues med stopp-ID. Arvet integrasjon
          (Entur/bysykkel/Hyre), samme komponent som kart-popupene. */}
      {isTransport && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Kollektiv i nærheten
          </p>
          <POIRealtimeSection realtimeData={realtimeData} />
        </div>
      )}

      {/* Lenke til arrangørens side, hvis oppgitt. */}
      {raw.eventUrl && (
        <a
          href={raw.eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-sky-600 transition hover:text-sky-700"
        >
          <ExternalLink size={14} />
          Mer om arrangementet
        </a>
      )}
    </div>
  );
}

/** Liten meta-rad med ikon + verdi (dato/tid/sted). */
function MetaRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-stone-600">
      <span className="shrink-0 text-stone-400">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
