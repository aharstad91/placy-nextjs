#!/usr/bin/env npx tsx
/**
 * Eksporter et board til prototypes/_data/ som ren JSON, slik at
 * vanilla-prototypene i prototypes/ kan jobbe mot ekte data uten
 * Next/Supabase-avhengighet.
 *
 * Eksporterer den AVLEDEDE board-modellen (`BoardData`) — samme
 * `transformToReportData` → `adaptBoardData`-kjede boardet selv rendrer, ikke
 * rå `products.config`. Det er avgjørende for troverdige prototyper: den
 * deterministiske minimum-garantien (generert kategori-editorial, highlights,
 * FAQ) oppstår NEDSTRØMS av configen. Leser du rå config, ser et nivå-1-board
 * tomt ut selv om boardet faktisk viser tekst.
 *
 * Snapshotet inneholder både `board` (avledet) og `project` (rå), pluss et
 * `meta`-felt som sier om boardet har avspillbar lyd — dvs. om det er nivå 1
 * (uten lyd) eller nivå 2 (med).
 *
 * Usage:
 *   npm run proto:data -- megler-harstad strindfjordvegen-10-7053-ranheim-norge
 *   npm run proto:data -- klp-eiendom ferjemannsveien-10
 *
 * NB: Må kjøres med NODE_OPTIONS=--conditions=react-server (npm-scriptet
 * gjør det) — v2-queries importerer `server-only`, som bare er no-op under
 * react-server-condition. Utenfor den kaster selve importen.
 */
import "./load-env";
import * as fs from "fs";
import * as path from "path";

import { getProductFromSupabaseV2 } from "../lib/supabase/v2-queries";
import { transformToReportData } from "../components/variants/report/report-data";
import { adaptBoardData, isPlayableAudio } from "../components/variants/report/board/board-data";
import type { ProductType } from "../lib/types";

const [customer, slug, productTypeArg] = process.argv.slice(2);

if (!customer || !slug) {
  console.error("Usage: npm run proto:data -- <customer> <slug> [productType=report]");
  process.exit(1);
}

const productType = (productTypeArg ?? "report") as ProductType;

async function main() {
  const project = await getProductFromSupabaseV2(customer, slug, productType);
  if (!project) {
    console.error(`Fant ikke board: ${customer}/${slug} (${productType})`);
    process.exit(1);
  }

  const reportData = transformToReportData(project);
  const board = adaptBoardData(reportData);

  // Nivå-skillet slik boardet selv brancher: har boardet avspillbar lyd?
  // (`isPlayableAudio` krever både url OG ikke-tom manus — én kilde, ingen drift.)
  const themes = project.reportConfig?.themes ?? [];
  const audioThemes = themes.filter(
    (t) => isPlayableAudio(t.audio) || isPlayableAudio(t.reelsAudio)
  ).length;
  const hasPlayableAudio = audioThemes > 0;

  // `board.poisById` er et Map — JSON.stringify ville gjort det til {}.
  // Serialiser som vanlig objekt; prototypene slår opp direkte på nøkkel.
  const { poisById, ...boardRest } = board;
  const snapshot = {
    meta: {
      customer,
      slug,
      productType,
      hasPlayableAudio,
      tier: hasPlayableAudio ? 2 : 1,
      audioThemes,
      exportedAt: new Date().toISOString(),
    },
    board: { ...boardRest, poisById: Object.fromEntries(poisById) },
    project,
  };

  const outDir = path.join(process.cwd(), "prototypes", "_data");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${customer}__${slug}.json`);
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2));

  const withEditorial = board.categories.filter((c) => c.editorial?.body).length;
  const generated = board.categories.filter((c) => c.editorial?.generated).length;
  const poiCount = board.categories.reduce((n, c) => n + c.pois.length, 0);
  console.log(
    `Skrev ${path.relative(process.cwd(), outFile)}\n` +
      `  NIVÅ ${snapshot.meta.tier} (${hasPlayableAudio ? `lyd på ${audioThemes} temaer` : "ingen lyd"})\n` +
      `  ${board.categories.length} kategorier, ${poiCount} POI-oppføringer` +
      ` — ${withEditorial} kategorier med brødtekst (${generated} generert deterministisk)`
  );
}

main();
