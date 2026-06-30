import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  readBoardUrlFlags,
  readBoardUrlFlagsFromWindow,
  type BoardUrlFlags,
} from "./board-url-flags";

const ALL_OFF: BoardUrlFlags = {
  filmMode: false,
  flyMode: false,
  establishingFlag: false,
  authorMode: false,
};

// readBoardUrlFlags — lese-kontrakten (AC1 + AC6).
describe("readBoardUrlFlags — flagg-leser", () => {
  it("tom query-streng → alle flagg av", () => {
    expect(readBoardUrlFlags("")).toEqual(ALL_OFF);
  });

  it("ukjente params → alle flagg av (ingen lekkasje fra fremmede nøkler)", () => {
    expect(readBoardUrlFlags("?foo=1&bar=baz")).toEqual(ALL_OFF);
  });

  it("?film=1 → kun filmMode", () => {
    expect(readBoardUrlFlags("?film=1")).toEqual({ ...ALL_OFF, filmMode: true });
  });

  it("?fly=1 → kun flyMode", () => {
    expect(readBoardUrlFlags("?fly=1")).toEqual({ ...ALL_OFF, flyMode: true });
  });

  it("?establishing=1 → kun establishingFlag", () => {
    expect(readBoardUrlFlags("?establishing=1")).toEqual({
      ...ALL_OFF,
      establishingFlag: true,
    });
  });

  it("?author=1 → kun authorMode", () => {
    expect(readBoardUrlFlags("?author=1")).toEqual({ ...ALL_OFF, authorMode: true });
  });

  // Hvert flagg er aktivt KUN ved den eksakte verdien "1" (byte-identisk med de
  // tidligere inline-`.get(x) === "1"`-lesningene).
  it.each([
    ["?film=0", "film=0"],
    ["?film=true", "film=true"],
    ["?film=2", "film=2"],
    ["?film=", "tom verdi"],
    ["?fly=0", "fly=0"],
    ["?establishing=yes", "establishing=yes"],
    ["?author=on", "author=on"],
  ])("%s (%s) → alle flagg av (kun \"1\" aktiverer)", (search) => {
    expect(readBoardUrlFlags(search)).toEqual(ALL_OFF);
  });

  it("uten ledende '?' parser likt (URLSearchParams-toleranse)", () => {
    expect(readBoardUrlFlags("film=1")).toEqual({ ...ALL_OFF, filmMode: true });
  });

  it("alle fire flagg samtidig → alle på (uavhengige akser)", () => {
    expect(readBoardUrlFlags("?film=1&fly=1&establishing=1&author=1")).toEqual({
      filmMode: true,
      flyMode: true,
      establishingFlag: true,
      authorMode: true,
    });
  });

  it("?fly=1 leses uavhengig av film — flyMode impliserer film-modus i KONSUM, ikke i leseren", () => {
    // Leseren rapporterer rå flagg-state; film-implikasjonen av ?fly=1 (pin-drop +
    // 'free' cameraMode) håndheves av konsumentene (useBoardMarkerSet / BoardMap),
    // ikke ved at leseren setter filmMode=true. Render-nivå-pin-drop reagerer uansett
    // på (filmMode || flyMode || establishingMode), så ?fly=1 alene dropper pins.
    expect(readBoardUrlFlags("?fly=1")).toEqual({ ...ALL_OFF, flyMode: true });
  });
});

describe("readBoardUrlFlagsFromWindow — mount-trygg variant", () => {
  it("returnerer en BoardUrlFlags og speiler window.location.search", () => {
    // jsdom-window finnes (board-tester kjører under jsdom); default search er tom.
    const flags = readBoardUrlFlagsFromWindow();
    expect(flags).toEqual(readBoardUrlFlags(window.location.search));
    expect(Object.keys(flags).sort()).toEqual(
      ["authorMode", "establishingFlag", "filmMode", "flyMode"].sort(),
    );
  });
});

// ── Kilde-invarianter: homing av kontrakten (AC1) + cross-file-kontrakt (AC4) ──
// Les filene som tekst (process.cwd(), ikke import.meta.url — kaster under jsdom).
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const BOARDMAP3D = "components/variants/report/board/BoardMap3D.tsx";
const BOARDMAP = "components/variants/report/board/BoardMap.tsx";
const HELPER = "components/variants/report/board/board-url-flags.ts";

describe("URL-flagg-kontrakt — kilde-invarianter", () => {
  it("AC1: BoardMap3D leser flaggene ÉN gang ved mount via board-url-flags", () => {
    const src = read(BOARDMAP3D);
    expect(src).toContain('from "./board-url-flags"');
    // Lest én gang i en useState-initialiserer (read-once-at-mount).
    expect(src).toMatch(/useState\(\s*readBoardUrlFlagsFromWindow\s*,?\s*\)/);
    // De fire flaggene destruktureres fra ÉN state-kilde (ikke fire separate lesninger).
    expect(src).toMatch(
      /\[\{\s*authorMode,\s*filmMode,\s*flyMode,\s*establishingFlag\s*\}\]\s*=\s*useState/,
    );
  });

  it("AC1: BoardMap3D inline-leser ikke lenger flaggene fra URLSearchParams", () => {
    const src = read(BOARDMAP3D);
    for (const flag of ["film", "fly", "establishing", "author"]) {
      expect(src).not.toContain(`.get("${flag}")`);
    }
  });

  it("AC6: kontrakt-modulen enumererer alle fire flagg-nøklene", () => {
    const src = read(HELPER);
    for (const flag of ["?film=1", "?fly=1", "?establishing=1", "?author=1"]) {
      expect(src).toContain(flag);
    }
  });

  it("AC4: ?fly=1-free-default i BoardMap har BEGGE triggere (konversen free⇒?fly=1 er FALSK)", () => {
    const src = read(BOARDMAP);
    // 'free' har to triggere: !hasVoiceOver ELLER ?fly=1 (PRD 9 Unit 3). Begge må
    // finnes — pinner at ?fly=1 er ÉN av to (no-VO-board er også free uten flagget).
    expect(src).toMatch(/if\s*\(\s*!hasVoiceOver\s*\)\s*return\s*"free"/);
    expect(src).toMatch(/\.get\("fly"\)\s*===\s*"1"/);
  });
});
