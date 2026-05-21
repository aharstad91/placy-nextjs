"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import Image from "next/image";
import { useBoard } from "../board-state";
import type { BoardCategory, BoardCategoryId, BoardHome } from "../board-data";
import { useBoardActiveSection } from "@/lib/hooks/useBoardActiveSection";
import { BottomPlayer } from "../audio-tour/BottomPlayer";
import { SectionPlayButton } from "../audio-tour/SectionPlayButton";
import {
  useAudioTourPhase,
  useAudioTourSectionProgress,
} from "@/lib/stores/audio-tour-store";
import { KaraokePitchText } from "../audio-tour/KaraokePitchText";
import { CategoryFeaturedChips } from "../CategoryFeaturedChips";
import { CategoryIndex } from "../CategoryIndex";
import { SidebarHero } from "../SidebarHero";
import { QueueOverlay } from "../QueueOverlay";
import { getCategoryIllustrationSrc } from "@/lib/themes/category-illustrations";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { pickFeaturedPOIs } from "@/lib/board/featured-pois";

const FEATURED_CHIP_COUNT = 5;

const HOME_SECTION_ID = "home";

/**
 * Single continuous scroll panel. Hjem-seksjon (SidebarHero + CategoryIndex)
 * etterfølges av én seksjon per kategori med pitch-tekst og featured chips.
 * Scroll-tracking via useBoardActiveSection dispatcher SELECT_CATEGORY
 * {source:"scroll"} så kart-pins følger scroll-narrativet.
 *
 * Spotify-anatomi: top-hero har stor play-knapp som primær audio-tour-CTA.
 * Bottom-player rendres KUN under aktiv tour (idle/ended → null) — ingen
 * dobbel CTA. Per-kategori CategoryAudioButton lar bruker hoppe direkte til
 * ett spor; CategoryIndex øverst gir nav-snarvei til alle kategorier.
 *
 * Mobil-mounting: når BoardScrollPanel mountes inni mobile sheet, settes
 * mountBottomPlayer={false} så player kan mountes som scaffold-sibling
 * utenfor sheeten (alltid synlig, ikke følger med drag).
 */
interface BoardScrollPanelProps {
  /** Når false: hopp over inline BottomPlayer-rendring. Mobil bruker dette
   *  for å mounte player som fixed-bottom sibling i scaffold istedenfor.
   *  Default true (desktop-oppførsel uendret). */
  mountBottomPlayer?: boolean;
}

export function BoardScrollPanel({
  mountBottomPlayer = true,
}: BoardScrollPanelProps = {}) {
  const { data, state, dispatch } = useBoard();
  const containerRef = useRef<HTMLDivElement>(null);
  // Når true: vi animerer en programmatic scroll (audio/Home-RESET). IO vil
  // fyre på alle mellomliggende seksjoner mens scroll passerer, og uten denne
  // guarden ville scroll-tracking-effekten dispatche SELECT_CATEGORY for hver
  // av dem — som ville rocket target-seksjonen ut av sentrum og gitt overshoot.
  const programmaticScrollRef = useRef(false);

  const { activeSectionId, registerSectionRef } = useBoardActiveSection(
    containerRef,
    HOME_SECTION_ID,
  );

  // Scroll → state: bubble visible section into BoardContext. Deps inkluderer
  // KUN activeSectionId — effekten skal være enveis (scroll → state). Hadde
  // state.activeCategoryId vært i deps, ville effekten fyrt på eksterne
  // state-endringer (audio-tour-sync, player-jump) før IO rekker å oppdatere
  // activeSectionId, og dispatch'et basert på utdatert initial-activeSectionId
  // ("home") — som ville angret den eksterne endringen. Closure-capture leser
  // state.activeCategoryId ved fire-time uansett.
  useEffect(() => {
    if (programmaticScrollRef.current) return;
    if (!activeSectionId) return;
    if (activeSectionId === HOME_SECTION_ID) {
      if (state.activeCategoryId !== null) {
        dispatch({ type: "RESET_TO_DEFAULT" });
      }
      return;
    }
    if (activeSectionId !== state.activeCategoryId) {
      dispatch({
        type: "SELECT_CATEGORY",
        id: activeSectionId as BoardCategoryId,
        source: "scroll",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, dispatch]);

  // State → scroll: when activeCategoryId changes externally (audio-tour-sync,
  // BottomPlayer category-jump, Home-marker RESET), scroll the matching section
  // into view. programmaticScrollRef suppresses scroll-tracking dispatches
  // during the smooth-scroll animation.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targetId = state.activeCategoryId ?? HOME_SECTION_ID;
    if (targetId === activeSectionId) return;
    const target = container.querySelector<HTMLElement>(
      `[data-board-section="${CSS.escape(targetId)}"]`,
    );
    if (!target) return;

    programmaticScrollRef.current = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    // scrollend er ikke universelt støttet (Safari < 17.4 mangler det), så vi
    // har en setTimeout-fallback. Smooth scroll på normalt content tar typisk
    // 300–600ms; 900ms gir buffer for lange hopp.
    const clearGuard = () => {
      programmaticScrollRef.current = false;
    };
    const fallback = window.setTimeout(clearGuard, 900);
    const onScrollEnd = () => {
      window.clearTimeout(fallback);
      clearGuard();
      container.removeEventListener("scrollend", onScrollEnd);
    };
    container.addEventListener("scrollend", onScrollEnd);

    return () => {
      window.clearTimeout(fallback);
      container.removeEventListener("scrollend", onScrollEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeCategoryId]);

  // tour-mode-attribute for CSS body-dimming (tour-mode.css).
  const tourPhase = useAudioTourPhase();
  const tourActive = tourPhase === "playing" || tourPhase === "paused";

  return (
    <section
      aria-label="Nabolags-narrativ"
      data-tour-active={tourActive ? "true" : undefined}
      className="relative flex h-full w-full flex-col overflow-hidden bg-stone-50 lg:border-r lg:border-stone-200/80"
    >
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto pb-[40vh]"
        >
          <SidebarHero />
          <div className="flex flex-col gap-3 px-3 pt-3">
            <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
              <CategoryIndex />
            </div>
            <HomeSection
              home={data.home}
              scrollActive={state.activeCategoryId === null}
              registerRef={registerSectionRef(HOME_SECTION_ID)}
            />
            {data.categories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                scrollActive={state.activeCategoryId === cat.id}
                registerRef={registerSectionRef(cat.id)}
              />
            ))}
          </div>
        </div>
        {/* Soft fade i topp/bunn av scroll-flaten — gir 1.5-visible-rytmen
         *  myke kanter så tekst toner ut mot edge istedenfor å klippes. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-stone-50 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-stone-50 to-transparent"
        />
      </div>
      {mountBottomPlayer && <BottomPlayer />}
      <QueueOverlay />
    </section>
  );
}

/** Beregner data-section-state med scroll-fallback. Under aktiv tour vinner
 *  tour-progress (played|active|unplayed); ellers driver scroll alene
 *  (active|inactive). Speil av rail-prinsippet — uten tour er det scroll-
 *  posisjonen som signaliserer "her er du." */
function deriveSectionState(
  tourProgress: ReturnType<typeof useAudioTourSectionProgress>,
  scrollActive: boolean,
): "played" | "active" | "unplayed" | "inactive" {
  if (tourProgress !== null) return tourProgress;
  return scrollActive ? "active" : "inactive";
}

/** Felles header-anatomi for både Hjem og kategori-seksjoner — speiler
 *  `IndexRow` i CategoryIndex (illustrasjon + tittel + subline) så bruker
 *  gjenkjenner sporet både i spilleliste-indeksen og i selve seksjonen.
 *  Til høyre sitter `SectionPlayButton` der `IndexRow` har chevron — samme
 *  posisjon, samme "trykk for å spille av denne seksjonen"-affordanse. */
function SectionHeader({
  thumbnail,
  fallbackIcon: FallbackIcon,
  label,
  subline,
  playButton,
}: {
  thumbnail?: string;
  fallbackIcon?: ReturnType<typeof getFilledIcon>;
  label: string;
  subline: string;
  playButton: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      {(thumbnail || FallbackIcon) && (
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : FallbackIcon ? (
            <span className="flex h-full w-full items-center justify-center">
              <FallbackIcon className="h-7 w-7 text-stone-400" weight="fill" />
            </span>
          ) : null}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-xl font-bold leading-tight text-stone-900">
          {label}
        </h2>
        <span className="text-[12px] text-stone-500">{subline}</span>
      </span>
      {playButton}
    </div>
  );
}

/** Full-bredde cover-illustrasjon på toppen av kortet. 3:2-aspect for
 *  konsistent visuell vekt på tvers av kategorier. */
function CardCover({ src }: { src: string }) {
  return (
    <div className="relative aspect-[3/2] w-full bg-stone-100">
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 376px"
        className="object-cover"
      />
    </div>
  );
}

/** Hjem-seksjonen rendres som første "spor" i scroll-stream — på lik linje
 *  med kategori-seksjoner under indeksen. Karaoke-tekst aktiveres når Hjem-
 *  sporet spilles (auto-modus); ellers vises heroIntro som plain pitch. */
function HomeSection({
  home,
  scrollActive,
  registerRef,
}: {
  home: BoardHome;
  scrollActive: boolean;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const progress = useAudioTourSectionProgress("home");
  const isAudioActive = progress === "active";
  const sectionState = deriveSectionState(progress, scrollActive);
  const karaokeText = home.audio?.manus;
  const karaokeTimings = home.audio?.timings;

  return (
    <section
      id={HOME_SECTION_ID}
      data-board-section={HOME_SECTION_ID}
      data-section-state={sectionState}
      ref={registerRef}
      className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
    >
      {home.heroImage && <CardCover src={home.heroImage} />}
      <div className="flex flex-col px-6 py-6">
        <SectionHeader
          label="Nabolaget"
          subline={
            [home.district, home.city].filter(Boolean).join(", ") || "Velkomst"
          }
          playButton={<SectionPlayButton target={{ kind: "home" }} />}
        />
        {karaokeText ? (
          <KaraokePitchText
            text={karaokeText}
            timings={karaokeTimings}
            isActive={isAudioActive}
            className="mt-4 text-base leading-relaxed text-stone-800"
          />
        ) : (
          home.heroIntro && (
            <p
              data-board-body
              className="mt-4 text-base leading-relaxed text-stone-800"
            >
              {home.heroIntro}
            </p>
          )
        )}
      </div>
    </section>
  );
}

function CategorySection({
  category,
  scrollActive,
  registerRef,
}: {
  category: BoardCategory;
  scrollActive: boolean;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const { data, dispatch } = useBoard();
  const progress = useAudioTourSectionProgress(category.id);
  const isAudioActive = progress === "active";
  const sectionState = deriveSectionState(progress, scrollActive);
  const karaokeText = category.audio?.manus;
  const karaokeTimings = category.audio?.timings;
  const featuredPois = useMemo(
    () => pickFeaturedPOIs(category.pois, FEATURED_CHIP_COUNT, category.id),
    [category.pois, category.id],
  );
  const coverSrc = getCategoryIllustrationSrc(data.projectSlug, category.id);

  return (
    <section
      id={category.id}
      data-board-section={category.id}
      data-section-state={sectionState}
      ref={registerRef}
      className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
    >
      {coverSrc && <CardCover src={coverSrc} />}
      <div className="flex flex-col px-6 py-6">
        <SectionHeader
          fallbackIcon={coverSrc ? undefined : getFilledIcon(category.icon)}
          label={category.label}
          subline={`${category.pois.length} punkter`}
          playButton={
            <SectionPlayButton target={{ kind: "category", category }} />
          }
        />
        {karaokeText ? (
          <KaraokePitchText
            text={karaokeText}
            timings={karaokeTimings}
            isActive={isAudioActive}
            className="mt-4 text-base leading-relaxed text-stone-800"
          />
        ) : (
          <>
            {category.lead && (
              <p
                data-board-body
                className="mt-4 text-base leading-relaxed text-stone-800"
              >
                {category.lead}
              </p>
            )}
            {category.body && (
              <p
                data-board-body
                className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-stone-700"
              >
                {category.body}
              </p>
            )}
          </>
        )}
        {featuredPois.length > 0 && (
          <div className="mt-6">
            <CategoryFeaturedChips
              pois={featuredPois}
              category={category}
              onChipClick={(poi) =>
                dispatch({
                  type: "OPEN_POI",
                  id: poi.id,
                  categoryId: category.id,
                })
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
