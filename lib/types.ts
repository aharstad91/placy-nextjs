// Placy TypeScript Typer
// Basert på placy-concept-spec.md

import { z } from "zod";

// === Grunnleggende typer ===

export type TravelMode = "walk" | "bike" | "car";
export type TimeBudget = 5 | 10 | 15 | 20 | 30;
export type StoryPriority = "must_have" | "nice_to_have" | "filler";
export type ProductType = "explorer" | "report" | "guide";

export interface Coordinates {
  lat: number;
  lng: number;
}

// === Kategori ===

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  color: string; // Hex farge for markør
}

// === POI (Point of Interest) ===

export interface POI {
  id: string;
  name: string;
  coordinates: Coordinates;
  address?: string;
  category: Category;
  description?: string;
  featuredImage?: string;
  galleryImages?: string[];

  // Google Places data (for Google Points)
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  googleMapsUrl?: string;
  photoReference?: string;

  // Redaksjonelt innhold (Storytelling)
  editorialHook?: string;
  localInsight?: string;
  storyPriority?: StoryPriority;
  editorialSources?: string[];

  // Trust validation
  trustScore?: number;
  trustFlags?: string[];
  trustScoreUpdatedAt?: string;

  // Social media links
  facebookUrl?: string;

  // Google enrichment (Layer 1)
  googleWebsite?: string;
  googleBusinessStatus?: string;
  googlePriceLevel?: number;
  googlePhone?: string;

  // Cached opening hours (from periodic refresh)
  openingHoursJson?: { weekday_text?: string[] };

  // Build-time Google-grounded stedsinnhold for Utforsk-modalen (migrasjon 084).
  // Parses ved lesing (parsePoiGroundingOrLog i v2-queries.ts) — feltet er
  // allerede validert når det er satt.
  grounding?: PoiGrounding;

  // POI Tier System
  poiTier?: 1 | 2 | 3;
  tierReason?: string;
  isChain?: boolean;
  isLocalGem?: boolean;
  poiMetadata?: Record<string, unknown>;
  tierEvaluatedAt?: string;

  // Event data (for event-type projects)
  eventDates?: string[];       // ["2026-04-18", "2026-04-19"]
  eventTimeStart?: string;     // "10:00"
  eventTimeEnd?: string;       // "16:00"
  eventDescription?: string;
  eventUrl?: string;           // Link to organizer's event page
  eventTags?: string[];        // ["Gratis", "Barnevennlig"]

  // Product-specific flags (set per product_pois)
  featured?: boolean;

  // Transport-integrasjoner
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  hyreStationId?: string;

  // Parent-child POI hierarchy (e.g., shopping center → stores)
  parentPoiId?: string;
  anchorSummary?: string;
  childPOIs?: POI[];

  // Reisetider fra prosjekt-origo. Enhets-KONTRAKT: MINUTTER (ceil) — samme
  // enhet som haversine-fallbacken i report-data.ts og precompute-steget
  // (v2.project_pois.travel_times, migrasjon 071). Aldri sekunder.
  travelTime?: {
    walk?: number;
    bike?: number;
    car?: number;
  };
}

// === Story ===

export interface Story {
  id: string;
  title: string;
  introText?: string;
  heroImages?: string[];
}

// === Trail Overlay (Overpass/OSM route relations) ===

export interface TrailFeatureProperties {
  id: string;
  name: string;
  routeType: "bicycle" | "hiking" | "foot";
  network: "lcn" | "rcn" | "ncn" | null;
}

export interface TrailFeature {
  type: "Feature";
  properties: TrailFeatureProperties;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

export interface TrailCollection {
  type: "FeatureCollection";
  features: TrailFeature[];
}

// === Report Config ===

export interface ReportThemeGroundingSource {
  title: string;
  /** Resolved final URL (eller redirect hvis resolve feilet). */
  url: string;
  /** Original Gemini redirect-URL — beholdt for re-resolve. */
  redirectUrl: string;
  domain: string;
}

/**
 * Build-time-generert grounding-data fra Gemini API med google_search-tool.
 * Lagret i products.config.reportConfig.themes[].grounding. Omit (ikke null)
 * ved feil — matcher optional ?:.
 *
 * Google ToS krever at searchEntryPointHtml rendres verbatim (DOMPurify-sanert
 * før lagring). groundingVersion bumpes for å tvinge regen.
 *
 * Version 1: raw Gemini narrative + sources + searchEntryPointHtml.
 * Version 2: legger til curatedNarrative (Claude-kuratert unified tekst med
 * POI-inline-lenker), curatedAt, poiLinksUsed. Raw narrative beholdes som
 * backup. Per-tema — v1 og v2 kan coexist i samme themes[]-array.
 */
export interface ReportThemeGrounding {
  /** Markdown-prosa. Zod `min(1)` er den autoritative grensen (IKKE 200) —
   *  V1/V2-skjemaene under er kontrakten, ikke denne docstringen. Raw
   *  Gemini-output for v1, råbackup for v2. */
  narrative: string;
  sources: ReportThemeGroundingSource[];
  /** Google Search-attribution-HTML — DOMPurify-sanert. Renders via dangerouslySetInnerHTML. */
  searchEntryPointHtml: string;
  /** ISO-8601 tidspunkt for Gemini-kallet. */
  fetchedAt: string;
  /** Per-tema version-flagg. Tillater partial rollout v1→v2. */
  groundingVersion: 1 | 2;
  /** Debug-only metadata. Bevares på v1 (V1Schema `.passthrough()`), men
   *  STRIPPES på v2 ved view-parse (V2Schema declarer ikke `meta` og er ikke
   *  `.passthrough()`). Bevisst: PRD 5/9 skal ALDRI lese `meta` post-parse på
   *  v2 — kun rå storage/debug, utenfor v2-render-viewet. */
  meta: {
    model: "gemini-2.5-flash";
    /** Debug-only — Gemini sine auto-genererte søk. */
    searchQueries: string[];
  };
  /** V2 only — Claude-kuratert unified tekst med [POI-navn](poi:uuid)-lenker. */
  curatedNarrative?: string;
  /** V2 only — ISO-8601 tidspunkt for curation. */
  curatedAt?: string;
  /** V2 only — UUIDs for POIs som ble inline-lenket. Sporer rendring + invalidation. */
  poiLinksUsed?: string[];
}

/**
 * Runtime-schema brukt ved render for å validere JSONB-innhold. Discriminated
 * union på groundingVersion tillater v1 (raw narrative) og v2 (curated +
 * POI-lenker) coexisting. Silent skip + server-log ved mismatch.
 *
 * V1-skjema er .passthrough() for rollout-tolerance: lar extra v2-felter (som
 * curatedNarrative) eksistere på rad som fortsatt er flagget v1, uten å feile.
 * Dette håndterer mellomtilstanden mens curation pågår.
 */
const GroundingSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
});

export const ReportThemeGroundingV1Schema = z
  .object({
    narrative: z.string().min(1),
    sources: z.array(GroundingSourceSchema).default([]),
    searchEntryPointHtml: z.string().min(1),
    fetchedAt: z.string(),
    groundingVersion: z.literal(1),
  })
  .passthrough();

/**
 * V2-render-view: curated narrative + POI-lenker er primær rendering-kilde.
 *
 * Bevisst META-ASYMMETRI vs V1: V2Schema declarer IKKE `meta` og er IKKE
 * `.passthrough()`, så `meta` (debug-only model/searchQueries) STRIPPES når
 * en v2-rad parses gjennom view-skjemaet. Det er tilsiktet — `meta` er rå
 * storage/debug og hører ikke hjemme i v2-render-viewet. PRD 5/9 skal ALDRI
 * lese `meta` post-parse på v2. (V1 beholder `meta` via `.passthrough()` for
 * rollout-toleranse mens curation pågår.)
 */
export const ReportThemeGroundingV2Schema = z.object({
  /** Raw Gemini-output beholdt som backup. */
  narrative: z.string().min(1),
  /** Claude-kuratert unified tekst — primær rendering-kilde i v2. */
  curatedNarrative: z.string().min(100),
  sources: z.array(GroundingSourceSchema).default([]),
  searchEntryPointHtml: z.string().min(1),
  fetchedAt: z.string(),
  curatedAt: z.string(),
  // POI-IDer i Placy er heterogene strenger: UUID, `google-ChIJ…`, slug-stil
  // (`bus-dronningens-gate`, `park-adressaparken`, `entur-NSR-StopPlace-271`).
  // Stram UUID-sjekk droppet 6/7 grounding-objekter ved render — sikkerheten
  // ligger i whitelist-oppslag mot loaded POI-set, ikke ID-form.
  poiLinksUsed: z.array(z.string().min(1)).default([]),
  groundingVersion: z.literal(2),
});

export const ReportThemeGroundingViewSchema = z.discriminatedUnion(
  "groundingVersion",
  [ReportThemeGroundingV1Schema, ReportThemeGroundingV2Schema],
);

export type ReportThemeGroundingView = z.infer<
  typeof ReportThemeGroundingViewSchema
>;
export type ReportThemeGroundingViewV1 = z.infer<
  typeof ReportThemeGroundingV1Schema
>;
export type ReportThemeGroundingViewV2 = z.infer<
  typeof ReportThemeGroundingV2Schema
>;

// === Board-fakta (FAQ-ens deterministiske kjerne) ===

/**
 * Fakta om ADRESSEN som boardet ikke kan regne ut selv, hentet build-time og
 * lagret i `products.config.reportConfig.boardFacts`.
 *
 * HVORFOR FAKTA OG IKKE FERDIG TEKST: FAQ-svarene monteres ved render fra disse
 * faktaene (`lib/generators/faq-generator.ts`), samme modell som `bridgeText`.
 * Da kan formuleringene itereres uten å re-provisjonere seks boards, og
 * «boardet regner det ut selv»-prinsippet fra `category-specs.ts` holder.
 *
 * HVORFOR PÅ ROTEN AV reportConfig OG IKKE PER TEMA: de handler om boligen, ikke
 * om et tema. Den globale nabolags-FAQ-en (ingen kategori valgt) leser de samme
 * transittfaktaene som transport-kategorien gjør.
 *
 * FERSKVARE: linjer og reisetider endres ved hver ruteomlegging hos operatøren.
 * `fetchedAt` og `departureAt` står her nettopp for at alderen skal kunne
 * vurderes — re-kjøring av steget velger et nytt avreisetidspunkt og kan derfor
 * gi legitimt andre svar. Ingen auto-TTL; oppfriskning er et pipeline-valg.
 */
const BoardTripPatternSchema = z.object({
  /** Reisetid i minutter, rundet opp — samme konvensjon som travel-times. */
  minutes: z.number().int().positive(),
  /** Linjekoder i rekkefølge. Tom liste = hele reisen til fots. */
  lines: z.array(z.string().min(1)).default([]),
  transfers: z.number().int().min(0),
  walkMeters: z.number().int().min(0),
});

const BoardTransitDirectionSchema = z.object({
  /** NSR-quay — én side av vegen. Retning er quay, aldri stoppested. */
  quayId: z.string().min(1),
  destinations: z.array(z.string().min(1)).default([]),
  lines: z.array(z.string().min(1)).default([]),
});

const BoardTransitStopSchema = z.object({
  /** Rå NSR-id med kolon — matcher `POI.enturStopplaceId`, ikke POI-id-en. */
  stopPlaceId: z.string().min(1),
  name: z.string().min(1),
  distanceM: z.number().int().min(0),
  modes: z.array(z.string().min(1)).default([]),
  directions: z.array(BoardTransitDirectionSchema).default([]),
});

const BoardKretsSchoolSchema = z.object({
  /** Kretsnavnet fra kommunens polygon, i VERSALER slik kilden skriver det. */
  krets: z.string().min(1),
  navn: z.string().min(1),
  trinnFra: z.number().int().nullable(),
  trinnTil: z.number().int().nullable(),
  elevtall: z.number().int().nullable(),
  offentlig: z.boolean(),
});

const BoardVideregaendeSchema = z.object({
  navn: z.string().min(1),
  offentlig: z.boolean(),
  distanceM: z.number().int().min(0),
  /** Tom når Entur ikke fant en reise — skolen står da uten bussetid. */
  patterns: z.array(BoardTripPatternSchema).default([]),
});

export const ReportBoardFactsSchema = z.object({
  /** Bumpes for å tvinge regenerering (samme spak som groundingVersion). */
  factsVersion: z.literal(1),
  fetchedAt: z.string().min(1),
  /** Avreisetidspunktet oppslagene gjelder for: neste hverdag kl. 08:00 norsk tid. */
  departureAt: z.string().min(1),
  stops: z.array(BoardTransitStopSchema).default([]),
  /** Reisen til byen. Utelatt når sentrumsstoppet ikke lot seg slå opp. */
  cityCentre: z
    .object({ name: z.string().min(1), patterns: z.array(BoardTripPatternSchema) })
    .optional(),
  schools: z
    .object({
      barneskole: BoardKretsSchoolSchema.optional(),
      ungdomsskole: BoardKretsSchoolSchema.optional(),
      /** Sortert på reisetid, raskeste først. Videregående har ingen krets. */
      videregaaende: z.array(BoardVideregaendeSchema).default([]),
    })
    .optional(),
});

export type ReportBoardFacts = z.infer<typeof ReportBoardFactsSchema>;
export type BoardTripPattern = z.infer<typeof BoardTripPatternSchema>;
export type BoardTransitStop = z.infer<typeof BoardTransitStopSchema>;
export type BoardKretsSchool = z.infer<typeof BoardKretsSchoolSchema>;
export type BoardVideregaende = z.infer<typeof BoardVideregaendeSchema>;

// === Kuratert FAQ (strøkets svar, arvet inn i board-config) ===

/**
 * Ett kuratert FAQ-svar — meglerens stemme på et spørsmål boardet ellers svarer
 * deterministisk på.
 *
 * `id` er board-lag-spørsmålets id fra `lib/editorial/category-specs.ts`
 * (`krets`, `linjer`, …). Finnes id-en der, OVERSTYRER det kuraterte svaret det
 * deterministiske — sluttbrukeren ser ingen søm. Er id-en kurators egen, legges
 * svaret til som et ekstra spørsmål, og da må `spørsmål` være med.
 *
 * FERSKVARE-REGELEN GJELDER HER: linjer, frekvenser, tider og priser hører
 * ALDRI i et kuratert svar. De hentes ved kjøring; et kuratert svar friskes
 * aldri opp (`editorial-hooks-no-perishable-info-20260208`).
 */
export interface ReportFaqAnswer {
  id: string;
  /** Påkrevd for kurators egne spørsmål, utelatt når id-en finnes i malverket. */
  spørsmål?: string;
  svar: string;
}

// === Per-POI grounding (Utforsk-modalen) ===

/**
 * Build-time-generert Google-grounded innhold for ETT sted. Lagret i
 * v2.pois.grounding (migrasjon 084).
 *
 * IKKE samme lag som ReportThemeGrounding over: tema-grounding beskriver et
 * strøk og lever i products.config, dette beskriver et sted og lever på POI-et.
 * Egen versjonsakse (`poiGroundingVersion`), egne skjemaer — gjenbruk ALDRI
 * ReportThemeGroundingViewSchema her.
 *
 * To lag, bevisst skilt:
 *   generated — provider-swappbart. Rå leverandør-output. Googles egen
 *               generativeSummary dekker ikke Norge (verifisert 2026-08-12);
 *               den dagen den gjør det, kommer den inn som en ny variant i
 *               PoiGroundingGeneratedSchema-unionen + en gren i
 *               attribusjonsblokken, uten at curated røres.
 *   curated   — Placy-eid. Megler-/redaksjonelt lag som overlever provider-swap.
 *
 * Google ToS: `searchEntryPointHtml` er PÅKREVD på grounding-provideren og må
 * rendres verbatim (DOMPurify-sanert før lagring). Mangler den, kan generated
 * ikke vises i det hele tatt — parse-helperen dropper det laget alene og lar
 * curated stå. Lagring av teksten er tillatt i inntil 2 år (Gemini API
 * Additional Terms); `fetchedAt` er alderskilden.
 */
const PoiGroundingSourceSchema = z.object({
  title: z.string(),
  /** Resolved final URL (SSRF-guardet i url-resolver). */
  url: z.string().url(),
  /** Original Gemini redirect-URL — beholdt for re-resolve. */
  redirectUrl: z.string().url(),
  domain: z.string(),
});

/**
 * Kvalitetsportens utfall, lagret sammen med innholdet — også for strykerne.
 * Uten lagrede strykere ville `passed === true`-gaten i CTA-laget vært
 * meningsløs (feltet ville alltid vært true når det fantes), og hver kjøring
 * ville re-generert de samme strykerne med ny Gemini-kost.
 */
const PoiQualityGateSchema = z.object({
  passed: z.boolean(),
  sourceCount: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  /** Lesbar begrunnelse når passed = false. */
  reason: z.string().optional(),
});

/** Gemini + Google Search-grounding — dagens eneste provider. */
export const PoiGroundingGeneratedGeminiSchema = z.object({
  provider: z.literal("gemini-search-grounding"),
  narrative: z.string().min(1),
  sources: z.array(PoiGroundingSourceSchema).default([]),
  /** ToS-påkrevd. Sanert build-time, rendres verbatim. */
  searchEntryPointHtml: z.string().min(1),
  searchQueries: z.array(z.string()).default([]),
  model: z.string().min(1),
  /** ISO-8601. Alderskilde for re-generering og 2-års ToS-vinduet. */
  fetchedAt: z.string().min(1),
  qualityGate: PoiQualityGateSchema,
});

/**
 * Union med ÉN variant i dag. Provider-swappen er da en additiv variant her
 * pluss en gren i attribusjonsblokken, ikke en omskriving. Ukjent provider
 * feiler bevisst — vi kan ikke rendre attribusjon vi ikke kjenner formen på,
 * og attribusjon er ToS-krav.
 */
export const PoiGroundingGeneratedSchema = z.discriminatedUnion("provider", [
  PoiGroundingGeneratedGeminiSchema,
]);

export const PoiGroundingCuratedSchema = z.object({
  narrative: z.string().min(1),
  curatedAt: z.string().min(1),
});

/**
 * Utfallet av et grounding-forsøk som IKKE ga innhold.
 *
 * `generated` kan ikke bære dette: skjemaet krever `narrative.min(1)` og
 * `searchEntryPointHtml.min(1)`, og et tomt forsøk har ingen av dem. Uten et
 * eget felt blir kolonnen stående `null`, og da er «aldri forsøkt» og «forsøkt,
 * ingenting der» samme tilstand. Målt på Sundsøya 2026-08-12: 12 av 78 POI-er
 * havnet der, og hver kjøring re-forsøkte alle 12 til full Gemini-kost.
 *
 * `outcome` skiller det som er verdt å prøve igjen fra det som er verdt å
 * skrive selv:
 *   no-data  — ingenting publisert om stedet. Kandidat for Lokalkunnskap (Moat 1).
 *   refusal  — modellen svarte om søket sitt i stedet for om stedet. Prompt-problem.
 *   error    — timeout, kvote, nettverk. Transient; prøv igjen.
 */
export const PoiGroundingAttemptSchema = z.object({
  /** ISO-8601. Alderskilde for re-forsøk-vinduet. */
  at: z.string().min(1),
  outcome: z.enum(["no-data", "refusal", "error"]),
  reason: z.string().min(1),
});

export const PoiGroundingV1Schema = z.object({
  poiGroundingVersion: z.literal(1),
  generated: PoiGroundingGeneratedSchema.optional(),
  curated: PoiGroundingCuratedSchema.optional(),
  /**
   * Siste forsøk som ikke ga innhold. Alle tre lagene er uavhengige: et POI kan
   * ha `lastAttempt` (Gemini fant ingenting) OG `curated` (vi skrev det selv) —
   * det er faktisk normaltilstanden for et servicested.
   */
  lastAttempt: PoiGroundingAttemptSchema.optional(),
});

/**
 * Discriminated union på poiGroundingVersion. Én variant i dag; en versjon-bump
 * tvinger regenerering ved at ukjente versjoner avvises ved parse.
 */
export const PoiGroundingViewSchema = z.discriminatedUnion(
  "poiGroundingVersion",
  [PoiGroundingV1Schema],
);

export type PoiGrounding = z.infer<typeof PoiGroundingViewSchema>;
export type PoiGroundingGenerated = z.infer<typeof PoiGroundingGeneratedSchema>;
export type PoiGroundingCurated = z.infer<typeof PoiGroundingCuratedSchema>;
export type PoiGroundingAttempt = z.infer<typeof PoiGroundingAttemptSchema>;
export type PoiGroundingSource = z.infer<typeof PoiGroundingSourceSchema>;
export type PoiQualityGate = z.infer<typeof PoiQualityGateSchema>;

/**
 * Build-time-generert audio-tour-data per kategori. Manus skrives av
 * `scripts/audio-manus-write.ts` (Steg 8c.1), MP3 + url/voice/model av
 * `scripts/audio-tour-build.ts` (Steg 8c.2). Omit (ikke null) ved feil.
 * audio.manus eksisterer alene mellom Steg 8c.1 og 8c.2; full audio krever
 * url+voice+model+generatedAt.
 */
/**
 * Character-level alignment fra ElevenLabs /with-timestamps. Brukes til å
 * synke karaoke-tekst med voice-over-posisjon. Arrays har samme lengde og
 * korresponderer 1:1: characters[i] starter ved characterStartTimesSeconds[i]
 * og slutter ved characterEndTimesSeconds[i].
 */
export interface ReportThemeAudioTimings {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface ReportThemeAudio {
  /** Public URL — typisk `/audio/{projectSlug}/{categoryId}.mp3`. Mangler frem til Steg 8c.2. */
  url?: string;
  /** ElevenLabs voice-ID brukt for generering. */
  voice?: string;
  /** ElevenLabs model-ID (f.eks. `eleven_multilingual_v2`). */
  model?: string;
  /** ISO-8601 tidspunkt for ElevenLabs-kallet. */
  generatedAt?: string;
  /** LLM-generert pitch-manus (~70 ord) som ble sendt til TTS. */
  manus: string;
  /** Character-level alignment fra /with-timestamps. Mangler på spor generert før audioVersion 5. */
  timings?: ReportThemeAudioTimings;
}

/**
 * Et autorert kamera-punkt for 3D-rapport-boardets per-kategori drone-bevegelse.
 * Mapper 1:1 på Google Maps 3D `CameraOptions` (center + range/tilt/heading).
 * `range` = avstand fra senter (m), `tilt` 0–90 (0 = rett ned), `heading` 0–360.
 */
export interface CameraPose {
  lat: number;
  lng: number;
  range: number;
  tilt: number;
  heading: number;
}

/**
 * Per-kategori kamera-konfig: dronen flyr fra `a` (start) til `b` (slutt) under
 * kategoriens voice-over. `b` valgfri — utelatt = rolig orbit ved `a`.
 * `moveDurationMs` overstyrer den audio-avledede varigheten (sjelden brukt).
 *
 * Lagres prototype-lokalt (se components/variants/report/board/camera-tours.ts).
 * Prod-promotering til `ReportThemeConfig.camera` (Supabase) er deferert.
 */
export interface CategoryCameraConfig {
  a: CameraPose;
  b?: CameraPose;
  moveDurationMs?: number;
}

/**
 * Nivå-2 (Bedre) kuratert kategori-innhold. TILSTEDEVÆRELSEN av dette objektet
 * (med ikke-tom body eller minst én highlight) er gating-signalet: en kategori
 * med editorial får et drill-in detalj-panel i rapport-board-sidebaren. Uten det
 * beholder kategorien nivå-1-oppførselen (klikk = velg på kart, intet panel).
 * Lagres per tema i products.config.reportConfig.themes[].editorial og kan
 * overskrives senere uten kodeendring — slik blir 1→2-oppgraderingen et felt-
 * fyll i Supabase. Nivå 3 (voice-over/reels) ligger fortsatt på `reelsAudio`.
 */
export interface ReportThemeEditorial {
  /** Kuratert brødtekst (kort avsnitt, dobbelt linjeskift = nytt avsnitt). */
  body: string;
  /** POI-IDer å trekke frem som «verdt å merke seg» — rendres som klikkbare
   *  chips i panelet → kameraet flyr til punktet (OPEN_POI). Refererer POIs i
   *  samme kategori; ukjente IDer ignoreres ved mapping. */
  highlightPoiIds?: string[];
  /** Path (/public eller absolutt) til kuratert bilde øverst i panelet.
   *  Faller tilbake til kategori-illustrasjonen når utelatt. */
  image?: string;
}

export interface ReportThemeConfig {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  color: string;
  intro?: string;
  bridgeText?: string;
  upperNarrative?: string;
  leadText?: string;
  categoryDescriptions?: Record<string, string>;
  /** Nivå-2 kuratert detalj-innhold. Omit → kategorien er nivå-1 (intet panel). */
  editorial?: ReportThemeEditorial;
  /** Strøkets kuraterte FAQ-svar for temaet, arvet fra `areas.report_editorial`.
   *  Overstyrer det deterministiske svaret per spørsmåls-id. Omit → kun
   *  deterministisk FAQ (som er minimum-garantien, ikke en mangel). */
  faq?: ReportFaqAnswer[];
  /** Google AI Mode-søk (udm=50) for "Les mer"-knapp. Short, generic query — Google handler fersk detalj. */
  readMoreQuery?: string;
  /** Build-time-generert Gemini-grounding. Omit ved feil — ikke null. */
  grounding?: ReportThemeGrounding;
  /** Build-time-generert audio-tour-spor for kategorien. Omit ved feil. */
  audio?: ReportThemeAudio;
  /** Reels-spesifikt lydspor (kortere, bilde-aligned manus) som overstyrer
   *  `audio` i reels-feeden. Audio-tour i rapport beholder `audio`. Per-prosjekt
   *  i Supabase — erstatter den gamle hardkodede CATEGORY_REELS_AUDIO-mappen. */
  reelsAudio?: ReportThemeAudio;
}

export interface BrokerInfo {
  name: string;
  firstName?: string;
  title: string;
  phone: string;
  email: string;
  photoUrl: string;
  officeName: string;
  officeLogoUrl?: string;
  bio?: string;
}

export interface ReportSummary {
  headline: string;
  insights: string[];
  brokerInviteText?: string;
}

export interface ReportCTA {
  leadUrl?: string;
  primaryLabel?: string;
  primarySubject?: string;
  shareTitle?: string;
}

/**
 * Per-prosjekt opt-in for prosjekt-spesifikke asset-filer. Erstatter de gamle
 * hardkodede slug-settene (PROJECTS_WITH_BRAND / PROJECTS_WITH_CUSTOM_ILLUSTRATIONS)
 * — et nytt prosjekt skrur på flagget i Supabase når filene er lastet opp, uten
 * kodeendring. Når et flagg er av, faller render-laget tilbake (tekst-wordmark,
 * generiske tema-illustrasjoner, bygnings-glyph-pin). Filene følger slug-
 * konvensjonen: `/illustrations/{slug}-logo.svg`, `-splash.jpg`,
 * `-splash-video.mp4`, `-{categoryId}.jpg`, `-pin-thumb.jpg`.
 */
export interface ProjectAssetFlags {
  /** Egen logo + splash-hero + splash-video finnes for prosjektet. */
  brand?: boolean;
  /** Kun splash-video (`{slug}-splash-video.mp4` + `.jpg`-poster) finnes — uten
   *  logo/splash-hero. Lar et prosjekt få levende splash-bakgrunn uten å skru på
   *  hele `brand`-flagget (som også krever logo + splash-stillbilde). */
  splashVideo?: boolean;
  /** Egne kategori-illustrasjoner (`{slug}-{categoryId}.jpg`) finnes. */
  customIllustrations?: boolean;
  /** Egen kvadratisk pin-thumbnail (`{slug}-pin-thumb.jpg`) finnes for 3D-markøren. */
  pinThumbnail?: boolean;
}

export interface ReportConfig {
  label?: string;
  heroIntro?: string;
  /** Bydel, eks. "Midtbyen". Subline i Nabolaget-seksjonen + splash. */
  district?: string;
  /** By, eks. "Trondheim". Vises etter district i subline. */
  city?: string;
  /** Opt-in for prosjekt-spesifikke asset-filer (brand/illustrasjon/pin). */
  assets?: ProjectAssetFlags;
  /** Path (absolute or /public) til illustrasjon som vises i hero + summary. Optional. */
  heroImage?: string;
  themes?: ReportThemeConfig[];
  /** Deterministiske fakta om adressen (transitt + skolekrets), hentet
   *  build-time. Kilden FAQ-svarene monteres fra ved render. */
  boardFacts?: ReportBoardFacts;
  /** Strøkets kuraterte svar på boardets globale nabolags-FAQ — de som ikke
   *  hører til én kategori («hva kjennetegner området?»). Arvet fra den
   *  reserverte `global`-nøkkelen i `areas.report_editorial`. */
  globalFaq?: ReportFaqAnswer[];
  /** Tre nabolags-motiver fra /generate-rapport. Vises i intro-kort ved samlekart. */
  motiver?: string[];
  summary?: ReportSummary;
  brokers?: BrokerInfo[];
  /**
   * Skjul megler-plassholderen i bunn av desktop-sidebaren.
   *
   * Plassholderen («Ansvarlig megler — Kontaktinfo legges til per prosjekt»)
   * finnes for eiendommer som ennå ikke har fått kontaktinfo, og skal stå der.
   * Men et board som ALDRI får en megler — en butikkatalog, et strøkskart —
   * viser da et tomt megler-kort på noe som ikke er en eiendom.
   *
   * Default av: eksisterende boards er uendret. Settes eksplisitt av prosjekter
   * uten megler-begrep.
   */
  hideBrokerCard?: boolean;
  cta?: ReportCTA;
  mapStyle?: string;
  trails?: TrailCollection;
  /** Tour-host-prat som spilles når brukeren starter guidet tur. Ikke en
   *  kategori — rendres som karaoke inni accordion under "Start guidet tur"-
   *  CTAen i SidebarHero. Auto-overgang til heroAudio (Nabolaget) når
   *  welcome er ferdig. */
  welcomeAudio?: ReportThemeAudio;
  /** Build-time-generert audio-tour-spor for Hjem-panelet (Hjem er ikke en kategori). */
  heroAudio?: ReportThemeAudio;
  /** Avslutnings-spor som spilles etter siste kategori. Ikke en kategori —
   *  rendres i bunn av sidebar over megler-kortet og telles ikke i
   *  CategoryIndex. */
  outroAudio?: ReportThemeAudio;
  /** Bump for å tvinge re-gen av alle audio-spor på alle prosjekter. */
  audioVersion?: 5;
  /** Eksplisitt opt-in for "Start tour"-knapp. Default false — selv om
   *  audio-spor er generert, skjules CTA inntil dette flagget settes per
   *  prosjekt. Tillater forhåndsgenerering uten å eksponere på prod. */
  audioTourEnabled?: boolean;
  /** Deklarert leveransenivå for rapport-boardet — det kunden har kjøpt,
   *  eller det demoen er bygget for å vise. 1 = Basic (3D-kart, POI-er,
   *  reisetider, live transport), 2 = +Editorial (kuratert drill-in på alle
   *  kategorier, admin-only). `undefined` → nivå 1. Ortogonale render-akser
   *  (3D, VO, camera-tours, brokers, brand) gates IKKE på feltet — de drives
   *  av egne flagg/data-presence (docs/rebuild/tier-kjerne-vs-overflate.md).
   *  Feltet er deklarasjon + lett nivå-2-readiness-sjekk
   *  (lib/validation/report-tier.ts), ikke en runtime-bryter. Navnet unngår
   *  kollisjon med POI-ens `poiTier`. */
  reportTier?: 1 | 2;
}

// === Origin Mode (for Explorer geolocation behavior) ===

export type OriginMode = "geolocation" | "fixed" | "geolocation-with-fallback";

// === Discovery Circle ===

export interface DiscoveryCircle {
  lat: number;
  lng: number;
  radiusMeters: number;
}

// === White-label theming ===
//
// ProjectTheme maps to shadcn semantic CSS tokens. Each field is a hex color
// that gets converted to HSL channel values via hexToHslChannels() and
// injected as inline style on the report route wrapper. Channel values are
// required so Tailwind's `hsl(var(--x) / <alpha-value>)` pattern keeps
// opacity modifiers working.

export interface ProjectTheme {
  // Semantic colors → override shadcn tokens
  backgroundColor?: string;        // → --background
  foregroundColor?: string;        // → --foreground
  primaryColor?: string;           // → --primary (accent, CTA buttons)
  primaryForegroundColor?: string; // → --primary-foreground (text on CTAs)
  cardColor?: string;              // → --card (broker card, surface)
  mutedColor?: string;             // → --muted (secondary surface)
  mutedForegroundColor?: string;   // → --muted-foreground (secondary text)
  borderColor?: string;            // → --border
  // Typography
  fontFamily?: string;             // CSS font-family string (free-form)
  // Branding
  logoUrl?: string;                // Logo in header
}

// === Project ===

/**
 * Render-formen boardet konsumerer — komponeres fra v2-skjemaet i
 * lib/supabase/v2-queries.ts (eneste datakilde etter cutover 2026-07-06).
 */
export interface Project {
  id: string;
  name: string;
  customer: string;
  urlSlug: string;
  productType: ProductType;
  centerCoordinates: Coordinates;
  story: Story;
  pois: POI[];
  categories: Category[];
  reportConfig?: ReportConfig;
  /** Bransje-tags (envalg) — determines bransjeprofil for themes/categories */
  tags?: string[];
  // Explorer-specific settings
  originMode?: OriginMode; // Default: "geolocation-with-fallback"
  venueType?: "hotel" | "residential" | "commercial" | null;
  /** Per-project white-label theme (CSS overrides) */
  theme?: ProjectTheme;
  /** URL til kundens hjemmeside — brukes i rapport-shell som tilbake-link og i footer */
  homepageUrl?: string | null;
  /** Whether the project has a 3D map add-on enabled */
  has3dAddon?: boolean;
  /**
   * Pre-computed skolekrets for this project's centerCoordinates.
   * Populated server-side (pages/API routes) to avoid bundling the 700kB
   * GeoJSON polygons into the client bundle. Client components read this
   * instead of calling getSchoolZone() directly.
   */
  schoolZone?: { barneskole: string | null; ungdomsskole: string | null };
}

// === Global State ===

export interface PlacyState {
  // Reiseinnstillinger
  travelMode: TravelMode;
  timeBudget: TimeBudget;

  // Aktive elementer
  activePOI: string | null;
  activeThemeStory: string | null;

  // Actions
  setTravelMode: (mode: TravelMode) => void;
  setTimeBudget: (budget: TimeBudget) => void;
  setActivePOI: (poiId: string | null) => void;
  setActiveThemeStory: (themeStoryId: string | null) => void;
}

// === API Response Types ===

export interface DirectionsResponse {
  routes: {
    duration: number; // sekunder
    distance: number; // meter
    geometry: {
      coordinates: [number, number][];
    };
  }[];
}

export interface TravelTimeResult {
  poiId: string;
  walk?: number;
  bike?: number;
  car?: number;
}

// === Async State ===

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Helper type for async state with data
export type AsyncStateWithData<T> = AsyncState<T> & { data: T };

// Initial async state factory
export const createInitialAsyncState = <T>(): AsyncState<T> => ({
  data: null,
  loading: false,
  error: null,
});

// Loading async state factory
export const createLoadingAsyncState = <T>(currentData?: T | null): AsyncState<T> => ({
  data: currentData ?? null,
  loading: true,
  error: null,
});

// Success async state factory
export const createSuccessAsyncState = <T>(data: T): AsyncState<T> => ({
  data,
  loading: false,
  error: null,
});

// Error async state factory
export const createErrorAsyncState = <T>(error: string, currentData?: T | null): AsyncState<T> => ({
  data: currentData ?? null,
  loading: false,
  error,
});

// Exhaustiveness checking utility
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

// === Camera Constraints (3D Map Performance) ===

export interface CameraConstraints {
  minTilt?: number;       // Default: 0 (degrees)
  maxTilt?: number;       // Default: 70 (degrees)
  minRange?: number;      // Default: 150 (meters)
  maxRange?: number;      // Default: 3000 (meters)
  bounds?: {
    north: number;        // Max latitude
    south: number;        // Min latitude
    east: number;         // Max longitude
    west: number;         // Min longitude
  };
  boundsBuffer?: number;  // Default: 0.2 (20% of diagonal)
}

// Default camera constraints for consistent performance
export const DEFAULT_CAMERA_CONSTRAINTS: Required<Omit<CameraConstraints, 'bounds' | 'boundsBuffer'>> & Pick<CameraConstraints, 'boundsBuffer'> = {
  minTilt: 0,
  maxTilt: 70,
  minRange: 150,
  maxRange: 3000,
  boundsBuffer: 0.2,
};

// === Place Knowledge Types ===

export const KNOWLEDGE_TOPICS = [
  'history', 'people', 'awards', 'media', 'controversy',
  'atmosphere', 'signature', 'culture', 'seasonal',
  'food', 'drinks', 'sustainability',
  'architecture', 'spatial', 'nature', 'accessibility',
  'practical', 'insider', 'relationships',
  'local_knowledge', // legacy — mapped to 'inside' category
] as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

// Category definition for type-safe grouping
interface CategoryDef {
  readonly labelNo: string;
  readonly labelEn: string;
  readonly topics: readonly KnowledgeTopic[];
}

export const KNOWLEDGE_CATEGORIES = {
  story: {
    labelNo: 'Historien',
    labelEn: 'The Story',
    topics: ['history', 'people', 'awards', 'media', 'controversy'],
  },
  experience: {
    labelNo: 'Opplevelsen',
    labelEn: 'The Experience',
    topics: ['atmosphere', 'signature', 'culture', 'seasonal'],
  },
  taste: {
    labelNo: 'Smaken',
    labelEn: 'The Taste',
    topics: ['food', 'drinks', 'sustainability'],
  },
  place: {
    labelNo: 'Stedet',
    labelEn: 'The Place',
    topics: ['architecture', 'spatial', 'nature', 'accessibility'],
  },
  inside: {
    labelNo: 'Innsiden',
    labelEn: 'The Inside Track',
    topics: ['practical', 'insider', 'relationships', 'local_knowledge'],
  },
} as const satisfies Record<string, CategoryDef>;

export type KnowledgeCategory = keyof typeof KNOWLEDGE_CATEGORIES;

export const KNOWLEDGE_TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  history: 'Historikk',
  people: 'Mennesker',
  awards: 'Anerkjennelse',
  media: 'I media',
  controversy: 'Debatt',
  atmosphere: 'Atmosfære',
  signature: 'Signaturen',
  culture: 'Kultur',
  seasonal: 'Sesong',
  food: 'Mat',
  drinks: 'Drikke',
  sustainability: 'Bærekraft',
  architecture: 'Arkitektur',
  spatial: 'Beliggenhet',
  nature: 'Natur',
  accessibility: 'Tilgjengelighet',
  practical: 'Praktisk',
  insider: 'Insider',
  relationships: 'Koblinger',
  local_knowledge: 'Visste du?',
};

export const KNOWLEDGE_TOPIC_LABELS_EN: Record<KnowledgeTopic, string> = {
  history: 'History',
  people: 'People',
  awards: 'Awards',
  media: 'In the Media',
  controversy: 'Debate',
  atmosphere: 'Atmosphere',
  signature: 'Signature',
  culture: 'Culture',
  seasonal: 'Seasonal',
  food: 'Food',
  drinks: 'Drinks',
  sustainability: 'Sustainability',
  architecture: 'Architecture',
  spatial: 'Location',
  nature: 'Nature',
  accessibility: 'Accessibility',
  practical: 'Practical',
  insider: 'Insider',
  relationships: 'Connections',
  local_knowledge: 'Did you know?',
};

export type KnowledgeConfidence = 'verified' | 'unverified' | 'disputed';

export interface PlaceKnowledge {
  id: string;
  poiId?: string;
  areaId?: string;
  topic: KnowledgeTopic;
  factText: string;
  factTextEn?: string;
  structuredData?: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  sourceUrl?: string;
  sourceName?: string;
  sortOrder: number;
  displayReady: boolean;
  verifiedAt?: string;
}
