import type {
  BoardAudioTrack,
  BoardCategory,
  BoardCategoryId,
  BoardData,
} from "../board/board-data";
import { getCategoryIllustrationSrc } from "@/lib/themes/category-illustrations";
import type { AudioTrack } from "@/lib/stores/audio-tour-store";
import transportReelsTimings from "@/data/reels-audio/transport.timings.json";

export interface IntroReelCard {
  kind: "intro";
  videoSrc: string;
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

export type ReelsCard = IntroReelCard | CategoryReelCard;

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
  const intro: IntroReelCard = { kind: "intro", videoSrc: introVideoSrc };

  const categoryCards: CategoryReelCard[] = boardData.categories
    .filter((c): c is BoardCategory & { audio: BoardAudioTrack } => !!c.audio)
    .map((c, idx) => {
      const illustrationSrc =
        getCategoryIllustrationSrc(boardData.projectSlug, c.id) ?? c.illustration?.src ?? "";
      return {
        kind: "category" as const,
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
      };
    })
    .filter((c) => !!c.illustrationSrc);

  return [intro, ...categoryCards];
}

export function buildCategoryTracks(cards: ReelsCard[]): AudioTrack[] {
  return cards
    .filter((c): c is CategoryReelCard => c.kind === "category")
    .map((c) => ({
      categoryId: c.categoryId,
      url: c.audio.url,
      manus: c.audio.manus,
    }));
}

export function cardIndexToAudioIndex(cardIndex: number): number {
  return cardIndex - 1;
}

export function audioIndexToCardIndex(audioIndex: number): number {
  return audioIndex + 1;
}
