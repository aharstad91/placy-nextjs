"use client";

import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
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
 * Sporet ER baren: én sammenhengende avrundet flate med faste ender, og
 * innholdet ruller inni den. Rullet baren selv, ville endene forsvunnet ut av
 * syne og flaten sluttet å lese som én ting.
 *
 * ## Området står først, og er skilt fra temaene
 *
 * Første brikke er STEDET (`AREA_STEP`) — «Beliggenhet», ikke et tema — med
 * kartnål og nøytral, mørk sirkel der temaene har sin egen farge. Den bærer et
 * fast ord, ikke strøksnavnet: navnet står som overskrift to centimeter under. Den er
 * inngangen indeksen var: hele nabolaget på kartet, en introduksjon til strøket
 * og strøkets spørsmål og svar. En chevron skiller den fra temaene, fordi de to
 * ikke er samme slags ting: den ene er et sted, de andre er spørsmål om det.
 *
 * Skillet er STERKERE enn det var (2026-08-28). Chevronen sto på 13 px i
 * `stone-300` med ett piksel luft på hver side, og leste som en klippefeil
 * framfor som «kategoriene ligger den veien» — mens stedets kartnål var like
 * liten som temaenes ikoner og derfor ikke sa at brikken var startpunktet
 * (Andreas: «jeg ønsker å få et større visuelt skille på at beliggenhet er
 * startpunktet»). Chevronen er nå 17 px, `stone-400`, med luft rundt seg; nålen
 * står i en sirkel som er 2 px større enn temaenes, med et tykkere strøk.
 *
 * Ikon-slotten har derfor FAST høyde for alle brikkene. Uten den ville stedets
 * større sirkel dyttet sin egen etikett to piksler ned, og raden ville hatt to
 * grunnlinjer for teksten.
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
 * spørsmålet og svarformene — ett feste, og innholdet renner under den frostede
 * flaten. Den svømmer altså ikke selv: slør og skygge hører til hodet, og sporet
 * arver faneradens egen grå bunn. Ingen utgang ved siden av: på desktop ER
 * kolonnen omvisningen, så det finnes ikke noe å gå tilbake TIL.
 */
export function StoryRail({ variant }: { variant: "deck" | "flow" }) {
  const { stops, step, goto, onArea } = useStoryTour();
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Raden forskyver seg i takt med fortellingen: det aktive stoppet legges mot
  // venstre kant, men ikke helt inntil — 44 px igjen til det forrige navnet, så
  // raden viser at den har en bakside. Det er progresjonen, uttrykt som
  // bevegelse i stedet for som et tall.
  useEffect(() => {
    const track = trackRef.current;
    const btn = track?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!track || !btn) return;
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    track.scrollLeft = Math.min(Math.max(0, btn.offsetLeft - 44), max);
  }, [step]);

  return (
    <div
      className={cn(
        "relative flex items-stretch",
        variant === "deck" ? "px-3.5 pb-2 pt-1.5" : "shrink-0",
      )}
    >
      {/* Toninger i barens egne kanter: en brikke klippet midt i et ord leser
          som en feil i stedet for som «det ligger mer den veien». De ligger på
          dekket, ikke i sporet — et element som ruller med, toner ingenting. */}
      {variant === "deck" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-3.5 top-1.5 z-[1] w-5 rounded-l-[22px] bg-gradient-to-r from-[rgba(252,251,250,0.92)] to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-3.5 top-1.5 z-[1] w-5 rounded-r-[22px] bg-gradient-to-l from-[rgba(252,251,250,0.92)] to-transparent"
          />
        </>
      )}

      <div
        ref={trackRef}
        className={cn(
          "relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-[22px]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[overscroll-behavior-x:contain] [scroll-behavior:smooth]",
          variant === "deck"
            ? "bg-[rgba(252,251,250,0.72)] shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_6px_22px_rgba(28,25,23,0.13)] backdrop-blur-md [backdrop-filter:blur(12px)_saturate(1.7)]"
            : "bg-black/[0.045]",
        )}
      >
        <div
          role="tablist"
          aria-label="Stopp"
          className="flex flex-nowrap items-stretch gap-0.5 p-1"
        >
          <RailChip
            /* Ikke stedsnavnet: det står som overskrift rett under. Se
               AREA_RAIL_LABEL. */
            label={AREA_RAIL_LABEL}
            icon="MapPin"
            /* Mørk og nøytral, ikke en syvende temafarge: brikken er stedet
               temaene ligger i. Samme svarte sirkel «Hele nabolaget» hadde. */
            color="#1c1917"
            root
            active={onArea}
            onClick={() => goto(AREA_STEP)}
          />
          <span
            aria-hidden
            className="flex shrink-0 items-center px-1 text-stone-400"
          >
            <ChevronRight size={17} strokeWidth={2.5} />
          </span>
          {stops.map((c, n) => (
            <RailChip
              key={c.id}
              label={c.label}
              icon={c.icon}
              color={c.color}
              active={n === step}
              past={n < step}
              onClick={() => goto(n)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Én brikke i raden. Samme form for stedet og for temaene — det er FARGEN og
 *  plasseringen som sier at den første er noe annet, ikke et eget format. */
function RailChip({
  label,
  icon,
  color,
  active,
  past = false,
  root = false,
  onClick,
}: {
  label: string;
  icon: string;
  color: string;
  active: boolean;
  /** Passert i rekkefølgen — teksten mørkner litt. Området har ingen bakside. */
  past?: boolean;
  /** Stedet, ikke et tema: større nål og tykkere strøk. Se doccen over. */
  root?: boolean;
  onClick: () => void;
}) {
  const Icon = getIcon(icon);
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
          teksten.

          Slotten er 22 px høy for ALLE brikkene, også de på 20: det er den som
          holder etikettene på samme grunnlinje når stedets sirkel er større enn
          temaenes. */}
      <span
        aria-hidden
        className="flex h-[22px] shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full text-white",
            root ? "h-[22px] w-[22px]" : "h-5 w-5",
          )}
          style={{ backgroundColor: color }}
        >
          <Icon size={root ? 14 : 12} strokeWidth={root ? 2.5 : 2} />
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
  return (
    <div
      data-testid="story-deck"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden"
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
