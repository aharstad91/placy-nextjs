/**
 * Adapter: event-Project (Supabase, productType "explorer" + Event-tags)
 * → BoardData (render-klar shape som board-skallet konsumerer direkte).
 *
 * Speiler `lib/trip-adapter.ts`: en tynn, render-klar adapter som mater de
 * eksisterende board-komponentene UTEN å gå via report-kuraterings-pipelinen
 * (`transformToReportData`/`getReportThemes`). Events har ingen kuratert
 * narrativ/audio — derfor:
 *
 * - `audioTourEnabled: false`
 * - ingen `editorial`/`welcome`/`outro`/`summary`/`brokers` (ingen-audio-modus
 *   håndteres av skallet i Unit 3, ikke her — vi utelater bare feltene).
 *
 * D5: event-feltene (`eventDates`/`eventTimeStart`/`eventTimeEnd`) bevares på
 * `BoardPOI.raw` (de finnes allerede på kilde-POIen fra DB). `useKompassFilter`
 * (Unit 4) leser `raw`, ikke display-feltene. Vi speiler dem også til
 * display-feltene på `BoardPOI` for tom-/nil-sikker rendering.
 */

import type { POI, Project } from "@/lib/types";
import type { BransjeprofilFeatures } from "@/lib/themes/bransjeprofiler";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardData,
  BoardHome,
  BoardPOI,
  BoardPOIId,
} from "@/components/variants/report/board/board-data";

/**
 * Bygg `BoardData` fra et event-prosjekt + dets bransjeprofil-features.
 *
 * `features` (`BransjeprofilFeatures`) holdes i signaturen for paritet med
 * report-stien og for fremtidig feature-gating (dayFilter/agendaView).
 * Foundationen er event-agnostisk (D8): virker for alle Event-taggede
 * prosjekter, ikke bare Kulturnatt.
 *
 * Kategorier uten POIer droppes (board kan ikke rendre tom kategori — speiler
 * `adaptBoardData`). Hvis alle kategorier er tomme returneres `categories: []`
 * — skallet rendrer da en tomtilstand uten å kaste.
 */
export function eventToBoardData(
  project: Project,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _features?: BransjeprofilFeatures,
): BoardData {
  // Grupper POIer per kategori-id. Kun kategorier definert i project.categories
  // får en BoardCategory; POIer med en kategori-id uten match droppes (vi har
  // ingen label/ikon/farge å rendre dem med).
  const poisByCategoryId = new Map<string, POI[]>();
  for (const poi of project.pois) {
    const catId = poi.category?.id;
    if (!catId) continue;
    const bucket = poisByCategoryId.get(catId);
    if (bucket) {
      bucket.push(poi);
    } else {
      poisByCategoryId.set(catId, [poi]);
    }
  }

  // Map kategorier → BoardCategory (id/label/icon/color fra project.categories).
  // Dropp kategorier uten POIer. Bevarer rekkefølgen fra project.categories.
  const categories: BoardCategory[] = project.categories
    .map((cat) => {
      const pois = poisByCategoryId.get(cat.id);
      if (!pois || pois.length === 0) return null;
      const categoryId = cat.id as BoardCategoryId;
      const boardPois = pois.map((p) => adaptEventPOI(p, categoryId));
      const boardCat: BoardCategory = {
        id: categoryId,
        label: cat.name || cat.id,
        lead: "",
        body: "",
        icon: cat.icon || "MapPin",
        color: cat.color || "#94a3b8", // stone-400
        pois: boardPois,
        // Events har ingen score-rangering; topRankedPois speiler distanse-
        // sorterte pois så board-laget får samme BoardPOI-form.
        topRankedPois: boardPois,
        // Ingen editorial/audio/grounding for events (utelates).
      };
      return boardCat;
    })
    .filter((c): c is BoardCategory => c !== null);

  // Full POI-lookup (lowercase id → POI) på tvers av alle kategorier — samme
  // kontrakt som adaptBoardData. Bygges fra project.pois så den dekker også
  // POIer i droppede/ukategoriserte kategorier (grounding-paritet).
  const poisById = new Map<string, POI>();
  for (const poi of project.pois) {
    poisById.set(poi.id.toLowerCase(), poi);
  }

  const home: BoardHome = {
    name: project.name,
    coordinates: project.centerCoordinates,
    // Events har ingen "eiendom" — adressen er ikke meningsfull. Holdes tom
    // (ingen-audio-modus i Unit 3 undertrykker uansett megler/eiendoms-chrome).
    address: "",
  };

  return {
    projectSlug: project.urlSlug,
    home,
    categories,
    poisById,
    // D3: ingen audio for events.
    audioTourEnabled: false,
    // Bevisst utelatt: welcome, outro, brokers, summary, cta, assets, editorial.
    venueType: project.venueType ?? null,
  };
}

/**
 * Map en event-POI → BoardPOI.
 *
 * D5: `raw` bærer hele kilde-POIen inkludert `eventDates`/`eventTimeStart`/
 * `eventTimeEnd` (filteret leser herfra). Display-feltene speiles på BoardPOI
 * for nil-sikker rendering: `event_dates: []` og `undefined` blir begge
 * `undefined` her (ikke-dagfiltrerbar), konsistent med `useKompassFilter`s
 * `eventDates && length > 0`-semantikk.
 */
function adaptEventPOI(poi: POI, categoryId: BoardCategoryId): BoardPOI {
  const hook = poi.editorialHook?.trim();
  const insight = poi.localInsight?.trim();
  const desc = poi.eventDescription?.trim() || poi.description?.trim();
  // Body: redaksjonelt innhold hvis det finnes, ellers event-beskrivelse.
  const body = [hook, insight].filter(Boolean).join("\n\n") || desc || undefined;

  // event_dates: [] vs undefined → begge ikke-dagfiltrerbare. Normaliser tom
  // array til undefined på display-feltet (konsistent med filter-semantikken).
  const eventDates =
    poi.eventDates && poi.eventDates.length > 0 ? poi.eventDates : undefined;

  return {
    id: poi.id as BoardPOIId,
    name: poi.name,
    coordinates: poi.coordinates,
    address: poi.address,
    body,
    categoryId,
    eventDates,
    eventTimeStart: poi.eventTimeStart,
    eventTimeEnd: poi.eventTimeEnd,
    // D5: hele kilde-POIen bevares; eventDates/Start/End ligger urørt her.
    raw: poi,
  };
}
