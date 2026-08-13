#!/usr/bin/env npx tsx
/**
 * Dekningsrapport: hvilke steder dekker Placy, og hva mangler.
 *
 * Read-only. Dette er både arbeidskøen (hva kureres neste) og tallet vi kan si
 * til en megler («X av 105 postnumre i markedet»).
 *
 * Bruk:
 *   npx tsx scripts/coverage-report.ts              # sammendrag
 *   npx tsx scripts/coverage-report.ts --full       # hvert postnummer
 *   npx tsx scripts/coverage-report.ts --kommune 5001
 *
 * Klassifiseringen ligger i `lib/pipeline/coverage-ledger.ts` og har testene.
 *
 * Rapporterer BEGGE retninger av hull: postnumre uten område, og områder uten
 * postnummer. Det siste er hvordan Straumen og Oppdal ble oppdaget — to ferdig
 * kuraterte områder som ellers ville vært usynlige i sitt eget regnskap.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { KOMMUNER } from "../lib/pipeline/postal-area-import";
import {
  BOLIG_THEME_IDS,
  buildCoverageLedger,
  poiHarBrukbarTekst,
  type AreaCoverageInput,
  type CoverageStatus,
  type PostalAreaInput,
} from "../lib/pipeline/coverage-ledger";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATUS_LABEL: Record<CoverageStatus, string> = {
  ukjent: "ukjent",
  geometri: "geometri",
  kuratert: "kuratert",
  dekket: "DEKKET",
};

/**
 * PostgREST returnerer maks 1000 rader uten eksplisitt grense, stille. Et
 * regnskap som underrapporterer uten å si det er verre enn ingen rapport, så vi
 * setter grensen selv og kaster hvis den nås — da må stien pagineres.
 */
const ROW_LIMIT = 5000;

async function get<T extends unknown[]>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}limit=${ROW_LIMIT}`, {
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Accept-Profile": "v2",
    },
  });
  if (!res.ok) throw new Error(`GET ${path} feilet: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as T;
  if (rows.length >= ROW_LIMIT) {
    throw new Error(
      `GET ${path} returnerte ${rows.length} rader = grensen. Regnskapet ville ` +
        `underrapportert stille — legg til paginering før du stoler på tallet.`
    );
  }
  return rows;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const full = args.includes("--full");
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

  const markedByKommune = new Map(KOMMUNER.map((k) => [k.nummer, k.marked]));

  const [postalRaw, areas, poisRaw] = await Promise.all([
    get<Array<Omit<PostalAreaInput, "marked">>>(
      "postal_areas?select=postnummer,poststed,kommunenummer,kommunenavn&order=kommunenummer,postnummer"
    ),
    get<AreaCoverageInput[]>(
      "areas?select=id,name_no,boundary,boundary_source,postal_codes,report_editorial&order=id"
    ),
    // Bare POI-er som HAR grounding — de øvrige har per definisjon ikke tekst, og
    // hele POI-tabellen er unødvendig å laste for det.
    get<Array<{ id: string; grounding: unknown }>>("pois?select=id,grounding&grounding=not.is.null"),
  ]);

  const postalAreas: PostalAreaInput[] = postalRaw
    .map((p) => ({ ...p, marked: markedByKommune.get(p.kommunenummer) ?? false }))
    .filter((p) => !onlyKommune || p.kommunenummer === onlyKommune);

  if (postalAreas.length === 0) {
    console.error(
      `Ingen postnumre for kommune «${onlyKommune}». Er importen kjørt? ` +
        `Kjente: ${KOMMUNER.map((k) => k.nummer).join(", ")}`
    );
    process.exit(1);
  }

  const poiIdsMedTekst = new Set(
    poisRaw.filter((p) => poiHarBrukbarTekst(p.grounding)).map((p) => p.id)
  );

  const ledger = buildCoverageLedger({ postalAreas, areas, poiIdsMedTekst });

  console.log("\n═══ Dekningsregnskap ═══\n");
  console.log(
    `  ${postalAreas.length} postnumre · ${areas.length} områder · ` +
      `${poiIdsMedTekst.size} POI-er med brukbar tekst\n`
  );

  // ── Per kommune ──
  const kommuner = [...new Set(postalAreas.map((p) => p.kommunenummer))];
  for (const kommunenummer of kommuner) {
    const kommune = KOMMUNER.find((k) => k.nummer === kommunenummer);
    const rader = ledger.perPostnummer.filter((p) =>
      postalAreas.find((pa) => pa.postnummer === p.postnummer)?.kommunenummer === kommunenummer
    );
    const dekket = rader.filter((r) => r.status === "dekket").length;
    const kuratert = rader.filter((r) => r.status === "kuratert").length;
    const geometri = rader.filter((r) => r.status === "geometri").length;
    const ukjent = rader.filter((r) => r.status === "ukjent").length;

    console.log(
      `  ${kommunenummer} ${(kommune?.navn ?? "?").padEnd(11)}` +
        `${String(rader.length).padStart(3)} postnr   ` +
        `dekket ${dekket}  kuratert ${kuratert}  geometri ${geometri}  ukjent ${ukjent}` +
        (kommune?.marked ? "" : "   (utenfor markedet)")
    );

    if (full) {
      for (const r of rader) {
        console.log(
          `      ${r.postnummer}  ${r.poststed.padEnd(16)} ${STATUS_LABEL[r.status].padEnd(9)}` +
            (r.areaIds.length ? r.areaIds.join(", ") : "—")
        );
      }
    }
  }

  // ── Totaler ──
  const pct = (n: number, av: number) => (av === 0 ? "0" : Math.round((n / av) * 100));
  const m = ledger.totals.marked;
  const iMarked = Object.values(m).reduce((a, b) => a + b, 0);

  console.log(`\n  MARKEDET (${iMarked} postnumre — Trondheim, Stjørdal, Melhus, Malvik)`);
  console.log(
    `    dekket ${m.dekket} (${pct(m.dekket, iMarked)}%)  ` +
      `kuratert ${m.kuratert}  geometri ${m.geometri}  ukjent ${m.ukjent}`
  );

  const a = ledger.totals.alle;
  const alle = Object.values(a).reduce((x, y) => x + y, 0);
  if (alle !== iMarked) {
    console.log(`\n  TOTALT (${alle} postnumre, inkl. utenfor markedet)`);
    console.log(
      `    dekket ${a.dekket}  kuratert ${a.kuratert}  geometri ${a.geometri}  ukjent ${a.ukjent}`
    );
  }

  // Summen MÅ stemme. Gjør den ikke det, har et postnummer falt mellom to
  // kategorier, og da er hele tallet ubrukelig som dekningsgrad.
  if (alle !== postalAreas.length) {
    console.error(
      `\n  FEIL: statusene summerer til ${alle}, men det er ${postalAreas.length} postnumre. ` +
        `Et postnummer har falt mellom kategoriene.`
    );
    process.exit(2);
  }

  // ── Områdene, sortert på hvor nær dekning de er ──
  const relevante = ledger.areaStatuses.filter(
    (s) => s.status !== "ukjent" || s.temaerMedTekst > 0
  );
  const rank: Record<CoverageStatus, number> = { dekket: 0, kuratert: 1, geometri: 2, ukjent: 3 };
  relevante.sort((x, y) => rank[x.status] - rank[y.status] || x.id.localeCompare(y.id));

  console.log(`\n  OMRÅDER (${relevante.length} med form eller innhold)`);
  for (const s of relevante) {
    const detalj =
      s.status === "kuratert" || s.status === "dekket"
        ? `  høydepunkter ${s.hoydepunkterMedTekst}/${s.hoydepunkter}` +
          (s.temaerUtenHoydepunkt.length
            ? `  temaer uten høydepunkt: ${s.temaerUtenHoydepunkt.join(", ")}`
            : "")
        : `  temaer med tekst ${s.temaerMedTekst}/${BOLIG_THEME_IDS.length}`;
    console.log(
      `    ${STATUS_LABEL[s.status].padEnd(9)} ${s.id.padEnd(18)}` +
        `${(s.boundary_source ?? "uten form").padEnd(10)}${detalj}` +
        (s.merknad ? `  — ${s.merknad}` : "")
    );
  }

  // ── Hull, begge retninger ──
  if (ledger.omraderUtenPostnummer.length > 0) {
    console.log(`\n  OMRÅDER UTEN POSTNUMMER (${ledger.omraderUtenPostnummer.length})`);
    console.log("    Usynlige i regnskapet over. Kjør --suggest-postal-codes.");
    for (const s of ledger.omraderUtenPostnummer) {
      console.log(`    ${s.id.padEnd(18)} status ${s.status}, ${s.temaerMedTekst} temaer med tekst`);
    }
  }

  if (ledger.overlapp.length > 0) {
    console.log(`\n  POSTNUMRE I FLERE OMRÅDER (${ledger.overlapp.length})`);
    console.log("    Høyeste status vinner over. Geofencen bruker første treff — vilkårlig");
    console.log("    hvis to av dem kureres, så de trenger tegnet grense først.");
    for (const o of ledger.overlapp) {
      console.log(`    ${o.postnummer}  ${o.areaIds.join(" = ")}`);
    }
  }

  if (!full) console.log("\n  (--full for hvert enkelt postnummer)");
  console.log("");
}

main().catch((err) => {
  console.error(`\nFEIL: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
