import type {
  BrokerInfo,
  Coordinates,
  POI,
  ProjectAssetFlags,
  ReportCTA,
  ReportSummary,
  ReportThemeAudio,
  ReportThemeGroundingView,
} from "@/lib/types";
import type { ReportData, ReportTheme, ThemeIllustration } from "../report-data";
import type { FaqEntry } from "@/lib/generators/faq-generator";
import { getHeroInsightPOIIds } from "../hero-insight-pois";
import { getProjectBrokers } from "@/lib/themes/project-brand";
import { computeSpreadCoordinates } from "@/lib/board/spread-co-located";
import { poiVisualIdentity } from "./marker-style";
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
 * Detalj-innhold for en kategoris drill-in-panel. Render-klart: highlight-
 * POIs er allerede resolvet til {id, navn} mot kategoriens POIs, så sidebaren
 * slipper å slå opp. Tilstedeværelse av dette objektet er gating-signalet for
 * drill-in detalj-panelet (se DesktopStorySidebar).
 *
 * To kilder (minimum-garantien, produktkall 2026-07-07 — ALLE boards har
 * kategoritekst + drill-in):
 * - KURATERT (nivå 2): theme.editorial arvet fra strøket. Vinner alltid.
 * - GENERERT (nivå 1-fallback): syntetisert fra narrativ-body (bl.a. den
 *   deterministiske bridgeText-generatoren) + tier-1-POIer som highlights.
 *   Markert med `generated: true`.
 * adaptCategory utelater objektet kun når verken kuratert innhold eller
 * narrativ-body finnes (da har kategorien ingen tekst å vise).
 */
export interface BoardCategoryEditorial {
  /** Brødtekst (dobbelt linjeskift = nytt avsnitt). */
  body: string;
  /**
   * Kort intro som ERSTATTER `body` i drill-in når FAQ-en bærer substansen.
   * Undefined → vis `body` som før.
   *
   * Degradasjonsregelen (Andreas 2026-08-22): teksten krympes BARE når FAQ-en
   * har minst `FAQ_LEAD_SHRINK_MIN` svar. På en adresse med tynn datadekning
   * ville «kort intro + ett FAQ-punkt» vært tynnere enn dagens minimum —
   * akkurat der rural-asymmetrien trenger boardet mest.
   */
  intro?: string;
  /**
   * Spørsmål og svar for kategorien, slik en megler ville svart på visning for
   * akkurat denne adressen. Deterministisk kjerne + strøkets kuraterte
   * overstyringer, allerede flettet. Tom/utelatt → ingen FAQ-seksjon.
   */
  faq?: FaqEntry[];
  /** Path til kuratert bilde, eller undefined (sidebaren faller tilbake til
   *  kategori-illustrasjonen). */
  image?: string;
  /** «Verdt å merke seg» — klikkbare chips → OPEN_POI. Transport-koblings-IDer
   *  tråes med så sidebar-radene kan vise live avgangstider/bysykkel-status
   *  (samme sanntidsdata som kart-popupene). */
  highlights: {
    id: BoardPOIId;
    name: string;
    /** Ikon-navn + farge fra POI-ens EGEN sub-kategori (tema som fallback) —
     *  avledet med `poiVisualIdentity`, samme derivasjon kartmarkøren bruker, så
     *  raden og pinnen for samme sted er visuelt identiske. */
    icon: string;
    color: string;
    enturStopplaceId?: string;
    bysykkelStationId?: string;
    hyreStationId?: string;
  }[];
  /** true = syntetisert fallback (ikke strøk-kuratert). Utelates på kuratert. */
  generated?: true;
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
  /** Boardets globale nabolags-FAQ — vist når ingen kategori er valgt. Tom
   *  eller utelatt = ingen seksjon (aldri en tom overskrift). Event-board har
   *  den aldri. */
  globalFaq?: FaqEntry[];
  /** Eksplisitt opt-in for audio-tour-CTA. Default false. */
  audioTourEnabled: boolean;
  /** Opt-in for prosjekt-spesifikke asset-filer (brand/illustrasjon/pin). */
  assets?: ProjectAssetFlags;
  /** Eiendomstype — styrer splash-intro-copy og fremtidig tilpasning. */
  venueType?: "hotel" | "residential" | "commercial" | null;
}

/**
 * Finner en POI på tvers av ALLE kategorier.
 *
 * Board-laget slo tidligere opp aktiv POI inne i den aktive kategorien, som
 * gjorde POI-detaljene (popup, rutelinje, label, 3D-kamerafly) avhengige av at
 * en kategori var valgt. Et markørklikk skal kunne åpne et punkt uten å endre
 * kategori-tilstanden, og da må oppslaget stå på egne bein.
 *
 * `poisById` finnes, men gir rå `POI` under en lowercased nøkkel — POI-flatene
 * trenger `BoardPOI` (bærer `categoryId`, visnings-koordinaten fra pin-
 * spredningen, og sammensatt `body`). Derfor søk over kategoriene.
 *
 * Returnerer første forekomst: samme sted kan ligge i flere kategorier, og
 * rekkefølgen er kategori-rekkefølgen — deterministisk mellom renders. Objektet
 * er hentet fra `data`, ikke konstruert, så referansen er stabil og
 * `React.memo`-sammenligninger nedstrøms holder.
 */
export function findBoardPOI(
  categories: readonly BoardCategory[],
  poiId: string | null | undefined,
): BoardPOI | null {
  if (!poiId) return null;
  for (const category of categories) {
    const poi = category.pois.find((p) => p.id === poiId);
    if (poi) return poi;
  }
  return null;
}

/**
 * Kategorien en POI hører til i board-modellen. Brukes der presentasjonen
 * trenger kategori-identiteten (rutelinjens farge) uten å kreve at kategorien
 * er AKTIV.
 */
export function findBoardCategoryOf(
  categories: readonly BoardCategory[],
  poi: BoardPOI | null,
): BoardCategory | null {
  if (!poi) return null;
  return categories.find((c) => c.id === poi.categoryId) ?? null;
}

/**
 * Mapper ReportData → BoardData. Filtrerer bort tema uten POI-er (board kan ikke
 * vise tom kategori) og normaliserer feltnavn.
 *
 * Body-felt-mapping (per doc-review beslutning):
 * - lead = editorial.body første avsnitt (nivå 2) || theme.leadText || theme.intro
 * - body = theme.upperNarrative || (theme.intro + bridgeText konkatenert)
 *
 * Hvis en kategori mangler all narrativ tekst (verken intro, leadText, eller upperNarrative),
 * faller den IKKE ut — vi viser tom Info-tab. Punkter-tab er fortsatt nyttig.
 */
export function adaptBoardData(report: ReportData): BoardData {
  const categories: BoardCategory[] = report.themes
    .filter((t) => t.allPOIs.length > 0)
    .map((t) => adaptCategory(t, report.centerCoordinates));

  // Pin-spredning for samlokaliserte POI-er (AKSET-caset: ungdomsskole + vgs
  // på identisk koordinat — markørene stables 100 % og bare én synes). Kun
  // BoardPOI.coordinates (visning) justeres; raw beholder kildekoordinatet.
  // Gjøres HER så markører, labels, popups og nabolagslista deler samme punkt.
  const allBoardPois = categories.flatMap((c) => c.pois);
  const spread = computeSpreadCoordinates(
    Array.from(new Map(allBoardPois.map((p) => [p.id, p])).values()),
  );
  if (spread.size > 0) {
    for (const cat of categories) {
      for (const poi of cat.pois) {
        const displaced = spread.get(poi.id);
        if (displaced) poi.coordinates = displaced;
      }
    }
  }

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
    globalFaq: report.globalFaq ?? [],
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

/** Visningstak på genererte «Verdt å merke seg»-punkter (speiler arve-stegets
 *  MAX_HIGHLIGHTS — kuratert og generert drill-in skal se like ut). */
const GENERATED_HIGHLIGHTS_MAX = 3;

/**
 * Så mange FAQ-svar en kategori må ha før brødteksten krympes til en kort
 * intro.
 *
 * Terskelen finnes for å beskytte de TYNNE adressene, ikke de rike: med to
 * svar ville «kort intro + FAQ» gitt mindre enn dagens kategoritekst, og det
 * er nettopp på et ukuratert strøk med tynn datadekning at boardet må holde
 * minimum-garantien. Under terskelen er oppførselen bit for bit som før.
 */
export const FAQ_LEAD_SHRINK_MIN = 3;

/**
 * Setningsslutt i norsk prosa: punktum/utropstegn/spørsmålstegn etterfulgt av
 * mellomrom OG stor bokstav.
 *
 * Kravet om stor bokstav er det som gjør splitten trygg: «1.–7. trinn med 486
 * elever» og «ca. 5 minutter» har punktum midt i setningen, men følges av små
 * bokstaver. Uten det ville introen blitt kuttet etter «1.».
 */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-ZÆØÅ])/;

/** Så mange setninger en krympet intro beholder. */
const INTRO_SENTENCES = 2;

/**
 * Første avsnitt, kortet til de par første setningene. Brukes når FAQ-en
 * bærer substansen — teksten skal sette scenen, ikke gjenta svarene under.
 */
export function shrinkToIntro(body: string): string {
  const firstParagraph = body.split(/\n{2,}/)[0]?.trim() ?? "";
  const sentences = firstParagraph.split(SENTENCE_BOUNDARY);
  return sentences.slice(0, INTRO_SENTENCES).join(" ").trim();
}

/**
 * Genererte highlights for fallback-drill-in: tier-1-utvelgerne (samme som
 * hero-insight-kortet) — nærmeste skole, viktigste holdeplass osv. bridgeText
 * navngir bevisst tier-2-POIer (komplement-designet fra Brøset-gullstandarden),
 * så generert tekst og punkter overlapper ikke. Tema uten tier-1-extractor
 * faller tilbake til score-rangerte topp-POIer.
 */
function pickGeneratedHighlights(
  theme: ReportTheme,
  center: Coordinates,
  /** Temaets ikon/farge — fallback når POI-en mangler sub-kategori-verdier. */
  fallback: { icon: string; color: string },
): BoardCategoryEditorial["highlights"] {
  const heroIds = getHeroInsightPOIIds(theme.id, theme.allPOIs, center);
  const source =
    heroIds.size > 0
      ? theme.allPOIs.filter((p) => heroIds.has(p.id))
      : theme.topRanked;
  return source.slice(0, GENERATED_HIGHLIGHTS_MAX).map((p) => ({
    id: p.id as BoardPOIId,
    name: p.name,
    ...poiVisualIdentity(p, fallback),
    enturStopplaceId: p.enturStopplaceId,
    bysykkelStationId: p.bysykkelStationId,
    hyreStationId: p.hyreStationId,
  }));
}

function adaptCategory(theme: ReportTheme, center: Coordinates): BoardCategory {
  const id = theme.id as BoardCategoryId;

  // Nivå-1-lead: kort hook hvis eksplisitt leadText, ellers første del av intro.
  // Er også dedup-anker for narrativ-body under (uendret semantikk) — den
  // endelige `lead` avledes ETTER editorial-blokken (kan overstyres av nivå 2).
  const fallbackLead = theme.leadText?.trim() || theme.intro?.trim() || "";

  // Body: alle narrative bidrag konkatenert, dedupert mot lead.
  // Rekkefølge: upperNarrative (rik) → intro (basis) → bridgeText (overgang).
  const bodyParts = [
    theme.upperNarrative?.trim(),
    theme.intro?.trim(),
    theme.bridgeText?.trim(),
  ].filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  if (fallbackLead) seen.add(fallbackLead);
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
        // Visuell identitet avledes HER, med samme derivasjon kartmarkøren
        // bruker, så raden og pinnen for samme sted ser like ut (2026-08-13).
        ...poiVisualIdentity(p, { icon, color }),
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

  // Minimum-garantien (produktkall 2026-07-07): ALLE boards viser kategoritekst
  // + drill-in. Kuratert strøk-editorial (nivå 2) vinner; ellers syntetiseres
  // detaljen fra narrativ-body (render-generert bridgeText — navngir ekte POIer,
  // deterministisk, ingen LLM) med tier-1-POIer som «Verdt å merke seg».
  const baseDetail: BoardCategoryEditorial | undefined =
    editorial ??
    (body
      ? {
          body,
          highlights: pickGeneratedHighlights(theme, center, { icon, color }),
          generated: true,
        }
      : undefined);

  // FAQ-en er kategoriens board-lag-svar: adressens egne fakta, som ikke kan
  // stå i den delte POI-teksten. Den henges på detaljen fordi den bor i samme
  // panel — men den kan finnes UTEN kuratert innhold, og en kategori som bare
  // har FAQ skal fortsatt få et panel.
  const faq = theme.faq ?? [];
  const detail: BoardCategoryEditorial | undefined = baseDetail
    ? {
        ...baseDetail,
        ...(faq.length > 0 ? { faq } : {}),
        // Degradasjonsregelen: krymp bare når FAQ-en faktisk bærer noe.
        ...(faq.length >= FAQ_LEAD_SHRINK_MIN && baseDetail.body
          ? { intro: shrinkToIntro(baseDetail.body) }
          : {}),
      }
    : faq.length > 0
      ? { body: "", highlights: [], faq, generated: true }
      : undefined;

  // Kortets lead avledes av drill-in-brødteksten (første avsnitt) — samme kilde
  // som panelet, kuratert eller generert. Kort-previewen clamper visuelt
  // (line-clamp-2), så full avsnittslengde er ok. Uten detalj-body (kuratert
  // highlights-only, eller ingen tekst i det hele tatt) gjelder fallbackLead
  // (leadText/intro — de statiske provisjonerings-defaultene).
  const lead = detail?.body ? detail.body.split(/\n{2,}/)[0].trim() : fallbackLead;

  return {
    id,
    label,
    question: theme.question,
    lead,
    body,
    grounding: theme.grounding,
    editorial: detail,
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
