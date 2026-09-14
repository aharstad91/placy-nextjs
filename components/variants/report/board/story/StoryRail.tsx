"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { cn } from "@/lib/utils";
import { AREA_RAIL_LABEL } from "./story-model";
import { AREA_STEP, useStoryTour } from "./story-tour";

/**
 * Transporten: kategorinavnene som én tab-rad.
 *
 * Seks anonyme streker fortalte HVOR MANGE, ikke HVA. Med navnene i raden
 * fortelles begge samtidig: du ser hvor du er, hva du har vært gjennom, og —
 * viktigst — hva som kommer, uten at noe annet må si det.
 *
 * ## Raden vises ikke på områdestoppet (2026-09-05)
 *
 * Der er brukeren ikke inne i rekkefølgen ennå, og seks brikker i en rad ingen
 * har introdusert leste ikke som et valg. Temaene står i stedet som et rutenett
 * i innholdet (`StoryThemeGrid`); raden kommer inn når et tema er valgt.
 *
 * ## «Tilbake» er en EGEN knapp, temaene ruller ved siden av (2026-09-14)
 *
 * Raden er to ting som står ved siden av hverandre: en rund tilbakeknapp til
 * venstre, og en avrundet flate med temaene ved siden av. Slik Chrome legger
 * tilbakepilen som egen knapp utenfor adressefeltet. Før lå utgangen som første
 * brikke INNE i den samme flaten som temaene, og da leste den som et syvende
 * tema med et annet ord på.
 *
 * Knappen står fast, og bare temaene ruller. Etter at rutenettet overtok
 * inngangen er den den ENESTE veien tilbake, og en eneste vei ut kan ikke
 * ligge bak en horisontal scroll (Andreas, 2026-09-05: «på en desktop mus …
 * så da må den ligge sticky left og alltid være tilgjengelig, så resten av
 * kategoriene slides horisontalt under den»). En Magic Mouse sveiper sidelengs
 * like lett som en telefon; en vanlig mus gjør det ikke.
 *
 * Den bærer bare pilen. Ordet «Tilbake» er knappens tilgjengelige navn
 * (`AREA_RAIL_LABEL`), ikke en etikett: pilen alene er nok når knappen står
 * for seg selv, og uten etikett får temaene bredden.
 *
 * Til høyre er det plass til en tilsvarende egen knapp senere («mer»). Den
 * kommer inn som `trailing`, og finnes ikke i DOM før noen sender den: en tom
 * eller uvirksom knapp er verre enn ingen.
 *
 * ## De to variantene
 *
 * `deck` er MOBIL: raden ligger i et fast dekk i rammens underkant, der
 * tommelen er, og står stille mens innholdet scroller. Den svømmer over
 * innholdet, og har derfor slør og skygge.
 *
 * `flow` er DESKTOP: der er underkanten det punktet som er lengst unna både
 * blikket og pekeren, mens toppen er der en kolonne begynner. Raden sendes
 * derfor inn i `StoryCard`s festede hode (`head`) og står der sammen med
 * spørsmålet og svarformene — ett feste, og innholdet renner under hodets egen
 * bunn. En lys grå, avrundet flate samler brikkene i én kategorivelger.
 */
export function StoryRail({
  variant,
  trailing,
}: {
  variant: "deck" | "flow";
  /** Egen knapp til høyre for temaene (f.eks. «mer»). Rendres bare når satt. */
  trailing?: React.ReactNode;
}) {
  const { stops, step, goto, onArea } = useStoryTour();
  const trackRef = useRef<HTMLDivElement | null>(null);
  /* Første posisjonering er en PLASSERING, ikke en bevegelse. Se hooken under. */
  const mountedRef = useRef(false);
  /* Har sporet mer innhold utenfor hver kant? Styrer toningene — se `edgeMask`. */
  const [edges, setEdges] = useState({ left: false, right: false });

  const readEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({
      left: track.scrollLeft > 2,
      right: track.scrollLeft < max - 2,
    });
  }, []);

  // Raden forskyver seg i takt med fortellingen: det aktive stoppet legges mot
  // venstre kant, men ikke helt inntil — 44 px igjen til det forrige navnet, så
  // raden viser at den har en bakside. Det er progresjonen, uttrykt som
  // bevegelse i stedet for som et tall.
  //
  // MEN første gang raden monteres skal den ikke bevege seg i det hele tatt:
  // der kommer den inn som svaret på et trykk i rutenettet, og en rad som
  // ruller bortover i det den dukker opp leser som at noe river seg løs
  // (Andreas, 2026-09-05: «jeg ser at tab-cat da scroller bortover raskt som en
  // slags anchor effekt … det må skje før den vises»). Sporet har
  // `scroll-behavior: smooth` i CSS, som gjelder tilordninger av `scrollLeft`
  // også — den slås derfor av for akkurat den første. `useLayoutEffect` og ikke
  // `useEffect`: plasseringen må være gjort FØR nettleseren tegner, ellers ser
  // man ett bilde av raden i utgangsposisjon.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const btn = track?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!track) return;
    if (btn) {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const left = Math.min(Math.max(0, btn.offsetLeft - 44), max);
      if (mountedRef.current) {
        track.scrollLeft = left;
      } else {
        mountedRef.current = true;
        const smooth = track.style.scrollBehavior;
        track.style.scrollBehavior = "auto";
        track.scrollLeft = left;
        track.style.scrollBehavior = smooth;
      }
    }
    readEdges();
  }, [step, readEdges]);

  if (onArea) return null;

  /**
   * Toningene i sporets kanter, som en maske på innholdet i stedet for som en
   * flate oppå det: baren er halvgjennomsiktig på mobil, og en gradient malt i
   * barens «egen» farge ville ikke truffet den.
   *
   * Bare der det FAKTISK ligger mer: en tone i venstre kant mens sporet står
   * ved starten sier at noe er gjemt der, og det er ikke sant.
   */
  const edgeMask = `linear-gradient(to right, ${
    edges.left ? "transparent 0px" : "#000 0px"
  }, #000 16px, #000 calc(100% - 18px), ${
    edges.right ? "transparent 100%" : "#000 100%"
  })`;

  return (
    <div
      className={cn(
        "relative flex items-center gap-2",
        variant === "deck" ? "px-3.5 pb-2 pt-1.5" : "shrink-0",
        variant === "deck" ? "story-enter-first-up" : "story-enter-first",
      )}
    >
      {/* Utgangen: egen rund knapp, utenfor flaten med temaene. Mørk og
          nøytral, ikke en temafarge — den er ikke et tema. */}
      <button
        type="button"
        onClick={() => goto(AREA_STEP)}
        aria-label={AREA_RAIL_LABEL}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-900",
          "transition-colors duration-200 hover:bg-black/[0.09]",
          variant === "deck"
            ? "bg-[rgba(252,251,250,0.72)] shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_6px_22px_rgba(28,25,23,0.13)] backdrop-blur-md [backdrop-filter:blur(12px)_saturate(1.7)]"
            : "bg-black/[0.045]",
        )}
      >
        <ArrowLeft size={18} strokeWidth={2.4} />
      </button>
      <div
        role="tablist"
        aria-label="Stopp"
        className={cn(
          "flex min-w-0 flex-1 items-stretch rounded-[22px] p-1",
          variant === "deck"
            ? "bg-[rgba(252,251,250,0.72)] shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_6px_22px_rgba(28,25,23,0.13)] backdrop-blur-md [backdrop-filter:blur(12px)_saturate(1.7)]"
            : "bg-black/[0.045]",
        )}
      >
        <div
          ref={trackRef}
          role="presentation"
          onScroll={readEdges}
          style={{ maskImage: edgeMask, WebkitMaskImage: edgeMask }}
          className={cn(
            "relative flex min-w-0 flex-1 flex-nowrap items-stretch gap-0.5",
            "overflow-x-auto overflow-y-hidden",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "[overscroll-behavior-x:contain] [scroll-behavior:smooth]",
          )}
        >
          {stops.map((c, n) => (
            <RailChip
              key={c.id}
              label={c.label}
              Icon={getIcon(c.icon)}
              color={c.color}
              active={n === step}
              past={n < step}
              onClick={() => goto(n)}
            />
          ))}
        </div>
      </div>
      {trailing}
    </div>
  );
}

/** Ett tema i raden: ikon i temaets farge over navnet. */
function RailChip({
  label,
  Icon,
  color,
  active,
  past = false,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  color: string;
  active: boolean;
  /** Passert i rekkefølgen — teksten mørkner litt. */
  past?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-current={active}
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 flex-col items-center gap-[3px] rounded-[18px] px-[11px] pb-[7px] pt-1.5",
        "whitespace-nowrap text-[11px] font-semibold tracking-[-0.01em]",
        "transition-colors duration-200",
        active
          ? "bg-white text-stone-900 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_1px_3px_rgba(28,25,23,0.1)]"
          : past
            ? "text-stone-600"
            : "text-stone-500",
      )}
    >
      {/* Ikonene står i FULL farge uansett tilstand: å dempe dem gjorde
          progresjonen lesbar og kategoriene uleselige — og raden er først og
          fremst et sted du skal finne fram i. Progresjonen ligger derfor bare i
          teksten. */}
      <span
        aria-hidden
        className="flex h-[22px] shrink-0 items-center justify-center"
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <Icon size={12} strokeWidth={2} />
        </span>
      </span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Det faste dekket på mobil. Ligger UTENFOR sheeten (fixed) fordi transporten
 * ikke skal flytte seg når innholdet over den endrer seg — og fordi den skal
 * være der tommelen er.
 *
 * Dekket er ikke en flate, bare et feste: baren flyter over innholdet, og det
 * som scroller under den blir liggende der — uskarpt, men synlig. En
 * heldekkende hvit stripe kuttet flaten i to og lot som om innholdet sluttet
 * der. Sløret ligger bak HELE festet, med en maske som toner det inn ovenfra,
 * så det ikke oppstår en synlig kant der uskarpheten begynner.
 */
export function StoryDeck() {
  const { onArea, leaving } = useStoryTour();
  // Uten rad er dekket bare et slør over bunnen av sheeten — se `StoryRail`.
  if (onArea) return null;
  return (
    <div
      data-testid="story-deck"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden",
        /* På vei tilbake til området toner dekket ut sammen med innholdet. */
        leaving && (leaving === "area" ? "story-leave-back" : "story-leave"),
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -top-[26px] z-0 bg-gradient-to-b from-white/0 to-white/55 backdrop-blur-lg"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, #000 30px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30px)",
        }}
      />
      <div className="pointer-events-auto relative z-[1]">
        <StoryRail variant="deck" />
      </div>
    </div>
  );
}
