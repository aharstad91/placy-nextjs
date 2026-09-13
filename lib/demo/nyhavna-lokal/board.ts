import { createHash } from "node:crypto";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardData,
  BoardHome,
  BoardPOI,
  BoardPOIId,
} from "@/components/variants/report/board/board-data";
import { poiVisualIdentity } from "@/components/variants/report/board/marker-style";
import type { Category, POI, Project } from "@/lib/types";
import { LOCAL_DATASET_ID } from "@/lib/demo/nyhavna-lokal/dataset";
import type { LocalCategory, LocalDataset, LocalPlace } from "@/lib/demo/nyhavna-lokal/schema";

/**
 * Adapteren: lokalt datasett → boardets egne typer (2026-09-13).
 *
 * ## Hvorfor forbi report-pipelinen
 *
 * `transformToReportData`/`adaptBoardData` DROPPER kategorier uten steder —
 * boardet «kan ikke vise en tom kategori». Det er riktig for et provisjonert
 * board, der en tom kategori betyr at nabolaget mangler tilbudet. Her betyr den
 * noe annet: rammen står klar og innholdet er ikke skrevet ennå. Derfor bygges
 * `BoardData` direkte, som `lib/event-board/event-board-data.ts` gjør det —
 * samme presedens, samme komponenter, ingen ny UI.
 *
 * ## Hva som bevisst er utelatt
 *
 * Ingen audio, ingen megler, ingen oppsummering, ingen grounding, ingen
 * isokroner. Ikke fordi de er vanskelige, men fordi et tomt board som later som
 * det har dem er en løgn om datagrunnlaget. De kan legges til når datasettet
 * bærer dem.
 */

/** Farge markørene faller tilbake på hvis en kategori mangler farge. */
const FALLBACK_COLOR = "#94a3b8";

/** Boardets `developmentStatus` kjenner bare to verdier; resten er ikke «her nå». */
const isExisting = (status: LocalPlace["status"]) => status === "existing";

function toCategory(category: LocalCategory): Category {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
  };
}

/**
 * Ett sted → boardets `POI`.
 *
 * `editorialHook` bærer sammendraget fordi det er feltet boardet allerede
 * rendrer som stedets egen tekst. `editorialSources` bærer kilde-URL-ene, som
 * er det kortet viser under teksten.
 */
function toPoi(place: LocalPlace, category: Category, urlBySourceId: ReadonlyMap<string, string>): POI {
  const subCategory: Category = {
    ...category,
    name: place.placeType?.trim() || category.name,
    icon: place.icon?.trim() || category.icon,
  };
  return {
    id: place.id,
    name: place.name,
    coordinates: place.coordinates,
    category: subCategory,
    ...(place.address ? { address: place.address } : {}),
    ...(place.summary ? { editorialHook: place.summary } : {}),
    ...(place.travelTime ? { travelTime: place.travelTime } : {}),
    developmentStatus: isExisting(place.status) ? "existing" : "planned",
    locationPrecision: place.locationPrecision,
    ...(place.locationNote ? { locationNote: place.locationNote } : {}),
    editorialSources: place.sourceIds
      .map((id) => urlBySourceId.get(id))
      .filter((url): url is string => Boolean(url)),
  };
}

function toBoardPoi(poi: POI, categoryId: BoardCategoryId, fallback: { icon: string; color: string }): BoardPOI {
  const identity = poiVisualIdentity(poi, fallback);
  return {
    id: poi.id as BoardPOIId,
    name: poi.name,
    coordinates: poi.coordinates,
    ...(poi.address ? { address: poi.address } : {}),
    ...(poi.editorialHook ? { body: poi.editorialHook } : {}),
    categoryId,
    icon: identity.icon,
    color: identity.color,
    raw: poi,
  };
}

/**
 * Innholds-hashen datasettet identifiseres med.
 *
 * Stemmen sender den med når en samtale startes, og serveren avviser en samtale
 * fra et board som er bygd på et annet datasett enn det serveren har lest. Uten
 * den kunne en fane som sto åpen mens JSON-en ble redigert fått en guide som
 * snakket om steder fanen ikke viser.
 */
export function datasetId(dataset: LocalDataset): string {
  const hash = createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
  return `${LOCAL_DATASET_ID}-${hash.slice(0, 16)}`;
}

/**
 * Et minimalt `Project`.
 *
 * `ReportReelsPage` tar det som prop (prosjekt-ID for instrumentering,
 * oversettelser, 3D-flagget). Det brukes IKKE til å bygge boardet — det gjør
 * `buildLocalBoard`. POI- og kategorilistene speiler datasettet, så et oppslag
 * på prosjektet ikke kan se noe annet enn kartet gjør.
 */
export function buildLocalProject(dataset: LocalDataset): Project {
  const categories = dataset.board.categories.map(toCategory);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const urlBySourceId = new Map(dataset.sources.map((s) => [s.id, s.url]));
  const pois = dataset.places.map((place) => toPoi(place, byId.get(place.categoryId)!, urlBySourceId));
  return {
    demoSnapshotId: datasetId(dataset),
    id: dataset.board.id,
    name: dataset.board.name,
    customer: "demo",
    urlSlug: dataset.board.id,
    productType: "report",
    centerCoordinates: dataset.board.center,
    story: { id: dataset.board.id, title: dataset.board.name },
    pois,
    categories,
    venueType: "residential",
    reportConfig: {
      themes: dataset.board.categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        categories: [c.id],
      })),
      ...(dataset.board.district ? { district: dataset.board.district } : {}),
      ...(dataset.board.city ? { city: dataset.board.city } : {}),
      ...(dataset.board.intro ? { heroIntro: dataset.board.intro } : {}),
      hideBrokerCard: true,
    },
  };
}

/**
 * Datasettet → render-klar `BoardData`.
 *
 * Kategoriene beholdes ALLTID, også tomme: det er hele poenget med rammen. Et
 * tomt board gir et kart uten markører, en temarad med alle temaene, og en
 * tomtilstand per tema (`StoryCategoryBody`).
 */
export function buildLocalBoard(dataset: LocalDataset): BoardData {
  const project = buildLocalProject(dataset);
  const poisByCategory = new Map<string, POI[]>();
  for (const poi of project.pois) {
    const bucket = poisByCategory.get(poi.category.id);
    if (bucket) bucket.push(poi);
    else poisByCategory.set(poi.category.id, [poi]);
  }

  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));

  const categories: BoardCategory[] = dataset.board.categories.map((category) => {
    const categoryId = category.id as BoardCategoryId;
    const fallback = { icon: category.icon || "MapPin", color: category.color || FALLBACK_COLOR };
    // Nærmest først, som på et provisjonert board. Steder uten målt tid står
    // sist i stedet for å bli sortert på et tall vi ikke har.
    const pois = (poisByCategory.get(category.id) ?? [])
      .slice()
      .sort(
        (a, b) =>
          (a.travelTime?.walk ?? Infinity) - (b.travelTime?.walk ?? Infinity) ||
          a.name.localeCompare(b.name, "nb"),
      )
      .map((poi) => toBoardPoi(poi, categoryId, fallback));
    const source = category.sourceId ? sourceById.get(category.sourceId) : undefined;
    const hasEditorial = Boolean(category.body || category.unplaced.length || source);
    return {
      id: categoryId,
      label: category.name,
      lead: category.lead,
      body: category.body,
      icon: fallback.icon,
      color: fallback.color,
      pois,
      // Ingen score i datasettet: rekkefølgen er den samme som i lista, så
      // «utvalget» og «alt vi har» aldri kan fortelle to historier.
      topRankedPois: pois,
      ...(hasEditorial
        ? {
            editorial: {
              body: category.body,
              highlights: pois.slice(0, 3).map((poi) => ({
                id: poi.id,
                name: poi.name,
                icon: poi.icon,
                color: poi.color,
              })),
              ...(source ? { source: { label: source.label, page: source.page, url: source.url } } : {}),
              ...(category.unplaced.length ? { unplaced: category.unplaced } : {}),
            },
          }
        : {}),
    };
  });

  const home: BoardHome = {
    name: dataset.board.name,
    coordinates: dataset.board.center,
    address: dataset.board.address,
    ...(dataset.board.intro ? { heroIntro: dataset.board.intro } : {}),
    ...(dataset.board.district ? { district: dataset.board.district } : {}),
    ...(dataset.board.city ? { city: dataset.board.city } : {}),
  };

  return {
    demoSnapshotId: project.demoSnapshotId,
    demoDataset: LOCAL_DATASET_ID,
    demoGreeting: dataset.board.greeting,
    projectSlug: project.urlSlug,
    home,
    categories,
    poisById: new Map(project.pois.map((poi) => [poi.id.toLowerCase(), poi])),
    // Ingen FAQ, ingen områdetekst, ingen lyd: datasettet bærer dem ikke ennå,
    // og et board som later som er verre enn et tomt.
    globalFaq: [],
    audioTourEnabled: false,
    venueType: "residential",
  };
}
