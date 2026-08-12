#!/usr/bin/env npx tsx
/**
 * Bilder fra Google Places → `v2.pois.gallery_images`.
 *
 * Bruker Places API (New) — $0/ubegrenset for bilde-operasjoner (Essentials
 * IDs-Only-nivået med `photos`-feltmaske). Henter opptil 3 bilder per POI,
 * resolver dem til lh3-CDN-URL-er og lagrer dem i `gallery_images[]`.
 *
 * Usage:
 *   npx tsx scripts/backfill-gallery-images.ts --project placy-demo_sundsoya           # dry-run
 *   npx tsx scripts/backfill-gallery-images.ts --project placy-demo_sundsoya --apply   # skriv
 *   npx tsx scripts/backfill-gallery-images.ts --area ranheim --apply
 *   npx tsx scripts/backfill-gallery-images.ts --all --apply
 *
 * Flagg: `--apply` (skriv), `--force` (hent på nytt selv om bilder finnes),
 * `--limit N`.
 *
 * ENDRET 2026-08-12 (PRD Unit 4):
 *   - Dry-run er default. Scriptet skrev tidligere umiddelbart.
 *   - Scope er påkrevd. `--area` alene var ubrukelig for boards utenfor
 *     Trondheim: alle 78 Sundsøya-POI-er har `area_id = null`, så bare
 *     `product_pois`-veien (`--project`) treffer dem.
 *   - `photo_resolved_at` stemples ved skriving. Uten det finner
 *     `refresh-photo-urls.ts` aldri de utløpte lh3-URL-ene igjen, og bildene
 *     blir brutte etter ~14 dager — midt i en salgsperiode.
 *   - To-fase: alt hentes før noe skrives, så 403/429 aborterer med null writes.
 */

import { config } from "dotenv";
import {
  collectGalleryImages,
  describeScope,
  fetchScopedPois,
  formatSummary,
  parseMode,
  parseScope,
  QuotaAbort,
  verifyWritten,
  writeBackup,
  writeFacts,
  type GalleryPoiRow,
  type SupabaseCtx,
} from "./places-backfill-lib";

config({ path: ".env.local" });

const SELECT = "id,name,google_place_id,gallery_images";

async function main() {
  const argv = process.argv.slice(2);

  const scopeResult = parseScope(argv);
  if ("error" in scopeResult) {
    console.error(scopeResult.error);
    process.exit(1);
  }
  const modeResult = parseMode(argv);
  if ("error" in modeResult) {
    console.error(modeResult.error);
    process.exit(1);
  }
  const { scope } = scopeResult;
  const mode = modeResult;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
    console.error(
      "Mangler env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY",
    );
    process.exit(1);
  }

  const ctx: SupabaseCtx = { url: SUPABASE_URL, key: SERVICE_ROLE_KEY };

  console.log("=== Bilder (Places API New, $0) ===");
  console.log(`Scope:  ${describeScope(scope)}`);
  console.log(`Modus:  ${mode.apply ? "APPLY" : "DRY RUN"}${mode.force ? " (force)" : ""}`);
  if (mode.limit) console.log(`Limit:  ${mode.limit}`);
  console.log();

  const { pois, note } = await fetchScopedPois<GalleryPoiRow>(ctx, scope, SELECT);
  console.log(`Hentet: ${note}`);
  if (pois.length === 0) {
    console.log("Ingen POI-er i scope. Ingenting å gjøre.");
    return;
  }

  const backupPath = writeBackup(
    `pois-gallery-${scope.kind === "project" ? scope.projectId : scope.kind}`,
    pois,
  );
  console.log(`Backup: ${backupPath}`);
  console.log();

  // Fase 1 — hent alt fra Google. Ingen writes her.
  let result;
  try {
    result = await collectGalleryImages(pois, {
      apiKey: GOOGLE_API_KEY,
      skipExisting: !mode.force,
      limit: mode.limit,
      onPoi: (line) => console.log(line),
    });
  } catch (err) {
    if (err instanceof QuotaAbort) {
      console.error();
      console.error(`ABORT: ${err.message}`);
      console.error(`Google-API-kall brukt før abort: ${err.partial.apiCalls}`);
      process.exit(2);
    }
    throw err;
  }

  console.log();
  console.log(formatSummary(result, mode));

  if (!mode.apply) return;
  if (result.facts.length === 0) {
    console.log("\nIngen POI-er å skrive.");
    return;
  }

  // Fase 2 — skriv.
  console.log("\n--- Skriver ---");
  const write = await writeFacts(ctx, result.facts, (line) => console.log(line));
  console.log(`Skrevet: ${write.written}/${result.facts.length}`);
  if (write.failed.length > 0) {
    console.error(`Skrivefeil: ${write.failed.length}`);
    for (const f of write.failed) console.error(`  ${f.name}: ${f.error}`);
  }

  const problems = await verifyWritten(ctx, result.facts, [
    "gallery_images",
    "photo_resolved_at",
  ]);
  if (problems.length > 0) {
    console.error(`\nPost-write-verifisering: ${problems.length} POI-er mangler data:`);
    for (const p of problems) console.error(`  ${p.name} — mangler ${p.missing.join(", ")}`);
    console.error(`Backup: ${backupPath}`);
    process.exit(1);
  }
  console.log("Post-write-verifisering: alle kolonner har verdi");
  console.log(`\n✓ Ferdig. Google-API-kall: ${result.apiCalls}. Backup: ${backupPath}`);
  console.log(
    "  MERK: lh3-URL-ene utløper etter ~14 dager. Kjør " +
      "`npx tsx scripts/refresh-photo-urls.ts` før demo/visning.",
  );
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
