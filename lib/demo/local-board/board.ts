import { isAnchorPOI } from "@/lib/board/anchor-poi";
import { radiusPlaces } from "@/lib/demo/local-board/radius";
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
import type { FaqEntry } from "@/lib/generators/faq-generator";
import type { Category, POI, Project } from "@/lib/types";
import type { LocalDemoDescriptor } from "@/lib/demo/local-board/registry";
import type { LocalCategory, LocalDataset, LocalFaq, LocalPlace } from "@/lib/demo/local-board/schema";

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
    id: place.poiCategoryId ?? category.id,
    name: place.poiCategoryId === "butikk" ? "Butikker" : place.placeType?.trim() || category.name,
    icon: place.icon?.trim() || category.icon,
  };
  return {
    id: place.id,
    name: place.name,
    coordinates: place.coordinates,
    category: subCategory,
    ...(place.bysykkelStationId ? { bysykkelStationId: place.bysykkelStationId } : {}),
    ...(place.enturStopplaceId ? { enturStopplaceId: place.enturStopplaceId } : {}),
    ...(place.parentPlaceId ? { parentPoiId: place.parentPlaceId } : {}),
    ...(place.anchorSummary ? { anchorSummary: place.anchorSummary } : {}),
    ...(place.address ? { address: place.address } : {}),
    ...(place.summary ? { editorialHook: place.summary } : {}),
    ...(place.image ? { featuredImage: place.image, markerImage: place.image } : {}),
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
    ...(isAnchorPOI(poi) ? { isAnchor: true, childPOIs: poi.childPOIs ?? [] } : {}),
    raw: poi,
  };
}

/**
 * Ett lokalt spørsmål → boardets `FaqEntry`.
 *
 * `source` er boardets INTERNE sporbarhetsfelt og rendres aldri; det er ikke
 * kildehenvisningen. Importerte svar merkes `deterministic` fordi det er det de
 * var i boardet de kom fra — hvor teksten faktisk kommer fra står i
 * `faq.json`s `sourceIds`, ikke her.
 */
const toFaqEntry = (entry: LocalFaq, sources: LocalDataset["sources"]): FaqEntry => ({
  id: entry.id,
  question: entry.question,
  answer: entry.answer,
  source: entry.origin === "imported" ? "deterministic" : "curated",
  ...(entry.origin === "local" ? {
    knowledgeSources: entry.sourceIds.flatMap((id) => {
      const source = sources.find((s) => s.id === id);
      return source ? [{ id, name: `${source.label}: ${source.page}`, url: source.url, verifiedAt: source.checkedAt }] : [];
    }),
  } : {}),
});

/** Spørsmålene per tema, i filas egen rekkefølge. Nøkkel `""` = hele området. */
function faqByCategory(dataset: LocalDataset): Map<string, FaqEntry[]> {
  const byCategory = new Map<string, FaqEntry[]>();
  const mapIds = new Map(dataset.places.map(p => [p.id, p.parentPlaceId ?? p.id]));
  for (const original of dataset.faqs) {
    const entry = { ...original, answer: original.answer.replace(/\(poi:([^)]+)\)/g, (_, id: string) => `(poi:${mapIds.get(id) ?? id})`) };
    const key = entry.categoryId ?? "";
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(toFaqEntry(entry, dataset.sources));
    else byCategory.set(key, [toFaqEntry(entry, dataset.sources)]);
  }
  return byCategory;
}

/**
 * Innholds-hashen datasettet identifiseres med.
 *
 * Stemmen sender den med når en samtale startes, og serveren avviser en samtale
 * fra et board som er bygd på et annet datasett enn det serveren har lest. Uten
 * den kunne en fane som sto åpen mens JSON-en ble redigert fått en guide som
 * snakket om steder fanen ikke viser.
 */
export function datasetId(dataset: LocalDataset, descriptor: LocalDemoDescriptor): string {
  // Deskriptoren er med i hashen, ikke bare i prefikset: funksjonsflaggene
  // avgjør hva flaten viser og hva stemmen kan gjøre, så en endring i dem er en
  // endring i det brukeren ser — like mye som en endring i innholdet.
  const hash = createHash("sha256").update(JSON.stringify({ dataset, descriptor })).digest("hex");
  return `${descriptor.id}-${hash.slice(0, 16)}`;
}

/**
 * Et minimalt `Project`.
 *
 * `ReportReelsPage` tar det som prop (prosjekt-ID for instrumentering,
 * oversettelser, 3D-flagget). Det brukes IKKE til å bygge boardet — det gjør
 * `buildLocalBoard`. POI- og kategorilistene speiler datasettet, så et oppslag
 * på prosjektet ikke kan se noe annet enn kartet gjør.
 */
export function buildLocalProject(dataset: LocalDataset, descriptor: LocalDemoDescriptor): Project {
  const categories = dataset.board.categories.map(toCategory);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const urlBySourceId = new Map(dataset.sources.map((s) => [s.id, s.url]));
  const pois = dataset.places.map((place) => toPoi(place, byId.get(place.categoryId)!, urlBySourceId));
  return {
    demoSnapshotId: datasetId(dataset, descriptor),
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
    // Kartveksleren Kart / Satelitt / 3D. Boardet åpner i Satelitt når det
    // ikke har innlest omvisning (`BoardMap`s egen regel).
    has3dAddon: dataset.board.map3d,
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
      // Alltid satt, også tom: utelatt felt gir markørens egen standardtekst.
      pinSubtitle: dataset.board.pinSubtitle,
      ...(dataset.board.pinAccent ? { pinAccent: dataset.board.pinAccent } : {}),
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
export function buildLocalBoard(dataset: LocalDataset, descriptor: LocalDemoDescriptor): BoardData {
  const project = buildLocalProject(dataset, descriptor);
  const byId = new Map(project.pois.map(p => [p.id, p]));
  const children = new Map<string, POI[]>();
  const themeByPoiId = new Map(dataset.places.map(p => [p.id, p.categoryId]));
  const directByTheme = new Map<string, POI[]>();
  for (const poi of project.pois) {
    const theme = themeByPoiId.get(poi.id)!;
    const direct = directByTheme.get(theme) ?? [];
    direct.push(poi);
    directByTheme.set(theme, direct);
    if (!poi.parentPoiId) continue;
    const siblings = children.get(poi.parentPoiId) ?? [];
    siblings.push(poi);
    children.set(poi.parentPoiId, siblings);
  }
  for (const [id, members] of children) {
    const parent = byId.get(id)!;
    parent.childPOIs = members;
  }
  const topLevel = project.pois.filter(p => !p.parentPoiId);
  const poisByCategory = new Map<string, POI[]>();
  for (const category of dataset.board.categories) {
    const matches = new Map<string, POI>();
    for (const poi of directByTheme.get(category.id) ?? []) {
      const destination = poi.parentPoiId ? byId.get(poi.parentPoiId)! : poi;
      if (matches.has(destination.id)) continue;
      const members = children.get(destination.id);
      const scoped = members?.filter(p => themeByPoiId.get(destination.id) === category.id || themeByPoiId.get(p.id) === category.id);
      matches.set(destination.id, scoped ? { ...destination, childPOIs: scoped } : destination);
    }
    poisByCategory.set(category.id, [...matches.values()]);
  }

  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));
  const faqs = faqByCategory(dataset);

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
    const faq = faqs.get(category.id) ?? [];
    // Spørsmålene alene er nok til at temaet har en `editorial`: de rendres
    // uavhengig av om temaet har steder, og det er nettopp poenget her.
    const hasEditorial = Boolean(category.body || category.unplaced.length || source || faq.length);
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
              ...(faq.length ? { faq } : {}),
            },
          }
        : {}),
    };
  });

  const radius = radiusPlaces(dataset.places, dataset.board.center, dataset.board.discoveryCategoryIds, dataset.board.presentation?.flatMap(s => s.placeIds));

  const home: BoardHome = {
    name: dataset.board.name,
    coordinates: dataset.board.center,
    address: dataset.board.address,
    ...(dataset.board.intro ? { heroIntro: dataset.board.intro } : {}),
    ...(dataset.board.district ? { district: dataset.board.district } : {}),
    ...(dataset.board.city ? { city: dataset.board.city } : {}),
    pinSubtitle: dataset.board.pinSubtitle,
    ...(dataset.board.pinAccent ? { pinAccent: dataset.board.pinAccent } : {}),
    ...(dataset.board.pinImage ? { pinImage: dataset.board.pinImage } : {}),
  };

  return {
    demoSnapshotId: project.demoSnapshotId,
    demoDataset: descriptor.id,
    demoFeatures: descriptor.features,
    demoRadiusPlaces: radius,
    demoReservePlaceIds: radius.filter(p => !p.initiallyVisible).map(p => p.id),
    demoGreeting: dataset.board.greeting,
    projectSlug: project.urlSlug,
    home,
    categories,
    poisById: new Map(topLevel.map((poi) => [poi.id.toLowerCase(), poi])),
    // Spørsmålene uten tema: de som gjelder hele området, vist på områdestoppet.
    globalFaq: faqs.get("") ?? [],
    audioTourEnabled: false,
    venueType: "residential",
  };
}
