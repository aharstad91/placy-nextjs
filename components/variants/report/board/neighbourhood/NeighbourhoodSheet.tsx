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
 * ## Hvorfor height og ikke transform — et bevisst avvik
 *
 * Repo-konvensjonen (`apple-style-slide-up-modal-with-backdrop-blur-20260415`)
 * er å animere KUN `transform`/`opacity`. Her går vi mot den, med vitende vilje.
 *
 * Den transform-baserte varianten — fast høyde lik den høyeste hvileposisjonen,
 * flyttet ned med `translateY` — ser identisk ut, men gir feil scroll-region:
 * scroll-containeren er da alltid høy, mens bare toppen er på skjermen. I lav
 * hvileposisjon blir innholdet under skjermkanten UNÅBART (containeren
 * overflower ikke, så det finnes ingenting å scrolle), og brukeren må dra
 * sheeten opp før lista i det hele tatt kan leses. Sheetens layout-høyde MÅ
 * være lik dens synlige høyde.
 *
 * Kostnaden er en reflow per drag-frame, men bare av sheet-subtreet (høyst en
 * håndfull kategorikort). Kart-stien røres ikke — som er det
 * `webgl-context-leak-per-render-probe-20260603` faktisk advarer mot.
 *
 * ## Hvorfor høyden styres imperativt
 *
 * Under draget skrives `style.height` DIREKTE på elementet — ingen React-render
 * per frame. Ved slipp settes målhøyden imperativt FØR `setRest`, så
 * React-committen skriver nøyaktig samme verdi og det aldri finnes en frame med
 * gammel posisjon. Hviletilstanden skrives av samme layout-effekt — én kilde
 * til sannhet.
 *
 * ## Hvorfor sheeten hviler HVOR SOM HELST
 *
 * Første versjon hadde to hvileposisjoner og snappet til nærmeste ved slipp.
 * Det er ikke Citymapper-oppførselen, og forskjellen er ikke kosmetisk: med to
 * posisjoner er det VI som bestemmer hvor mye kart brukeren får se, og valget
 * mellom «litt for lite kart» og «litt for lite liste» finnes ikke. Fri
 * posisjonering flytter den avveiningen til fingeren.
 *
 * Ytterpunktene er fortsatt magnetiske (`SNAP_THRESHOLD_PX`) — ellers blir
 * «vis meg mest mulig kart» en presisjonsøvelse. Alt mellom dem er brukerens.
 *
 * ## Hvorfor taket følger innholdet
 *
 * Maks-høyden er den LAVESTE av flate-andelen og innholdets egen høyde. Uten
 * det kunne en liste med to kort dras opp til 86 % og etterlate et dødt beige
 * felt under siste rad. Man skal ikke kunne dra ut i tomrom.
 *
 * ## Hvorfor lista ikke oppdateres under draget
 *
 * Kun hvileposisjonen rapporteres oppover (`onHeightChange`). R12: lista
 * re-scopes ved gest-SLIPP, ikke kontinuerlig. Det gjør også at
 * viewport-publiseringen fyrer én gang per drag, ikke 60.
 */

/** Ytterpunktene som andel av tilgjengelig høyde. Tallene er en FØLELSE, ikke
 *  en beregning — de justeres på enhet. */
const REST_LOW_FRACTION = 0.34;
const REST_HIGH_FRACTION = 0.86;

/** R3: laveste posisjon må alltid vise header + minst ett fullt kategorikort,
 *  ellers leses ankomsttilstanden som en tom skuff. På korte skjermer
 *  (iPhone SE, 667 px) er 34 % for lite, derfor et gulv i piksler. */
const REST_LOW_MIN_PX = 236;

/** Apple-easing (`apple-style-slide-up-modal-with-backdrop-blur-20260415`). */
const SNAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_DURATION_MS = 380;
const SETTLE_MIN_MS = 130;

/** Farten ved slipp kastes videre i så mange millisekunder. Gir kastet
 *  etterslep uten en full fjær-simulering — sheeten lander der bevegelsen
 *  pekte, ikke der fingeren tilfeldigvis slapp. */
const MOMENTUM_PROJECTION_MS = 190;

/** Lander kastet nærmere et ytterpunkt enn dette, går det helt inn. */
const SNAP_THRESHOLD_PX = 44;

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
  children,
}: {
  /** Header-tittel. Default unngår ordet «Nabolaget» med vilje: `teknostallen`
   *  har et TEMA som heter det, og to «Nabolaget» på samme skjerm leses feil. */
  title?: string;
  /** Målt høyde (px) på gjeldende hvileposisjon. Kartet bruker den som
   *  okklusjon i viewport-rektangelet. Kalles ved hvileposisjon- og
   *  container-endring — aldri under draget. */
  onHeightChange: (heightPx: number) => void;
  children?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  /** Første posisjonering skal ikke animere — sheeten skal stå der den skal
   *  når splashen fader, ikke gli ned dit. */
  const positionedRef = useRef(false);

  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  /** Hvileposisjonen i piksler. `null` = ikke posisjonert ennå; første måling
   *  legger den på `low`. */
  const [restHeight, setRestHeight] = useState<number | null>(null);

  const bounds = useMemo(() => {
    if (containerHeight <= 0) return { min: 0, max: 0 };
    const ceiling = Math.round(containerHeight * REST_HIGH_FRACTION);
    const min = Math.round(
      clamp(containerHeight * REST_LOW_FRACTION, REST_LOW_MIN_PX, ceiling),
    );
    // Taket følger innholdet: er lista kortere enn flaten tillater, stopper
    // draget der innholdet slutter i stedet for å åpne et tomt felt.
    const max = contentHeight > 0 ? clamp(contentHeight, min, ceiling) : ceiling;
    return { min, max };
  }, [containerHeight, contentHeight]);

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

  // Innholdets egen høyde, som gir taket. Wrapperen måles i stedet for
  // scroll-containeren fordi `scrollHeight` aldri rapporterer mindre enn
  // `clientHeight` — en kort liste i en høy container ville målt seg selv som
  // «akkurat passe høy» og taket ville aldri sunket.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const header = headerRef.current;
    if (!content || !header) return;
    const measure = () =>
      setContentHeight(content.offsetHeight + header.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const applyHeight = useCallback((heightPx: number, durationMs: number) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition =
      durationMs > 0 ? `height ${durationMs}ms ${SNAP_EASING}` : "none";
    el.style.height = `${heightPx}px`;
  }, []);

  /** Høyden som faktisk gjelder. Utledet, ikke lagret: når flaten eller
   *  innholdet krymper må hvileposisjonen følge med inn i de nye grensene, og
   *  en state-synk i en effekt ville gitt en frame med gammel høyde. */
  const appliedHeight =
    restHeight === null
      ? bounds.min
      : clamp(restHeight, bounds.min, bounds.max);

  // Hviletilstanden. Hopper over mens et drag eier høyden.
  useLayoutEffect(() => {
    if (appliedHeight <= 0 || dragRef.current) return;
    applyHeight(appliedHeight, positionedRef.current ? SNAP_DURATION_MS : 0);
    positionedRef.current = true;
  }, [appliedHeight, applyHeight]);

  // Rapporteres i en LAYOUT-effekt: viewport-publiseringen skal lande før
  // paint, men et setState i forelderen under vår egen render ville vært et
  // cross-component render-phase-update (React advarer, med rette). Kun
  // hvileposisjonen rapporteres — aldri mellomverdier fra draget.
  useLayoutEffect(() => {
    if (appliedHeight > 0) onHeightChange(appliedHeight);
  }, [appliedHeight, onHeightChange]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!e.isPrimary || bounds.max <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: appliedHeight,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
    };
    applyHeight(appliedHeight, 0);
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
      bounds.min,
      bounds.max,
    );
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    applyHeight(trackPointer(drag, e.clientY, e.timeStamp), 0);
  };

  /** Flytter til en ny hvileposisjon. Målhøyden skrives imperativt FØR
   *  `setRestHeight`, så React-committen skriver samme verdi og bevegelsen
   *  aldri går via den gamle posisjonen. */
  const settleAt = (next: number, from: number) => {
    const duration = clamp(
      Math.abs(next - from) * 1.4,
      SETTLE_MIN_MS,
      SNAP_DURATION_MS,
    );
    applyHeight(next, duration);
    setRestHeight(next);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const current = trackPointer(drag, e.clientY, e.timeStamp);
    dragRef.current = null;

    if (!drag.moved) {
      // Tapp på håndtaket: hopp til det ytterpunktet man ikke står nærmest.
      // Gir en ikke-gestuell vei mellom ytterpunktene for den som ikke drar.
      const midpoint = (bounds.min + bounds.max) / 2;
      settleAt(current > midpoint ? bounds.min : bounds.max, current);
      return;
    }

    // Fri posisjonering: farten kastes videre, resultatet klemmes inn i
    // grensene, og bare de siste pikslene mot et ytterpunkt er magnetiske.
    const projected = clamp(
      current + drag.velocity * MOMENTUM_PROJECTION_MS,
      bounds.min,
      bounds.max,
    );
    // Nærmeste magnet vinner, ikke den først testede: med et lavt innholdstak
    // kan hele spennet være smalere enn to terskler, og da ville en fast
    // rekkefølge gjort bunn-magneten allmektig — sheeten lot seg ikke åpne.
    const toMin = projected - bounds.min;
    const toMax = bounds.max - projected;
    const next =
      toMin <= SNAP_THRESHOLD_PX && toMin <= toMax
        ? bounds.min
        : toMax <= SNAP_THRESHOLD_PX
          ? bounds.max
          : projected;
    settleAt(Math.round(next), current);
  };

  const atMin = appliedHeight <= bounds.min + 1;
  const atMax = appliedHeight >= bounds.max - 1;

  return (
    // Rammen dekker hele flaten kun for å MÅLE den. pointer-events-none så
    // kart-pan under sheeten når kartet uhindret; selve sheeten slår det på
    // igjen.
    <div
      ref={frameRef}
      data-testid="neighbourhood-frame"
      className="pointer-events-none absolute inset-0 z-30"
    >
      {/* Høyden settes imperativt av layout-effekten (og av draget) — bevisst
          ikke via style-propen, så React-commit og gest aldri kjemper om
          samme felt. */}
      <div
        ref={sheetRef}
        data-testid="neighbourhood-sheet"
        data-rest={atMin ? "low" : atMax ? "high" : "free"}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl bg-[#f5f1ea] shadow-[0_-8px_32px_rgba(28,25,23,0.22)]"
      >
        {/* Gripeflaten eier vertikale gester. `touch-action: none` er PÅKREVD
            her (uten den kansellerer nettleseren pekeren og draget dør) — men
            den skal ALDRI settes på scroll-containeren under
            (`unified-poi-carousel-report-20260420`). */}
        <button
          ref={headerRef}
          type="button"
          data-testid="neighbourhood-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={atMax ? "Vis mer av kartet" : "Vis mer av lista"}
          aria-expanded={atMax}
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
        >
          {/* Wrapperen bærer bunn-innrykket, ikke scroll-containeren: da er
              `offsetHeight` her lik sheetens fulle innholdsbehov, som er
              nøyaktig tallet taket trenger. */}
          <div
            ref={contentRef}
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
