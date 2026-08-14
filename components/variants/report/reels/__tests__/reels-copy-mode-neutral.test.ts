import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R13: ingen statisk tekst på rapport-flaten skal påstå at nærområdet ligger «i
 * gangavstand».
 *
 * Påstanden var alt feil før reisemodus-veksleren: spennet på
 * intern_martin-barstads-veg-23c er 6–35 minutter til fots. Med modusveksleren
 * blir den i tillegg selvmotsigende — boardet kan stå i bil-modus.
 *
 * Vakten er en KILDE-skanning, ikke en render-test, fordi tekstene er
 * konstanter i fem ulike filer og velges av venue-type, lyd-tilstedeværelse og
 * embed-modus. En render-test måtte truffet hver kombinasjon; skanningen fanger
 * dem alle, også en ny som legges til senere.
 *
 * Genererte og kuraterte tekster er UTENFOR denne vakten (se planens Scope
 * Boundaries) — bridge-text-generatoren og strøk-editorial er gang-rammet med
 * vilje. Derfor skannes bare de statiske copy-filene.
 */

const STATIC_COPY_FILES = [
  "components/variants/report/reels/reels-data.ts",
  "components/variants/report/reels/ReportReelsPage.tsx",
  "components/variants/report/reels/DesktopReportSplash.tsx",
  "components/variants/report/reels/MobileReportSplash.tsx",
];

/** Kommentarlinjer er prosa som forklarer regelen — de skal kunne nevne ordet. */
function codeLinesOf(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
}

describe("R13: statisk copy påstår ikke gangavstand", () => {
  it.each(STATIC_COPY_FILES)("%s", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const offenders = codeLinesOf(source).filter((line) =>
      /gangavstand/i.test(line),
    );
    expect(offenders).toEqual([]);
  });
});
