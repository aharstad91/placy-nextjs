import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveIntroActive } from "./board-flythrough-orchestrator";

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
