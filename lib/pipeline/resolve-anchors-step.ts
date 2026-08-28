/**
 * Anker-oppløsning som pipeline-steg (Unit 2) — kjøres mellom trust (Steg 5) og
 * hydrering (Steg 6), slik at hydreringen ser det ferdige hierarkiet.
 *
 * Steget avgjør INGENTING selv: `lib/board/anchor-membership.ts` er beslutningen
 * (ren funksjon, ingen I/O), denne modulen er I/O-en rundt den. Den leser
 * prosjektets POI-pool, kaller `resolveAnchors`, og persisterer resultatet i to
 * kolonner: `parent_poi_id` på medlemmene og `anchor_summary` på ankeret.
 *
 * ## Hvorfor kjøpesenteret ikke bare er en POI til
 *
 * Sirkus Shopping har ~100 leietakere med tilnærmet identiske koordinater. Uten
 * anker stables de som 60 pinner på ett punkt i kartet, og «kjøpesenter»
 * forsvinner som destinasjon. Med anker er senteret ÉN pinne med et
 * innholdsregister, og de 60 navnene lever inne i den.
 *
 * ## To familier, ikke én kategori (2026-08-28)
 *
 * Idrettsanlegg gir nøyaktig samme feil: Ranheim idrettspark er åtte pinner,
 * Leangen tretten, Lade tretten. Steget kjører derfor `ANCHOR_FAMILIES` etter
 * hverandre — kjøpesenter først, så idrettsanlegg — og hver familie bærer sine
 * egne regler for hvem som kan være anker, hvem som kan være medlem og hvor
 * langt medlemskapet rekker. Se `lib/board/anchor-families.ts` for hvorfor de
 * ikke kunne dele ett regelsett.
 *
 * En POI som allerede er medlem i én familie tilbys ikke til den neste, og
 * ingen families kandidat kan bli medlem i en annen families anker.
 *
 * ## Idempotens og kryss-prosjekt-vern
 *
 * `parent_poi_id` ligger på den DELTE poolen (`v2.pois`), ikke per prosjekt —
 * containment er en egenskap ved stedet, ikke ved boardet. En eksisterende
 * lenke nulles derfor bare når ankeret ble akseptert i denne kjøringen, eller
 * når bygget ikke er anker noen steder. Et prosjekt som avviser Sirkus fordi
 * bare to av butikkene ligger i utvalget dets, skal ikke rive ned de 58
 * lenkene et nærmere prosjekt satte.
 *
 * ## Transport er ikke innhold
 *
 * Holdeplasser og bysykkelstativ utelates som medlemskandidater. Bussholdeplassen
 * utenfor inngangen ligger godt innenfor nærhets-gaten, men den er veifinning —
 * ikke en butikk i senteret, og den skal beholde sin egen pinne.
 *
 * ## Angre
 *
 * Ankerradene tagges `poi_metadata.anchor_resolution = '<ISO-dato>'`. Hele
 * oppløsningen rulles tilbake med:
 *
 *   UPDATE v2.pois SET parent_poi_id = NULL
 *   WHERE parent_poi_id IN (
 *     SELECT id FROM v2.pois WHERE poi_metadata->>'anchor_resolution' IS NOT NULL
 *   );
 *   UPDATE v2.pois SET anchor_summary = NULL, poi_metadata = poi_metadata - 'anchor_resolution'
 *   WHERE poi_metadata->>'anchor_resolution' IS NOT NULL;
 *
 * Ankerradene bærer også `poi_metadata.anchor_family`, så én familie kan rulles
 * tilbake alene — bytt ut betingelsen med
 * `poi_metadata->>'anchor_family' = 'anlegg'` i begge setningene for å angre
 * idretts-ankrene uten å røre kjøpesentrene.
 *
 * Merk at dette også fjerner de fire håndsatte Valentinlyst-lenkene fra
 * 057/058 dersom Valentinlyst ble re-oppløst — de to migrasjonene finnes
 * fortsatt og kan kjøres på nytt.
 *
 * Fail-soft som discovery/trust: samler warnings, aborterer aldri
 * provisjoneringen. Et board uten anker er dagens board.
 */

import { createServerClient } from "@/lib/supabase/client";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import {
  resolveAnchors,
  type AnchorCandidate,
  type AnchorResolution,
  type MemberCandidate,
} from "@/lib/board/anchor-membership";
import {
  ANCHOR_FAMILIES,
  isFamilyCandidate,
  type AnchorFamily,
} from "@/lib/board/anchor-families";

/** Antall kategorinavn `anchor_summary` nevner før den sier «og mer». */
const SUMMARY_MAX_CATEGORIES = 5;

export interface ResolvedAnchorReport {
  id: string;
  name: string;
  /** Familien ankeret ble akseptert i — «kjøpesenter» eller «idrettsanlegg». */
  family: string;
  memberCount: number;
  summary: string;
  /** Hvor mange medlemmer som kom inn på hver gate — kalibreringsgrunnlag. */
  via: { containment: number; address: number; proximity: number };
}

export interface ResolveAnchorsStepResult {
  anchors: ResolvedAnchorReport[];
  /** Medlemmer som fikk `parent_poi_id` satt eller endret i denne kjøringen. */
  membersLinked: number;
  /** Medlemmer som mistet en lenke til et anker vi faktisk vurderte. */
  membersUnlinked: number;
  /** Kandidater som passerte familiens gate uten å samle nok medlemmer. */
  rejected: Array<{ name: string; memberCount: number }>;
  /** Transport-POI-er holdt utenfor medlemskap (holdeplasser, bysykkel). */
  transportExcluded: number;
  warnings: string[];
}

interface PoiRow {
  id: string;
  name: string;
  address: string | null;
  lat: number | string;
  lng: number | string;
  category_id: string | null;
  contained_in_ids: string[] | null;
  parent_poi_id: string | null;
  anchor_summary: string | null;
  entur_stopplace_id: string | null;
  bysykkel_station_id: string | null;
  poi_metadata: Record<string, unknown> | null;
  google_review_count: number | null;
  source: string | null;
  google_place_id: string | null;
}

const POI_COLUMNS =
  "id, name, address, lat, lng, category_id, contained_in_ids, parent_poi_id, anchor_summary, entur_stopplace_id, bysykkel_station_id, poi_metadata, google_review_count, source, google_place_id";

/**
 * «Dagligvare, apotek, frisør, vinmonopol, bakeri og mer» — samme form som
 * 057/058 skrev for hånd, nå avledet av medlemmenes faktiske kategorier.
 *
 * Idrettsanlegg sender STEDSNAVN hit i stedet (`properNouns`), fordi
 * kategori-varianten kollapser til «Idrettsanlegg» der — hvert medlem har samme
 * kategori. Da blir setningen «Ranheimshallen, Extra Arena, Ranheim
 * Friidrettshall og mer».
 *
 * Deterministisk: sorteres på antall synkende, så navn stigende. Første navn
 * beholder stor forbokstav, resten skrives med liten — det er en setning, ikke
 * en liste med egennavn.
 */
export function buildAnchorSummary(
  categoryNames: string[],
  options: { properNouns?: boolean } = {},
): string {
  if (categoryNames.length === 0) return "";

  const counts = new Map<string, number>();
  for (const name of categoryNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const ordered = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nb-NO"))
    .map(([name]) => name);

  return joinAnchorSummary(ordered, options.properNouns ?? false);
}

/**
 * Sammendrag bygget av medlemmenes STEDSNAVN, sortert på hvor kjent stedet er.
 *
 * Alfabetisk rekkefølge (som kategori-varianten arver fra frekvens-sorteringen)
 * gir «islek, Leangen Bolig Arena, Leangen Bydelshall …» — de fem første
 * bokstavene i alfabetet, ikke de fem stedene noen kjenner. Sortert på antall
 * Google-anmeldelser blir samme anlegg til «Trondheim Ice Rink, Trondheim
 * Curlingklubb, Leangen Bydelshall …», som er hva en beboer faktisk ville sagt.
 *
 * Navnene dedupliseres på kasus først: poolen har samme OSM-objekt under flere
 * id-former, og et sammendrag som gjentar seg er verre enn ingen.
 */
export function buildAnchorNameSummary(
  members: Array<{ name: string; reviewCount: number }>,
): string {
  const byName = new Map<string, { name: string; reviewCount: number }>();
  for (const member of members) {
    const key = member.name.toLocaleLowerCase("nb-NO");
    const seen = byName.get(key);
    if (!seen || member.reviewCount > seen.reviewCount) byName.set(key, member);
  }
  const ordered = [...byName.values()]
    .sort((a, b) => b.reviewCount - a.reviewCount || a.name.localeCompare(b.name, "nb-NO"))
    .map((m) => m.name);
  return joinAnchorSummary(ordered, true);
}

/**
 * «A, B, C og D», eller «A, B, C, D, E og mer» når lista er lengre enn taket.
 *
 * `properNouns` styrer bare kasus: kategorinavn er fellesnavn og skrives med
 * liten forbokstav inne i setningen, stedsnavn er egennavn og gjør ikke det —
 * «Ranheimshallen, extra arena» er feil på en måte leseren ser med én gang.
 */
function joinAnchorSummary(ordered: string[], properNouns: boolean): string {
  if (ordered.length === 0) return "";
  const shown = ordered.slice(0, SUMMARY_MAX_CATEGORIES);
  const words = properNouns
    ? shown
    : shown.map((name, i) => (i === 0 ? name : name.toLocaleLowerCase("nb-NO")));

  if (ordered.length > shown.length) return `${words.join(", ")} og mer`;
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} og ${words[words.length - 1]}`;
}

/**
 * Er raden Placy-eid?
 *
 * Samme spørsmål som `contentRank` i `dedupe-colocated-pins` stiller, og av
 * samme grunn: skriver vi teksten selv, er det raden brukeren skal se. Brukes
 * som rangeringssignal når to kandidater er samme sted under to navn —
 * «Ranheim Idrettspark» finnes både som kuratert seed og som OSM-rad.
 */
/**
 * Anmeldelser teller BARE når raden faktisk er et Google-sted.
 *
 * Målt i poolen 2026-08-28: 24 OSM-rader bærer `google_review_count = 10` uten
 * å ha `google_place_id` i det hele tatt — en plassholder fra en tidligere
 * backfill, ikke ekte anmeldelser. Uten denne gaten vinner OSM-veien «Ranheim
 * idrettsanlegg» (falske 10) over Google-oppføringen «Ranheim Idrettspark»
 * (ekte 1), og ankeret får feil navn.
 */
function googleReviewCount(row: PoiRow): number {
  if (!row.google_place_id) return 0;
  return row.google_review_count ?? 0;
}

function isCuratedRow(row: PoiRow): boolean {
  return row.source === "curated-reseed" || row.source === "curated";
}

export async function resolveProjectAnchors(options: {
  projectId: string;
  /**
   * Tørrkjøring: poolen leses og oppløsningen regnes ut som vanlig, men ingen
   * rad skrives. Tallene i rapporten er dermed nøyaktig det en ekte kjøring
   * ville gjort — samme kodevei, bare uten `update`. Brukes av
   * `scripts/anchor-backfill.ts` til å planlegge backfillen før den kjøres.
   */
  dryRun?: boolean;
}): Promise<ResolveAnchorsStepResult> {
  const dryRun = options.dryRun ?? false;
  const result: ResolveAnchorsStepResult = {
    anchors: [],
    membersLinked: 0,
    membersUnlinked: 0,
    rejected: [],
    transportExcluded: 0,
    warnings: [],
  };

  // `createServerClient` KASTER når service-role-config mangler (fail-fast,
  // PRD 1 Besl. 10). Her er kontrakten fail-soft, så kastet fanges: et board
  // uten anker er dagens board, og provisjoneringen skal ikke ryke på det.
  let baseClient: ReturnType<typeof createServerClient>;
  try {
    baseClient = createServerClient();
  } catch (err) {
    result.warnings.push(
      `⚠️  Supabase ikke konfigurert (${err instanceof Error ? err.message : String(err)}) — anker-oppløsning hoppet over`,
    );
    return result;
  }
  if (!baseClient) {
    result.warnings.push("⚠️  Supabase ikke konfigurert — anker-oppløsning hoppet over");
    return result;
  }
  // v2 er eneste skjema etter cutover 2026-07-06. Cast til public-typen
  // (paritet) så .from() typer entydig; runtime treffer v2.
  const db = baseClient.schema("v2") as unknown as typeof baseClient;

  // ── 1. Prosjektets POI-pool ─────────────────────────────────────────────
  const { data: projectPois, error: ppError } = await db
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", options.projectId);

  if (ppError) {
    result.warnings.push(
      `⚠️  Henting av project_pois feilet: ${ppError.message} — anker-oppløsning hoppet over`,
    );
    return result;
  }
  if (!projectPois || projectPois.length === 0) {
    result.warnings.push("⚠️  Ingen POI-er koblet til prosjektet — anker-oppløsning hoppet over");
    return result;
  }

  const rows: PoiRow[] = [];
  for (const chunk of chunkIds(projectPois.map((p) => p.poi_id))) {
    const { data, error } = await db.from("pois").select(POI_COLUMNS).in("id", chunk);
    if (error || !data) {
      result.warnings.push(
        `⚠️  Henting av POI-data feilet: ${error?.message ?? "ukjent"} — anker-oppløsning hoppet over`,
      );
      return result;
    }
    rows.push(...(data as unknown as PoiRow[]));
  }

  // ── 2. Kandidater og medlemmer, per familie ─────────────────────────────
  //
  // Familiene kjøres ETTER hverandre, ikke sammen, og rekkefølgen er en
  // beslutning: kjøpesenteret først, så idrettsanlegget. Et treningssenter inne
  // i Sirkus hører til Sirkus, ikke til et anlegg 200 m unna, og et medlem som
  // allerede er tatt tilbys aldri til neste familie.
  //
  // Ingen families KANDIDAT kan bli medlem i en annen families anker. Uten den
  // regelen kunne «Ranheim Idrettspark» endt som en butikk-pinne inne i et
  // kjøpesenter, og anlegget forsvunnet fra kartet.
  const geo = new Map<string, { lat: number; lng: number }>();
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) geo.set(row.id, { lat, lng });
  }

  const candidateIdsByFamily = new Map<string, Set<string>>();
  const allCandidateIds = new Set<string>();
  for (const family of ANCHOR_FAMILIES) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!geo.has(row.id)) continue;
      if (isFamilyCandidate(family, { name: row.name, categoryId: row.category_id })) {
        ids.add(row.id);
        allCandidateIds.add(row.id);
      }
    }
    candidateIdsByFamily.set(family.id, ids);
  }

  // Transport er veifinning, ikke innhold i senteret. Telles én gang, ikke per
  // familie — tallet er en egenskap ved poolen.
  const transportIds = new Set<string>();
  for (const row of rows) {
    if (row.entur_stopplace_id || row.bysykkel_station_id) transportIds.add(row.id);
  }
  result.transportExcluded = transportIds.size;

  const candidates: AnchorCandidate[] = [];
  const anchorFamilyById = new Map<string, AnchorFamily>();
  const resolution: AnchorResolution = { anchors: [], parentByPoiId: new Map(), rejected: [] };
  const claimedIds = new Set<string>();

  for (const family of ANCHOR_FAMILIES) {
    const familyCandidateIds = candidateIdsByFamily.get(family.id)!;
    if (familyCandidateIds.size === 0) continue;

    const familyCandidates: AnchorCandidate[] = [];
    const familyMembers: MemberCandidate[] = [];

    for (const row of rows) {
      const point = geo.get(row.id);
      if (!point) continue;

      if (familyCandidateIds.has(row.id)) {
        familyCandidates.push({
          id: row.id,
          name: row.name,
          address: row.address,
          ...point,
          curated: isCuratedRow(row),
          reviewCount: googleReviewCount(row),
          containedInIds: row.contained_in_ids ?? undefined,
        });
        continue;
      }
      if (allCandidateIds.has(row.id)) continue;
      if (transportIds.has(row.id)) continue;
      if (claimedIds.has(row.id)) continue;

      familyMembers.push({
        id: row.id,
        name: row.name,
        address: row.address,
        ...point,
        categoryId: row.category_id,
        containedInIds: row.contained_in_ids ?? undefined,
      });
    }

    const familyResolution = resolveAnchors(familyCandidates, familyMembers, family.options);
    candidates.push(...familyCandidates);
    for (const anchor of familyResolution.anchors) {
      anchorFamilyById.set(anchor.anchorId, family);
      resolution.anchors.push(anchor);
      for (const id of anchor.memberIds) claimedIds.add(id);
    }
    for (const [poiId, anchorId] of familyResolution.parentByPoiId) {
      resolution.parentByPoiId.set(poiId, anchorId);
    }
    resolution.rejected.push(...familyResolution.rejected);
  }

  if (candidates.length === 0) {
    // Ikke en feil: de fleste boards har verken kjøpesenter eller idrettsanlegg
    // i radiusen.
    return result;
  }

  result.rejected = resolution.rejected
    .filter((r) => r.memberCount > 0)
    .map((r) => ({ name: r.name, memberCount: r.memberCount }));

  // ── 3. Kategorinavn til anchor_summary ──────────────────────────────────
  const categoryNameById = new Map<string, string>();
  const usedCategoryIds = [
    ...new Set(
      resolution.anchors.flatMap((a) =>
        a.memberIds
          .map((id) => rows.find((r) => r.id === id)?.category_id)
          .filter((c): c is string => Boolean(c)),
      ),
    ),
  ];
  if (usedCategoryIds.length > 0) {
    const { data: cats, error: catError } = await db
      .from("categories")
      .select("id, name")
      .in("id", usedCategoryIds);
    if (catError) {
      result.warnings.push(
        `⚠️  Kategorinavn kunne ikke hentes (${catError.message}) — anchor_summary blir tom`,
      );
    }
    for (const c of cats ?? []) categoryNameById.set(c.id, c.name);
  }

  // ── 4. Skriv medlemslenkene (én bulk-update per anker) ──────────────────
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const today = new Date().toISOString().slice(0, 10);

  for (const anchor of resolution.anchors) {
    const changed = anchor.memberIds.filter(
      (id) => rowById.get(id)?.parent_poi_id !== anchor.anchorId,
    );
    for (const chunk of chunkIds(changed)) {
      if (dryRun) {
        result.membersLinked += chunk.length;
        continue;
      }
      const { error } = await db
        .from("pois")
        .update({ parent_poi_id: anchor.anchorId })
        .in("id", chunk);
      if (error) {
        result.warnings.push(
          `⚠️  Kunne ikke lenke ${chunk.length} medlemmer til «${anchor.name}»: ${error.message}`,
        );
        continue;
      }
      result.membersLinked += chunk.length;
    }

    const anchorRow = rowById.get(anchor.anchorId);
    const family = anchorFamilyById.get(anchor.anchorId);

    const summary =
      family?.summaryFrom === "names"
        ? buildAnchorNameSummary(
            anchor.memberIds
              .map((id) => rowById.get(id))
              .filter((r): r is PoiRow => Boolean(r))
              .map((r) => ({ name: r.name, reviewCount: googleReviewCount(r) })),
          )
        : buildAnchorSummary(
            anchor.memberIds
              .map((id) => rowById.get(id)?.category_id)
              .filter((c): c is string => Boolean(c))
              .map((c) => categoryNameById.get(c))
              .filter((n): n is string => Boolean(n)),
          );
    const metadata = {
      ...(anchorRow?.poi_metadata ?? {}),
      anchor_resolution: today,
      // Hvilken familie ankeret kom fra. Gjør angre kirurgisk: idretts-ankrene
      // kan rulles tilbake uten å røre kjøpesentrene.
      anchor_family: family?.id ?? "kjopesenter",
    };
    if (!dryRun) {
      const { error: anchorError } = await db
        .from("pois")
        .update({
          anchor_summary: summary || null,
          poi_metadata: metadata,
          // Et anker er aldri medlem av noe. Rydder etter en tidligere kjøring
          // der kandidaten ennå ikke var et anker.
          parent_poi_id: null,
        })
        .eq("id", anchor.anchorId);
      if (anchorError) {
        result.warnings.push(
          `⚠️  Kunne ikke skrive anchor_summary for «${anchor.name}»: ${anchorError.message}`,
        );
      }
    }

    const via = { containment: 0, address: 0, proximity: 0 };
    for (const v of Object.values(anchor.via)) via[v]++;

    result.anchors.push({
      id: anchor.anchorId,
      name: anchor.name,
      family: family?.label ?? "Kjøpesenter",
      memberCount: anchor.memberIds.length,
      summary,
      via,
    });
  }

  // ── 5. Riv lenker som ikke lenger holder ────────────────────────────────
  // «Vurdert i denne kjøringen» er IKKE godt nok grunnlag for å rive. ≥4-kravet
  // måles mot DETTE prosjektets POI-utvalg, og et board langt unna har færre av
  // senterets butikker i utvalget sitt: Olavskvartalet oppløses til 4 medlemmer
  // fra Ferjemannsveien og 2 fra Teknostallen 2 km unna. Rev vi på avvisning,
  // ville det sist kjørte boardet degradert ankeret for alle de andre —
  // rekkefølgen på prosjektene ville avgjort resultatet.
  //
  // Derfor to grunner, og bare de to:
  //   1. ankeret ble AKSEPTERT her, men POI-en er ikke medlem lenger
  //      (stedet flyttet ut, eller adressen ble rettet)
  //   2. bygget er ikke anker NOEN steder — verken her eller fra en tidligere
  //      kjøring — så lenken peker på et senter som ikke finnes som destinasjon
  //
  // Bare POI-er som ikke fikk NOE anker i denne kjøringen. Et medlem som byttet
  // anker er allerede skrevet i steg 4, og skal ikke rives ned igjen her.
  const acceptedAnchorIds = new Set(resolution.anchors.map((a) => a.anchorId));
  const deadAnchorIds = new Set(
    candidates
      .filter((c) => !acceptedAnchorIds.has(c.id) && !rowById.get(c.id)?.anchor_summary)
      .map((c) => c.id),
  );
  const stale = rows
    .filter(
      (r) =>
        r.parent_poi_id !== null &&
        (acceptedAnchorIds.has(r.parent_poi_id) || deadAnchorIds.has(r.parent_poi_id)) &&
        !resolution.parentByPoiId.has(r.id),
    )
    .map((r) => r.id);

  for (const chunk of chunkIds(stale)) {
    if (dryRun) {
      result.membersUnlinked += chunk.length;
      continue;
    }
    const { error } = await db.from("pois").update({ parent_poi_id: null }).in("id", chunk);
    if (error) {
      result.warnings.push(
        `⚠️  Kunne ikke rydde ${chunk.length} utdaterte anker-lenker: ${error.message}`,
      );
      continue;
    }
    result.membersUnlinked += chunk.length;
  }

  return result;
}
