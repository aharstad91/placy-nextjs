#!/usr/bin/env npx tsx
/**
 * Tar staged manus fra .curation-staging/<projectSlug>/<spor>.md og PATCHer
 * `products.config.reportConfig.heroAudio.manus` + `themes[].audio.manus`
 * for matchende prosjekt.
 *
 * Nullstiller audio.url, audio.voice, audio.model, audio.generatedAt og
 * audio.timings for hvert touched spor — så `audio-tour-build.ts` regenererer
 * MP3 + karaoke-timings uten --force.
 *
 * Spor-mapping:
 *   nabolaget.md → heroAudio (heroAudio.manus, ikke en theme)
 *   <theme-id>.md → themes[].audio.manus  (mat-drikke, barn-oppvekst, etc.)
 *
 * Usage:
 *   npx tsx scripts/apply-curation-staging.ts <project_id> <projectSlug>
 *   eks: npx tsx scripts/apply-curation-staging.ts banenor-eiendom_stasjonskvartalet stasjonskvartalet
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const projectId = process.argv[2];
const projectSlug = process.argv[3];
if (!projectId || !projectSlug) {
  console.error(
    "Usage: apply-curation-staging.ts <project_id> <projectSlug>",
  );
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const stagingDir = path.join(".curation-staging", projectSlug);
if (!fs.existsSync(stagingDir)) {
  console.error(`Staging dir mangler: ${stagingDir}`);
  process.exit(1);
}

function extractBody(md: string): string {
  const fmMatch = md.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const afterFrontmatter = fmMatch ? fmMatch[1] : md;
  return afterFrontmatter
    .replace(/^#\s+.*$/m, "")
    .replace(/\n+/g, " ")
    .trim();
}

interface ThemeAudio {
  manus?: string;
  url?: string;
  voice?: string;
  model?: string;
  generatedAt?: string;
  timings?: unknown;
}

interface Theme {
  id: string;
  audio?: ThemeAudio;
  [k: string]: unknown;
}

interface ReportConfig {
  heroAudio?: ThemeAudio;
  themes?: Theme[];
  [k: string]: unknown;
}

interface ProductRow {
  id: string;
  config: { reportConfig?: ReportConfig; [k: string]: unknown } | null;
  updated_at: string;
}

function clearAudioMeta(audio: ThemeAudio | undefined, manus: string): ThemeAudio {
  const next: ThemeAudio = { ...(audio ?? {}), manus };
  delete next.url;
  delete next.voice;
  delete next.model;
  delete next.generatedAt;
  delete next.timings;
  return next;
}

async function main() {
  // Read staged .md files
  const mdFiles = fs
    .readdirSync(stagingDir)
    .filter((f) => f.endsWith(".md"));

  const manusBySpor: Record<string, string> = {};
  for (const f of mdFiles) {
    const spor = f.replace(/\.md$/, "");
    const body = extractBody(fs.readFileSync(path.join(stagingDir, f), "utf-8"));
    if (body) manusBySpor[spor] = body;
  }
  console.log(`Lest ${Object.keys(manusBySpor).length} manus fra ${stagingDir}`);

  // Fetch product row
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/products?project_id=eq.${projectId}&product_type=eq.report&select=id,config,updated_at`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  const rows = (await fetchRes.json()) as ProductRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error(`Ingen products-rad for project_id=${projectId}`);
    process.exit(1);
  }
  const product = rows[0];
  const existingConfig = product.config ?? {};
  const rc: ReportConfig =
    (existingConfig.reportConfig as ReportConfig | undefined) ?? {};

  // Build new heroAudio (from nabolaget.md)
  const heroManus = manusBySpor["nabolaget"];
  const nextHero = heroManus ? clearAudioMeta(rc.heroAudio, heroManus) : rc.heroAudio;

  // Build new themes
  const touched: string[] = heroManus ? ["heroAudio (nabolaget)"] : [];
  const nextThemes: Theme[] = (rc.themes ?? []).map((t) => {
    const newManus = manusBySpor[t.id];
    if (!newManus) return t;
    touched.push(t.id);
    return { ...t, audio: clearAudioMeta(t.audio, newManus) };
  });

  console.log("Touched spor:", touched.join(", "));

  const nextRc: ReportConfig = {
    ...rc,
    heroAudio: nextHero,
    themes: nextThemes,
  };
  const nextConfig = { ...existingConfig, reportConfig: nextRc };

  // PATCH med optimistic lock
  const patchUrl = new URL(`${SUPABASE_URL}/rest/v1/products`);
  patchUrl.searchParams.set("id", `eq.${product.id}`);
  patchUrl.searchParams.set("updated_at", `eq.${product.updated_at}`);

  const patchRes = await fetch(patchUrl.toString(), {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ config: nextConfig }),
  });

  if (!patchRes.ok) {
    console.error("PATCH failed:", patchRes.status, await patchRes.text());
    process.exit(1);
  }
  const patched = (await patchRes.json()) as ProductRow[];
  if (!Array.isArray(patched) || patched.length === 0) {
    console.error("Optimistic lock — 0 rows touched");
    process.exit(1);
  }
  console.log("PATCH OK:", patched.length, "row(s)");
  console.log(`\nNeste steg: npx tsx scripts/audio-tour-build.ts ${projectId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
