#!/usr/bin/env npx tsx
/**
 * Importer postnummerområde-polygoner fra Kartverket til `v2.postal_areas`.
 *
 * Dette er grå-kartet i dekningsregnskapet: hvert postnummer i markedet finnes
 * som en form, uavhengig av om noen har spurt om det ennå. Modellen er å gjøre
 * jobben på området FØR en megler kommer med en adresse — geometri koster ingen
 * kvote og ingen dømmekraft, så det er ingen grunn til å hente den «ved behov».
 *
 * Bruk:
 *   npx tsx scripts/import-postal-areas.ts                    # dry-run
 *   npx tsx scripts/import-postal-areas.ts --apply            # skriv
 *   npx tsx scripts/import-postal-areas.ts --kommune 5001     # én kommune
 *
 * Ren logikk (WFS-spørring, GML-parsing, endringssjekk) ligger i
 * `lib/pipeline/postal-area-import.ts` og har testene. Denne fila er nettverk,
 * skriving og rapport.
 *
 * KOST: 0. Kartverkets WFS er gratis og krever ingen nøkkel. Kjøres når
 * Kartverket oppdaterer datasettet — sjelden, årlig er nok.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  KOMMUNER,
  WFS_URL,
  buildWfsQuery,
  parsePostalAreaGml,
  needsWrite,
  type Kommune,
  type PostalAreaRow,
  type RejectedFeature,
} from "../lib/pipeline/postal-area-import";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WFS_TIMEOUT_MS = 90_000;

async function fetchKommune(kommune: Kommune): Promise<{
  rows: PostalAreaRow[];
  rejected: RejectedFeature[];
}> {
  const params = new URLSearchParams(buildWfsQuery(kommune.nummer));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WFS_TIMEOUT_MS);

  try {
    const res = await fetch(`${WFS_URL}?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Placy/1.0 (kontakt@placy.no)" },
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`WFS ${res.status} for kommune ${kommune.nummer}: ${body.slice(0, 300)}`);
    }
    return parsePostalAreaGml(body);
  } finally {
    clearTimeout(timer);
  }
}

async function readExisting(): Promise<Map<string, PostalAreaRow>> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/postal_areas?select=postnummer,poststed,kommunenummer,kommunenavn,boundary,source_local_id,source_updated_at`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Accept-Profile": "v2",
      },
    }
  );
  if (!res.ok) throw new Error(`GET postal_areas feilet: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as PostalAreaRow[];
  return new Map(rows.map((r) => [r.postnummer, r]));
}

async function upsert(rows: PostalAreaRow[]): Promise<void> {
  // PostgREST-upsert på primærnøkkelen `postnummer`. imported_at settes her slik
  // at den reflekterer denne kjøringen (den er utenfor needsWrite-sammenligningen
  // nettopp fordi den alltid endrer seg).
  const payload = rows.map((r) => ({ ...r, imported_at: new Date().toISOString() }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/postal_areas`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Content-Profile": "v2",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Upsert feilet: ${res.status} ${await res.text()}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const kommuneArg = args.find((a) => a.startsWith("--kommune"));
  const onlyKommune = kommuneArg?.includes("=")
    ? kommuneArg.split("=")[1]
    : kommuneArg
      ? args[args.indexOf(kommuneArg) + 1]
      : undefined;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local");
    process.exit(1);
  }

  const kommuner = onlyKommune
    ? KOMMUNER.filter((k) => k.nummer === onlyKommune)
    : [...KOMMUNER];

  if (kommuner.length === 0) {
    console.error(
      `Ukjent kommune «${onlyKommune}». Kjente: ${KOMMUNER.map((k) => `${k.nummer} ${k.navn}`).join(", ")}`
    );
    process.exit(1);
  }

  console.log(`\nPostnummerområder fra Kartverket — ${apply ? "SKRIVER" : "dry-run"}\n`);

  const all: PostalAreaRow[] = [];
  const allRejected: Array<RejectedFeature & { kommune: string }> = [];
  let avvikFraForventet = false;

  for (const kommune of kommuner) {
    const { rows, rejected } = await fetchKommune(kommune);

    // 0 features betyr endret API-kontrakt, ikke tomt datasett — vi VET at alle
    // seks kommunene har postnumre. Å skrive videre her ville tømt tabellen
    // stille ved en fremtidig kontraktsendring.
    if (rows.length === 0 && rejected.length === 0) {
      console.error(
        `\nABORT: kommune ${kommune.nummer} ${kommune.navn} returnerte 0 features. ` +
          `Forventet ${kommune.forventetAntall}. Sjekk om WFS-kontrakten er endret.`
      );
      process.exit(2);
    }

    const unike = new Set(rows.map((r) => r.postnummer));
    const avvik = unike.size - kommune.forventetAntall;
    if (avvik !== 0) avvikFraForventet = true;

    console.log(
      `  ${kommune.nummer} ${kommune.navn.padEnd(10)} ${String(unike.size).padStart(3)} postnr` +
        (avvik === 0 ? "  (som forventet)" : `  AVVIK ${avvik > 0 ? "+" : ""}${avvik} mot Brings register`) +
        (rejected.length ? `  ${rejected.length} forkastet` : "")
    );

    all.push(...rows);
    allRejected.push(...rejected.map((r) => ({ ...r, kommune: kommune.nummer })));
  }

  if (allRejected.length > 0) {
    console.log(`\nForkastede features (${allRejected.length}):`);
    for (const r of allRejected) {
      console.log(`  ${r.kommune} ${r.postnummer ?? "(uten postnr)"} — ${r.reason}`);
    }
  }

  // Duplikate postnumre på tvers av kommuner ville brutt primærnøkkelen i en
  // upsert-batch, og PostgREST melder det som en uleselig conflict-feil.
  const seen = new Map<string, string>();
  const duplikater: string[] = [];
  for (const r of all) {
    const forrige = seen.get(r.postnummer);
    if (forrige) duplikater.push(`${r.postnummer} (${forrige} + ${r.kommunenummer})`);
    else seen.set(r.postnummer, r.kommunenummer);
  }
  if (duplikater.length > 0) {
    console.error(`\nABORT: samme postnummer i flere kommuner: ${duplikater.join(", ")}`);
    process.exit(2);
  }

  const existing = await readExisting();
  const toWrite = all.filter((r) => needsWrite(existing.get(r.postnummer), r));
  const nye = toWrite.filter((r) => !existing.has(r.postnummer)).length;

  console.log(
    `\nTotalt ${all.length} postnumre — ${nye} nye, ${toWrite.length - nye} endret, ` +
      `${all.length - toWrite.length} uendret`
  );

  const marked = all.filter((r) => KOMMUNER.find((k) => k.nummer === r.kommunenummer)?.marked);
  console.log(`  Av dem er ${marked.length} i markedet (Trondheim, Stjørdal, Melhus, Malvik)`);

  if (avvikFraForventet) {
    console.log(
      "\n  MERK: antallet avviker fra Brings register for minst én kommune. Det kan\n" +
        "  være legitimt (registrene oppdateres i ulik takt), men verifiser før du\n" +
        "  bruker tallet som dekningsgrad."
    );
  }

  if (!apply) {
    console.log("\nDry-run — ingenting skrevet. Kjør med --apply for å skrive.\n");
    return;
  }

  if (toWrite.length === 0) {
    console.log("\nIngenting å skrive — basen er a jour.\n");
    return;
  }

  await upsert(toWrite);
  console.log(`\nSkrev ${toWrite.length} rader til v2.postal_areas.\n`);
}

main().catch((err) => {
  console.error(`\nFEIL: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
