#!/usr/bin/env node
// @ts-check
/**
 * Bundle-bevis for board-skallets lazy-load-grenser (PRD 9 Unit 7 / PRD 2
 * Beslutning 14). Binær pass/fail.
 *
 * Kjør ETTER `npm run build`:
 *   node scripts/verify-board-bundle.mjs
 *
 * Beviser at de fire tunge nivå-2-/ortogonale modulene IKKE ligger i den
 * initielle lasten for et rapport-board, men i separate dynamic-import-chunker:
 *
 *   1. splash-<video>-pipeline + kuratert hero-asset-lasting
 *      → DesktopReportSplash / MobileReportSplash / EmbedArrivalLoader
 *   2. voiceover-orchestration → ReelsAudioOrchestrator
 *
 * NB (Next 16 / Turbopack): `webpackChunkName`-kommentarene i ReportReelsPage
 * er INERTE i bygget — Turbopack hasher chunk-navn og emitterer ikke
 * `.next/app-build-manifest.json`. Chunk-NAVN kan derfor ikke brukes som
 * identifikator. Beviset går i stedet på kode-MARKØRER (string-literaler som
 * overlever minifisering) mot Turbopacks per-rute-manifester:
 *
 *   entry  = build-manifest.json → rootMainFiles + polyfillFiles (initiell last)
 *   lazy   = react-loadable-manifest.json → dynamic-import-chunkene
 *
 * To assertions per modul:
 *   A: markøren finnes i NØYAKTIG ÉN lazy-chunk → modulen er faktisk code-splittet
 *      (ikke bare fraværende/død).
 *   B: markøren er FRAVÆRENDE fra alle entry-chunker → ingenting tungt på
 *      initiell last.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = join(process.cwd(), ".next");
const ROUTE = "/eiendom/[customer]/[project]/rapport-board";
const ROUTE_MANIFEST_DIR = join(
  NEXT_DIR,
  "server",
  "app",
  "eiendom",
  "[customer]",
  "[project]",
  "rapport-board",
  "page",
);

/**
 * Unike kode-markører per modul. `all: true` krever at ALLE tokens finnes i
 * samme chunk (brukes der ett token alene også kan stamme fra en annen modul —
 * f.eks. `voiceover_played`, som også er en literal i event-schema).
 * @type {{module: string, tokens: string[], all?: boolean}[]}
 */
const MODULES = [
  {
    module: "DesktopReportSplash (splash-<video> + kuratert hero)",
    tokens: ["(min-width: 1024px) 50vw, 0px"],
  },
  {
    module: "MobileReportSplash (splash-<video> + kuratert hero)",
    tokens: [" – nabolag"],
  },
  {
    module: "EmbedArrivalLoader (splash-<video> + kuratert hero)",
    tokens: ["(min-width: 768px) 28rem, 90vw"],
  },
  {
    module: "ReelsAudioOrchestrator (voiceover-orchestration)",
    tokens: ["voiceover_played", "visibilitychange"],
    all: true,
  },
];

let failed = false;
const fail = (/** @type {string} */ msg) => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};
const ok = (/** @type {string} */ msg) => console.log(`  ✓ ${msg}`);

const buildManifestPath = join(ROUTE_MANIFEST_DIR, "build-manifest.json");
const loadableManifestPath = join(
  ROUTE_MANIFEST_DIR,
  "react-loadable-manifest.json",
);

for (const p of [buildManifestPath, loadableManifestPath]) {
  if (!existsSync(p)) {
    console.error(
      `FEIL: ${p.replace(process.cwd() + "/", "")} mangler.\n` +
        `Kjør \`npm run build\` først (manifestene er per-rute i Next 16/Turbopack).`,
    );
    process.exit(2);
  }
}

const buildManifest = JSON.parse(readFileSync(buildManifestPath, "utf8"));
const loadableManifest = JSON.parse(readFileSync(loadableManifestPath, "utf8"));

/** @type {string[]} */
const entryFiles = [
  ...(buildManifest.rootMainFiles ?? []),
  ...(buildManifest.polyfillFiles ?? []),
];
/** @type {string[]} */
const lazyFiles = [
  ...new Set(
    Object.values(loadableManifest).flatMap(
      (/** @type {any} */ v) => v.files ?? [],
    ),
  ),
].sort();

if (entryFiles.length === 0) {
  console.error("FEIL: rutas entry-chunk-liste (rootMainFiles) er tom.");
  process.exit(2);
}
if (lazyFiles.length === 0) {
  console.error(
    "FEIL: ingen dynamic-import-chunker for ruta — code-splittingen er borte.",
  );
  process.exit(2);
}

/** Les en chunk-fil relativt til .next. Manglende fil → tom streng. */
const readChunk = (/** @type {string} */ rel) => {
  const p = join(NEXT_DIR, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};
const basename = (/** @type {string} */ rel) => rel.split("/").pop();

/** Chunker som inneholder markøren (alle tokens hvis `all`, ellers minst ett). */
const matching = (
  /** @type {string[]} */ files,
  /** @type {string[]} */ tokens,
  /** @type {boolean | undefined} */ all,
) =>
  files.filter((f) => {
    const src = readChunk(f);
    return all
      ? tokens.every((t) => src.includes(t))
      : tokens.some((t) => src.includes(t));
  });

console.log(`\nRute: ${ROUTE}`);
console.log(`  entry-chunker (initiell last): ${entryFiles.length}`);
for (const f of entryFiles) console.log(`    ${basename(f)}`);
console.log(`  dynamic-import-chunker: ${lazyFiles.length}`);
for (const f of lazyFiles) console.log(`    ${basename(f)}`);

console.log("\n[A] Modul-kode ligger i nøyaktig én dynamic-import-chunk:");
/** @type {Record<string, string>} */
const lazyChunkOf = {};
for (const { module, tokens, all } of MODULES) {
  const hits = matching(lazyFiles, tokens, all);
  if (hits.length === 0) {
    fail(
      `${module}: markør «${tokens.join(" + ")}» finnes i INGEN lazy-chunk ` +
        `(modulen er ikke code-splittet — eller markøren er utdatert)`,
    );
    continue;
  }
  if (hits.length > 1) {
    fail(
      `${module}: markør funnet i ${hits.length} lazy-chunker ` +
        `(${hits.map(basename).join(", ")}) — duplisert kode`,
    );
    continue;
  }
  lazyChunkOf[module] = hits[0];
  ok(`${module} → ${basename(hits[0])}`);
}

console.log("\n[B] Modul-kode er fraværende fra ALLE entry-chunker:");
for (const { module, tokens, all } of MODULES) {
  if (!(module in lazyChunkOf)) continue; // allerede feilet i [A]
  const leaked = matching(entryFiles, tokens, all);
  if (leaked.length > 0) {
    fail(
      `${module}: LEKKET til entry-chunk(er): ${leaked.map(basename).join(", ")}`,
    );
  } else {
    ok(`${module}: ikke i initiell last`);
  }
}

console.log("");
if (failed) {
  console.error("BUNDLE-BEVIS: FAIL");
  process.exit(1);
}
console.log(
  `BUNDLE-BEVIS: PASS — alle ${MODULES.length} tunge moduler er lazy og ute av initiell last.`,
);
process.exit(0);
