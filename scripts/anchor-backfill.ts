#!/usr/bin/env npx tsx
/**
 * Anker-backfill (Unit 8) — kjør kjøpesenter-oppløsningen mot eksisterende boards.
 *
 * Usage:
 *   npx tsx scripts/anchor-backfill.ts                      # tørrkjøring, ALLE boards
 *   npx tsx scripts/anchor-backfill.ts --project sundsoya   # ett board
 *   npx tsx scripts/anchor-backfill.ts --skip-discovery     # bare oppløsning (ingen Google-kall)
 *   npx tsx scripts/anchor-backfill.ts --commit             # SKRIVER til prod
 *
 * ## Hvorfor et eget skript og ikke `provision-rapport --update`
 *
 * En full re-provisjonering kjører ti steg: ny Google-discovery for ALLE
 * kategorier, trust-rescoring, reisetids-precompute og nabolags-editorial.
 * Backfillen trenger to av dem. Blast-radiusen på de åtte andre — kostnad,
 * ny-POI-churn og redaksjonell regenerering — er ikke noe denne endringen har
 * bedt om, og et board som ser annerledes ut av grunner vi ikke kan peke på er
 * verre enn et board uten anker.
 *
 * ## Rekkefølgen er ikke valgfri
 *
 * 1. **Anker-passet** (Google) importerer sentre standard-discoveryen bommet på.
 *    Vikhammer senteret har verken rating eller anmeldelser og faller på
 *    `hasMinimumQualitySignals` — det er derfor boardet mangler nærsenteret
 *    sitt, ikke fordi boardet er gammelt. En oppløsning mot dagens data ville
 *    ikke funnet noe, for raden finnes ikke.
 * 2. **Oppløsningen** leser poolen og skriver `parent_poi_id` + `anchor_summary`.
 *
 * Kjører alltid ETT prosjekt om gangen. `parent_poi_id` ligger på den DELTE
 * poolen, og to samtidige oppløsninger over samme bygg ville skrevet over
 * hverandre.
 *
 * ## Angre
 *
 * Begge stegene tagger radene sine. Hele backfillen rulles tilbake med:
 *
 *   UPDATE v2.pois SET parent_poi_id = NULL
 *   WHERE parent_poi_id IN (
 *     SELECT id FROM v2.pois WHERE poi_metadata->>'anchor_resolution' IS NOT NULL
 *   );
 *   UPDATE v2.pois SET anchor_summary = NULL,
 *          poi_metadata = poi_metadata - 'anchor_resolution' - 'anchor_probe'
 *   WHERE poi_metadata->>'anchor_resolution' IS NOT NULL
 *      OR poi_metadata->>'anchor_probe' IS NOT NULL;
 *
 * MERK: de fire håndsatte Valentinlyst-lenkene fra migrasjon 057/058 ligger i
 * samme kolonne uten tagg. De overlever tilbakerullingen over KUN hvis
 * Valentinlyst ikke ble re-oppløst; ble det det, kjør 057/058 på nytt.
 */

import "./load-env";
import { createServerClient } from "@/lib/supabase/client";
import { discoverAnchorsForProject } from "@/lib/pipeline/discover-anchors";
import { resolveProjectAnchors } from "@/lib/pipeline/resolve-anchors-step";
import { enrichContainment } from "@/lib/pipeline/enrich-containment";
import { ANCHOR_FAMILIES } from "@/lib/board/anchor-families";

interface ProjectRow {
  id: string;
  name: string;
  url_slug: string;
  center_lat: number;
  center_lng: number;
  discovery_circles: Array<{ lat: number; lng: number; radiusMeters: number }> | null;
}

/** Radius fra discovery_circles, med samme default som pipelinen bruker. */
const FALLBACK_RADIUS_M = 2500;

function parseArgs() {
  const args = process.argv.slice(2);
  const has = (f: string) => args.includes(f);
  const all = (f: string) =>
    args.reduce<string[]>((acc, a, i) => (a === f && args[i + 1] ? [...acc, args[i + 1]] : acc), []);
  return {
    projects: all("--project"),
    commit: has("--commit"),
    skipDiscovery: has("--skip-discovery"),
    skipContainment: has("--skip-containment"),
  };
}

interface BoardOutcome {
  slug: string;
  name: string;
  /** Sentre anker-passet hentet inn (eller ville hentet inn). */
  discovered: number;
  discoveredBeyond: number;
  discoveredRejected: number;
  anchors: Array<{ name: string; family: string; memberCount: number; summary: string }>;
  /** Containment-høstingen: kall brukt og rader som fikk peker. */
  containmentCalls: number;
  containmentRows: number;
  membersLinked: number;
  membersUnlinked: number;
  rejected: Array<{ name: string; memberCount: number }>;
  warnings: string[];
}

async function main() {
  const { projects: wanted, commit, skipDiscovery, skipContainment } = parseArgs();
  const mode = commit ? "SKRIVER TIL PROD" : "tørrkjøring (ingen writes)";

  console.log(`\n━━━ Anker-backfill — ${mode} ━━━\n`);
  if (!commit) {
    console.log("Ingen rad røres. Kjør på nytt med --commit når planen er gjennomgått.\n");
  }

  const base = createServerClient();
  const db = base.schema("v2") as unknown as typeof base;

  const { data, error } = await db
    .from("projects")
    .select("id, name, url_slug, center_lat, center_lng, discovery_circles")
    .order("name");
  if (error) {
    console.error(`Kunne ikke hente prosjekter: ${error.message}`);
    process.exit(1);
  }
  const allProjects = (data ?? []) as unknown as ProjectRow[];
  const targets =
    wanted.length > 0
      ? allProjects.filter((p) => wanted.includes(p.url_slug))
      : allProjects;

  if (targets.length === 0) {
    console.error(`Ingen prosjekt matchet ${wanted.join(", ")}`);
    process.exit(1);
  }

  // Utgangspunkt, så rapporten kan si hva som FAKTISK endret seg.
  const before = await poolCounts(db);
  console.log(
    `Pool før: ${before.total} POI-er · ${before.anchors} med anchor_summary · ${before.linked} med parent_poi_id\n`,
  );

  const outcomes: BoardOutcome[] = [];

  // Seriellt, aldri parallelt: `parent_poi_id` ligger på den delte poolen.
  for (const project of targets) {
    const radius =
      project.discovery_circles?.[0]?.radiusMeters ?? FALLBACK_RADIUS_M;
    console.log(`\n── ${project.name} (${project.url_slug}) · radius ${radius} m ──`);

    const outcome: BoardOutcome = {
      slug: project.url_slug,
      name: project.name,
      discovered: 0,
      discoveredBeyond: 0,
      discoveredRejected: 0,
      anchors: [],
      containmentCalls: 0,
      containmentRows: 0,
      membersLinked: 0,
      membersUnlinked: 0,
      rejected: [],
      warnings: [],
    };

    if (!skipDiscovery) {
      const disc = await discoverAnchorsForProject({
        projectId: project.id,
        lat: Number(project.center_lat),
        lng: Number(project.center_lng),
        radiusMeters: radius,
        dryRun: !commit,
      });
      outcome.discovered = disc.imported.length;
      outcome.discoveredBeyond = disc.beyondCircle;
      outcome.discoveredRejected = disc.rejected.length;
      outcome.warnings.push(...disc.warnings);
      console.log(
        `  Anker-søk: ${disc.imported.length} av ${disc.candidatesFound} kjøpesenter tatt med (${disc.beyondCircle} utenfor sirkelen)`,
      );
      for (const a of disc.imported) {
        const members =
          a.memberCount === undefined
            ? ""
            : ` — ${a.memberCountIsFloor ? "minst " : ""}${a.memberCount} virksomheter`;
        console.log(
          `     · ${a.name} (${(a.distanceMeters / 1000).toFixed(1)} km)${a.beyondCircle ? " [utenfor]" : ""}${members}`,
        );
      }
    }

    // Containment FØR oppløsningen. Gate 1 i anker-definisjonen er Googles
    // `containingPlaces`, og den er tom for nesten hele poolen (4 av 1 908
    // Google-rader målt 2026-08-28). Uten dette steget er det navne-gaten
    // alene som avgjør hva som er et idrettsanlegg — og den bommer på
    // Charlottenlund, der stedet heter «Charlottenlundhallen».
    let containmentOverlay: ReadonlyMap<string, string[]> | undefined;
    if (!skipContainment) {
      const anlegg = ANCHOR_FAMILIES.find((f) => f.id === "anlegg")!;
      const enrich = await enrichContainment({
        projectId: project.id,
        categoryIds: [...anlegg.candidateCategoryIds],
        apiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
        dryRun: !commit,
      });
      containmentOverlay = enrich.pointers;
      outcome.containmentCalls = enrich.calls;
      outcome.containmentRows = enrich.rowsUpdated;
      outcome.warnings.push(...enrich.warnings);
      if (enrich.clusters > 0) {
        console.log(
          `  Containment: ${enrich.clusters} klynger · ${enrich.calls} kall · ${enrich.rowsUpdated} rader fikk peker` +
            (enrich.unknownContainers > 0 ? ` · ${enrich.unknownContainers} pekere til steder vi ikke har` : ""),
        );
      }
    }

    const res = await resolveProjectAnchors({
      projectId: project.id,
      dryRun: !commit,
      containmentOverlay,
    });
    outcome.anchors = res.anchors.map((a) => ({
      name: a.name,
      family: a.family,
      memberCount: a.memberCount,
      summary: a.summary,
    }));
    outcome.membersLinked = res.membersLinked;
    outcome.membersUnlinked = res.membersUnlinked;
    outcome.rejected = res.rejected;
    outcome.warnings.push(...res.warnings);

    if (res.anchors.length === 0) {
      console.log("  Oppløsning: ingen anker i radiusen");
    } else {
      console.log(
        `  Oppløsning: ${res.anchors.length} ankre · ${res.membersLinked} medlemmer lenket` +
          (res.membersUnlinked > 0 ? ` · ${res.membersUnlinked} lenker ryddet` : ""),
      );
      for (const a of res.anchors) {
        console.log(`     · [${a.family}] ${a.name}: ${a.memberCount} steder — «${a.summary}»`);
      }
    }
    for (const r of res.rejected) {
      console.log(`     · avvist: ${r.name} (${r.memberCount} medlemmer, under terskelen)`);
    }
    for (const w of outcome.warnings) console.log(`  ${w}`);

    outcomes.push(outcome);
  }

  report(outcomes, commit);

  const after = await poolCounts(db);
  console.log(
    `\nPool etter: ${after.total} POI-er · ${after.anchors} med anchor_summary · ${after.linked} med parent_poi_id`,
  );
  if (!commit) {
    console.log("(uendret — dette var en tørrkjøring)");
  }
}

async function poolCounts(db: ReturnType<typeof createServerClient>) {
  const { count: total } = await db.from("pois").select("id", { count: "exact", head: true });
  const { count: anchors } = await db
    .from("pois")
    .select("id", { count: "exact", head: true })
    .not("anchor_summary", "is", null);
  const { count: linked } = await db
    .from("pois")
    .select("id", { count: "exact", head: true })
    .not("parent_poi_id", "is", null);
  return { total: total ?? 0, anchors: anchors ?? 0, linked: linked ?? 0 };
}

/**
 * Fullstendighetsrapporten planen krever: hvor mange ankre av hvor mange
 * kandidater, hvor mange POI-er som ble medlemmer, hvor mange kandidater som
 * falt på ≥4-terskelen — og hvor mange ankre som landet på 4–5 medlemmer, som
 * er marginen mot terskelen.
 */
function report(outcomes: BoardOutcome[], commit: boolean) {
  const uniqueAnchors = new Map<string, number>();
  for (const o of outcomes) {
    for (const a of o.anchors) uniqueAnchors.set(a.name, a.memberCount);
  }
  const rejectedNames = new Set(outcomes.flatMap((o) => o.rejected.map((r) => r.name)));
  const nearThreshold = [...uniqueAnchors.entries()].filter(([, n]) => n <= 5);
  const totalLinked = outcomes.reduce((s, o) => s + o.membersLinked, 0);
  const totalUnlinked = outcomes.reduce((s, o) => s + o.membersUnlinked, 0);
  const discovered = outcomes.reduce((s, o) => s + o.discovered, 0);

  console.log(`\n━━━ Fullstendighet (${commit ? "skrevet" : "planlagt"}) ━━━\n`);
  console.log(`Boards gjennomgått:      ${outcomes.length}`);
  console.log(`Sentre hentet av Google: ${discovered}`);
  console.log(`Ankre opprettet:         ${uniqueAnchors.size} (unike bygg)`);
  console.log(`Medlemmer lenket:        ${totalLinked}`);
  console.log(`Lenker ryddet:           ${totalUnlinked}`);
  console.log(`Avvist på ≥4-terskelen:  ${rejectedNames.size}`);
  console.log(
    `Ankre på 4–5 medlemmer:  ${nearThreshold.length}${
      nearThreshold.length > 0
        ? ` (${nearThreshold.map(([n, c]) => `${n}: ${c}`).join(", ")})`
        : ""
    }`,
  );

  const boardsWithout = outcomes.filter((o) => o.anchors.length === 0);
  if (boardsWithout.length > 0) {
    console.log(
      `\nBoards uten anker: ${boardsWithout.map((o) => o.slug).join(", ")}`,
    );
  }
}

main().catch((e) => {
  console.error("KAST:", e?.stack ?? e?.message ?? e);
  process.exit(1);
});
