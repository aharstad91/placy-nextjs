#!/usr/bin/env node
// @ts-check
/**
 * Bundle-bevis for board-skallets lazy-load-grenser (PRD 9 Unit 7 / PRD 2
 * Beslutning 14). Binær pass/fail mot NAVNGITTE identifikatorer.
 *
 * Kjør ETTER `npm run build`:
 *   node scripts/verify-board-bundle.mjs
 *
 * Beviser at de tre PRD-2-verifiserte tunge nivå-2-/ortogonale modulene IKKE
 * ligger i entry-chunken for et nivå-1 rapport-board, men i SEPARATE lazy-chunker:
 *
 *   1. reels/splash-<video>-pipeline + kuratert hero-asset-lasting
 *      → report-splash-desktop / report-splash-mobile / report-embed-arrival
 *   2. voiceover-orchestration
 *      → reels-audio-orchestration
 *
 * To uavhengige assertions:
 *   A (autoritativ, alle 4 chunker): den navngitte chunk-fila finnes, og
 *     chunk-en er FRAVÆRENDE fra rutas entry-chunk-liste (app-build-manifest).
 *   B (innholds-kryssjekk, splash-trioen): en unik kode-markør finnes i modulens
 *     lazy-chunk, men i INGEN av rutas entry-chunker → modul-KODEN (ikke bare
 *     chunk-navnet) er ute av entry-chunken.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = join(process.cwd(), ".next");
const CHUNKS_DIR = join(NEXT_DIR, "static", "chunks");
const ROUTE = "/eiendom/[customer]/[project]/rapport-board/page";

/** De fire navngitte lazy-chunkene (webpackChunkName i ReportReelsPage.tsx). */
const NAMED_CHUNKS = [
  "report-splash-desktop",
  "report-splash-mobile",
  "report-embed-arrival",
  "reels-audio-orchestration",
];

/**
 * Unike kode-markører for innholds-kryssjekk (overlever minifisering — string-
 * literaler fra JSX). Orchestration-modulen har ingen unik string-literal
 * (struktural unikhet), så den dekkes kun av assertion A.
 * @type {{module: string, chunk: string, marker: string}[]}
 */
const CONTENT_MARKERS = [
  {
    module: "DesktopReportSplash (splash-<video> + kuratert hero)",
    chunk: "report-splash-desktop",
    marker: "(min-width: 1024px) 50vw, 0px",
  },
  {
    module: "MobileReportSplash (splash-<video> + kuratert hero)",
    chunk: "report-splash-mobile",
    marker: " – nabolag",
  },
  {
    module: "EmbedArrivalLoader (splash-<video> + kuratert hero)",
    chunk: "report-embed-arrival",
    marker: "(min-width: 768px) 28rem, 90vw",
  },
];

let failed = false;
const fail = (/** @type {string} */ msg) => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};
const ok = (/** @type {string} */ msg) => console.log(`  ✓ ${msg}`);

if (!existsSync(NEXT_DIR) || !existsSync(CHUNKS_DIR)) {
  console.error(
    "FEIL: .next/static/chunks mangler. Kjør `npm run build` først.",
  );
  process.exit(2);
}

// Rutas entry-chunk-liste (initiell last) fra app-build-manifest.
const appManifest = JSON.parse(
  readFileSync(join(NEXT_DIR, "app-build-manifest.json"), "utf8"),
);
const entryFiles = appManifest.pages?.[ROUTE];
if (!Array.isArray(entryFiles)) {
  console.error(`FEIL: fant ikke ruta ${ROUTE} i app-build-manifest.json.`);
  process.exit(2);
}
const entryBasenames = entryFiles.map((/** @type {string} */ f) =>
  f.split("/").pop(),
);

// Alle emitterte chunk-filer.
const allChunkFiles = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith(".js"));

/** Finn den faktiske (hashede) fila for et navngitt chunk. */
const findChunkFile = (/** @type {string} */ name) =>
  allChunkFiles.find((f) => f.startsWith(`${name}.`));

console.log(`\nEntry-chunker for ${ROUTE}:`);
for (const f of entryBasenames) console.log(`    ${f}`);

console.log("\n[A] Navngitte lazy-chunker — eksisterer + fraværende fra entry:");
const chunkPaths = {};
for (const name of NAMED_CHUNKS) {
  const file = findChunkFile(name);
  if (!file) {
    fail(`${name}: ingen emittert chunk-fil (forventet ${name}.<hash>.js)`);
    continue;
  }
  chunkPaths[name] = join(CHUNKS_DIR, file);
  // Entry-chunk-lista skal ALDRI liste lazy-chunken (lastes on-demand).
  const inEntry = entryBasenames.some((/** @type {string} */ b) =>
    b.startsWith(`${name}.`),
  );
  if (inEntry) {
    fail(`${name}: chunk ligger i rutas entry-liste (skal være lazy)`);
  } else {
    ok(`${name} → ${file} (separat lazy-chunk, ikke i entry)`);
  }
}

console.log(
  "\n[B] Innholds-kryssjekk — modul-kode i lazy-chunk, fraværende fra ALLE entry-chunker:",
);
const entryPaths = entryBasenames
  .map((/** @type {string} */ b) => join(CHUNKS_DIR, b))
  .filter((p) => existsSync(p));
for (const { module, chunk, marker } of CONTENT_MARKERS) {
  const lazyPath = chunkPaths[chunk];
  const inLazy = lazyPath && readFileSync(lazyPath, "utf8").includes(marker);
  if (!inLazy) {
    fail(`${module}: markør «${marker}» IKKE i lazy-chunk ${chunk}`);
    continue;
  }
  const leaked = entryPaths.filter((p) =>
    readFileSync(p, "utf8").includes(marker),
  );
  if (leaked.length > 0) {
    fail(
      `${module}: markør «${marker}» LEKKET til entry-chunk(er): ${leaked
        .map((p) => p.split("/").pop())
        .join(", ")}`,
    );
  } else {
    ok(`${module}: markør i ${chunk}, fraværende fra alle entry-chunker`);
  }
}

console.log("");
if (failed) {
  console.error("BUNDLE-BEVIS: FAIL");
  process.exit(1);
}
console.log("BUNDLE-BEVIS: PASS — alle tre nivå-2-/ortogonale moduler er lazy.");
process.exit(0);
