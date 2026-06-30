import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_IDS } from "@/lib/themes/theme-ids";
import { getThemeDefaults } from "@/lib/pipeline/report-defaults";
import { GENERATED_MARKER, buildPythonBlock } from "./gen-python-theme-ids";

const PYTHON_FILE = join(process.cwd(), "scripts/extract-skolekrets-boundary.py");
const pythonSrc = readFileSync(PYTHON_FILE, "utf8");

function parsePythonThemeIds(src: string): string[] {
  const match = src.match(/THEME_IDS = \[([^\]]*)\]/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'))
    .map((l) => l.replace(/^"|",?$/g, ""));
}

describe("r08.5 drift-guard: Python THEME_IDS stemmer med TS THEME_IDS", () => {
  it("Python THEME_IDS matches canonical TS THEME_IDS", () => {
    const pythonIds = parsePythonThemeIds(pythonSrc);
    expect(pythonIds).toEqual([...THEME_IDS]);
  });

  it("contains generated marker comment", () => {
    expect(pythonSrc).toContain(GENERATED_MARKER);
  });

  it("generated marker precedes THEME_IDS list", () => {
    const markerPos = pythonSrc.indexOf(GENERATED_MARKER);
    const blockPos = pythonSrc.indexOf("THEME_IDS = [");
    expect(markerPos).toBeGreaterThanOrEqual(0);
    expect(blockPos).toBeGreaterThan(markerPos);
  });

  it("THEME_IDS er bolig-profil — 6 temaer (naering deferred)", () => {
    const pythonIds = parsePythonThemeIds(pythonSrc);
    const boligIds = getThemeDefaults("bolig").map((t) => t.id);
    expect(pythonIds).toEqual(boligIds);
    expect(pythonIds).toHaveLength(6);
  });

  it("buildPythonBlock-output matcher faktisk Python-fil (ingen drift)", () => {
    const expected = buildPythonBlock(THEME_IDS);
    const match = pythonSrc.match(
      /(# GENERERT fra lib\/themes\/theme-ids\.ts[^\n]*\nTHEME_IDS = \[[^\]]*\])/
    );
    expect(match, "Generert blokk ikke funnet i Python-fil").toBeTruthy();
    expect(match![1]).toBe(expected);
  });
});
