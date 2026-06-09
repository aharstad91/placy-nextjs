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
