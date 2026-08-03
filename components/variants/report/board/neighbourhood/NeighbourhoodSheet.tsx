"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * Nabolagssheeten — skallet (Unit 3a).
 *
 * Boards uten spillbar voice-over fikk før BARE et fullskjerm kart etter
 * splash. Denne sheeten er innholdsflaten: kart øverst, fritt dragbar liste
 * nederst, kartet aldri helt skjult (R1/R3).
 *
 * ## Hvorfor transform og ikke height
 *
 * Sheeten har FAST høyde (den høyeste hvileposisjonen) og flyttes med
 * `translateY`. Å animere `height` ville reflowet innholdet på hver frame av
 * draget; med transform rører vi bare compositoren, og scroll-posisjonen i
 * lista overlever en dragsesjon uendret.
 *
 * ## Hvorfor transformen styres imperativt
 *
 * Under draget skrives `style.transform` DIREKTE på elementet — ingen React-
 * render per frame. Det er ikke en mikro-optimalisering: en dragbar sheet
 * re-rendrer i gest-frekvens, og en per-render-probe på kart-stien har krasjet
 * dette kartet før (`webgl-context-leak-per-render-probe-20260603`). Ved slipp
 * settes måltransformen imperativt FØR `setRest`, så React-committen skriver
 * nøyaktig samme verdi og det aldri finnes en frame med gammel posisjon.
 * Hviletilstanden skrives av samme layout-effekt — én kilde til sannhet.
 *
 * ## Hvorfor lista ikke oppdateres under draget
 *
 * Kun hvileposisjonen rapporteres oppover (`onHeightChange`). R12: lista
 * re-scopes ved gest-SLIPP, ikke kontinuerlig. Det gjør også at kartets
 * `setPadding` og viewport-publiseringen fyrer én gang per drag, ikke 60.
 */

export type SheetRestPosition = "low" | "high";

/** Hvileposisjoner som andel av tilgjengelig høyde. Tallene er en FØLELSE, ikke
 *  en beregning — de justeres på enhet. */
const REST_LOW_FRACTION = 0.34;
const REST_HIGH_FRACTION = 0.86;

/** R3: lav hvileposisjon må alltid vise header + minst ett fullt kategorikort,
 *  ellers leses ankomsttilstanden som en tom skuff. På korte skjermer
 *  (iPhone SE, 667 px) er 34 % for lite, derfor et gulv i piksler. */
const REST_LOW_MIN_PX = 236;

/** Apple-easing (`apple-style-slide-up-modal-with-backdrop-blur-20260415`). */
const SNAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_DURATION_MS = 380;

/** Over denne farten (px/ms) vinner retningen over nærmeste hvileposisjon —
 *  et raskt kast skal lande der fingeren pekte, ikke der den slapp. */
const FLICK_VELOCITY_PX_PER_MS = 0.45;

/** Bevegelse under dette regnes som et tapp, ikke et drag. */
const TAP_SLOP_PX = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

interface DragSession {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
}

export function NeighbourhoodSheet({
  title = "I nærheten",
  onHeightChange,
  onRestChange,
  children,
}: {
  /** Header-tittel. Default unngår ordet «Nabolaget» med vilje: `teknostallen`
   *  har et TEMA som heter det, og to «Nabolaget» på samme skjerm leses feil. */
  title?: string;
  /** Målt høyde (px) på gjeldende hvileposisjon. Kartet bruker den som
   *  bottom-padding OG som okklusjon i viewport-rektangelet. Kalles ved
   *  hvileposisjon- og container-endring — aldri under draget. */
  onHeightChange: (heightPx: number) => void;
  /** Valgfri varsling om hvileposisjon (brukes av førstegangs-hintet i 3b). */
  onRestChange?: (rest: SheetRestPosition) => void;
  children?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  /** Første posisjonering skal ikke animere — sheeten skal stå der den skal
   *  når splashen fader, ikke gli ned dit. */
  const positionedRef = useRef(false);

  const [containerHeight, setContainerHeight] = useState(0);
  const [rest, setRest] = useState<SheetRestPosition>("low");

  const restHeights = useMemo(() => {
    if (containerHeight <= 0) return { low: 0, high: 0 };
    const high = Math.round(containerHeight * REST_HIGH_FRACTION);
    const low = Math.round(
      clamp(containerHeight * REST_LOW_FRACTION, REST_LOW_MIN_PX, high),
    );
    return { low, high };
  }, [containerHeight]);

  // Måler den tilgjengelige flaten, ikke viewporten. `EventMobileSheet`
  // hardkoder 700 px og bommer på alt annet enn den ene telefonen den ble
  // bygget på. ResizeObserver fanger også Safari-adressefeltets 100dvh-skift:
  // det synlige området endrer seg faktisk, så lista SKAL følge etter.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setContainerHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyTransform = useCallback(
    (heightPx: number, animate: boolean) => {
      const el = sheetRef.current;
      if (!el) return;
      el.style.transition = animate
        ? `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`
        : "none";
      el.style.transform = `translateY(${restHeights.high - heightPx}px)`;
    },
    [restHeights.high],
  );

  // Hviletilstanden. Hopper over mens et drag eier transformen.
  useLayoutEffect(() => {
    if (restHeights.high <= 0 || dragRef.current) return;
    applyTransform(restHeights[rest], positionedRef.current);
    positionedRef.current = true;
  }, [rest, restHeights, applyTransform]);

  // Rapporteres i en LAYOUT-effekt: kartets padding og viewport-publiseringen
  // skal lande før paint, men et setState i forelderen under vår egen render
  // ville vært et cross-component render-phase-update (React advarer, med
  // rette). Kun hvileposisjonen rapporteres — aldri mellomverdier fra draget.
  const restHeight = restHeights[rest];
  useLayoutEffect(() => {
    if (restHeight > 0) onHeightChange(restHeight);
  }, [restHeight, onHeightChange]);

  const goTo = useCallback(
    (next: SheetRestPosition) => {
      setRest(next);
      onRestChange?.(next);
    },
    [onRestChange],
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!e.isPrimary || restHeights.high <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: restHeights[rest],
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
    };
    applyTransform(restHeights[rest], false);
  };

  /** Oppdaterer dragsesjonen fra en peker-posisjon og returnerer den nye
   *  synlige høyden. Brukes av BÅDE move og up: `pointerup` bærer sin egen
   *  koordinat, og en gest som slippes uten en avsluttende `pointermove` ville
   *  ellers snappet fra en foreldet posisjon. */
  const trackPointer = (drag: DragSession, clientY: number, t: number) => {
    const dt = t - drag.lastT;
    // Positiv fart = fingeren går oppover = sheeten vokser.
    if (dt > 0) drag.velocity = (drag.lastY - clientY) / dt;
    drag.lastY = clientY;
    drag.lastT = t;
    if (Math.abs(clientY - drag.startY) > TAP_SLOP_PX) drag.moved = true;
    return clamp(
      drag.startHeight + (drag.startY - clientY),
      restHeights.low,
      restHeights.high,
    );
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    applyTransform(trackPointer(drag, e.clientY, e.timeStamp), false);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const current = trackPointer(drag, e.clientY, e.timeStamp);
    dragRef.current = null;

    if (!drag.moved) {
      // Tapp på håndtaket: bytt hvileposisjon. Gir en ikke-gestuell vei mellom
      // de to tilstandene (samme affordans som `EventMobileSheet`s tapp-syklus).
      const next = rest === "low" ? "high" : "low";
      applyTransform(restHeights[next], true);
      goTo(next);
      return;
    }

    const next: SheetRestPosition =
      Math.abs(drag.velocity) > FLICK_VELOCITY_PX_PER_MS
        ? drag.velocity > 0
          ? "high"
          : "low"
        : Math.abs(current - restHeights.low) <=
            Math.abs(current - restHeights.high)
          ? "low"
          : "high";
    // Måltransformen settes FØR setRest, så React-committen skriver samme
    // verdi og snappet aldri hopper via den gamle posisjonen.
    applyTransform(restHeights[next], true);
    goTo(next);
  };

  return (
    // Rammen dekker hele flaten kun for å MÅLE den. pointer-events-none så
    // kart-pan under sheeten når kartet uhindret; selve sheeten slår det på
    // igjen.
    <div
      ref={frameRef}
      data-testid="neighbourhood-frame"
      className="pointer-events-none absolute inset-0 z-30"
    >
      <div
        ref={sheetRef}
        data-testid="neighbourhood-sheet"
        data-rest={rest}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl bg-[#f5f1ea] shadow-[0_-8px_32px_rgba(28,25,23,0.22)] will-change-transform"
        style={{ height: restHeights.high || undefined }}
      >
        {/* Gripeflaten eier vertikale gester. `touch-action: none` er PÅKREVD
            her (uten den kansellerer nettleseren pekeren og draget dør) — men
            den skal ALDRI settes på scroll-containeren under
            (`unified-poi-carousel-report-20260420`). */}
        <button
          type="button"
          data-testid="neighbourhood-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={rest === "low" ? "Vis mer av lista" : "Vis mer av kartet"}
          aria-expanded={rest === "high"}
          className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5 text-left active:cursor-grabbing"
        >
          <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-stone-400/70" />
          <span className="block text-[15px] font-semibold tracking-tight text-stone-900">
            {title}
          </span>
        </button>

        <div
          data-testid="neighbourhood-scroll"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
