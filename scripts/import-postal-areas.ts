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
 *   npx tsx scripts/import-postal-areas.ts                        # dry-run
 *   npx tsx scripts/import-postal-areas.ts --apply                # skriv
 *   npx tsx scripts/import-postal-areas.ts --kommune 5001         # én kommune
 *   npx tsx scripts/import-postal-areas.ts --derive-boundaries    # avled areas.boundary
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
import {
  planBoundaryDerivation,
  type AreaForDerivation,
  type Derivation,
  type PostalAreaGeometry,
} from "../lib/pipeline/derive-area-boundary";

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

// ── Steg 2: avled areas.boundary fra postal_codes ─────────────────────────

async function readAreas(): Promise<AreaForDerivation[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/areas?select=id,name_no,boundary,boundary_source,postal_codes&order=id`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Accept-Profile": "v2",
      },
    }
  );
  if (!res.ok) throw new Error(`GET areas feilet: ${res.status} ${await res.text()}`);
  return (await res.json()) as AreaForDerivation[];
}

async function readPostalGeometries(): Promise<Map<string, PostalAreaGeometry>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/postal_areas?select=postnummer,boundary`, {
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Accept-Profile": "v2",
    },
  });
  if (!res.ok) throw new Error(`GET postal_areas feilet: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ postnummer: string; boundary: PostalAreaGeometry }>;
  return new Map(rows.map((r) => [r.postnummer, r.boundary]));
}

/**
 * Skriver KUN `boundary` og `boundary_source` — ikke en spread av hele raden.
 * `areas` har ingen `updated_at`, så det finnes ingen optimistisk lås her (samme
 * dokumenterte valg som `lib/pipeline/apply-area-staging.ts`); da er et smalt
 * PATCH-felt den eneste beskyttelsen mot å klobbe `report_editorial` med en
 * utdatert lesning.
 */
async function writeBoundary(derivation: Derivation): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/areas?id=eq.${encodeURIComponent(derivation.id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Content-Profile": "v2",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        boundary: derivation.boundary,
        boundary_source: derivation.boundary_source,
      }),
    }
  );
  if (!res.ok) throw new Error(`PATCH ${derivation.id} feilet: ${res.status} ${await res.text()}`);

  // 0 rader er en feil, ikke en no-op: id-en kom fra vår egen lesning et øyeblikk
  // siden, så 0 betyr at raden er borte eller at filteret er feil.
  const rows = (await res.json()) as unknown[];
  if (rows.length === 0) {
    throw new Error(`PATCH ${derivation.id} traff 0 rader — raden finnes ikke lenger?`);
  }
}

async function deriveBoundaries(apply: boolean): Promise<void> {
  const [areas, postalGeometries] = await Promise.all([readAreas(), readPostalGeometries()]);
  const plan = planBoundaryDerivation(areas, postalGeometries);

  console.log(`\nAvled areas.boundary — ${apply ? "SKRIVER" : "dry-run"}\n`);
  console.log(`  ${areas.length} områder lest, ${postalGeometries.size} postnummer-polygoner\n`);

  for (const d of plan.derive) {
    console.log(`  AVLEDER  ${d.id.padEnd(18)} ${d.postnumre.join(",")}`);
  }

  const grunner = ["har-boundary", "mangler-postnummer", "ingen-postnummer-funnet"] as const;
  console.log("");
  for (const grunn of grunner) {
    const truffet = plan.skipped.filter((s) => s.reason === grunn);
    if (truffet.length === 0) continue;
    console.log(`  hoppet over (${grunn}): ${truffet.length}`);
    if (grunn !== "har-boundary") {
      console.log(`    ${truffet.map((s) => s.id).join(", ")}`);
    }
  }

  if (plan.ukjentePostnumre.length > 0) {
    // Ikke stille utelatelse: kurator har listet et postnummer vi ikke har
    // geometri for, og det er enten en skrivefeil eller en kommune som mangler i
    // importens KOMMUNER-liste.
    const perOmrade = new Map<string, string[]>();
    for (const u of plan.ukjentePostnumre) {
      const list = perOmrade.get(u.id) ?? [];
      list.push(u.postnummer);
      perOmrade.set(u.id, list);
    }
    console.log(`\n  Postnumre uten geometri i basen (${plan.ukjentePostnumre.length}):`);
    for (const [id, postnumre] of perOmrade) {
      console.log(`    ${id.padEnd(18)} ${postnumre.join(", ")}`);
    }
    console.log(
      "    → enten en skrivefeil i postal_codes, eller en kommune som mangler i KOMMUNER."
    );
  }

  if (plan.kollisjoner.length > 0) {
    console.log(`\n  KOLLISJONER — områder som får identisk form (${plan.kollisjoner.length}):`);
    for (const k of plan.kollisjoner) {
      console.log(`    ${k.postnummer}  ${k.areaIds.join(" = ")}`);
    }
    console.log(
      "    Disse deler postnummer, så avledet geometri blir like. findAreaForPoint\n" +
        "    advarer og bruker første treff — vilkårlig. Ufarlig så lenge de mangler\n" +
        "    report_editorial, men de trenger en tegnet grense FØR de kureres."
    );
  }

  if (!apply) {
    console.log(`\nDry-run — ${plan.derive.length} ville fått form. Kjør med --apply.\n`);
    return;
  }

  for (const d of plan.derive) await writeBoundary(d);
  console.log(`\nSkrev boundary på ${plan.derive.length} områder.\n`);
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

  if (args.includes("--derive-boundaries")) {
    await deriveBoundaries(apply);
    return;
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
