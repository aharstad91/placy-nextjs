#!/usr/bin/env npx tsx
/**
 * Slå sammen dublett-POIer i v2.pois.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-pois.ts                 # dry-run (default)
 *   npx tsx scripts/merge-duplicate-pois.ts --apply         # skriv
 *   npx tsx scripts/merge-duplicate-pois.ts --max-distance 50
 *
 * BAKGRUNN: cutover-migrasjonen (074) la nye rader med ny ID-konvensjon oppå
 * legacy-rader med samme autoritative nøkkel. En re-provisjonering linker den
 * ene mens den andre alt er lenket, og boardet får to pins for samme sted.
 * Oppdaget på Ranheim 2026-08-14 (16 synlige par).
 *
 * REKKEFØLGE (rekkefølgen ER sikkerheten):
 *   1. Les alt, bygg plan, ABORT hvis en taper er referert fra en flate vi
 *      ikke kan repeke (place_knowledge, events, collections, parent_poi_id).
 *   2. Skriv rollback-dump til backups/ FØR første mutasjon.
 *   3. Absorbér felter taperen har og vinneren mangler.
 *   4. Repek lenker (project_pois, product_pois) og translations.
 *   5. Slett taper-radene — FK-ene er CASCADE, så dette må skje sist.
 *   6. Etterverifiser: ingen referanser til slettede IDer, alle kuraterte
 *      highlightCandidates resolver fortsatt, board-antall uendret eller lavere
 *      med nøyaktig antall fjernede dubletter.
 *
 * Logikken ligger i lib/pipeline/merge-duplicate-pois.ts (ren, testet).
 */

import "./load-env";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  groupByAuthoritativeKey,
  resolveGroups,
  buildAbsorptionPatch,
  planLinkRepoint,
  type LinkRow,
  type MergeablePoi,
  type ResolvedGroup,
} from "@/lib/pipeline/merge-duplicate-pois";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MAX_DISTANCE = Number(
  args[args.indexOf("--max-distance") + 1] ?? NaN,
) || 100;

const readHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Accept-Profile": "v2",
};
const writeHeaders = {
  ...readHeaders,
  "Content-Type": "application/json",
  "Content-Profile": "v2",
  Prefer: "return=representation",
};

const PAGE = 1000;

/** Paginert henting. PostgREST kutter stille på 1000 rader — et regnskap som
 *  underrapporterer uten å si fra er verre enn ingen rapport (migrasjon 087). */
async function fetchAll<T>(pathAndQuery: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: { ...readHeaders, Range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`${pathAndQuery}: HTTP ${res.status} ${await res.text()}`);
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function mutate(method: "PATCH" | "DELETE", pathAndQuery: string, body?: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: writeHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as unknown[];
}

interface ProjectPoiRow extends LinkRow { project_id: string; poi_id: string; travel_times?: unknown }
interface ProductPoiRow extends LinkRow { product_id: string; poi_id: string }
interface TranslationRow { id: string; entity_type: string; entity_id: string }
interface AreaRow { id: string; report_editorial: Record<string, { highlightCandidates?: string[] }> | null }

async function main() {
  console.log(`\n═══ Sammenslåing av dublett-POIer ═══`);
  console.log(`Modus: ${APPLY ? "APPLY (skriver)" : "DRY-RUN"} · avstandsport ${MAX_DISTANCE} m\n`);

  const [pois, projectPois, productPois, translations, areas, collections, events, knowledge] =
    await Promise.all([
      fetchAll<MergeablePoi>("pois?select=*&order=id"),
      fetchAll<ProjectPoiRow>("project_pois?select=*"),
      fetchAll<ProductPoiRow>("product_pois?select=*"),
      fetchAll<TranslationRow>("translations?select=id,entity_type,entity_id"),
      fetchAll<AreaRow>("areas?select=id,report_editorial"),
      fetchAll<{ id: string; poi_ids: string[] | null }>("collections?select=id,poi_ids"),
      fetchAll<{ id: string; poi_id: string | null }>("events?select=id,poi_id"),
      fetchAll<{ id: string; poi_id: string | null }>("place_knowledge?select=id,poi_id"),
    ]);

  console.log(`Lest: ${pois.length} POI-er · ${projectPois.length} project_pois · ${productPois.length} product_pois`);

  const curatedIds = new Set<string>();
  for (const area of areas) {
    for (const theme of Object.values(area.report_editorial ?? {})) {
      for (const id of theme?.highlightCandidates ?? []) curatedIds.add(id);
    }
  }

  const resolved = resolveGroups(groupByAuthoritativeKey(pois), curatedIds, MAX_DISTANCE);
  const safe = resolved.filter((g) => g.problems.length === 0);
  const review = resolved.filter((g) => g.problems.length > 0);

  console.log(`\nDublett-grupper: ${resolved.length}  →  trygge ${safe.length} · til gjennomgang ${review.length}`);
  if (review.length) {
    console.log(`\n── Holdes UTENFOR (må vurderes manuelt) ──`);
    for (const g of review) {
      console.log(`  ${g.key}=${g.value}`);
      console.log(`     ${g.winner.name} [${g.winner.id}]  vs  ${g.losers.map((l) => `${l.name} [${l.id}]`).join(", ")}`);
      console.log(`     ⚠ ${g.problems.join("; ")}`);
    }
  }

  const loserIds = new Set(safe.flatMap((g) => g.losers.map((l) => l.id)));
  if (loserIds.size === 0) {
    console.log("\nIngenting å slå sammen.");
    return;
  }

  // ── Abort-porten: flater vi ikke repeker ────────────────────────────────
  const blockers: string[] = [];
  for (const c of collections)
    for (const id of c.poi_ids ?? []) if (loserIds.has(id)) blockers.push(`collections ${c.id} → ${id}`);
  for (const e of events) if (e.poi_id && loserIds.has(e.poi_id)) blockers.push(`events ${e.id} → ${e.poi_id}`);
  for (const k of knowledge) if (k.poi_id && loserIds.has(k.poi_id)) blockers.push(`place_knowledge ${k.id} → ${k.poi_id}`);
  for (const p of pois)
    if (typeof p.parent_poi_id === "string" && loserIds.has(p.parent_poi_id))
      blockers.push(`pois.parent_poi_id ${p.id} → ${p.parent_poi_id}`);
  for (const id of curatedIds) if (loserIds.has(id)) blockers.push(`areas.highlightCandidates → ${id}`);

  if (blockers.length) {
    console.error(`\n✗ ABORT: ${blockers.length} referanser til taper-rader som denne migrasjonen ikke repeker:`);
    for (const b of blockers.slice(0, 20)) console.error(`   ${b}`);
    console.error(`\nUtvid migrasjonen til å repeke disse før du kjører den.`);
    process.exit(1);
  }
  console.log(`✓ Abort-porten: 0 referanser fra collections / events / place_knowledge / parent_poi_id / kuratering`);

  // Kuraterte IDer som ALLEREDE peker i tomme luften. De er en reell feil, men
  // ikke denne migrasjonens — etterverifiseringen må skille arvet rot fra skade,
  // ellers feiler hver framtidig kjøring på noe den ikke forårsaket.
  const liveBefore = new Set(pois.map((p) => p.id));
  const danglingBefore = new Set([...curatedIds].filter((id) => !liveBefore.has(id)));
  if (danglingBefore.size) {
    console.log(`\n⚠ ${danglingBefore.size} kuraterte highlight-IDer peker på rader som ikke finnes (fra FØR denne kjøringen):`);
    for (const id of danglingBefore) {
      const owner = areas.find((a) =>
        Object.values(a.report_editorial ?? {}).some((t) => t?.highlightCandidates?.includes(id)),
      );
      console.log(`   ${owner?.id ?? "?"} → ${id}`);
    }
  }

  // ── Plan ────────────────────────────────────────────────────────────────
  interface Action {
    group: ResolvedGroup;
    patch: Record<string, unknown>;
    projectRepoint: ProjectPoiRow[];
    projectDrop: ProjectPoiRow[];
    productRepoint: ProductPoiRow[];
    productDrop: ProductPoiRow[];
    translationIds: string[];
  }

  const actions: Action[] = safe.map((group) => {
    const ids = new Set(group.losers.map((l) => l.id));
    const projectPlan = planLinkRepoint(projectPois, "project_id", group.winner.id, ids);
    const productPlan = planLinkRepoint(productPois, "product_id", group.winner.id, ids);
    return {
      group,
      patch: buildAbsorptionPatch(group.winner, group.losers),
      projectRepoint: projectPlan.repoint,
      projectDrop: projectPlan.drop,
      productRepoint: productPlan.repoint,
      productDrop: productPlan.drop,
      translationIds: translations
        .filter((t) => t.entity_type === "poi" && ids.has(t.entity_id))
        .map((t) => t.id),
    };
  });

  const sum = (fn: (a: Action) => number) => actions.reduce((n, a) => n + fn(a), 0);
  console.log(`\n── Plan ──`);
  console.log(`  Rader som slettes:        ${loserIds.size}`);
  console.log(`  Vinnere som arver felter: ${actions.filter((a) => Object.keys(a.patch).length).length}`);
  console.log(`  project_pois repekes:     ${sum((a) => a.projectRepoint.length)}  ·  slettes ${sum((a) => a.projectDrop.length)}`);
  console.log(`  product_pois repekes:     ${sum((a) => a.productRepoint.length)}  ·  slettes ${sum((a) => a.productDrop.length)}`);
  console.log(`  translations repekes:     ${sum((a) => a.translationIds.length)}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN — ingenting skrevet. Kjør med --apply.`);
    return;
  }

  // ── Rollback-dump FØR første mutasjon ───────────────────────────────────
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `merge-duplicate-pois-${Date.now()}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        maxDistance: MAX_DISTANCE,
        groups: safe.map((g) => ({ key: g.key, value: g.value, winnerId: g.winner.id, loserIds: g.losers.map((l) => l.id) })),
        deletedPois: safe.flatMap((g) => g.losers),
        winnersBefore: safe.map((g) => g.winner),
        projectPoisTouched: actions.flatMap((a) => [...a.projectRepoint, ...a.projectDrop]),
        productPoisTouched: actions.flatMap((a) => [...a.productRepoint, ...a.productDrop]),
        translationsTouched: translations.filter((t) => actions.some((a) => a.translationIds.includes(t.id))),
      },
      null,
      2,
    ),
  );
  console.log(`\nRollback-dump: ${backupFile}`);

  // ── Mutasjon ────────────────────────────────────────────────────────────
  let patched = 0, repointed = 0, dropped = 0, deleted = 0;

  for (const a of actions) {
    const winnerId = a.group.winner.id;

    if (Object.keys(a.patch).length) {
      await mutate("PATCH", `pois?id=eq.${encodeURIComponent(winnerId)}`, a.patch);
      patched++;
    }

    // Repek FØR sletting — FK-ene er CASCADE.
    for (const link of a.projectRepoint) {
      await mutate(
        "PATCH",
        `project_pois?project_id=eq.${encodeURIComponent(link.project_id)}&poi_id=eq.${encodeURIComponent(link.poi_id)}`,
        { poi_id: winnerId },
      );
      repointed++;
    }
    for (const link of a.projectDrop) {
      await mutate(
        "DELETE",
        `project_pois?project_id=eq.${encodeURIComponent(link.project_id)}&poi_id=eq.${encodeURIComponent(link.poi_id)}`,
      );
      dropped++;
    }
    for (const link of a.productRepoint) {
      await mutate(
        "PATCH",
        `product_pois?product_id=eq.${encodeURIComponent(link.product_id)}&poi_id=eq.${encodeURIComponent(link.poi_id)}`,
        { poi_id: winnerId },
      );
      repointed++;
    }
    for (const link of a.productDrop) {
      await mutate(
        "DELETE",
        `product_pois?product_id=eq.${encodeURIComponent(link.product_id)}&poi_id=eq.${encodeURIComponent(link.poi_id)}`,
      );
      dropped++;
    }
    for (const id of a.translationIds) {
      await mutate("PATCH", `translations?id=eq.${encodeURIComponent(id)}`, { entity_id: winnerId });
      repointed++;
    }

    for (const loser of a.group.losers) {
      await mutate("DELETE", `pois?id=eq.${encodeURIComponent(loser.id)}`);
      deleted++;
    }
  }

  console.log(`\n── Skrevet ──`);
  console.log(`  vinnere oppdatert ${patched} · lenker repeket ${repointed} · lenker slettet ${dropped} · POI-er slettet ${deleted}`);

  // ── Etterverifisering ───────────────────────────────────────────────────
  const [poisAfter, projectAfter, productAfter] = await Promise.all([
    fetchAll<{ id: string }>("pois?select=id"),
    fetchAll<ProjectPoiRow>("project_pois?select=project_id,poi_id"),
    fetchAll<ProductPoiRow>("product_pois?select=product_id,poi_id"),
  ]);
  const liveIds = new Set(poisAfter.map((p) => p.id));

  const problems: string[] = [];
  for (const id of loserIds) if (liveIds.has(id)) problems.push(`slettet rad finnes fortsatt: ${id}`);
  for (const l of projectAfter) if (!liveIds.has(l.poi_id)) problems.push(`project_pois foreldreløs: ${l.poi_id}`);
  for (const l of productAfter) if (!liveIds.has(l.poi_id)) problems.push(`product_pois foreldreløs: ${l.poi_id}`);
  for (const id of curatedIds)
    if (!liveIds.has(id) && !danglingBefore.has(id))
      problems.push(`kuratert highlight peker på slettet rad: ${id}`);

  if (problems.length) {
    console.error(`\n✗ ETTERVERIFISERING FEILET (${problems.length}):`);
    for (const p of problems.slice(0, 20)) console.error(`   ${p}`);
    console.error(`\nRollback-dump: ${backupFile}`);
    process.exit(1);
  }

  console.log(`\n✓ Etterverifisering: ${poisAfter.length} POI-er igjen (var ${pois.length}), 0 foreldreløse lenker, alle ${curatedIds.size} kuraterte highlight-IDer resolver.`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
