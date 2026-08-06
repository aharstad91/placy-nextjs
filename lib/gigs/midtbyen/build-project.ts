/**
 * Fra butikkfila til et `Project` rapport-pipelinen kan konsumere.
 *
 * Demoen går gjennom den ORDINÆRE rapport-stien: `ReportReelsPage` får bare
 * `project` og bygger `BoardData` selv via `transformToReportData`. Den henter
 * IKKE event-stien der `boardData` sendes inn som ferdig prop — da bytter
 * mobilflaten til event-sheeten, og det er ikke flaten dette skal ligne.
 *
 * Ingen database er involvert. Butikkene ligger i `stores.json` i repoet,
 * hentet og beriket av skriptene i `scripts/midtbyen/`.
 */

import type { Category, POI, Project, ReportThemeConfig } from "@/lib/types";
import { TORVET } from "@/lib/gigs/midtbyen/anchor";
import {
  MIDTBYEN_GROUPS,
  groupForStore,
  type MidtbyenGroup,
} from "@/lib/gigs/midtbyen/categories";
import storesFile from "@/lib/gigs/midtbyen/stores.json";

/** Formen `stores.json` faktisk har. Skrevet av `enrich-stores.ts`. */
interface StoreRecord {
  name: string;
  address: string;
  mapsUrl: string;
  websiteUrl?: string;
  termIds: number[];
  acceptsCard: boolean;
  acceptsCardDigital: boolean;
  lat?: number;
  lng?: number;
  googlePlaceId?: string;
  openingHours?: string[];
  googleRating?: number;
  googleReviewCount?: number;
  walkMinutes?: number;
}

/**
 * Kort etikett-linje per gruppe.
 *
 * MÅ være forskjellig fra `GROUP_INTROS`. `adaptCategory` bruker `leadText` som
 * dedup-anker for brødteksten: er de to like, filtreres brødteksten bort, og da
 * står drill-in-siden uten prosa. Lead er stikkordene, intro er beskrivelsen.
 */
const GROUP_LEADS: Record<string, string> = {
  "klaer-mote": "Klær, sko, vesker og smykker.",
  "interior-hjem": "Interiør, møbler, blomster og kjøkken.",
  "helse-velvare": "Frisør, hudpleie, tannlege, optiker og apotek.",
  "sport-fritid": "Sport, friluft og sykkel.",
  "boker-spill-hobby": "Bøker, hobby, spill og elektronikk.",
  "mat-drikke": "Delikatesse, te og kaffe.",
  annet: "Virksomheter uten kategori i kilden.",
};

/**
 * Kategoritekstene som gjør drill-in-siden til en stedsbeskrivelse.
 *
 * `CategoryPage` viser prosa fra `editorial.body` eller `lead`. Uten tekst her
 * blir siden en bar liste, og minimums-garantien for alle boards (kategoritekst
 * + drill-in) ryker.
 *
 * Innholdet er avledet av datasettet selv — gatene med flest butikker og
 * faktiske gangtider fra Torvet — ikke av en språkmodell. Presens, ingen
 * årstall, ingen historikk.
 */
const GROUP_INTROS: Record<string, string> = {
  "klaer-mote":
    "Den desidert største gruppen i Midtbyen. Tyngdepunktet ligger langs " +
    "Kongens gate og Olav Tryggvasons gate, med kjedene samlet i " +
    "kjøpesentrene og de mindre butikkene spredt utover sidegatene. Alt " +
    "ligger under ti minutters gange fra Torvet.",
  "interior-hjem":
    "Interiør, møbler, blomster og kjøkkenutstyr, med tyngdepunkt i Kongens " +
    "gate og Olav Tryggvasons gate. Gruppen rommer også byens gallerier og " +
    "brukskunst.",
  "helse-velvare":
    "Frisører, hudpleie, tannleger, optikere og apotek. De fleste ligger " +
    "langs Thomas Angells gate og Kongens gate, og ingen er mer enn åtte " +
    "minutter unna Torvet.",
  "sport-fritid":
    "Sportsbutikker og friluftsutstyr, fra merkevarebutikker til " +
    "sykkelverksted. Dette er gruppen som strekker seg lengst ut av kjernen — " +
    "helt til Brattørkaia, et kvarters gange fra Torvet.",
  "boker-spill-hobby":
    "Bokhandler, hobbybutikker, spill og elektronikk. De fleste ligger i " +
    "Kongens gate og Nordre gate, innenfor ti minutters gange.",
  "mat-drikke":
    "Delikatesse, te og kaffe. En liten gruppe — Midtbyens serveringssteder " +
    "er ikke en del av denne katalogen, som lister butikker.",
  annet:
    "Virksomheter kilden ikke har kategorisert: en nærbutikk, parkering og " +
    "en trafikkskole.",
};

/** «Aagaard siden 1876» → «aagaard-siden-1876». */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Midtbykort-status som én faktasetning.
 *
 * Kortet er Midtbyen Managements eget produkt, og hvor det kan brukes er det
 * katalogen egentlig svarer på. `adaptPOI` bygger `BoardPOI.body` av
 * `editorialHook` + `localInsight` og rører ikke `description`, så teksten må
 * ligge her for å bli synlig. Bevisst snarvei i demoen.
 */
function cardStatus(store: StoreRecord): string {
  if (store.acceptsCard && store.acceptsCardDigital) {
    return "Tar fysisk og digitalt Midtbykort.";
  }
  if (store.acceptsCard) return "Tar fysisk Midtbykort.";
  return "Tar ikke Midtbykort.";
}

function toCategory(group: MidtbyenGroup): Category {
  return {
    id: group.id,
    name: group.label,
    icon: group.icon,
    color: group.color,
  };
}

function toPOI(store: StoreRecord, group: MidtbyenGroup, id: string): POI {
  const poi: POI = {
    id,
    name: store.name,
    coordinates: { lat: store.lat!, lng: store.lng! },
    address: store.address,
    category: toCategory(group),
    editorialHook: cardStatus(store),
  };

  // Gangtiden er det nabolagslista sorterer på. Uten den faller raden bakerst
  // og kortet viser ingen minutter.
  if (store.walkMinutes !== undefined) {
    poi.travelTime = { walk: store.walkMinutes };
  }
  if (store.openingHours?.length) {
    poi.openingHoursJson = { weekday_text: store.openingHours };
  }
  if (store.googlePlaceId) poi.googlePlaceId = store.googlePlaceId;
  if (store.googleRating !== undefined) poi.googleRating = store.googleRating;
  if (store.googleReviewCount !== undefined) {
    poi.googleReviewCount = store.googleReviewCount;
  }
  if (store.websiteUrl) poi.googleWebsite = store.websiteUrl;

  return poi;
}

export interface MidtbyenProjectResult {
  project: Project;
  /** Butikker uten koordinat — utelatt fra kartet, aldri stille borte. */
  skipped: string[];
}

/**
 * Bygg prosjektet, og si fra om hva som ble utelatt.
 *
 * Butikker uten koordinat kan ikke plasseres og utelates. Antallet returneres
 * i stedet for å forsvinne, slik at et hull i dataene er synlig for den som
 * kjører.
 */
export function buildMidtbyenProjectWithReport(): MidtbyenProjectResult {
  const stores = storesFile.stores as StoreRecord[];

  const skipped: string[] = [];
  const pois: POI[] = [];
  const usedIds = new Set<string>();
  const groupsInUse = new Map<string, MidtbyenGroup>();

  for (const store of stores) {
    if (store.lat === undefined || store.lng === undefined) {
      skipped.push(store.name);
      continue;
    }
    const group = groupForStore(store.termIds);

    // Navnene er unike i kilden i dag, men en kollisjon ville gitt to POI-er
    // med samme id og et punkt som forsvinner fra kartet uten spor.
    let id = slugify(store.name);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    pois.push(toPOI(store, group, id));
    groupsInUse.set(group.id, group);
  }

  // Rekkefølgen følger MIDTBYEN_GROUPS, ikke butikkenes rekkefølge, så
  // kategorikortene står likt hver gang.
  const orderedGroups = MIDTBYEN_GROUPS.filter((g) => groupsInUse.has(g.id));

  const themes: ReportThemeConfig[] = orderedGroups.map((group) => ({
    id: group.id,
    name: group.label,
    icon: group.icon,
    color: group.color,
    // POI-ens `category.id` er gruppe-IDen, så temaet plukker sine egne punkter.
    categories: [group.id],
    leadText: GROUP_LEADS[group.id] ?? "",
    intro: GROUP_INTROS[group.id] ?? "",
  }));

  const project: Project = {
    id: "midtbyen_shopping",
    name: "Midtbyen",
    customer: "midtbyen",
    urlSlug: "shopping",
    productType: "report",
    centerCoordinates: TORVET,
    story: {
      id: "midtbyen-shopping",
      title: "Butikkene i Midtbyen",
    },
    pois,
    categories: orderedGroups.map(toCategory),
    reportConfig: {
      label: "Midtbyen",
      district: "Midtbyen",
      city: "Trondheim",
      heroIntro:
        "Butikkene i Midtbyen, plassert på kartet og sortert etter hvor lang " +
        "tid du bruker dit fra Torvet.",
      themes,
    },
    // Ingen lyd noe sted: ingen audio på temaene, ingen welcomeAudio, heroAudio
    // eller outroAudio. Det er DET som både fjerner omvisning-pilla og slår på
    // nabolagsflaten — begge er gatet på fravær av spillbar lyd.
    has3dAddon: false,
  };

  return { project, skipped };
}

/** Prosjektet alene — det rutene trenger. */
export function buildMidtbyenProject(): Project {
  return buildMidtbyenProjectWithReport().project;
}
