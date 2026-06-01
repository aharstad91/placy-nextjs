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
import matDrikkeReelsTimings from "@/data/reels-audio/mat-drikke.timings.json";
import naturFriluftslivReelsTimings from "@/data/reels-audio/natur-friluftsliv.timings.json";
import hverdagslivReelsTimings from "@/data/reels-audio/hverdagsliv.timings.json";
import opplevelserReelsTimings from "@/data/reels-audio/opplevelser.timings.json";
import treningAktivitetReelsTimings from "@/data/reels-audio/trening-aktivitet.timings.json";
import barnOppvekstReelsTimings from "@/data/reels-audio/barn-oppvekst.timings.json";

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
  | MeglerReelCard;

export function isAudioBearing(card: ReelsCard): card is AudioBearingCard {
  return (
    card.kind === "welcome" ||
    card.kind === "home" ||
    card.kind === "category" ||
    card.kind === "outro"
  );
}

// Per-kategori video-bakgrunner. Når en kategori-id har dedikert Veo-
// generert klipp, brukes det. Resten faller tilbake til scene1-4 i syklus.
const CATEGORY_VIDEO_BG: Record<string, string> = {
  "natur-friluftsliv": "/reels/categories/natur-friluftsliv.mp4",
  "transport": "/reels/categories/transport.mp4",
  "mat-drikke": "/reels/categories/mat-drikke.mp4",
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
      "Nye Trondheim Sentralstasjon er nærmeste nabo, og det gir muligheten til å gå rett ut til alle former for transport. " +
      "Skal du langt, tar toget deg direkte sørover til Oslo, og nordover til Bodø. " +
      "Toget stopper ved Trondheim lufthavn, Værnes, og flybuss kjører jevnt tur/retur fra holdeplass et par minutter unna. " +
      "Buss-stoppene rundt kvartalet dekker hele byregionen, og du går fem minutter til hurtigbåtterminalen. " +
      "Trenger du noe raskere i nærheten, ligger bysykler og elsparkesykler i stasjoner rett rundt deg. " +
      "Og er det behov for bil, finner du dedikerte delebiler med både person- og varebiler i nærheten. " +
      "Til slutt er det også verdt å nevne at det er en dedikert taxi-holdeplass to minutter unna døra.",
    timings: transportReelsTimings,
  },
  "mat-drikke": {
    url: "/audio/stasjonskvartalet/mat-drikke-reels.mp3",
    manus:
      "Med denne beliggenheten får man adgang til over 200 spisesteder innen kort gangavstand, med restaurant, kafé eller pub spredt utover bydelene. " +
      "Solsiden og sentrum-kjernen er gode eksempler på steder hvor det er spisesteder på rekke og rad. " +
      "Uansett hva en ønsker seg av mat og drikke, kan du få det i nærheten. " +
      "For dagligvarer er det flere butikker innen fem minutters gange, samt vil det bli bygd en ny dagligvarebutikk i kvartalet.",
    timings: matDrikkeReelsTimings,
  },
  "natur-friluftsliv": {
    url: "/audio/stasjonskvartalet/natur-friluftsliv-reels.mp3",
    manus:
      "Stasjonskvartalet ligger mellom Nidelva og fjorden — bymidten har vannet rundt seg. " +
      "Du går fem minutter ned til Sjøbadet, eller ti minutter til Adressaparken ved elveløpet. " +
      "Derfra følger en tursti langs Nidelva videre forbi Bakklandet og Marinen — en av Trondheims mest brukte ruter. " +
      "Vestover ligger Skansen med gjestehavn og sandstrand, en kort kveldstur. " +
      "Og når du vil sykle langs fjorden, tar Ladestien deg ut fra sentrum.",
    timings: naturFriluftslivReelsTimings,
  },
  hverdagsliv: {
    url: "/audio/stasjonskvartalet/hverdagsliv-reels.mp3",
    manus:
      "Hverdagslogistikken er løst når du flytter inn i Midtbyen. " +
      "Du går ti minutter til Solsiden — Midtbyens største kjøpesenter, med dagligvare, klær, elektronikk og tjenester under ett tak. " +
      "Mer spesialisert handel ligger på Byhaven, med mote og delikatesse i egen karakter. " +
      "Frisører, apotek og velvære finner du spredt mellom kvartalene — alle innen ti minutters gange.",
    timings: hverdagslivReelsTimings,
  },
  opplevelser: {
    url: "/audio/stasjonskvartalet/opplevelser-reels.mp3",
    manus:
      "Stasjonskvartalet ligger midt i Trondheims kulturtetthet. " +
      "Fem minutter ned til Rockheim — det nasjonale museet for populærmusikk. " +
      "Innen ti minutters gange samler kunsthaller, museer og Cinemateket seg i sentrum. " +
      "Folkebiblioteket åpner som hverdagsmøteplass på veien. " +
      "Nidarosdomen og Stiftsgården ligger et kvarter unna til fots — et raskt møte med byens tusen års historie.",
    timings: opplevelserReelsTimings,
  },
  "trening-aktivitet": {
    url: "/audio/stasjonskvartalet/trening-aktivitet-reels.mp3",
    manus:
      "Trening og restitusjon ligger samlet rundt Stasjonskvartalet. " +
      "Noen få minutter unna ligger Stu — flytende badstuflåter på fjorden. " +
      "Britannia Spa har oppvarmet basseng, badstuer og behandlingsrom innen ti minutter. " +
      "Pirbadet dekker svømming og badeland for hele familien. " +
      "Og for den daglige treningen ligger flere 24-timers kjeder spredt i Midtbyen.",
    timings: treningAktivitetReelsTimings,
  },
  "barn-oppvekst": {
    url: "/audio/stasjonskvartalet/barn-oppvekst-reels.mp3",
    manus:
      "Som barnefamilie får du skole, park og lekeareal innenfor gangavstand fra Stasjonskvartalet. " +
      "Bispehaugen er nærmeste barneskole, ti minutter gjennom Midtbyen — med flere alternativer innen kort sykkeltur. " +
      "Trondheim katedralskole tar over for videregående — også ti minutter til fots. " +
      "Et halvt dusin parker ligger innen kort gange — fra grøntområder i sentrum til større familiearealer vestover.",
    timings: barnOppvekstReelsTimings,
  },
};

export function buildReelsCards(
  boardData: BoardData,
  introVideoSrc: string,
): ReelsCard[] {
  const cards: ReelsCard[] = [];

  cards.push({ kind: "intro", videoSrc: introVideoSrc });

  if (boardData.welcome && boardData.home.heroImage) {
    cards.push({
      kind: "welcome",
      label: "Velkommen",
      illustrationSrc: boardData.home.heroImage,
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
      audio: boardData.home.audio,
    });
  }

  boardData.categories
    .filter((c) => !!c.audio || !!CATEGORY_REELS_AUDIO[c.id])
    .forEach((c, idx) => {
      const audio = CATEGORY_REELS_AUDIO[c.id] ?? c.audio;
      if (!audio) return;
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
