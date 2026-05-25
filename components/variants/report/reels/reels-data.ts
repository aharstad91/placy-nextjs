import type {
  BoardAudioTrack,
  BoardCategory,
  BoardCategoryId,
  BoardData,
} from "../board/board-data";
import type { BrokerInfo } from "@/lib/types";
import { getCategoryIllustrationSrc } from "@/lib/themes/category-illustrations";
import type { AudioTrack } from "@/lib/stores/audio-tour-store";
import transportReelsTimings from "@/data/reels-audio/transport.timings.json";

export interface IntroReelCard {
  kind: "intro";
  videoSrc: string;
}

/** "Nabolaget" — første audio-card etter intro. Speiler home-spor fra
 *  audio-tour, men i reel-format (video-bg eller hero-bilde, karaoke-VO).
 *  Markørene på kartet viser hele neighbourhood-en (default-state). */
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

/** Megler-kontaktkort — statisk slutt-card uten audio. Knapper for tlf/e-post. */
export interface MeglerReelCard {
  kind: "megler";
  label: string;
  brokers: BrokerInfo[];
}

/** Audio-bærende kort som driver tracks-arrayen til audio-store. Intro og
 *  megler har ingen audio. */
export type AudioBearingCard = HomeReelCard | CategoryReelCard | OutroReelCard;

export type ReelsCard =
  | IntroReelCard
  | HomeReelCard
  | CategoryReelCard
  | OutroReelCard
  | MeglerReelCard;

export function isAudioBearing(card: ReelsCard): card is AudioBearingCard {
  return card.kind === "home" || card.kind === "category" || card.kind === "outro";
}

// Per-kategori video-bakgrunner. Når en kategori-id har dedikert Veo-
// generert klipp, brukes det. Resten faller tilbake til scene1-4 i syklus.
const CATEGORY_VIDEO_BG: Record<string, string> = {
  "natur-friluftsliv": "/reels/categories/natur-friluftsliv.mp4",
  "transport": "/reels/categories/transport.mp4",
};

const FALLBACK_VIDEO_BG = [
  "/reels/categories/scene1.mp4",
  "/reels/categories/scene2.mp4",
  "/reels/categories/scene3.mp4",
  "/reels/categories/scene4.mp4",
];

// Reels-spesifikk audio (kortere/bilde-aligned manus). Når en kategori har
// override her, brukes denne i stedet for audio-tour-versjonen fra board-
// data. Audio-tour i rapport-board beholder originalen siden timings i
// Supabase peker på det manuset. Se worklog 2026-05-25 (manus-pivot).
const CATEGORY_REELS_AUDIO: Record<string, BoardAudioTrack> = {
  transport: {
    url: "/audio/stasjonskvartalet/transport-reels.mp3",
    manus:
      "Stasjonskvartalet er i samme bygg som nye Trondheim Sentralstasjon. " +
      "Her har du umiddelbar tilgang til tog og buss. " +
      "Toget går direkte sørover til Oslo, og direkte nordover til Bodø, med stopp på Værnes lufthavn underveis. " +
      "Bussholdeplassene rundt kvartalet dekker hele byregionen. " +
      "Hurtigbåter går fra Pirterminalen, fem minutter unna. " +
      "Flere bysykkel-stasjoner i nærheten — bysykler leies med app. " +
      "Mange tjenester innen elsparkesykler, som står spredt og i stasjoner i nærheten. " +
      "Og bildeling gir deg bil når du trenger større turer.",
    timings: transportReelsTimings,
  },
};

export function buildReelsCards(
  boardData: BoardData,
  introVideoSrc: string,
): ReelsCard[] {
  const cards: ReelsCard[] = [];

  cards.push({ kind: "intro", videoSrc: introVideoSrc });

  if (boardData.home.audio && boardData.home.heroImage) {
    cards.push({
      kind: "home",
      label: "Nabolaget",
      subline:
        [boardData.home.district, boardData.home.city]
          .filter(Boolean)
          .join(", ") || undefined,
      illustrationSrc: boardData.home.heroImage,
      audio: boardData.home.audio,
    });
  }

  boardData.categories
    .filter((c): c is BoardCategory & { audio: BoardAudioTrack } => !!c.audio)
    .forEach((c, idx) => {
      const illustrationSrc =
        getCategoryIllustrationSrc(boardData.projectSlug, c.id) ??
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
        audio: CATEGORY_REELS_AUDIO[c.id] ?? c.audio,
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
      audio: boardData.outro,
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
