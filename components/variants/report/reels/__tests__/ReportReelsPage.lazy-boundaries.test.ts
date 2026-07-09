import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PRD 9 Unit 7 — lazy-load-grense-implementasjon (source-level guard).
 *
 * Bundle-beviset (scripts/verify-board-bundle.mjs) krever en `npm run build` og
 * er derfor en runbook-/CI-sjekk, ikke en enhetstest. Denne testen låser
 * KILDE-invariantene som gjør at bygget produserer de separate lazy-chunkene:
 * de tre verifiserte tunge modulene MÅ være `dynamic()`-importert med stabilt
 * `webpackChunkName`, og MÅ IKKE være statisk importert. Skall-grensen
 * (`ResponsiveLayout = dynamic(ssr:false)`) bevares. Second-system-vakt (AC3):
 * KUN disse fire dynamiske grensene.
 */
const SRC = readFileSync(
  join(
    process.cwd(),
    "components/variants/report/reels/ReportReelsPage.tsx",
  ),
  "utf8",
);

const ORCHESTRATOR_SRC = readFileSync(
  join(
    process.cwd(),
    "components/variants/report/reels/ReelsAudioOrchestrator.tsx",
  ),
  "utf8",
);

describe("ReportReelsPage — lazy-load-grenser (Unit 7 AC1/AC3)", () => {
  const lazyModules: { name: string; chunk: string }[] = [
    { name: "DesktopReportSplash", chunk: "report-splash-desktop" },
    { name: "MobileReportSplash", chunk: "report-splash-mobile" },
    { name: "EmbedChrome", chunk: "report-embed-chrome" },
    { name: "ReelsAudioOrchestrator", chunk: "reels-audio-orchestration" },
  ];

  it("AC1: de tre splash-modulene + orchestratoren er dynamic()-importert med stabilt webpackChunkName", () => {
    for (const { name, chunk } of lazyModules) {
      // const <Name> = dynamic( ... webpackChunkName: "<chunk>" ... )
      const re = new RegExp(
        `const ${name} = dynamic\\([\\s\\S]*?webpackChunkName: "${chunk}"`,
      );
      expect(SRC, `${name} skal være dynamic() med chunk ${chunk}`).toMatch(re);
    }
  });

  it("AC1/AC3: ingen STATISK import av de fire lazy-modulene (de skal kun lastes via dynamic)", () => {
    expect(SRC).not.toMatch(/import\s*\{[^}]*\}\s*from\s*"\.\/DesktopReportSplash"/);
    expect(SRC).not.toMatch(/import\s*\{[^}]*\}\s*from\s*"\.\/MobileReportSplash"/);
    expect(SRC).not.toMatch(/import\s+EmbedChrome\s+from\s*"\.\/EmbedChrome"/);
    // Orchestratoren importeres aldri statisk her — kun via dynamic().
    expect(SRC).not.toMatch(
      /import\s+ReelsAudioOrchestrator\s+from\s*"\.\/ReelsAudioOrchestrator"/,
    );
    // Hooken skal ikke lenger kalles direkte i page-modulen (flyttet til den
    // lazy orchestrator-modulen) — ellers havner den i entry-chunken igjen.
    expect(SRC).not.toContain(
      'import { useReelsAudioOrchestration } from "./use-reels-audio-orchestration"',
    );
  });

  it("AC1: skall-grensen ResponsiveLayout = dynamic(ssr:false) er bevart", () => {
    expect(SRC).toMatch(/const ResponsiveLayout = dynamic\(/);
    expect(SRC).toMatch(/ssr: false/);
  });

  it("AC3 (second-system-vakt): nøyaktig 4 dynamic()-grenser i page-modulen", () => {
    const count = (SRC.match(/= dynamic\(/g) ?? []).length;
    // 2 splash + EmbedChrome + 1 orchestrator + 1 skall (ResponsiveLayout) = 5
    expect(count).toBe(5);
  });

  it("orchestrator-modulen wrapper KUN voiceover-hooken og rendrer null (atferds-ekvivalent søsken)", () => {
    expect(ORCHESTRATOR_SRC).toContain(
      'import { useReelsAudioOrchestration } from "./use-reels-audio-orchestration"',
    );
    expect(ORCHESTRATOR_SRC).toMatch(/useReelsAudioOrchestration\(\)/);
    expect(ORCHESTRATOR_SRC).toMatch(/return null/);
    expect(ORCHESTRATOR_SRC).toMatch(/export default function ReelsAudioOrchestrator/);
  });
});
