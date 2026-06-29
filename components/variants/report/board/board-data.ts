import type {
  BrokerInfo,
  POI,
  ProjectAssetFlags,
  ReportCTA,
  ReportSummary,
  ReportThemeAudio,
  ReportThemeGroundingView,
} from "@/lib/types";
import type { ReportData, ReportTheme, ThemeIllustration } from "../report-data";
import { getProjectBrokers } from "@/lib/themes/project-brand";
import type {
  BoardAudioTimings,
  BoardAudioTrack,
  BoardCategoryId,
  BoardPOIId,
} from "@/lib/board/board-types";

// Kanonisk type-hjem er lib/board/board-types.ts (PRD 5 / r05.1). Importeres for
// intern bruk + re-eksporteres her så komponenter beholder en bakover-kompatibel
// import-flate (de importerer fra board-data, ikke @/lib/types).
export type { BoardAudioTimings, BoardAudioTrack, BoardCategoryId, BoardPOIId };

export interface BoardPOI {
  id: BoardPOIId;
  name: string;
  coordinates: { lat: number; lng: number };
  address?: string;
  /** Body-tekst sammensatt av editorialHook + localInsight (begge optional). */
  body?: string;
  /** Kategori-IDen POI tilhører i board-modellen — brukes når vi opener POI uten å vite hvilken kategori. */
  categoryId: BoardCategoryId;
  /** Event-datoer (ISO, eks. ["2025-09-12"]) — display-only. Filteret leser
   *  `raw.eventDates` (D5), ikke dette feltet. Undefined for boligrapporter
   *  (adaptBoardData setter det aldri). */
  eventDates?: string[];
  /** Event-starttid (HH:MM, eks. "18:00") — display-only. Undefined for boligrapporter. */
  eventTimeStart?: string;
  /** Event-sluttid (HH:MM, eks. "23:00") — display-only. Undefined for boligrapporter. */
  eventTimeEnd?: string;
  /** Original POI bevart for fall-through-tilgang (Google rating, photos, opening hours, etc.). */
  raw: POI;
}

/**
 * Nivå-2 (Bedre) kuratert detalj-innhold for en kategori. Render-klart: highlight-
 * POIs er allerede resolvet til {id, navn} mot kategoriens POIs, så sidebaren
 * slipper å slå opp. Tilstedeværelse av dette objektet er gating-signalet for
 * drill-in detalj-panelet (se DesktopStorySidebar). adaptCategory utelater det
 * når theme.editorial mangler ELLER har verken body eller resolvede highlights.
 */
export interface BoardCategoryEditorial {
  /** Kuratert brødtekst (dobbelt linjeskift = nytt avsnitt). */
  body: string;
  /** Path til kuratert bilde, eller undefined (sidebaren faller tilbake til
   *  kategori-illustrasjonen). */
  image?: string;
  /** «Verdt å merke seg» — klikkbare chips → OPEN_POI. Transport-koblings-IDer
   *  tråes med så sidebar-radene kan vise live avgangstider/bysykkel-status
   *  (samme sanntidsdata som kart-popupene). */
  highlights: {
    id: BoardPOIId;
    name: string;
    enturStopplaceId?: string;
    bysykkelStationId?: string;
    hyreStationId?: string;
  }[];
}

export interface BoardCategory {
  id: BoardCategoryId;
  /** Kategori-navn vist i rail og som peek-eyebrow (f.eks. "Barn & Oppvekst"). */
  label: string;
  /** Original spørsmål fra theme.question (f.eks. "Er det bra for barna?"). Vist i prototype men ikke i header etter redesign. */
  question?: string;
  /** Kort lead-tekst vist i peek-card og under modal-tittel. */
  lead: string;
  /** Lengre body-tekst for reading-modal Info-tab. Sammensatt av upperNarrative eller intro+bridgeText. */
  body: string;
  /** Build-time Gemini-grounding for "Les mer"-disclosure. Skipper hvis udefinert (samme rendering som i rapport). */
  grounding?: ReportThemeGroundingView;
  /** Nivå-2 kuratert detalj-innhold. Tilstedeværelse gater drill-in-panelet. */
  editorial?: BoardCategoryEditorial;
  /** Optional banner-illustrasjon. */
  illustration?: ThemeIllustration;
  /** Lucide ikon-navn fra report-themes (brukes i rail og marker). */
  icon: string;
  /** Kategori-farge (hex) brukt i markører, path-line, og UI-aksenter. */
  color: string;
  pois: BoardPOI[];
  /** Score-rangerte (byTierThenScore) topp-POI-er fra theme.topRanked. Brukes av
   *  3D-board for å bygge et kuratert anker-sett (top-3/kategori) i oversikts-state
   *  — bevisst forskjellig fra `pois` som er DISTANSE-sortert. */
  topRankedPois: BoardPOI[];
  /** Audio-tour-spor for kategorien — kun satt når både url og manus eksisterer. */
  audio?: BoardAudioTrack;
  /** Reels-spesifikt lydspor — overstyrer `audio` i reels-feeden. Per-prosjekt fra Supabase. */
  reelsAudio?: BoardAudioTrack;
}

export interface BoardHome {
  name: string;
  coordinates: { lat: number; lng: number };
  address: string;
  /** Hero-bilde av eiendommen (fra reportConfig.heroImage). Vist i default-detail-panel. */
  heroImage?: string;
  /** Intro-tekst (fra reportConfig.heroIntro eller bransjeprofil-mal). Vist i default-detail-panel. */
  heroIntro?: string;
  /** Bydel, eks. "Midtbyen". Brukes som subline i Nabolaget-seksjonen. */
  district?: string;
  /** By, eks. "Trondheim". Vises etter district i subline. */
  city?: string;
  /** Hjem-spor for audio-tour — kun satt når både url og manus eksisterer. */
  audio?: BoardAudioTrack;
}

export interface BoardData {
  /** URL-slug for prosjektet, eks. "stasjonskvartalet". Brukes til å slå opp
   *  prosjekt-spesifikke illustrasjoner og andre ressurser. */
  projectSlug?: string;
  home: BoardHome;
  categories: BoardCategory[];
  /** Tour-host-prat som spilles ved start av guidet tur. Rendres som
   *  karaoke-tekst inni accordion under "Start guidet tur"-CTAen, ikke som
   *  egen scroll-seksjon. Telles ikke i CategoryIndex. */
  welcome?: BoardAudioTrack;
  /** Avslutnings-spor som spilles etter siste kategori. Rendres som eget
   *  kort i bunn av sidebar over megler-kortet — er IKKE en kategori og
   *  telles ikke i CategoryIndex. */
  outro?: BoardAudioTrack;
  /** Megler-kontakter til kontakt-kortet i bunn av sidebar. Tomt/undefined
   *  → ingen kort vises. */
  brokers?: BrokerInfo[];
  /** Strukturert oppsummering (headline + insights) — driver det visuelle
   *  oppsummerings-kortet på slutten (SummaryReelCard). Undefined → kortet
   *  vises ikke (finalen er da outro-recap + megler). */
  summary?: ReportSummary;
  /** Call-to-action-config (lead-URL, primær-label) for oppsummerings-kortet. */
  cta?: ReportCTA;
  /** Lookup-map fra POI-id (lowercase) til full POI. Brukes av grounding-rendering for å resolve [text](poi:uuid)-lenker — kan referere POIs på tvers av kategorier. */
  poisById: Map<string, POI>;
  /** Eksplisitt opt-in for audio-tour-CTA. Default false. */
  audioTourEnabled: boolean;
  /** Opt-in for prosjekt-spesifikke asset-filer (brand/illustrasjon/pin). */
  assets?: ProjectAssetFlags;
  /** Eiendomstype — styrer splash-intro-copy og fremtidig tilpasning. */
  venueType?: "hotel" | "residential" | "commercial" | null;
}

/**
 * Mapper ReportData → BoardData. Filtrerer bort tema uten POI-er (board kan ikke
 * vise tom kategori) og normaliserer feltnavn.
 *
 * Body-felt-mapping (per doc-review beslutning):
 * - lead = theme.intro || theme.leadText (kort)
 * - body = theme.upperNarrative || (theme.intro + bridgeText konkatenert)
 *
 * Hvis en kategori mangler all narrativ tekst (verken intro, leadText, eller upperNarrative),
 * faller den IKKE ut — vi viser tom Info-tab. Punkter-tab er fortsatt nyttig.
 */
export function adaptBoardData(report: ReportData): BoardData {
  const categories: BoardCategory[] = report.themes
    .filter((t) => t.allPOIs.length > 0)
    .map((t) => adaptCategory(t));

  // Bygg full POI-lookup på tvers av alle tema. Grounding kan referere POIs i andre kategorier
  // (f.eks. "Yogaskolen" nevnt i Trening-grounding men ranket høyere i annen kategori).
  const poisById = new Map<string, POI>();
  for (const theme of report.themes) {
    for (const poi of theme.allPOIs) {
      poisById.set(poi.id.toLowerCase(), poi);
    }
  }

  return {
    projectSlug: report.projectSlug,
    home: {
      name: report.projectName,
      coordinates: report.centerCoordinates,
      address: report.address,
      heroImage: report.heroImage,
      heroIntro: report.heroIntro,
      // Bydel/by fra reportConfig (Supabase). Undefined → subline skjules.
      district: report.district,
      city: report.city,
      audio: pickPlayableAudio(report.heroAudio),
    },
    categories,
    welcome: pickPlayableAudio(report.welcomeAudio),
    outro: pickPlayableAudio(report.outroAudio),
    // Ekte reportConfig.brokers vinner; ellers demo-fallback per prosjekt
    // (Stasjonskvartalet inntil brokers finnes i Supabase). Se project-brand.ts.
    brokers: report.brokers?.length
      ? report.brokers
      : getProjectBrokers(report.projectSlug),
    summary: report.summary,
    cta: report.cta,
    poisById,
    audioTourEnabled: report.audioTourEnabled === true,
    assets: report.assets,
    venueType: report.venueType ?? null,
  };
}

/** Returnerer { url, manus, timings? } kun når url+manus begge er definert
 *  — partial audio (manus-only, før Steg 8c.2) blir undefined så board-
 *  laget vet at spor ikke er klart. timings inkluderes når tilgjengelig
 *  (audioVersion 5+); ellers omittes (komponent rendrer karaoke som
 *  klartekst). */
/**
 * Single source for VO-seleksjon (PRD 5 / r05.2). Ren boolean selection-test:
 * audio er spillbar KUN når både `url` og en IKKE-tom (trimmet) `manus` finnes.
 * Trim-varianten er konsolidert hit — whitespace-only manus ('   ') teller IKKE
 * lenger som spillbar.
 *
 * Konsumenter: render (PRD 9 — viser VO betinget) + PRD 14 audio-store, som et
 * ortogonalt data-presence-flagg. VO-seleksjon er NIVÅ-UAVHENGIG — PRD 2 er IKKE
 * konsument (nivå-2-readiness sjekker ikke VO; den gamle report-tier.ts-duplikaten
 * isPlayable/hasPlayableVO ble fjernet i PRD 2, ikke her).
 */
export function isPlayableAudio(a: ReportThemeAudio | undefined): boolean {
  return Boolean(a?.url && a?.manus?.trim());
}

/**
 * Bygg et spillbart BoardAudioTrack, eller undefined. Deler EKSAKT samme
 * trim-betingelse som `isPlayableAudio` (én kilde, ingen drift).
 */
export function pickPlayableAudio(
  audio: ReportThemeAudio | undefined,
): BoardAudioTrack | undefined {
  if (!isPlayableAudio(audio)) return undefined;
  // isPlayableAudio garanterer url-truthy + ikke-tom manus.
  const track: BoardAudioTrack = { url: audio!.url!, manus: audio!.manus };
  if (audio!.timings) track.timings = audio!.timings;
  return track;
}

function adaptCategory(theme: ReportTheme): BoardCategory {
  const id = theme.id as BoardCategoryId;

  // Lead: kort hook hvis eksplisitt leadText, ellers første del av intro
  const lead = theme.leadText?.trim() || theme.intro?.trim() || "";

  // Body: alle narrative bidrag konkatenert, dedupert mot lead.
  // Rekkefølge: upperNarrative (rik) → intro (basis) → bridgeText (overgang).
  const bodyParts = [
    theme.upperNarrative?.trim(),
    theme.intro?.trim(),
    theme.bridgeText?.trim(),
  ].filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  if (lead) seen.add(lead);
  const body = bodyParts
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    })
    .join("\n\n");

  // Fallbacks når reportConfig.themes peker på en theme-id uten bransjeprofil-base
  // (merge `{ ...undefined, ...rcTheme }` gir manglende name/icon/color).
  const label = theme.name || theme.id;
  const icon = theme.icon || "MapPin";
  const color = theme.color || "#94a3b8"; // stone-400

  // Nivå-2 editorial: resolve highlight-POI-IDer mot kategoriens POIs (id+navn)
  // så sidebaren får render-klare chips. Ukjente IDer ignoreres. Gates bort når
  // det verken finnes brødtekst eller resolvede highlights — da er det ikke ekte
  // nivå-2-innhold og drill-in-panelet skal ikke vises (kategorien er nivå 1).
  const editorial = ((): BoardCategoryEditorial | undefined => {
    if (!theme.editorial) return undefined;
    const trimmedBody = theme.editorial.body?.trim() ?? "";
    const highlights = (theme.editorial.highlightPoiIds ?? [])
      .map((pid) => theme.allPOIs.find((p) => p.id === pid))
      .filter((p): p is POI => Boolean(p))
      .map((p) => ({
        id: p.id as BoardPOIId,
        name: p.name,
        enturStopplaceId: p.enturStopplaceId,
        bysykkelStationId: p.bysykkelStationId,
        hyreStationId: p.hyreStationId,
      }));
    if (!trimmedBody && highlights.length === 0) return undefined;
    return {
      body: trimmedBody,
      image: theme.editorial.image,
      highlights,
    };
  })();

  return {
    id,
    label,
    question: theme.question,
    lead,
    body,
    grounding: theme.grounding,
    editorial,
    illustration: theme.image,
    icon,
    color,
    pois: theme.allPOIs.map((p) => adaptPOI(p, id)),
    // topRanked er score-rangert (byTierThenScore), ikke distanse-sortert som
    // allPOIs. Adapteres på samme måte så board-laget får samme BoardPOI-form.
    topRankedPois: theme.topRanked.map((p) => adaptPOI(p, id)),
    audio: pickPlayableAudio(theme.audio),
    reelsAudio: pickPlayableAudio(theme.reelsAudio),
  };
}

function adaptPOI(poi: POI, categoryId: BoardCategoryId): BoardPOI {
  const hook = poi.editorialHook?.trim();
  const insight = poi.localInsight?.trim();
  const body = [hook, insight].filter(Boolean).join("\n\n") || undefined;

  return {
    id: poi.id as BoardPOIId,
    name: poi.name,
    coordinates: poi.coordinates,
    address: poi.address,
    body,
    categoryId,
    raw: poi,
  };
}
