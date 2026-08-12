#!/usr/bin/env npx tsx
/**
 * Åpningstider + telefon fra Google Places → `v2.pois`.
 *
 * Usage:
 *   npx tsx scripts/refresh-opening-hours.ts --project placy-demo_sundsoya            # dry-run
 *   npx tsx scripts/refresh-opening-hours.ts --project placy-demo_sundsoya --apply    # skriv
 *   npx tsx scripts/refresh-opening-hours.ts --area ranheim --apply
 *   npx tsx scripts/refresh-opening-hours.ts --all --apply                           # hele v2.pois
 *
 * Flagg: `--apply` (skriv), `--force` (hent på nytt selv om åpningstider finnes),
 * `--limit N` (behandle kun N POI-er — billig røyktest).
 *
 * MIGRERT 2026-08-12 (PRD Unit 4): scriptet kalte tidligere LEGACY-endepunktet
 * `maps.googleapis.com/maps/api/place/details/json` og sendte API-nøkkelen som
 * `key`-parameter i QUERYSTRINGEN. Det bryter CLAUDE.md-regelen «ALLTID
 * API-nøkkel i header, aldri URL-querystring (leker i logs)». Nå går alt via
 * `fetchPlaceDetails` (Places API New, `X-Goog-Api-Key`-header). Regresjonsvernet
 * ligger i `lib/google-places/fetch-place-details.test.ts` og
 * `scripts/places-backfill-lib.test.ts`, som asserter mot den faktiske
 * request-URL-en.
 *
 * ØVRIGE ENDRINGER I SAMME MIGRERING:
 *   - Dry-run er default. Tidligere skrev scriptet umiddelbart, mot ALLE POI-er
 *     med place_id (5 386 rader) uten noen måte å avgrense.
 *   - Scope er påkrevd (`--project`/`--area`/`--all`) — kostnadsvern.
 *   - To-fase: alt hentes før noe skrives, så 403/429 aborterer med null writes.
 *   - Backup til `backups/` og post-write-verifisering, som gemini-grounding.ts.
 */

import { config } from "dotenv";
import {
  collectOpeningHours,
  describeScope,
  fetchScopedPois,
  formatSummary,
  parseMode,
  parseScope,
  QuotaAbort,
  verifyWritten,
  writeBackup,
  writeFacts,
  type OpeningHoursPoiRow,
  type SupabaseCtx,
} from "./places-backfill-lib";

config({ path: ".env.local" });

const SELECT = "id,name,google_place_id,opening_hours_json";

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

  console.log("=== Åpningstider + telefon (Places API New) ===");
  console.log(`Scope:  ${describeScope(scope)}`);
  console.log(`Modus:  ${mode.apply ? "APPLY" : "DRY RUN"}${mode.force ? " (force)" : ""}`);
  if (mode.limit) console.log(`Limit:  ${mode.limit}`);
  console.log();

  const { pois, note } = await fetchScopedPois<OpeningHoursPoiRow>(ctx, scope, SELECT);
  console.log(`Hentet: ${note}`);
  if (pois.length === 0) {
    console.log("Ingen POI-er i scope. Ingenting å gjøre.");
    return;
  }

  // Backup før alt — også på dry-run. Gratis forsikring (mønster: gemini-grounding.ts).
  const backupPath = writeBackup(
    `pois-opening-hours-${scope.kind === "project" ? scope.projectId : scope.kind}`,
    pois,
  );
  console.log(`Backup: ${backupPath}`);
  console.log();

  // Fase 1 — hent alt fra Google. Ingen writes her.
  let result;
  try {
    result = await collectOpeningHours(pois, {
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

  // Post-write-verifisering.
  const problems = await verifyWritten(ctx, result.facts, [
    "opening_hours_json",
    "google_phone",
  ]);
  if (problems.length > 0) {
    console.error(`\nPost-write-verifisering: ${problems.length} POI-er mangler data:`);
    for (const p of problems) console.error(`  ${p.name} — mangler ${p.missing.join(", ")}`);
    console.error(`Backup: ${backupPath}`);
    process.exit(1);
  }
  console.log("Post-write-verifisering: alle kolonner har verdi");
  console.log(`\n✓ Ferdig. Google-API-kall: ${result.apiCalls}. Backup: ${backupPath}`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
