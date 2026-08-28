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
 * ## Hvorfor kartet får HVILEMINIMUMET og ikke sheetens høyde
 *
 * Tallet som rapporteres oppover er alltid `bounds.min` — den laveste
 * hvileposisjonen — uansett hvor sheeten faktisk står.
 *
 * Første versjon rapporterte den gjeldende høyden, og det ga en løkke som
 * fikk sheeten til å pumpe opp og ned av seg selv:
 *
 *   sheet-høyde → kartets okklusjon → utsnitts-rektangel → antall synlige
 *   POI-er → listas høyde → innholdstaket → sheet-høyde → …
 *
 * De to retningene har motsatt fortegn (høyere sheet gir færre POI-er gir
 * lavere tak gir lavere sheet gir flere POI-er …), så systemet svinger i
 * stedet for å konvergere. Innholdstaket lukket den siste lenken.
 *
 * `bounds.min` avhenger kun av containerhøyden, aldri av innholdet, og bryter
 * derfor løkken ved kilden. Det er dessuten den ærlige avlesningen: lista
 * svarer på «hva er i utsnittet», og utsnittet er det brukeren ser når
 * sheeten hviler. Å dra den opp for å LESE lista skal ikke endre hva lista
 * handler om — det er også slik Citymapper oppfører seg.
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

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

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
  contentRestKey = null,
  tone = "cream",
  children,
}: {
  /** Header-tittel. Default unngår ordet «Nabolaget» med vilje: `teknostallen`
   *  har et TEMA som heter det, og to «Nabolaget» på samme skjerm leses feil. */
  title?: string;
  /** Høyden (px) kartet skal regne som skjult av sheeten. Alltid den laveste
   *  hvileposisjonen, ikke den sheeten står i — se doccen over om løkken.
   *  Endrer seg kun når flaten endrer størrelse. */
  onHeightChange: (heightPx: number) => void;
  /**
   * Når satt hviler sheeten i INNHOLDETS egen høyde i stedet for i
   * hvileminimumet — målt ÉN gang og frosset så lenge nøkkelen står.
   *
   * Finnes for omvisningen (`board/story`), der flaten ikke er en liste du blar
   * i men et vindu du leser i: der skal den vanlige visningen fylle sheeten
   * uten scroll, mens steds- og svar-fanen får noe å scrolle i. Måles med den
   * fanen omvisningen faktisk serverer først, og fryses — ellers ville en fane
   * som er høyere enn en annen flyttet flaten under leseren, som er en følge
   * hen ikke ba om.
   *
   * Målt høyde blir sheetens HVILESTILLING, ikke en låst høyde: den kan
   * fortsatt dras. Forskjellen er hele poenget — en følge du ikke ba om, mot en
   * du styrer. Bytt nøkkel (eller sett `null`) for å måle på nytt.
   */
  contentRestKey?: string | null;
  /**
   * Flatens farge. `cream` er nabolagslista: kortene er hvite og ligger PÅ
   * flaten. `white` er omvisningen, der stoppet er det eneste innholdet — der
   * er fortellingen forgrunnen, ikke et kort som ligger på en beige bunn, og
   * det festede spørsmålets hvite maske må ha samme farge som flaten under
   * seg (ellers leser masken som en stripe i stedet for som kanten av flaten).
   */
  tone?: "cream" | "white";
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
   *  legger den på `low` (eller på den frosne innholdshøyden, se
   *  `contentRestKey`). */
  const [restHeight, setRestHeight] = useState<number | null>(null);
  /** Den frosne innholdshøyden og nøkkelen den ble målt under. */
  const [contentRest, setContentRest] = useState<{
    key: string;
    px: number;
  } | null>(null);

  const bounds = useMemo(() => {
    if (containerHeight <= 0) return { min: 0, max: 0 };
    const ceiling = Math.round(containerHeight * REST_HIGH_FRACTION);
    const min = Math.round(
      clamp(containerHeight * REST_LOW_FRACTION, REST_LOW_MIN_PX, ceiling),
    );
    // Taket følger innholdet: er lista kortere enn flaten tillater, stopper
    // draget der innholdet slutter i stedet for å åpne et tomt felt.
    //
    // UNNTAK: en flate med frosset hvilestilling (`contentRestKey` — se propen)
    // er et VINDU, ikke en liste. Der bytter innholdet høyde uten at brukeren
    // ba om det: omvisningens tre faner er ulikt høye, og med innholdstaket
    // krympet hele flaten i det du byttet fane — nøyaktig den følgen frosset
    // hvilestilling finnes for å hindre. Taket er da flate-andelen alene, og
    // et kortere innhold etterlater luft i stedet for å flytte vinduet.
    const max =
      contentRestKey === null && contentHeight > 0
        ? clamp(contentHeight, min, ceiling)
        : ceiling;
    return { min, max };
  }, [containerHeight, contentHeight, contentRestKey]);

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
  const measureContent = useCallback(() => {
    const content = contentRef.current;
    const header = headerRef.current;
    if (!content || !header) return;
    setContentHeight(content.offsetHeight + header.offsetHeight);
  }, []);

  // Måles på nytt ved HVER commit, ikke bare når observeren fyrer:
  // ResizeObserver kaller tilbake etter paint, så en liste som krymper ville
  // fått én malt frame med det gamle taket — nøyaktig det døde beige feltet
  // under siste rad. Kostnaden er to `offsetHeight`-avlesninger per render, og
  // sheeten rendrer ikke under draget (høyden skrives imperativt).
  useLayoutEffect(measureContent);

  // Observeren fanger det commit-målingen ikke ser: fonter som lastes,
  // safe-area som endrer seg, bilder som får høyde etterpå.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const header = headerRef.current;
    if (!content || !header) return;
    const ro = new ResizeObserver(measureContent);
    ro.observe(content);
    ro.observe(header);
    return () => ro.disconnect();
  }, [measureContent]);

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
  const preferredRest =
    contentRest !== null && contentRest.key === contentRestKey
      ? contentRest.px
      : bounds.min;
  const appliedHeight =
    restHeight === null
      ? clamp(preferredRest, bounds.min, bounds.max)
      : clamp(restHeight, bounds.min, bounds.max);

  // Fryser innholdshøyden ved første måling under en ny nøkkel, og slipper den
  // igjen når nøkkelen forsvinner. `setRestHeight(null)` i samme slengen:
  // flaten skal FLYTTE seg til den nye hvilestillingen, ikke stå igjen i den
  // forrige (som er en høyde omvisningen ikke ba om).
  useLayoutEffect(() => {
    if (contentRestKey === null) {
      if (contentRest !== null) {
        setContentRest(null);
        setRestHeight(null);
      }
      return;
    }
    if (contentRest?.key === contentRestKey) return;
    if (contentHeight <= 0) return;
    setContentRest({ key: contentRestKey, px: contentHeight });
    setRestHeight(null);
  }, [contentRestKey, contentRest, contentHeight]);

  // Hviletilstanden. Hopper over mens et drag eier høyden.
  useLayoutEffect(() => {
    if (appliedHeight <= 0 || dragRef.current) return;
    applyHeight(appliedHeight, positionedRef.current ? SNAP_DURATION_MS : 0);
    positionedRef.current = true;
  }, [appliedHeight, applyHeight]);

  // Rapporteres i en LAYOUT-effekt: viewport-publiseringen skal lande før
  // paint, men et setState i forelderen under vår egen render ville vært et
  // cross-component render-phase-update (React advarer, med rette).
  //
  // Verdien er hvileminimumet, ikke `appliedHeight`. Det er løkkebruddet —
  // `bounds.min` avhenger bare av containerhøyden, så ingenting sheeten gjør
  // kan komme tilbake til den via lista. Se doccen øverst.
  useLayoutEffect(() => {
    if (bounds.min > 0) onHeightChange(bounds.min);
  }, [bounds.min, onHeightChange]);

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
        className={`pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl shadow-[0_-8px_32px_rgba(28,25,23,0.22)] ${
          tone === "white" ? "bg-white" : "bg-[#f5f1ea]"
        }`}
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
