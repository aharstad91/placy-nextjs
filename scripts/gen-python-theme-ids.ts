#!/usr/bin/env tsx
/**
 * Genererer Python-konstantblokken THEME_IDS fra den kanoniske TypeScript-kilden
 * (lib/themes/theme-ids.ts) og oppdaterer extract-skolekrets-boundary.py in-place.
 *
 * Kjør ved endring av REPORT_THEME_DEFAULTS:
 *   npx tsx scripts/gen-python-theme-ids.ts
 */

import { THEME_IDS } from "@/lib/themes/theme-ids";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const PYTHON_FILE = join(process.cwd(), "scripts/extract-skolekrets-boundary.py");
export const GENERATED_MARKER =
  "# GENERERT fra lib/themes/theme-ids.ts — ikke rediger manuelt";

// [^\]]* matches newlines without needing dotAll flag (avoids es2018 target issue)
export const BLOCK_RE =
  /(# GENERERT fra lib\/themes\/theme-ids\.ts[^\n]*\n)?THEME_IDS = \[[^\]]*\]/;

export function buildPythonBlock(ids: readonly string[]): string {
  return [
    GENERATED_MARKER,
    "THEME_IDS = [",
    ...ids.map((id) => `    "${id}",`),
    "]",
  ].join("\n");
}

// Only execute when run directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const src = readFileSync(PYTHON_FILE, "utf8");
  if (!BLOCK_RE.test(src)) {
    process.stderr.write(`Fant ikke THEME_IDS-blokken i ${PYTHON_FILE}\n`);
    process.exit(1);
  }

  const block = buildPythonBlock(THEME_IDS);
  const updated = src.replace(BLOCK_RE, block);

  if (updated === src) {
    process.stdout.write(`✓ THEME_IDS er allerede oppdatert i ${PYTHON_FILE}\n`);
  } else {
    writeFileSync(PYTHON_FILE, updated, "utf8");
    process.stdout.write(`✓ Oppdaterte THEME_IDS i ${PYTHON_FILE}\n`);
  }
}
