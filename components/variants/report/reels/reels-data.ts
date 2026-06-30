import type {
  BoardAudioTrack,
  BoardCategory,
  BoardCategoryId,
  BoardData,
} from "../board/board-data";
import type { BrokerInfo, ReportCTA } from "@/lib/types";
import { getCategoryIllustrationSrc } from "@/lib/themes/category-illustrations";
import type { AudioTrack } from "@/lib/stores/audio-tour-store";

export interface IntroReelCard {
  kind: "intro";
  videoSrc: string;
}

/** "Velkommen" — meta-orienterings-kort helt i topp etter intro-videoen.
 *  Tilsvarer den gamle "Start opplevelsen"-knappen — sier: "velkommen,
 *  dette skal vi gå gjennom de neste minuttene". Bruker `boardData.welcome`
 *  fra audio-tour-pipelinen. Markørene på kartet viser hele nabolaget
 *  (default-state, samme som home). */
export interface WelcomeReelCard {
  kind: "welcome";
  label: string;
  illustrationSrc: string;
  videoBgSrc?: string;
  audio: BoardAudioTrack;
}

/** "Nabolaget" — innhold-etablering etter Velkomst-cardet. Speiler home-
 *  spor fra audio-tour, men i reel-format (video-bg eller hero-bilde,
 *  karaoke-VO). Markørene på kartet viser hele neighbourhood-en. */
export interface HomeReelCard {
  kind: "home";
  label: string;
  subline?: string;
  illustrationSrc: string;
  videoBgSrc?: string;
  audio: BoardAudioTrack;
}

export interface CategoryReelCard {
  kind: "category";
  categoryId: BoardCategoryId;
  label: string;
  lead: string;
  illustrationSrc: string;
  /** Optional video-bakgrunn — overstyrer illustrasjon når satt. Cyclic
   *  mapping basert på cardIndex i builderen — testfase, vi har 4 scene-
   *  klipp og gjentar dem rundt. */
  videoBgSrc?: string;
  audio: BoardAudioTrack;
  pois: BoardCategory["pois"];
  color: string;
  icon: string;
}

/** Oppsummering — spilles etter siste kategori. Karaoke-VO med overblikks-
 *  bilde av prosjektet. */
export interface OutroReelCard {
  kind: "outro";
  label: string;
  illustrationSrc: string;
  videoBgSrc?: string;
  audio: BoardAudioTrack;
}

/** Visuelt oppsummerings-kort — statisk, uten audio. Headline + insight-
 *  punkter + CTA. Vises rett før megler-kortet, men KUN for prosjekter med
 *  strukturert summary-data (headline). Uten data hoppes kortet over og
 *  finalen blir outro-recap + megler (som før). */
export interface SummaryReelCard {
  kind: "summary";
  label: string;
  headline: string;
  insights: string[];
  cta?: ReportCTA;
  /** Første megler — brukt til mailto-fallback når cta.leadUrl mangler. */
  broker?: BrokerInfo;
}

/** Megler-kontaktkort — statisk slutt-card uten audio. Knapper for tlf/e-post. */
export interface MeglerReelCard {
  kind: "megler";
  label: string;
  brokers: BrokerInfo[];
}

/** Audio-bærende kort som driver tracks-arrayen til audio-store. Intro og
 *  megler har ingen audio. */
export type AudioBearingCard =
  | WelcomeReelCard
  | HomeReelCard
  | CategoryReelCard
  | OutroReelCard;

export type ReelsCard =
  | IntroReelCard
  | WelcomeReelCard
  | HomeReelCard
  | CategoryReelCard
  | OutroReelCard
  | SummaryReelCard
  | MeglerReelCard;

export function isAudioBearing(card: ReelsCard): card is AudioBearingCard {
  return (
    card.kind === "welcome" ||
    card.kind === "home" ||
    card.kind === "category" ||
    card.kind === "outro"
  );
}

// Per-kategori video-bakgrunner. Når en kategori-id har dedikert klipp,
// brukes det; resten faller tilbake til scene1-4 i syklus. trening-aktivitet
// + hverdagsliv er klippet fra de proff-produserte Stasjonskvartalet-filmene
// (Mann som løper / Kvinne i handlegate), center-croppet 16:9→9:16 til 720x1280.
const CATEGORY_VIDEO_BG: Record<string, string> = {
  "natur-friluftsliv": "/reels/categories/natur-friluftsliv.mp4",
  "transport": "/reels/categories/transport.mp4",
  "mat-drikke": "/reels/categories/mat-drikke.mp4",
  "trening-aktivitet": "/reels/categories/trening-aktivitet.mp4",
  "hverdagsliv": "/reels/categories/hverdagsliv.mp4",
};

const FALLBACK_VIDEO_BG = [
  "/reels/categories/scene1.mp4",
  "/reels/categories/scene2.mp4",
  "/reels/categories/scene3.mp4",
  "/reels/categories/scene4.mp4",
];

/**
 * Avleder poster-bildet (videoens FØRSTE frame) fra en video-bg-sti etter
 * konvensjon: samme sti, men `.jpg` i stedet for `.mp4`. Posterne genereres
 * build-time av `scripts/generate-reels-posters.mjs`.
 *
 * Brukes to steder: (1) preview-kortet i DesktopStorySidebar viser denne
 * stillbilde-frame-en når kategorien IKKE er aktiv — slik at preview matcher
 * videoen som spilles når kortet blir aktivt; (2) `<video poster>` på det
 * aktive kortet, så første frame vises umiddelbart uten svart blink før
 * videoen laster. Returnerer undefined når kortet ikke har video-bg (da
 * faller preview tilbake til det statiske illustrasjonsbildet).
 */
export function posterForVideo(videoBgSrc: string | undefined): string | undefined {
  if (!videoBgSrc) return undefined;
  return videoBgSrc.replace(/\.mp4$/i, ".jpg");
}

/**
 * Poster/tittel for thumbnail-visning (desktop-stripa + mobil-rail). Audio-bærende
 * kort bruker video-posteren (eller illustrasjonen); megler har ikke media →
 * portrett brukes. Intro/summary har ingen thumbnail.
 */
export function thumbView(card: ReelsCard): { title: string; image?: string } {
  switch (card.kind) {
    case "welcome":
    case "home":
    case "category":
    case "outro":
      return {
        title: card.label,
        image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc,
      };
    case "megler":
      return { title: card.label, image: card.brokers[0]?.photoUrl };
    default:
      return { title: "" };
  }
}

/**
 * "Spiller nå"-visning for mobil-transporten (Spotify-mønster): poster + tittel
 * + meta-linje. Erstatter den abstrakte thumbnail-railen med ETT konkret, kjent
 * now-playing-element som svarer «hva spilles, og hvor i løypa er jeg».
 *
 * Meta-linja er kort og kort-spesifikk:
 *  - kategori: `{n} steder · {pos}/{antall kategorier}` (pos blant KATEGORIENE,
 *    ikke hele tracks-arrayen — «kategori = sang»).
 *  - welcome/home/outro/summary/megler: en passende undertekst.
 */
export function nowPlayingView(
  cards: ReelsCard[],
  cardIndex: number,
): { title: string; meta: string; image?: string } {
  const card = cards[cardIndex];
  if (!card) return { title: "", meta: "" };
  const image = thumbView(card).image;
  const title = "label" in card ? card.label : "";
  switch (card.kind) {
    case "category": {
      const categories = cards.filter(
        (c): c is CategoryReelCard => c.kind === "category",
      );
      const pos = categories.indexOf(card) + 1;
      const places = card.pois.length;
      const meta =
        places > 0
          ? `${places} steder · ${pos}/${categories.length}`
          : `${pos}/${categories.length}`;
      return { title, meta, image };
    }
    case "welcome":
      return { title, meta: "Introduksjon", image };
    case "home":
      return { title, meta: card.subline ?? "Nabolaget", image };
    case "outro":
      return { title, meta: "Oppsummering", image };
    case "summary":
      return { title, meta: "Oppsummering", image };
    case "megler":
      return { title, meta: "Ta kontakt", image };
    default:
      return { title, meta: "", image };
  }
}

/**
 * Lengden på et lydspor i sekunder, avledet fra siste karakter-slutt-tid i
 * timings-dataen (ElevenLabs character-alignment). Brukes til lengde-pillen
 * på preview-kortene. Returnerer undefined når sporet mangler timings (spor
 * fra før audioVersion 5), så pillen bare vises når vi faktisk vet lengden.
 */
export function audioDurationSec(audio: BoardAudioTrack | undefined): number | undefined {
  const ends = audio?.timings?.characterEndTimesSeconds;
  if (!ends || ends.length === 0) return undefined;
  return ends[ends.length - 1];
}


// ---------------------------------------------------------------------------
// Reels-video-kilde-derivasjon (per prosjekt-slug). Trukket ut av
// ReportReelsPage (PRD 9 Unit 2 — ingen forretningslogikk i komponenter).
// REELS_MONTAGE_PROJECTS er et PRD-9-eid DATA-flagg (§5.4).
// ---------------------------------------------------------------------------

/** Intro-video pr. prosjekt etter slug-konvensjon: `/reels/{slug}/intro.mp4`.
 *  Mangler filen (nytt prosjekt uten produsert intro) → tom src, og IntroReel
 *  faller tilbake til svart bakgrunn med start-knapp (videoen har ingen poster,
 *  så et 404 gir ikke ødelagt bilde — bare svart). */
export function introVideoSrc(projectSlug: string | undefined): string {
  return projectSlug ? `/reels/${projectSlug}/intro.mp4` : "";
}

// Prosjekter med produsert reels-montasje (velkommen + nabolaget levende
// bakgrunner). I motsetning til intro-videoen bruker disse kortene posterForVideo
// (.mp4 → .jpg), så en 404-poster ville gitt et ødelagt bilde i sidebar/
// CategoryReel. Derfor gates de eksplisitt per slug (samme mønster som
// PIN_THUMBNAILS) — nytt prosjekt legges til her når montasjene er lastet opp
// under /reels/<slug>/. Uten montasje → undefined → kortet faller tilbake til
// illustrasjonsbildet.
export const REELS_MONTAGE_PROJECTS = new Set<string>(["stasjonskvartalet"]);

// Velkommen-kortets levende bakgrunn (splash-montasjen, center-croppet til 9:16):
// `/reels/{slug}/welcome.mp4`. Undefined utenfor REELS_MONTAGE_PROJECTS.
export function welcomeVideoSrc(projectSlug: string | undefined): string | undefined {
  return projectSlug && REELS_MONTAGE_PROJECTS.has(projectSlug)
    ? `/reels/${projectSlug}/welcome.mp4`
    : undefined;
}

// Nabolaget-kortets levende bakgrunn (Ken Burns + kryss-fade-loop, 9:16):
// `/reels/{slug}/nabolaget.mp4`. Undefined utenfor REELS_MONTAGE_PROJECTS.
export function homeVideoSrc(projectSlug: string | undefined): string | undefined {
  return projectSlug && REELS_MONTAGE_PROJECTS.has(projectSlug)
    ? `/reels/${projectSlug}/nabolaget.mp4`
    : undefined;
}

export function buildReelsCards(
  boardData: BoardData,
  introVideoSrc: string,
  welcomeVideoSrc?: string,
  homeVideoSrc?: string,
): ReelsCard[] {
  const cards: ReelsCard[] = [];

  cards.push({ kind: "intro", videoSrc: introVideoSrc });

  if (boardData.welcome && boardData.home.heroImage) {
    cards.push({
      kind: "welcome",
      label: "Velkommen",
      illustrationSrc: boardData.home.heroImage,
      // Velkommen-kortet får splash-videoen (center-croppet til 9:16) som
      // levende bakgrunn i stedet for det flate hero-stillbildet — samme
      // footage som splash-panelet, i riktig høydeformat. Faller tilbake til
      // illustrationSrc om welcome-videoen mangler. Poster avledes .mp4→.jpg
      // (se posterForVideo).
      ...(welcomeVideoSrc ? { videoBgSrc: welcomeVideoSrc } : {}),
      audio: boardData.welcome,
    });
  }

  if (boardData.home.audio && boardData.home.heroImage) {
    cards.push({
      kind: "home",
      label: "Nabolaget",
      subline:
        [boardData.home.district, boardData.home.city]
          .filter(Boolean)
          .join(", ") || undefined,
      illustrationSrc: boardData.home.heroImage,
      // Nabolaget-kortet får en Ken Burns-loop av faktiske nabolags-foto
      // (Solsiden + Bakke gangbru) som levende bakgrunn. Faller tilbake til
      // illustrationSrc om home-videoen mangler. Poster avledes .mp4→.jpg.
      ...(homeVideoSrc ? { videoBgSrc: homeVideoSrc } : {}),
      audio: boardData.home.audio,
    });
  }

  boardData.categories
    .filter((c) => !!c.reelsAudio || !!c.audio)
    .forEach((c, idx) => {
      // Reels-spesifikt spor (Supabase) overstyrer audio-tour-sporet i feeden.
      const audio = c.reelsAudio ?? c.audio;
      if (!audio) return;
      const illustrationSrc =
        getCategoryIllustrationSrc(boardData.projectSlug, c.id, boardData.assets) ??
        c.illustration?.src ??
        "";
      if (!illustrationSrc) return;
      cards.push({
        kind: "category",
        categoryId: c.id,
        label: c.label,
        lead: c.lead,
        illustrationSrc,
        videoBgSrc:
          CATEGORY_VIDEO_BG[c.id] ??
          FALLBACK_VIDEO_BG[idx % FALLBACK_VIDEO_BG.length],
        audio,
        pois: c.pois,
        color: c.color,
        icon: c.icon,
      });
    });

  if (boardData.outro && boardData.home.heroImage) {
    cards.push({
      kind: "outro",
      label: "Oppsummert",
      illustrationSrc: boardData.home.heroImage,
      // Oppsummert-kortet får samme levende bakgrunn som Velkommen (splash-videoen,
      // center-croppet 16:9→9:16) — rammer inn opplevelsen symmetrisk start↔slutt.
      // Faller tilbake til hero-stillbildet om welcome-videoen mangler.
      ...(welcomeVideoSrc ? { videoBgSrc: welcomeVideoSrc } : {}),
      audio: boardData.outro,
    });
  }

  // Visuelt oppsummerings-kort — kun når strukturert summary-data finnes.
  // Plasseres etter outro-recap, før megler-kontakt.
  if (boardData.summary?.headline && boardData.summary.insights?.length) {
    cards.push({
      kind: "summary",
      label: "Oppsummert",
      headline: boardData.summary.headline,
      insights: boardData.summary.insights,
      cta: boardData.cta,
      broker: boardData.brokers?.[0],
    });
  }

  if (boardData.brokers && boardData.brokers.length > 0) {
    cards.push({
      kind: "megler",
      label: "Ta kontakt",
      brokers: boardData.brokers,
    });
  }

  return cards;
}

/** Bygger audio-tour-tracks-arrayen fra alle audio-bærende cards i samme
 *  rekkefølge som de vises i feeden. Brukes av use-reels-audio-orchestration. */
export function buildCategoryTracks(cards: ReelsCard[]): AudioTrack[] {
  return cards.filter(isAudioBearing).map((c) => ({
    categoryId: c.kind === "category" ? c.categoryId : c.kind,
    url: c.audio.url,
    manus: c.audio.manus,
    // durationSec avledet fra karaoke-timings — gjør A→B-kamerabevegelsens
    // varighet kjent SYNKRONT ved cut-tid (uten å vente på <audio> loadedmetadata).
    durationSec: audioDurationSec(c.audio),
  }));
}

/** Mapper cardIndex → audioIndex (indeks i tracks-arrayen). Returnerer -1
 *  hvor cardet ikke har audio (intro, megler). */
export function cardIndexToAudioIndex(
  cards: ReelsCard[],
  cardIndex: number,
): number {
  let audioIndex = -1;
  for (let i = 0; i <= cardIndex && i < cards.length; i++) {
    if (isAudioBearing(cards[i])) audioIndex++;
  }
  return cards[cardIndex] && isAudioBearing(cards[cardIndex]) ? audioIndex : -1;
}

/** Indeks til første audio-bærende card (welcome/home/kategori/outro).
 *  Brukes av desktop-sidebaren til å starte avspillingen fra "Start"-knappen. */
export function firstAudioBearingIndex(cards: ReelsCard[]): number {
  return cards.findIndex(isAudioBearing);
}

/**
 * Velger play-knappens label på velkomst-splashen (desktop + mobil).
 *
 * D3: event-board har ingen audio-tur (`firstIdx === -1`), så boligrapportens
 * basic-fallback "Utforsk nærområdet" ville ellers stått på selve play-knappen
 * — en eiendoms-streng som bryter D3 ("null megler/eiendoms-strenger på
 * event-board"). I event-modus returnerer vi en program-passende, eiendoms-fri
 * label uavhengig av tur-state. Boligrapport-grenen er uendret.
 */
export function deriveSplashPrimaryLabel(opts: {
  eventMode: boolean;
  notStarted: boolean;
  firstIdx: number;
  ended: boolean;
}): string {
  if (opts.eventMode) return "Utforsk programmet";
  if (opts.notStarted) {
    return opts.firstIdx === -1 ? "Utforsk nærområdet" : "Start opplevelsen";
  }
  return opts.ended ? "Spill av på nytt" : "Fortsett";
}

/**
 * Velkomst-splashens intro-copy. D3: event-modus har egen, megler/eiendoms-fri
 * copy (ingen "nærområdet til hotellet"/"utenfor kontordøren"). Boligrapport
 * forgrener på venueType (commercial/hotel); residential/ukjent → undefined
 * (splashen viser da ingen intro-paragraf). Trukket ut av ResponsiveLayoutInner
 * (PRD 9 Unit 2 — ren, enhetstestbar helper, samme mønster som
 * deriveSplashPrimaryLabel).
 */
export function deriveSplashIntro(opts: {
  eventMode: boolean;
  venueType: BoardData["venueType"];
}): string | undefined {
  if (opts.eventMode)
    return "Utforsk programmet på kartet — se hva som skjer, hvor og når. Trykk play, og finn opplevelsene i nærheten.";
  if (opts.venueType === "commercial")
    return "Vi tar deg med på en guidet tur i nærområdet — restauranter, transport, trenings- og servicetilbud rett utenfor kontordøren. Trykk play, og se hva som ligger i gangavstand.";
  if (opts.venueType === "hotel")
    return "Utforsk nærområdet til hotellet — restauranter, severdigheter, transport og opplevelser rett utenfor lobbyen. Trykk play, og se hva som ligger i gangavstand.";
  return undefined;
}

/** Indeks til neste audio-bærende card etter `fromIndex`, eller -1 om ingen.
 *  Driver desktop auto-advance: når et spor slutter, ruller løpebåndet til
 *  neste kapittel. Hopper over ikke-audio-cards (intro/megler). */
export function nextAudioBearingIndex(
  cards: ReelsCard[],
  fromIndex: number,
): number {
  for (let i = fromIndex + 1; i < cards.length; i++) {
    if (isAudioBearing(cards[i])) return i;
  }
  return -1;
}

/** Indeks til FORRIGE audio-bærende card før `fromIndex`, eller -1 om ingen.
 *  Driver mobil-transportens ⏮-knapp (forrige kapittel). Speil av
 *  `nextAudioBearingIndex`; hopper over ikke-audio-cards (intro/summary/megler),
 *  så ⏮ fra summary/megler lander på outro. */
export function prevAudioBearingIndex(
  cards: ReelsCard[],
  fromIndex: number,
): number {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (isAudioBearing(cards[i])) return i;
  }
  return -1;
}

/** Mapper audioIndex → cardIndex. */
export function audioIndexToCardIndex(
  cards: ReelsCard[],
  audioIndex: number,
): number {
  let seen = -1;
  for (let i = 0; i < cards.length; i++) {
    if (isAudioBearing(cards[i])) {
      seen++;
      if (seen === audioIndex) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Audio-bærende navigasjons-orkestrering (track-ended auto-advance).
// Ren beslutnings-funksjon trukket ut av ReportReelsPage.ReelsAudioShell
// (PRD 9 Unit 2): den AVGJØR hva som skjer når et VO-spor slutter naturlig;
// komponenten EKSEKVERER (timere/refs/dispatch/setTeaserArmed). Holder den tunge
// to-flate-logikken testbar uten å mocke React-timere.
// ---------------------------------------------------------------------------

/** Pause (ms) mellom kategori-kapitler ved auto-advance — et lite pust så VO-en
 *  ikke hopper rett fra én kategori til neste. */
export const CATEGORY_ADVANCE_PAUSE_MS = 1000;

/** Teaser-vindu (ms): hvor lenge kart-glimtet står ved kategori-VO-slutt FØR
 *  passiv auto-advance til neste kapittel (R8/R9). Lengre enn pusten over så
 *  brukeren rekker å lese «Utforsk på kart» og evt. tappe. */
export const CATEGORY_TEASER_MS = 3500;

export type TrackEndedAction =
  /** Gjør ingenting (kategori med kart åpent, eller intro/summary/megler). */
  | { type: "none" }
  /** Kall audioNext() NÅ — eneste vei til terminal "ended"-fase. */
  | { type: "endTour" }
  /** Planlegg setActiveIndex(targetIndex) etter delayMs. Kanselleres av
   *  activeIndex-cleanup ved manuell navigasjon (ingen fire-time-guard). */
  | { type: "advance"; targetIndex: number; delayMs: number }
  /** Arm kart-teaseren og planlegg en fire-time-guard'et advance: ved fire-tid
   *  avbrytes den hvis brukeren har navigert bort (activeIndex ≠ guardIndex),
   *  åpnet kartet (mapOpen), eller avvæpnet teaseren. targetIndex utenfor cards
   *  ved fire-tid → audioNext() i stedet (terminal). */
  | {
      type: "teaserAdvance";
      targetIndex: number;
      delayMs: number;
      guardIndex: number;
    };

/**
 * Avgjør auto-advance-handlingen når et VO-spor slutter naturlig.
 * - Desktop: advance til neste audio-bærende kapittel (etter pust), ellers
 *   endTour (siste kapittel ferdig → nå terminal "ended" så "Spill av på nytt").
 * - Mobil welcome/home (kart-fremtunge beats): advance videre, ellers none.
 * - Mobil outro: advance til finale-kortet (+1, audio-frie megler/summary),
 *   ellers endTour.
 * - Mobil kategori, KUN når kartet ikke er åpent: arm teaser + guard'et advance.
 *   (Slutter VO-en mens brukeren er på kart-flaten skal touren stå → none.)
 * - Ellers: none.
 */
export function decideTrackEndedAction(opts: {
  isDesktop: boolean;
  cards: ReelsCard[];
  activeIndex: number;
  mapOpen: boolean;
}): TrackEndedAction {
  const { isDesktop, cards, activeIndex, mapOpen } = opts;

  if (isDesktop) {
    const next = nextAudioBearingIndex(cards, activeIndex);
    return next !== -1
      ? { type: "advance", targetIndex: next, delayMs: CATEGORY_ADVANCE_PAUSE_MS }
      : { type: "endTour" };
  }

  const endedCard = cards[activeIndex];
  if (!endedCard) return { type: "none" };

  if (endedCard.kind === "welcome" || endedCard.kind === "home") {
    const next = nextAudioBearingIndex(cards, activeIndex);
    return next !== -1
      ? { type: "advance", targetIndex: next, delayMs: CATEGORY_ADVANCE_PAUSE_MS }
      : { type: "none" };
  }

  if (endedCard.kind === "outro") {
    const next = activeIndex + 1;
    return next < cards.length
      ? { type: "advance", targetIndex: next, delayMs: CATEGORY_ADVANCE_PAUSE_MS }
      : { type: "endTour" };
  }

  if (endedCard.kind === "category" && !mapOpen) {
    const nextAudio = nextAudioBearingIndex(cards, activeIndex);
    const next = nextAudio !== -1 ? nextAudio : activeIndex + 1;
    return {
      type: "teaserAdvance",
      targetIndex: next,
      delayMs: CATEGORY_TEASER_MS,
      guardIndex: activeIndex,
    };
  }

  return { type: "none" };
}
