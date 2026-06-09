"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Mail,
  Map as MapIcon,
  MapPin,
  Pause,
  Phone,
  Play,
  RotateCcw,
  User,
} from "lucide-react";
import { useReels } from "./reels-state";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";
import {
  firstAudioBearingIndex,
  isAudioBearing,
  posterForVideo,
} from "./reels-data";
import type { MeglerReelCard, ReelsCard } from "./reels-data";
import type { BoardCategoryId, BoardPOIId, BoardHome } from "../board/board-data";
import { useBoard } from "../board/board-state";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { POIRealtimeSection } from "../blocks/POIRealtimeSection";

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
 * Mobil-komponenten (ReelsStack + CardRouter-stack) er urørt og brukes
 * fortsatt <1024px.
 */

/** Lett-vekts kategori-data for den bla-bare oversikten (empty state). Bygd i
 *  ReportReelsPage fra boardData.categories. */
export interface SidebarPreviewCategory {
  id: string;
  label: string;
  color: string;
  count: number;
  lead?: string;
  image?: string;
  /** Nivå-2 (Bedre) kuratert detalj-innhold. Tilstedeværelse gjør temakortet til
   *  en drill-in: klikk åpner et detalj-panel som tar over scroll-området i
   *  stedet for kun å velge kategorien på kartet. Render-klart fra board-data. */
  editorial?: {
    body: string;
    image?: string;
    highlights: {
      id: string;
      name: string;
      enturStopplaceId?: string;
      bysykkelStationId?: string;
      hyreStationId?: string;
    }[];
  };
}

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
  /** Kategori-oversikt vist når prosjektet ikke har reels-lyd ennå (ingen
   *  audio-bærende kort). Da vises en bla-bar oversikt i stedet for spilleren. */
  previewCategories?: SidebarPreviewCategory[];
  /** D3: event-modus undertrykker megler/eiendoms-chrome (placeholder-footeren
   *  i empty-state). Boligrapporter sender ikke dette → footeren vises som før. */
  noBrokers?: boolean;
}

/**
 * Empty state: bla-bar nabolagsoversikt vist når prosjektet ikke har produsert
 * reels-lyd ennå. Bruker dataene som ALLEREDE finnes (temaer + POI-antall + lead)
 * og posisjonerer den fortalte lydturen som et kommende tillegg — i stedet for
 * et tomt, svart spiller-kort.
 */
export function SidebarContentPreview({
  categories,
  activeCategoryId,
  onSelect,
  onShowAll,
  onOpenPoi,
  noBrokers = false,
}: {
  categories: SidebarPreviewCategory[];
  activeCategoryId?: string | null;
  /** Klikk på et temakort → velg kategorien på board-et (cut-overlay + drone-
   *  flyvning + markør-filtrering). Aktiv kategori re-klikket → tilbake til overblikk. */
  onSelect?: (id: string) => void;
  /** Klikk på "Hele nabolaget" / tilbake-pil → reset board til overblikk (alle markører). */
  onShowAll?: () => void;
  /** Klikk på en highlight-chip i detalj-panelet → åpne POI på kartet (kameraet
   *  flyr til punktet). Kun relevant for nivå-2-kategorier. */
  onOpenPoi?: (poiId: string, categoryId: string) => void;
  /** D3: event-modus undertrykker megler-placeholder-footeren. Default false
   *  (boligrapport) → footeren vises som før. */
  noBrokers?: boolean;
}) {
  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const noneActive = !activeCategoryId;

  // Nivå-2 gating: er den aktive kategorien en med kuratert editorial? I så fall
  // tar detalj-panelet over scroll-området (megler-footeren under blir stående).
  // Uten editorial (nivå 1) viser vi index-lista som før — det aktive kortet
  // ringes bare som markering.
  const activeCat = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId)
    : undefined;
  const detail = activeCat?.editorial;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {detail ? (
        <CategoryDetailView
          category={activeCat!}
          detail={detail}
          onBack={onShowAll}
          onOpenPoi={onOpenPoi}
        />
      ) : (
        /* Scroll-område: "Hele nabolaget" (reset/overblikk) + kategori-kortene. */
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={onShowAll}
            aria-current={noneActive}
            className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-white/60 p-2.5 text-left transition-all duration-150 hover:bg-white ${
              noneActive
                ? "border-stone-900 ring-1 ring-stone-900"
                : "border-black/5 hover:border-stone-500 hover:ring-1 hover:ring-stone-500"
            }`}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
              <MapIcon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold text-stone-900">Hele nabolaget</p>
                <span className="shrink-0 text-[11px] font-medium text-stone-400">
                  {total} steder
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-stone-500">
                Vis alle steder på kartet
              </p>
            </div>
          </button>

          {categories.map((c) => {
            const isActive = activeCategoryId === c.id;
            const hasDetail = !!c.editorial;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect?.(c.id)}
                aria-current={isActive}
                className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-white/60 p-2.5 text-left transition-all duration-150 hover:bg-white ${
                  isActive
                    ? "border-stone-900 ring-1 ring-stone-900"
                    : "border-black/5 hover:border-stone-500 hover:ring-1 hover:ring-stone-500"
                }`}
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-200">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-stone-900">{c.label}</p>
                    <span className="shrink-0 text-[11px] font-medium text-stone-400">
                      {c.count} steder
                    </span>
                  </div>
                  {c.lead && (
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-stone-500">
                      {c.lead}
                    </p>
                  )}
                </div>
                {/* Nivå-2 affordans: chevron som markert MINI-KNAPP — innrammet
                    sirkel som fylles mørk + nudger på hover, så kortet leses som
                    klikkbart og åpner et detalj-panel. På et nivå-2-board har ALLE
                    kort kuratering (tier er per prosjekt), så denne er uniform. */}
                {hasDetail && (
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-stone-100 text-stone-500 ring-1 ring-black/5 transition-colors duration-150 group-hover:bg-stone-900 group-hover:text-white group-hover:ring-stone-900"
                  >
                    <ChevronRight size={16} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Author/megler — sticky i bunn av sidebaren (scroller ikke med kategori-
          lista). Nøytral placeholder, fylles per prosjekt. Speiler megler-kortets
          struktur (avatar + navn + Ring/E-post) i lys variant. D3: undertrykt i
          event-modus (events har ingen megler/eiendom). */}
      {!noBrokers && (
        <div className="shrink-0 border-t border-black/5 px-6 pb-6 pt-3">
          <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/60 p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-400">
              <User size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900">Ansvarlig megler</p>
              <p className="text-[12px] text-stone-400">Kontaktinfo legges til per prosjekt</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-200/70 px-3 py-1.5 text-[12px] font-semibold text-stone-400">
                  <Phone className="h-3.5 w-3.5" />
                  Ring
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-[12px] font-semibold text-stone-400">
                  <Mail className="h-3.5 w-3.5" />
                  E-post
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Nivå-2 drill-in: kuratert detalj-panel for én kategori. Tar over scroll-området
 * i empty-state-sidebaren mens megler-footeren under blir stående. Tilbake-pilen
 * sender tilbake til index-lista (reset board → alle markører). Highlight-chips er
 * klikkbare → POI åpnes på kartet (kameraet flyr dit).
 */
function CategoryDetailView({
  category,
  detail,
  onBack,
  onOpenPoi,
}: {
  category: SidebarPreviewCategory;
  detail: NonNullable<SidebarPreviewCategory["editorial"]>;
  onBack?: () => void;
  onOpenPoi?: (poiId: string, categoryId: string) => void;
}) {
  // Dobbelt linjeskift = nytt avsnitt; enkelt nivå er nok for kuratert tekst.
  const paragraphs = detail.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const heroImage = detail.image ?? category.image;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Tilbake-rad (standard nav-mønster) → index med alle kategorier. */}
      <button
        type="button"
        onClick={onBack}
        className="mb-3 -ml-1 inline-flex w-fit items-center gap-1.5 rounded-full px-1.5 py-1 text-[13px] font-semibold text-stone-600 transition hover:bg-black/5 hover:text-stone-900"
      >
        <ArrowLeft size={16} />
        Alle kategorier
      </button>

      {heroImage && (
        <div className="relative mb-4 h-44 w-full shrink-0 overflow-hidden rounded-2xl bg-stone-200">
          <Image
            src={heroImage}
            alt=""
            fill
            sizes="390px"
            className="object-cover object-center"
          />
        </div>
      )}

      <h3 className="text-lg font-bold leading-tight text-stone-900">{category.label}</h3>
      <p className="mt-0.5 text-[12px] font-medium text-stone-400">
        {category.count} steder i nærheten
      </p>

      {paragraphs.length > 0 && (
        <div className="mt-3 space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-stone-600">
              {p}
            </p>
          ))}
        </div>
      )}

      {detail.highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Verdt å merke seg
          </p>
          <div className="flex flex-col gap-2">
            {detail.highlights.map((h) => (
              <POIHighlightRow
                key={h.id}
                highlight={h}
                color={category.color}
                onOpen={() => onOpenPoi?.(h.id, category.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type HighlightItem = NonNullable<
  SidebarPreviewCategory["editorial"]
>["highlights"][number];

/**
 * En «Verdt å merke seg»-rad. Klikkbar header (åpner POI på kartet) + — for
 * transport-POI-er (buss/bysykkel/tog/bildeling) — en live sanntidstabell under,
 * samme data og komponent som kart-popupene bruker. For næringseiendom er
 * jobbreisen et kjøpsargument, så avgangstider rett i sidebaren er høy verdi.
 *
 * Ikke-transport-highlights rendrer kun header (sanntidsseksjonen returnerer
 * null), så raden ser ut som før utenfor transport-kategorien.
 */
function POIHighlightRow({
  highlight,
  color,
  onOpen,
}: {
  highlight: HighlightItem;
  color: string;
  onOpen: () => void;
}) {
  const isTransport = !!(
    highlight.enturStopplaceId ||
    highlight.bysykkelStationId ||
    highlight.hyreStationId
  );
  // Hooket er null-trygt: ikke-transport-rader poller ikke.
  const realtimeData = useRealtimeData(isTransport ? highlight : null);

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white/60 transition-colors duration-150 hover:border-stone-400 hover:bg-white">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          <MapPin size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-stone-800">
          {highlight.name}
        </span>
        <ChevronRight
          size={16}
          className="shrink-0 text-stone-300 transition-colors duration-150 group-hover:text-stone-600"
          aria-hidden
        />
      </button>
      {isTransport && (
        <div className="px-3 pb-2.5">
          <POIRealtimeSection realtimeData={realtimeData} />
        </div>
      )}
    </div>
  );
}

/** Poster/tittel for thumbnail-raden. Megler har ikke media → portrett brukes. */
function thumbView(card: ReelsCard): { title: string; image?: string } {
  switch (card.kind) {
    case "welcome":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "home":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "category":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "outro":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "megler":
      return { title: card.label, image: card.brokers[0]?.photoUrl };
    default:
      return { title: "" };
  }
}

/**
 * Sammenhengende fremdrifts-strek for HELE reelen, drevet av faktisk
 * avspillingstid — som en låt på Spotify. Track-lengdene (durationSec, avledet
 * synkront fra karaoke-timings) summeres til reelens totale lengde; baren fyller
 * (sum av spilte spor + tid i aktivt spor) / total, så den kryper jevnt på tvers
 * av alle kapitler i konstant sann-tids-fart. Mangler noen lengder faller vi
 * tilbake til like store segment per kapittel (fortsatt sømløst).
 *
 * STEG-MARKØRER: baren leses som ÉN 100 %-strek, men tynne (1,5px) vertikale
 * «notch»-streker i footer-fargen kutter den ved hver kategori-grense — en subtil
 * antydning om at løpet er kategori-inndelt, uten å splitte baren i separate
 * seksjoner. Grensene ligger på samme lengde-vektede punkter som fyllet bruker
 * (kumulativ andel av total varighet), så strek og fyll alltid flukter.
 *
 * SØMLØSHET (60 fps): <audio> sender bare `timeupdate` ~4 Hz (hver 250 ms), så å
 * binde bredden rett til `currentTime` gir 250 ms-steg. I stedet kjører en rAF-
 * loop som EKSTRAPOLERER posisjonen mellom samplene via wall-clock (estCt =
 * sist kjente currentTime + tid gått siden). Bredden settes IMPERATIVT på fill-
 * elementet — React har ingen width i JSX, så 4 Hz re-render rører den aldri og
 * vi slipper å re-rendre per frame. Hvert ekte timeupdate re-ankrer estimatet
 * (ingen drift); overshoot klampes til sporets lengde.
 *
 * Track-boundary: når et spor slutter holder desktop et lite "pust" der audio er
 * pauset og currentTime = 0 FØR trackIndex avanserer. Det ville gitt et synlig
 * tilbakehopp til kapittel-start; `heldRef` demper det ved å aldri la baren falle
 * så lenge vi står på (eller avanserer forbi) samme spor. Ekte tilbake-navigasjon
 * (klikk på tidligere kapittel → lavere trackIndex, eller re-start) slipper gjennom.
 */
function StoryProgressBar() {
  const { currentTime, duration } = useAudioElement();
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const tracks = useAudioTourStore((s) => s.tracks);
  const phase = useAudioTourStore((s) => s.phase);

  // Ferske verdier til rAF-loopen (bundet én gang) uten å re-binde hver render.
  const stateRef = useRef({ trackIndex, tracks, phase, duration });
  stateRef.current = { trackIndex, tracks, phase, duration };

  // Anker for ekstrapolering: siste kjente (currentTime, wall-clock). Re-ankres
  // ved hvert nytt sample + ved spor-/fase-skifte.
  const anchorRef = useRef({ ct: 0, wall: 0 });
  useEffect(() => {
    anchorRef.current = { ct: currentTime, wall: performance.now() };
  }, [currentTime, trackIndex, phase]);

  const heldRef = useRef({ trackIndex: -1, pct: 0 });
  const fillRef = useRef<HTMLDivElement | null>(null);
  // Sett 0% i commit (callback-ref kjører før paint) → ingen full-bredde-blink
  // før første rAF-frame. React styrer ikke bredden videre (ingen width i JSX).
  const setFill = useCallback((el: HTMLDivElement | null) => {
    fillRef.current = el;
    if (el) el.style.width = "0%";
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { trackIndex, tracks, phase, duration } = stateRef.current;
      const durs = tracks.map((t) => t.durationSec ?? 0);
      const curDur = durs[trackIndex] || duration || 0;
      // Estimert tid i aktivt spor: sist kjente currentTime + tid gått (kun mens
      // vi spiller). Klampes til sporets lengde så vi ikke overshooter.
      let estCt = anchorRef.current.ct;
      if (phase === "playing" && anchorRef.current.wall > 0) {
        estCt += (performance.now() - anchorRef.current.wall) / 1000;
      }
      const within = curDur > 0 ? Math.min(1, Math.max(0, estCt / curDur)) : 0;

      let pct = 0;
      if (phase === "ended") {
        pct = 100;
      } else if (tracks.length > 0) {
        if (durs.every((d) => d > 0)) {
          // Sann-tids-vekting: bar-posisjon = forløpt tid / total tid.
          const total = durs.reduce((s, d) => s + d, 0);
          const before = durs.slice(0, trackIndex).reduce((s, d) => s + d, 0);
          pct = Math.min(100, ((before + within * durs[trackIndex]) / total) * 100);
        } else {
          // Fallback: like store segment per kapittel når lengder mangler.
          pct = Math.min(100, ((trackIndex + within) / tracks.length) * 100);
        }
      }

      // Monoton guard mot track-boundary-tilbakehoppet (se komponent-doc).
      const held = heldRef.current;
      if (trackIndex >= held.trackIndex && pct < held.pct) pct = held.pct;
      heldRef.current = { trackIndex, pct };

      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Kategori-grenser som andel (0–1) av total — samme lengde-vekting som fyllet,
  // så notch-strekene flukter med der baren faktisk skifter kapittel. Beregnes i
  // render (billig). Hopper over 0 % og 100 % (kantene runder uansett av).
  const durs = tracks.map((t) => t.durationSec ?? 0);
  const weighted = durs.length > 1 && durs.every((d) => d > 0);
  const total = durs.reduce((s, d) => s + d, 0);
  const boundaries: number[] = [];
  if (tracks.length > 1) {
    let acc = 0;
    for (let i = 0; i < tracks.length - 1; i++) {
      acc += weighted ? durs[i] : 1;
      boundaries.push(weighted ? acc / total : (i + 1) / tracks.length);
    }
  }

  return (
    <div className="px-3 pt-3">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div ref={setFill} className="h-full rounded-full bg-white/90" />
        {/* Subtile steg-streker ved hver kategori-grense (footer-fargen kutter
            baren med en 1,5px notch). Ligger oppå fyllet så de vises både på
            spilt og uspilt del. */}
        {boundaries.map((frac, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-y-0 w-[1.5px] bg-[#1a1510]"
            style={{ left: `${frac * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DesktopStorySidebar({
  home,
  renderActiveCard,
  logoSrc,
  onLogoClick,
  previewCategories = [],
  noBrokers = false,
}: Props) {
  const { state, setActiveIndex, markAudioUnlocked } = useReels();
  const { state: boardState, dispatch: boardDispatch } = useBoard();
  const { unlock } = useAudioElement();
  const { pause, resume, goToTrack } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  // Empty-state (uten voice-over): klikk på et temakort velger kategorien på
  // board-et → cream cut-overlay + per-kategori drone-flyvning + markører
  // filtrert til kategorien. Klikk på aktiv kategori igjen → tilbake til
  // overblikk (alle markører). Source "rail" holder board-fasen "default".
  const handleSelectPreviewCategory = (id: string) => {
    if (boardState.activeCategoryId === id) {
      boardDispatch({ type: "RESET_TO_DEFAULT" });
    } else {
      boardDispatch({
        type: "SELECT_CATEGORY",
        id: id as BoardCategoryId,
        source: "rail",
      });
    }
  };

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
  const firstChapterImage = items[0] ? thumbView(items[0].card).image : undefined;

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
    <aside className="relative z-20 flex h-full w-[438px] shrink-0 flex-col border-r border-black/5 bg-[#f2e9dc] shadow-xl">
      {/* Header — logo (→ velkomst) + tittel. Ingen divider; ren look som skisse. */}
      <div className="shrink-0 px-6 pb-3 pt-6">
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
        <h2 className="text-xl font-bold leading-tight text-stone-900">
          {home.name}
        </h2>
        {subline && <p className="mt-0.5 text-sm text-stone-500">{subline}</p>}
      </div>

      {!hasPlayableContent ? (
        <SidebarContentPreview
          categories={previewCategories}
          activeCategoryId={boardState.activeCategoryId}
          noBrokers={noBrokers}
          onSelect={handleSelectPreviewCategory}
          onShowAll={() => boardDispatch({ type: "RESET_TO_DEFAULT" })}
          onOpenPoi={(poiId, categoryId) =>
            boardDispatch({
              type: "OPEN_POI",
              id: poiId as BoardPOIId,
              categoryId: categoryId as BoardCategoryId,
            })
          }
        />
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
          {activeIsIntro ? (
            firstChapterImage && (
              <Image
                src={firstChapterImage}
                alt=""
                fill
                sizes="372px"
                className="object-cover opacity-90"
              />
            )
          ) : (
            renderActiveCard(state.activeIndex)
          )}
          {/* State-drevet transport-overlay (erstatter knappen under kortet):
              spiller → skjult, vises som Pause ved hover; pauset/ferdig →
              vedvarende Play + scrim så kortet leses som ekte pauset. Kun på
              spillbare (audio-bærende) kort. */}
          {activeIsAudio && (
            <button
              type="button"
              onClick={handleToggle}
              aria-label={isPlaying ? "Pause" : isEnded ? "Spill av på nytt" : "Spill av"}
              className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300 ${
                isPlaying
                  ? "opacity-0 hover:opacity-100 focus-visible:opacity-100"
                  : "opacity-100"
              }`}
            >
              {!isPlaying && <span className="absolute inset-0 bg-black/30" />}
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/40 backdrop-blur-sm">
                {isPlaying ? (
                  <Pause size={26} className="fill-white text-white" />
                ) : isEnded ? (
                  <RotateCcw size={26} className="text-white" />
                ) : (
                  <Play size={26} className="translate-x-0.5 fill-white text-white" />
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
                            <Pause size={9} className="fill-white text-white" />
                          ) : isEnded ? (
                            <RotateCcw size={9} className="text-white" />
                          ) : (
                            <Play size={9} className="translate-x-px fill-white text-white" />
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
          KUN i player-løpet: empty-state (uten voice-over) har sin egen nøytrale
          megler-placeholder i SidebarContentPreview, så vi unngår dobbel footer. */}
      {hasPlayableContent && meglerCard && meglerCard.brokers.length > 0 && (
        <div className="shrink-0 border-t border-black/5 px-6 pb-6 pt-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {meglerCard.label}
          </p>
          <div className="flex flex-col gap-3">
            {meglerCard.brokers.map((broker) => (
              <div
                key={`${broker.name}-${broker.email}`}
                className="flex items-center gap-3"
              >
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
                  <span className="truncate text-sm font-semibold leading-tight text-stone-900">
                    {broker.name}
                  </span>
                  <span className="truncate text-[12px] text-stone-500">
                    {broker.title} · {broker.officeName}
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <a
                      href={`tel:${broker.phone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-stone-700"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Ring
                    </a>
                    <a
                      href={`mailto:${broker.email}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-[12px] font-semibold text-stone-800 transition hover:bg-black/5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      E-post
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
