/**
 * PRD 10 Unit 5 — URL-flagg-KONTRAKTEN + film-modus-produktet (G5).
 *
 * Hjemler de fire board-URL-flaggene som ÉN dokumentert kontrakt + ren, testbar
 * leser (samme «hjemle ren beslutnings-funksjon fra closuren»-balanse som Unit 1s
 * `deriveIntroFlightPlan` og Unit 4s `deriveCategoryCameraConfig`). Ekstrahert fra
 * `BoardMap3D`s fire separate `useState`-initialiserere så lese-kontrakten er
 * enhetstestbar — atferd er byte-identisk med de tidligere inline-`URLSearchParams`-
 * lesningene (hvert flagg er aktivt KUN ved den eksakte verdien `"1"`).
 *
 * KONTRAKT — hvilke flagg finnes + semantikk (AC6):
 *
 *   ?film=1  → `filmMode`. Cinematisk RENT kart for capture: kategori-pins droppes
 *              på RENDER-nivå (`markerPOIs → []` i `selectMarkerPOIs`) — ALDRI via
 *              DOM-fjerning utenfra (removeChild-race på en node React eier). PRD 10
 *              eier URL-flagg-PRODUKTET; PRD 6 (`use-board-marker-set`) eier
 *              pin-drop-MEKANIKKEN. `projectSite`-labelen er en EGEN prop og påvirkes
 *              IKKE (rent kart beholder prosjekt-label — ToS + produktverdi).
 *
 *   ?fly=1   → `flyMode`. Spiller intro-flythrough-en (oval-spiral) live i kartet.
 *              IMPLISERER film-modus (pins skjult, samme render-nivå-drop) OG 'free'
 *              cameraMode. Merk: 'free' har TO triggere — `!hasVoiceOver` ELLER
 *              `?fly=1` (`BoardMap.tsx:146-152`, PRD 9 Unit 3). `?fly=1` er altså ÉN
 *              av to free-triggere; konversen `free ⇒ ?fly=1` er FALSK (et no-VO-board
 *              er også free uten flagget). Film-modus AVHENGER av at directoren
 *              yield-er til den frame-drevne flyturen.
 *
 *   ?establishing=1 → `establishingFlag`. Velger den multi-waypoint strøk-flythrough-en
 *              (`board-establishing-shots`) UTEN voice-over. Blir til `establishingMode`
 *              KUN hvis strøket faktisk har en bane konfigurert (`getEstablishingShot`).
 *              `establishingMode` (ikke flagget alene) driver render-nivå-pin-drop +
 *              reveal-kaskaden. Skall-siden (splash-skip) monteres i `ReportReelsPage`
 *              (PRD 9 Unit 2, §10 Q4) — PRD 10 eier kontrakten, ikke mount-effekten.
 *
 *   ?author=1 → `authorMode`. Dev-only autoring-modus: monterer `CameraWaypointAuthor`
 *              for å fange kamera-waypoints til `camera-tours`-DATA. Aldri eksponert i
 *              produksjon med mindre flagget settes. PRD 10 KONSUMERER author-komponenten
 *              (PRD 6); den eies ikke her.
 *
 * Mount-effektene (pin-drop-mekanikk, free-default, splash-skip, author-mount) bor i
 * PRD 6/9-eide filer (§10 Q4) — denne modulen hjemler bare LESE-kontrakten + semantikken;
 * PRD 10 redigerer ikke de filene uten koordinering.
 */
export interface BoardUrlFlags {
  /** `?film=1` — cinematisk rent kart (render-nivå pin-drop for capture). */
  filmMode: boolean;
  /** `?fly=1` — live intro-flythrough; impliserer film-modus + 'free' cameraMode. */
  flyMode: boolean;
  /** `?establishing=1` — multi-waypoint strøk-flythrough uten voice-over. */
  establishingFlag: boolean;
  /** `?author=1` — dev-only kamera-waypoint-autoring (`CameraWaypointAuthor`). */
  authorMode: boolean;
}

/** Alle flagg av — brukt server-side / før mount (ingen `window`). */
const ALL_OFF: BoardUrlFlags = {
  filmMode: false,
  flyMode: false,
  establishingFlag: false,
  authorMode: false,
};

/**
 * Ren leser av URL-flagg-kontrakten fra en query-streng (`window.location.search`).
 * Hvert flagg er aktivt KUN ved den eksakte verdien `"1"` — `"0"`, manglende, eller
 * en hvilken som helst annen verdi gir `false` (byte-identisk med de tidligere inline-
 * `URLSearchParams(...).get(x) === "1"`-lesningene).
 */
export function readBoardUrlFlags(search: string): BoardUrlFlags {
  const params = new URLSearchParams(search);
  return {
    filmMode: params.get("film") === "1",
    flyMode: params.get("fly") === "1",
    establishingFlag: params.get("establishing") === "1",
    authorMode: params.get("author") === "1",
  };
}

/**
 * Mount-trygg variant: leser flaggene ÉN gang fra `window.location.search`, eller
 * returnerer alle-av når `window` mangler (SSR / før hydrering). Brukt i
 * `BoardMap3D`s `useState`-initialiserer slik at flaggene leses nøyaktig én gang ved
 * mount (AC1).
 */
export function readBoardUrlFlagsFromWindow(): BoardUrlFlags {
  if (typeof window === "undefined") return ALL_OFF;
  return readBoardUrlFlags(window.location.search);
}
