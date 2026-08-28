"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Mail, Pause, Phone, Play, RotateCcw, User } from "lucide-react";
import { useReels } from "./reels-state";
import { StoryProgressBar } from "./StoryProgressBar";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";
import {
  firstAudioBearingIndex,
  isAudioBearing,
  thumbView,
} from "./reels-data";
import type { MeglerReelCard } from "./reels-data";
import type { BoardCategory, BoardHome } from "../board/board-data";
import { useBoard } from "../board/board-state";
import type { BrokerInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SIDEBAR_SECTION_TITLE } from "../board/sidebar-style";
import { StoryCard } from "../board/story/StoryCard";
import { StoryRail } from "../board/story/StoryRail";
import { AREA_STEP, useStoryTour } from "../board/story/story-tour";
import { EventFilterPanel } from "../board/event/EventFilterPanel";
import type { EventBoardFilterResult } from "@/lib/event-board/useEventBoardFilter";
import type { BoardCollectionApi } from "@/lib/event-board/use-board-collection";

/**
 * Desktop-adaptiv storytelling-lane (kun >=1024px, rendres fra
 * ResponsiveLayoutInner i ReportReelsPage).
 *
 * Player-modell (erstatter det gamle scroll-løpebåndet): ÉN aktiv chapter vises
 * stort i 9:16-kortet, og kategoriene komprimeres til en klikkbar thumbnail-rad
 * i bunn — en "spiller" der hele historien er synlig på én skjerm uten scroll.
 * Mål: dempe kognitiv last. I stedet for en stabel kort som beveger seg under
 * scroll (oppå video + kart-bevegelse + voice-over), skifter nå KUN det aktive
 * kort-komponentet ved kategori-bytte. Thumbnailene er statiske postere (ingen
 * autoplay), så raden i seg selv tilfører ingen bevegelse.
 *
 * Avspilling gjenbruker mobil-maskineriet 1:1:
 * - Det aktive kortet rendrer den ekte `CategoryReel`/`MeglerReel` via
 *   `renderActiveCard` (CardRouter desktopMode) → samme video/karaoke-VO som
 *   mobil-feeden. Ingen endring i de delte komponentene.
 * - "Start/Fortsett"-knappen låser opp audio (samme `unlock()`-gesture som
 *   IntroReel) og setter activeIndex; `useReelsAudioOrchestration` driver touren.
 * - Auto-advance håndteres i ReelsAudioShell.handleTrackEnded (desktop).
 *
 * Uten spillbar lyd er kolonnen OMVISNINGEN (`StoryColumn`) — se doccen der.
 *
 * Mobil-komponenten (ReelsStack + CardRouter-stack) er urørt og brukes
 * fortsatt <1024px.
 */

/**
 * Kolonnens geometri. Eksportert fordi KARTET må kjenne den: sidebaren ligger
 * som et flytende panel OPPÅ et kart i full bredde (Apple Maps-modellen), så
 * kartet fortsetter bak panelet og til syne i luften rundt det. `OCCLUSION_PX`
 * er bredden pluss luften på begge sider — tallet `mapPaddingLeft` trenger for
 * at innrammingen skal treffe det brukeren FAKTISK ser, ikke midten av et lerret
 * der en tredjedel er dekket.
 *
 * Bunnluften er større enn resten, og det er ikke en smaksavgjørelse: Googles
 * attribusjon er låst i kartelementets nederste venstre hjørne og kan ikke
 * flyttes (vilkårene). Med panelet like langt ned som til sidene ville den
 * havnet bak det. Stripen under panelet er der for at den skal være synlig.
 */
export const SIDEBAR_WIDTH_PX = 438;
export const SIDEBAR_GUTTER_PX = 14;
export const SIDEBAR_GUTTER_BOTTOM_PX = 52;
export const SIDEBAR_OCCLUSION_PX = SIDEBAR_WIDTH_PX + SIDEBAR_GUTTER_PX * 2;

interface Props {
  home: BoardHome;
  /** Rendrer det aktive kortets media (video/bilde-bg + karaoke-VO, eller
   *  megler-kort). Gjenbruk av CardRouter i desktopMode — samme presentasjon
   *  som mobil. */
  renderActiveCard: (cardIndex: number) => React.ReactNode;
  /** Prosjekt-logo (SVG). Vises klikkbar i header → re-åpner velkomst-splash. */
  logoSrc?: string;
  /** Trykk på logo → animer splash-laget inn igjen (ingen refresh). */
  onLogoClick?: () => void;
  /** D3: event-modus undertrykker megler/eiendoms-chrome (megler-kortet i
   *  omvisningens kolonne). Boligrapporter sender ikke dette → kortet vises. */
  noBrokers?: boolean;
  /** Unit 4: event-board filter-resultat. Når satt (event-modus) rendres
   *  EventFilterPanel (tema/dag/tid-chips + dato-seksjonert liste + tomtilstand)
   *  i stedet for omvisningen. Null/undefined for boligrapporter. */
  eventFilter?: EventBoardFilterResult | null;
  /** Board-kategoriene — gir EventFilterPanel tema-chip-etiketter/farger. */
  categories?: BoardCategory[];
  /** Unit 5: "Min samling"-søm. Når satt får EventFilterPanel lagre-toggle per
   *  rad + samling-affordance. Null/undefined for boligrapporter. */
  collection?: BoardCollectionApi | null;
  /** Unit 5: åpne samling-draweren (del-URL/QR). */
  onOpenCollection?: () => void;
}

/**
 * Kolonnen på et board uten spillbar lyd: OMVISNINGEN, alltid (2026-08-27).
 *
 * ## Hva som ble borte, og hvorfor
 *
 * Her sto en indeks: «Hele nabolaget»-kortet, ett temakort per kategori med
 * illustrasjon og lead, boardets FAQ, og et drill-in-panel per tema med prosa,
 * «Verdt å merke seg», utsnitts-scopet stedsliste og temavelger. Omvisningen lå
 * OVER den som et valg, og tilbake-pilen i hodet førte hit.
 *
 * De to flatene gjorde samme jobb (Andreas, 2026-08-27): omvisningen ER en
 * versjon 2 av den beige indeksen — samme innhold, strammere rekkefølge, og med
 * kartet som medspiller i stedet for som illustrasjon ved siden av. To flater
 * som gjør samme jobb betyr to steder å vedlikeholde og et valg leseren ikke har
 * grunnlag for å ta. Indeksen er derfor slettet, og med den tilbake-pilen: det
 * finnes ikke lenger noe å gå tilbake TIL.
 *
 * Det ene indeksen kunne som omvisningen ikke kunne — å snakke om STEDET selv,
 * ikke om et tema i det — ligger nå som rekkefølgens første brikke
 * (`AREA_STEP`): strøkets navn, dekningen i tall, og strøkets egne spørsmål og
 * svar.
 *
 * MOBIL er urørt. Der ligger indeksen fortsatt bak «Avslutt», fordi flaten er en
 * sheet over kartet og ikke en kolonne ved siden av det: nabolagslista er
 * utsnitts-styrt og ER hovedflaten der.
 *
 * ## Hvorfor omvisningen startes av en effekt
 *
 * Fordi tilstanden er delt med mobil. Provideren ligger over BEGGE flatene, og
 * mobil trenger fortsatt av-tilstanden (indeksen sin). Kolonnen sier derfor at
 * DEN er omvisningen ved å slå den på når den monteres — og igjen hvis noe
 * skulle slå den av. Ankomsten er områdestoppet, ikke første tema: det er
 * overblikket, og det var det indeksen viste.
 */
export function StoryColumn({ noBrokers = false }: { noBrokers?: boolean }) {
  const { available, on, begin } = useStoryTour();

  useEffect(() => {
    if (available && !on) begin(AREA_STEP);
  }, [available, on, begin]);

  // `pt-0`: et festet element kan ikke gå OVER sin egen containing block, så med
  // kolonnens vanlige topp-padding festet hodet seg like langt ned — og i den
  // stripen så man innholdet gli forbi over det.
  return (
    <div
      data-testid="story-sidebar"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-10 pt-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <StoryCard
        variant="column"
        head={<StoryRail variant="flow" />}
        footer={!noBrokers ? <MeglerFooterCard /> : undefined}
      />
    </div>
  );
}

/**
 * Ansvarlig megler — SIST i scroll-innholdet, ikke pinnet: som sticky footer
 * stjal den vertikal plass fra innholdet hele tiden den var synlig (Andreas,
 * 2026-08-24, gjentatt 2026-08-27 for omvisningens kolonne).
 *
 * Ekte megler når prosjektet har en; ellers en nøytral plassholder med samme
 * struktur, så plassen kortet tar er den samme før og etter at kontaktinfoen er
 * fylt ut. D3: undertrykt i event-modus (events har ingen megler/eiendom) —
 * gaten (`noBrokers`) ligger hos kallstedet.
 */
function MeglerFooterCard() {
  const { data } = useBoard();
  const brokers = data.brokers ?? [];

  return (
    <div className="-mx-6 mt-5 shrink-0 border-t border-stone-200 px-6 pb-3 pt-5">
      <p className={cn("mb-3", SIDEBAR_SECTION_TITLE)}>Ansvarlig megler</p>
      {brokers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {brokers.map((broker) => (
            <BrokerContactRow
              key={`${broker.name}-${broker.email}`}
              broker={broker}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-stone-300/80 bg-white p-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-500">
            <User size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-stone-500">
              Kontaktinfo legges til per prosjekt
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-200/70 px-3.5 py-2 text-[13px] font-semibold text-stone-500">
                <Phone className="h-4 w-4" />
                Ring
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-2 text-[13px] font-semibold text-stone-500">
                <Mail className="h-4 w-4" />
                E-post
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Én megler: bilde, navn, tittel · kontor, og Ring/E-post som ekte
 *  `tel:`/`mailto:`-lenker. Delt mellom omvisningens kolonne og player-løpets
 *  kontakt-footer, så de to aldri drifter fra hverandre. */
function BrokerContactRow({ broker }: { broker: BrokerInfo }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-stone-200">
        {broker.photoUrl && (
          <Image
            src={broker.photoUrl}
            alt={broker.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-semibold leading-tight text-stone-900">
          {broker.name}
        </span>
        <span className="truncate text-[14px] text-stone-600">
          {broker.title} · {broker.officeName}
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`tel:${broker.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-700"
          >
            <Phone className="h-4 w-4" />
            Ring
          </a>
          <a
            href={`mailto:${broker.email}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-2 text-[13px] font-semibold text-stone-800 transition hover:bg-black/5"
          >
            <Mail className="h-4 w-4" />
            E-post
          </a>
        </div>
      </div>
    </div>
  );
}

export function DesktopStorySidebar({
  home,
  renderActiveCard,
  logoSrc,
  onLogoClick,
  noBrokers = false,
  eventFilter = null,
  categories = [],
  collection = null,
  onOpenCollection,
}: Props) {
  const { state, setActiveIndex, markAudioUnlocked } = useReels();
  const { unlock } = useAudioElement();
  const { pause, resume, goToTrack } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  // Thumbnail-raden viser alle chapters unntatt intro-video-splashen, megler
  // og det visuelle summary-kortet. Megler er trukket ut til en konstant
  // kontakt-footer nederst (vises alltid); summary-kortet er en mobil-finale
  // og surfaces ikke i desktop-løpebåndet (desktop-recap er outro-sporet).
  const items = state.cards
    .map((card, index) => ({ card, index }))
    .filter(
      ({ card }) =>
        card.kind !== "intro" &&
        card.kind !== "megler" &&
        card.kind !== "summary",
    );

  const meglerCard = state.cards.find(
    (card): card is MeglerReelCard => card.kind === "megler",
  );

  const subline = [home.district, home.city].filter(Boolean).join(", ");
  const isPlaying = phase === "playing";
  // Hele reelen ferdigspilt (siste spor slutt → store-fase "ended"): vis et
  // replay-ikon i transport-overlayet i stedet for Play. Klikk restarter fra
  // første kapittel (handleToggle håndterer "ended" → setActiveIndex+goToTrack).
  const isEnded = phase === "ended";
  const firstIdx = firstAudioBearingIndex(state.cards);
  // Ingen audio-bærende kort = prosjektet har ikke produsert reels-lyd ennå.
  // Da vises den bla-bare oversikten i stedet for det (tomme) spiller-kortet.
  const hasPlayableContent = firstIdx !== -1;
  // "Ikke startet" dekker to tilfeller: (1) audio aldri unlocket, og (2) audio
  // unlocket via klikk på et ikke-audio-kort (megler/intro) uten at touren
  // faktisk startet — da står phase fortsatt "idle". Begge skal vise "Start".
  const notStarted = !state.audioUnlocked || phase === "idle";

  const activeCard = state.cards[state.activeIndex];
  // Før touren starter peker activeIndex på intro (splash dekker sidebaren da).
  // Vis et rolig stillbilde av første chapter i kort-arealet i stedet for å
  // (auto)spille intro-videoen bak splashen.
  const activeIsIntro = !activeCard || activeCard.kind === "intro";
  const activeIsAudio = !!activeCard && isAudioBearing(activeCard);
  const firstChapterImage = items[0]
    ? thumbView(items[0].card).image
    : undefined;

  // Hvilken av de tre kolonnene dette er. Chromen (flatefarge + om adressen står
  // i headeren) leser DENNE og ikke omvisningens `on`: omvisningen slås på av en
  // effekt inne i `StoryColumn`, og i frame-en før den hadde panelet ellers
  // rukket å blinke beige.
  const showStoryColumn = !eventFilter && !hasPlayableContent;

  // Hold det aktive chapter-thumbnailet synlig i raden når storien avanserer
  // (klikk eller auto-advance) — sentrer det horisontalt.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [state.activeIndex]);

  const activateCard = async (index: number) => {
    if (!state.audioUnlocked) {
      await unlock();
      markAudioUnlocked();
    }
    setActiveIndex(index);
  };

  // Samlet transport-toggle. Drevet av klikk på selve kort-overlayet (knappen
  // under kortet er fjernet): pause/resume/replay avhengig av state.
  const handleToggle = () => {
    if (notStarted) {
      if (firstIdx !== -1) void activateCard(firstIdx);
      return;
    }
    if (isPlaying) {
      pause("manual");
    } else if (phase === "ended") {
      // Restart fra første kapittel. setActiveIndex flytter ankeret tilbake;
      // goToTrack(0) garanterer at audio-touren faktisk re-spiller.
      if (firstIdx !== -1) setActiveIndex(firstIdx);
      goToTrack(0);
    } else {
      resume();
    }
  };

  return (
    // Presentasjonsmodus har HVIT flate: fortellingen er forgrunnen, ikke et
    // kort som ligger på en beige bunn. Det skal dessuten være samme flate på
    // begge bredder — ikke krem på den ene og hvit på den andre.
    <aside
      style={{ width: SIDEBAR_WIDTH_PX }}
      className={cn(
        // Flytende panel, ikke en vegg: kartet ligger i full bredde under og
        // fortsetter bak panelet og ut i luften rundt det. Derfor radius og ring
        // i stedet for en kant mot kartet, og derfor en flate som slipper litt
        // av kartet gjennom — `backdrop-blur` holder teksten lesbar mens
        // satellittbildet beveger seg bak den.
        "relative z-20 flex h-full shrink-0 flex-col overflow-hidden rounded-[26px]",
        "ring-1 ring-black/5 shadow-[0_18px_50px_-12px_rgba(28,25,23,0.35)] backdrop-blur-xl",
        showStoryColumn ? "bg-white/[0.93]" : "bg-[#f2e9dc]/[0.94]",
      )}
    >
      {/* Header — logo (→ velkomst) + tittel. Ingen divider; ren look som skisse.
          I omvisningen faller adressen bort: den står i annonsen og i fanen, og
          her tok den to linjer over spørsmålet og gjorde stoppet til andrelinje
          i sitt eget kort. Logoen blir stående — den er kundens merke, ikke en
          overskrift. */}
      <div
        className={cn(
          "shrink-0 px-6",
          showStoryColumn ? "pb-2 pt-5" : "pb-3 pt-6",
        )}
      >
        {logoSrc && (
          <button
            type="button"
            onClick={onLogoClick}
            aria-label="Tilbake til velkomst"
            className="mb-4 block transition-opacity hover:opacity-70"
          >
            <Image
              src={logoSrc}
              alt={home.name}
              width={132}
              height={51}
              unoptimized
              className="h-[54px] w-auto"
            />
          </button>
        )}
        {!showStoryColumn && (
          <>
            <h2 className="text-xl font-bold leading-tight text-stone-900">
              {home.name}
            </h2>
            {subline && (
              <p className="mt-0.5 text-sm text-stone-500">{subline}</p>
            )}
          </>
        )}
      </div>

      {eventFilter ? (
        /* Unit 4: event-modus → filter-panel (tema/dag/tid + dato-seksjonert
           liste + tomtilstand). Erstatter både SidebarContentPreview og
           player-løpet — events har ingen audio og er filter-drevet. */
        <EventFilterPanel
          filter={eventFilter}
          categories={categories}
          collection={collection}
          onOpenCollection={onOpenCollection}
        />
      ) : showStoryColumn ? (
        <StoryColumn noBrokers={noBrokers} />
      ) : (
        <>
          {/* Reel + player som ÉN sammenhengende card — INGEN gap mellom dem. Den ytre
          wrapperen eier radius og skygge for HELE enheten (overflow-hidden runder
          begge ender); den mørke reelen ligger øverst (flex-1) og den mørke
          player-footeren limt rett under. mx-6 flukter med logo/tittel. */}
          <div className="mx-6 mb-4 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-lg">
            {/* Reel-arealet — mørkt, fyller resten av høyden. Topphjørnene avrundes av
            wrapperens overflow-hidden; bunnen er rett og møter playeren sømløst. */}
            <div className="group relative min-h-0 flex-1 bg-black">
              {activeIsIntro
                ? firstChapterImage && (
                    <Image
                      src={firstChapterImage}
                      alt=""
                      fill
                      sizes="372px"
                      className="object-cover opacity-90"
                    />
                  )
                : renderActiveCard(state.activeIndex)}
              {/* State-drevet transport-overlay (erstatter knappen under kortet):
              spiller → skjult, vises som Pause ved hover; pauset/ferdig →
              vedvarende Play + scrim så kortet leses som ekte pauset. Kun på
              spillbare (audio-bærende) kort. */}
              {activeIsAudio && (
                <button
                  type="button"
                  onClick={handleToggle}
                  aria-label={
                    isPlaying
                      ? "Pause"
                      : isEnded
                        ? "Spill av på nytt"
                        : "Spill av"
                  }
                  className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300 ${
                    isPlaying
                      ? "opacity-0 hover:opacity-100 focus-visible:opacity-100"
                      : "opacity-100"
                  }`}
                >
                  {!isPlaying && (
                    <span className="absolute inset-0 bg-black/30" />
                  )}
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/40 backdrop-blur-sm">
                    {isPlaying ? (
                      <Pause size={26} className="fill-white text-white" />
                    ) : isEnded ? (
                      <RotateCcw size={26} className="text-white" />
                    ) : (
                      <Play
                        size={26}
                        className="translate-x-0.5 fill-white text-white"
                      />
                    )}
                  </span>
                </button>
              )}
            </div>

            {/* Player-footer — mørk seksjon limt RETT under reelen (samme card, ingen
            gap). "Dark mode": footeren leses som én enhet med den svarte reelen,
            men en varm near-black (#1a1510, et hakk lysere enn reelens #000) gjør
            at den fortsatt fremstår som en hevet player-flate. Kategori-navn og
            n/total-teller er fjernet for et renere, mer integrert uttrykk — progress-
            streken og thumbnail-raden deler samme side-padding så alt flukter. */}
            <div className="shrink-0 bg-[#1a1510]">
              {/* Progress — avrundet strek inni playeren, med samme side-padding (px-3)
              som thumbnail-raden under så de flukter. Drevet av faktisk avspillingstid
              over HELE reelen (Spotify-stil sammenhengende fyll); se StoryProgressBar. */}
              <StoryProgressBar />

              {/* Player-rad — thumbnails tett under progress-streken. KUN den indre raden
              scroller (overflow-x-auto klipper y). Kategori-navn vises via native
              `title` på hover (ingen styled boble → ingen klipping/død plass mot den
              tette layouten). Fade-overlays på begge kanter toner mot bakgrunnen. */}
              <div className="relative">
                <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {items.map(({ card, index }) => {
                    const view = thumbView(card);
                    const isActive = state.activeIndex === index;
                    return (
                      <button
                        key={index}
                        ref={isActive ? activeThumbRef : undefined}
                        type="button"
                        onClick={() => void activateCard(index)}
                        aria-label={view.title}
                        title={view.title}
                        aria-current={isActive}
                        className={`relative h-14 w-14 shrink-0 snap-center rounded-xl transition-all duration-300 ${
                          isActive
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a1510]"
                            : "opacity-55 hover:opacity-90"
                        }`}
                      >
                        <span className="absolute inset-0 overflow-hidden rounded-xl">
                          {view.image ? (
                            <Image
                              src={view.image}
                              alt=""
                              fill
                              sizes="56px"
                              // De statiske poster-/illustrasjons-JPG-ene er allerede
                              // små; å sende dem gjennom next/image-optimizeren for en
                              // 56px-thumbnail gir ingen visuell gevinst og lar dev-
                              // optimizeren deadlocke ved samtidige on-demand-kall (de
                              // siste i køen henger → blanke thumbnails). Server filen
                              // direkte i stedet — robust i både dev og prod.
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <span className="absolute inset-0 bg-stone-700" />
                          )}
                          {/* Aktiv-markør: liten play/pause-dot nede til høyre. */}
                          {isActive && (
                            <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-900/80">
                              {isPlaying ? (
                                <Pause
                                  size={9}
                                  className="fill-white text-white"
                                />
                              ) : isEnded ? (
                                <RotateCcw size={9} className="text-white" />
                              ) : (
                                <Play
                                  size={9}
                                  className="translate-x-px fill-white text-white"
                                />
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Fade-out mot footer-bakgrunnen på begge kanter — dekker hele thumbnail-
                båndet (inset-y-0). Matcher den mørke footer-tonen. */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#1a1510] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#1a1510] to-transparent" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Konstant kontakt-footer — megler vises alltid nederst (ikke gjemt som
          siste thumbnail). Ring/E-post er direkte tel:/mailto:-lenker, så den
          fungerer uavhengig av reel-spilleren. Lyst tema som matcher sidebaren.
          KUN i player-løpet: omvisningens kolonne har sitt eget megler-kort sist
          i scrollen (ikke pinnet), så vi unngår dobbel footer. */}
      {hasPlayableContent && meglerCard && meglerCard.brokers.length > 0 && (
        <div className="shrink-0 border-t border-stone-200 px-6 pb-6 pt-4">
          <p className={cn("mb-3", SIDEBAR_SECTION_TITLE)}>
            {meglerCard.label}
          </p>
          <div className="flex flex-col gap-3">
            {meglerCard.brokers.map((broker) => (
              <BrokerContactRow
                key={`${broker.name}-${broker.email}`}
                broker={broker}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
