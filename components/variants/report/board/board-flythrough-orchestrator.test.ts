import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveIntroActive,
  deriveIntroFlightPlan,
} from "./board-flythrough-orchestrator";
import {
  WELCOME_INTRO_SETTLE_MS,
  WELCOME_CALM_SWEEP_DEG,
  MIN_INTRO_FLY_MS,
  DEFAULT_INTRO_PATH,
} from "./board-intro-flythrough";
import { getBoardIntro } from "./board-intros";

// ---------------------------------------------------------------------------
// deriveIntroActive (AC2): de tre intro-eierne (flyMode/isWelcomeBeat/
// basicIntroActive) gir introActive=true, men AND-es bort av establishingMode så
// to animatorer ikke kjemper om kamera-posituren.
// ---------------------------------------------------------------------------
describe("deriveIntroActive — tre intro-eiere AND-et bort av establishingMode", () => {
  const none = {
    flyMode: false,
    isWelcomeBeat: false,
    basicIntroActive: false,
    establishingMode: false,
  };

  it("ingen eier aktiv → false", () => {
    expect(deriveIntroActive(none)).toBe(false);
  });

  it.each([
    ["flyMode", { ...none, flyMode: true }],
    ["isWelcomeBeat", { ...none, isWelcomeBeat: true }],
    ["basicIntroActive", { ...none, basicIntroActive: true }],
  ])("%s alene → introActive=true", (_label, args) => {
    expect(deriveIntroActive(args)).toBe(true);
  });

  it.each([
    ["flyMode", { ...none, flyMode: true, establishingMode: true }],
    ["isWelcomeBeat", { ...none, isWelcomeBeat: true, establishingMode: true }],
    [
      "basicIntroActive",
      { ...none, basicIntroActive: true, establishingMode: true },
    ],
    [
      "alle tre",
      {
        flyMode: true,
        isWelcomeBeat: true,
        basicIntroActive: true,
        establishingMode: true,
      },
    ],
  ])("establishingMode AND-er bort %s → false", (_label, args) => {
    expect(deriveIntroActive(args)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveIntroFlightPlan (AC3/AC4): produkt-welcome- vs. capture-grenen av intro-
// flythrough-en. Produkt-welcome får kort settle + VO-skalert flytur + calm-sweep
// PUSH-IN + static-only-mot-reduced-motion; capture (?fly=1) beholder default-
// settle + banens fulle sveip og flyr ALLTID (aldri static-only).
// ---------------------------------------------------------------------------
describe("deriveIntroFlightPlan — produkt-welcome (AC3)", () => {
  const welcome = (overrides: Partial<Parameters<typeof deriveIntroFlightPlan>[0]> = {}) =>
    deriveIntroFlightPlan({
      isWelcomeBeat: true,
      flyMode: false,
      audioDurationMs: undefined,
      reducedMotion: false,
      introPath: {},
      ...overrides,
    });

  it("settle = WELCOME_INTRO_SETTLE_MS uansett banens egen settleMs", () => {
    expect(welcome().settleMs).toBe(WELCOME_INTRO_SETTLE_MS);
    expect(welcome({ introPath: { settleMs: 9999 } }).settleMs).toBe(
      WELCOME_INTRO_SETTLE_MS,
    );
  });

  it("fly-varighet skaleres til VO: max(MIN_INTRO_FLY_MS, audioDurationMs - settleMs)", () => {
    // 20000 - 1200 = 18800, godt over gulvet → bruk den.
    expect(welcome({ audioDurationMs: 20000 }).flyDurationMs).toBe(
      20000 - WELCOME_INTRO_SETTLE_MS,
    );
  });

  it("fly-varighet gulves på MIN_INTRO_FLY_MS for korte VO-er", () => {
    // 5000 - 1200 = 3800 < 8000 → klemt til gulvet.
    expect(welcome({ audioDurationMs: 5000 }).flyDurationMs).toBe(MIN_INTRO_FLY_MS);
  });

  it("fly-varighet undefined uten audioDurationMs (banens egen durationMs brukes)", () => {
    expect(welcome().flyDurationMs).toBeUndefined();
  });

  it("calm-sweep: sweepDeg klemmes til WELCOME_CALM_SWEEP_DEG, ovalEccentricity nulles", () => {
    const plan = welcome();
    expect(plan.calmOverride.sweepDeg).toBe(WELCOME_CALM_SWEEP_DEG);
    expect(plan.calmOverride.ovalEccentricity).toBe(0);
  });

  it("landings-framing bevart: startHeading + sweepDeg er invariant gjennom calm-overstyringen", () => {
    const plan = welcome();
    const baseEnd = DEFAULT_INTRO_PATH.startHeading + DEFAULT_INTRO_PATH.sweepDeg;
    expect(plan.calmOverride.startHeading! + plan.calmOverride.sweepDeg!).toBe(baseEnd);
  });

  it("per-prosjekt-tuning bevarer landings-framing (stasjonskvartalet sweep 150 → 90)", () => {
    const introPath = getBoardIntro("stasjonskvartalet"); // startHeading 20, sweepDeg 150
    const plan = welcome({ introPath });
    expect(plan.calmOverride.sweepDeg).toBe(WELCOME_CALM_SWEEP_DEG); // min(90, 150)
    expect(plan.calmOverride.startHeading).toBe(20 + (150 - WELCOME_CALM_SWEEP_DEG));
    // end = start + sweep bevart: 20 + 150 === 80 + 90.
    expect(plan.calmOverride.startHeading! + plan.calmOverride.sweepDeg!).toBe(20 + 150);
  });

  it("staticOnly følger reducedMotion for produkt-beaten", () => {
    expect(welcome({ reducedMotion: true }).staticOnly).toBe(true);
    expect(welcome({ reducedMotion: false }).staticOnly).toBe(false);
  });
});

describe("deriveIntroFlightPlan — capture / ?fly=1 (AC4)", () => {
  const capture = (overrides: Partial<Parameters<typeof deriveIntroFlightPlan>[0]> = {}) =>
    deriveIntroFlightPlan({
      isWelcomeBeat: false,
      flyMode: true,
      audioDurationMs: undefined,
      reducedMotion: false,
      introPath: {},
      ...overrides,
    });

  it("beholder default-settle (banens settleMs ?? DEFAULT_INTRO_PATH.settleMs)", () => {
    expect(capture().settleMs).toBe(DEFAULT_INTRO_PATH.settleMs);
    expect(capture({ introPath: { settleMs: 2222 } }).settleMs).toBe(2222);
  });

  it("fly-varighet undefined selv med audioDurationMs (ikke produkt-welcome)", () => {
    expect(capture({ audioDurationMs: 20000 }).flyDurationMs).toBeUndefined();
  });

  it("calmOverride = {} → banens fulle sveip beholdes for opptaket", () => {
    expect(capture().calmOverride).toEqual({});
  });

  it("flyr ALLTID: staticOnly=false selv med reducedMotion (capture er aldri static-only)", () => {
    expect(capture({ reducedMotion: true }).staticOnly).toBe(false);
  });

  it("capture vinner over welcome når begge flagg står (isProductWelcome krever !flyMode)", () => {
    const plan = deriveIntroFlightPlan({
      isWelcomeBeat: true,
      flyMode: true,
      audioDurationMs: 20000,
      reducedMotion: true,
      introPath: {},
    });
    // Capture-semantikk: default settle, full sveip, ingen VO-skalering, alltid fly.
    expect(plan.settleMs).toBe(DEFAULT_INTRO_PATH.settleMs);
    expect(plan.flyDurationMs).toBeUndefined();
    expect(plan.calmOverride).toEqual({});
    expect(plan.staticOnly).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Render-skall-invarianter i BoardMap3D etter dekomponeringen. Leser kilde via
// process.cwd() (ikke import.meta.url) så testen ikke kaster under jsdom.
// ---------------------------------------------------------------------------
describe("BoardMap3D — dekomponerings-invarianter (Unit 06.7)", () => {
  const src = readFileSync(
    join(process.cwd(), "components/variants/report/board/BoardMap3D.tsx"),
    "utf8",
  );

  it("AC6: CameraWaypointAuthor rendres fortsatt kun bak authorMode (?author=1)", () => {
    // authorMode leses fra ?author=1; komponenten mountes bak {authorMode && ...}.
    expect(src).toMatch(/get\("author"\)\s*===\s*"1"/);
    expect(src).toMatch(/\{authorMode\s*&&\s*\(?\s*[\s\S]*?<CameraWaypointAuthor/);
  });

  it("delegerer markørsett-seleksjon til useBoardMarkerSet (ekstrahert)", () => {
    expect(src).toMatch(/useBoardMarkerSet\(/);
    // De tunge memoene skal IKKE lenger ligge inline i orchestratoren.
    expect(src).not.toMatch(/const markerPOIs = useMemo/);
    expect(src).not.toMatch(/selectBlobPOIs|selectFlyoverBlobs/);
  });

  it("delegerer flythrough-orkestrering til useBoardFlythrough (ekstrahert)", () => {
    expect(src).toMatch(/useBoardFlythrough\(/);
    // De tre imperative flythrough-effektene skal ikke lenger ligge inline.
    expect(src).not.toMatch(/runIntroFlythrough|runEstablishingFlythrough/);
    expect(src).not.toMatch(/flyCameraTo\?\.\(/);
  });

  it("AC3: samme hasVoiceOver-signal mater BÅDE autoOrbit OG markørsettet", () => {
    // hasVoiceOver kommer fra useBoardMarkerSet og sendes til director som autoOrbit.
    expect(src).toMatch(/hasVoiceOver/);
    expect(src).toMatch(/autoOrbit:\s*hasVoiceOver/);
  });

  it("bruker deriveIntroActive for det AND-ede intro-flagget (AC2)", () => {
    expect(src).toMatch(/deriveIntroActive\(/);
  });
});

// ---------------------------------------------------------------------------
// Establishing-choreografi-orkestrering (PRD 10 Unit 10.2). De pure mekanismene
// (runEstablishingFlythrough, deriveIntroActive AND-out) er behovs-testet
// andre steder (board-establishing-flythrough.test.ts + describe over); her
// guardes WIRING-invariantene som lever inne i React-effekter/JSX og som
// verbatim-porten må bevare. Kilde-leses via process.cwd() (ikke jsdom-render),
// samme stil som dekomponerings-invariantene over.
// ---------------------------------------------------------------------------
describe("Establishing-shot-flythrough — orkestrerings-invarianter (Unit 10.2)", () => {
  const orchSrc = readFileSync(
    join(process.cwd(), "components/variants/report/board/board-flythrough-orchestrator.ts"),
    "utf8",
  );
  const boardSrc = readFileSync(
    join(process.cwd(), "components/variants/report/board/BoardMap3D.tsx"),
    "utf8",
  );
  const shellSrc = readFileSync(
    join(process.cwd(), "components/variants/report/reels/ReportReelsPage.tsx"),
    "utf8",
  );

  it("AC1: establishingFlag leser ?establishing=1; establishingShot = getEstablishingShot(slug); establishingMode = !!establishingShot", () => {
    expect(boardSrc).toMatch(/get\("establishing"\)\s*===\s*"1"/);
    expect(boardSrc).toMatch(/getEstablishingShot\(/);
    expect(boardSrc).toMatch(/establishingMode\s*=\s*!!establishingShot/);
  });

  it("AC2: establishing-effekten kjører runEstablishingFlythrough med path=establishingShot, staticOnly=reducedMotion", () => {
    // Effekt-vakten: ukjent slug → establishingShot=undefined → no-op (ikke krasj).
    expect(orchSrc).toMatch(
      /if\s*\(!establishingMode\s*\|\|\s*!establishingShot\s*\|\|\s*!map3dInstance\)\s*return;/,
    );
    expect(orchSrc).toMatch(/runEstablishingFlythrough\(/);
    expect(orchSrc).toMatch(/path:\s*establishingShot/);
    expect(orchSrc).toMatch(/staticOnly:\s*reducedMotion/);
  });

  it("AC2/AC3: onProgress flipper bloom når s >= bloomAtProgress (reset til false når effekten (re)kjører)", () => {
    expect(orchSrc).toMatch(/bloomAt\s*=\s*establishingShot\.bloomAtProgress/);
    expect(orchSrc).toMatch(/setBloomStarted\(false\)/); // reset ved effekt-start
    expect(orchSrc).toMatch(/onProgress:\s*\(s\)\s*=>\s*\{[\s\S]*?if\s*\(s\s*>=\s*bloomAt\)\s*setBloomStarted\(true\)/);
  });

  it("AC2: reduced-motion (ingen flytur) fyrer bloom på 'done' så strøket ikke står tomt på statisk positur", () => {
    expect(orchSrc).toMatch(
      /if\s*\(phase\s*===\s*"done"\s*&&\s*reducedMotion\)\s*setBloomStarted\(true\)/,
    );
  });

  it("AC3: showReveal gates på (establishingMode && bloomStarted) — kaskaden venter til kameraet stiger over platået", () => {
    expect(boardSrc).toMatch(/establishingMode\s*&&\s*bloomStarted/);
  });

  it("AC4: establishingMode AND-er bort intro-eierne (mates inn i deriveIntroActive) OG ORes inn til director så den yield-er", () => {
    // AND-out: establishingMode er ett av deriveIntroActive-argumentene.
    expect(boardSrc).toMatch(/deriveIntroActive\(\{[\s\S]*?establishingMode[\s\S]*?\}\)/);
    // Director-yield: introActive || establishingMode mates til useBoard3DCamera.
    expect(boardSrc).toMatch(/introActive:\s*introActive\s*\|\|\s*establishingMode/);
  });

  it("AC5: window.__placyEstablishing settes per fase i onPhase", () => {
    expect(orchSrc).toMatch(/onPhase:\s*\(phase[\s\S]*?__placyEstablishing/);
    expect(orchSrc).toMatch(/__placyEstablishing\s*=\s*\n?\s*phase/);
  });

  it("AC6: cross-file splash-skip-kontrakt — shell (PRD 9) og choreografi (PRD 10) deler KUN URL-strengen 'establishing'", () => {
    // PRD 10-siden: BoardMap3D leser flagget og eier choreografien.
    expect(boardSrc).toMatch(/get\("establishing"\)/);
    // PRD 9-siden (shell): samme flagg-streng hopper over splash + avdekker board.
    expect(shellSrc).toMatch(/get\("establishing"\)\s*!==\s*"1"/);
    expect(shellSrc).toMatch(/setSplashVisible\(false\)/);
    expect(shellSrc).toMatch(/setBoardRevealed\(true\)/);
    // Choreografi-filene importerer/redigerer IKKE shell-filen (én-veis kobling
    // via flagg-strengen, ikke via modul-avhengighet).
    expect(orchSrc).not.toMatch(/ReportReelsPage/);
    expect(boardSrc).not.toMatch(/ReportReelsPage/);
  });
});
