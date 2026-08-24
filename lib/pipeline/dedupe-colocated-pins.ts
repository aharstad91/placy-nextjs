/**
 * Tverr-kilde-dedup av pins på ett board.
 *
 * Problemet (målt 2026-08-24): samme fysiske sted kommer inn fra flere kilder
 * og blir flere pins. `lib/board/spread-co-located.ts` sprer sammenfallende
 * markører på en liten sirkel i stedet for å stable dem, så duplikatene skjuler
 * seg IKKE — de vises side om side som om det var to steder.
 *
 * Fire mønstre observert i prod:
 *   - "EXTRA Arena" (OSM-node, `sports_centre`) og "Extra Arena" (OSM-way,
 *     `pitch`) 80 m fra hverandre: samme anlegg, tagget to ganger i OSM.
 *   - "Hansbakkfjæra" som intern badeplass-seed OG som OSM-flate.
 *   - "Sakshaug skole" fra NSR og fra OSM.
 *   - "Recharge Charging Station" som fire distinkte Google-place-IDer innenfor
 *     200 m — fire reelle ladepunkter på samme anlegg, korrekt data presentert
 *     som fire identiske pins.
 *
 * HVOR dedupen hører: i hydreringen (`hydrate-report.ts`), ikke i lenkingen til
 * `project_pois`. Boardet rendrer `product_pois`; `project_pois` er poolen som
 * også bærer precomputede reisetider. Å droppe en rad fra poolen ville kastet
 * reisetiden og gjort valget varig — å droppe den fra produktet er en ren
 * VISNINGS-beslutning som re-hydrering gjenoppretter. Poolen skal være komplett.
 *
 * Konsekvensen av å ta feil er asymmetrisk her også, men i motsatt retning av
 * OSM-porten: å vise to pins for samme sted er en synlig feil på hvert board,
 * mens å skjule den ene av to identiske pins koster ingenting så lenge de
 * faktisk ER samme sted. Derfor er terskelen streng — samme kategori, samme
 * normaliserte navn, under 200 m — og ikke fuzzy navnematching.
 */

/** Steder nærmere enn dette, med samme navn og kategori, regnes som samme sted. */
export const COLOCATED_THRESHOLD_M = 200;

export interface DedupeCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categoryId: string;
  source: string | null;
  /** Placy-eid redaksjonell tekst. Avgjør vinneren FØR kilde-prioritet. */
  editorialHook?: string | null;
  localInsight?: string | null;
  /** Google-metadata (rating, åpningstider, bilder) henger på denne. */
  googlePlaceId?: string | null;
}

export interface DedupeDrop {
  id: string;
  keptId: string;
  name: string;
  categoryId: string;
  meters: number;
}

export interface DedupeResult {
  kept: DedupeCandidate[];
  dropped: DedupeDrop[];
}

function haversineMeters(a: DedupeCandidate, b: DedupeCandidate): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Navne-normalisering. Bevisst konservativ: bare store/små bokstaver og
 * skilletegn. Ingen stemming, ingen diakritikk-stripping — "Charlottenlund
 * kunstgressbane" og "Charlottenlund kunstgrasbane" ER to forskjellige baner
 * (430 m fra hverandre), og fuzzy matching ville slått dem sammen.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

/**
 * Kilde-prioritet — lavere er bedre. Google først fordi den bærer åpningstider,
 * telefon, bilder og omtaler; registrene (NSR/Barnehagefakta/Entur) er
 * autoritative på institusjoner; OSM har geometri men sjelden åpningstider;
 * interne seeds sist fordi de er våre egne plassholdere.
 *
 * `source` er ikke alltid satt (Google-rader og gamle migrerte rader har null),
 * så ID-prefikset brukes som andre signal.
 */
export function sourceRank(candidate: DedupeCandidate): number {
  const src = candidate.source?.toLowerCase() ?? "";
  const id = candidate.id;
  if (src === "google" || id.startsWith("google-")) return 0;
  if (
    src === "nsr" ||
    src === "barnehagefakta" ||
    src === "entur" ||
    id.startsWith("nsr-") ||
    id.startsWith("bhf-") ||
    id.startsWith("entur-")
  ) {
    return 1;
  }
  if (src === "osm" || id.startsWith("osm-")) return 2;
  return 3;
}

/**
 * Andre-nivå tie-break innenfor samme kilde-rang. For OSM er en node som regel
 * det bevisst plasserte stedspunktet, mens en way/relation er geometrien rundt
 * det: "EXTRA Arena" (node, sports_centre) er et bedre stedsobjekt enn
 * "Extra Arena" (way, pitch), som egentlig er banen på anlegget.
 */
function osmGeometryRank(id: string): number {
  if (id.startsWith("osm-node-")) return 0;
  if (id.startsWith("osm-way-")) return 1;
  if (id.startsWith("osm-relation-")) return 2;
  return 3;
}

/**
 * INNHOLDS-rang, og den slår kilde-rang. Lavere er bedre.
 *
 * Dette er den viktigste regelen i modulen, og den ble funnet ved å måle:
 * ren kilde-prioritet ville droppet `badeplass-grilstadstranda` — som har
 * `editorial_hook`, `poi_tier`, `is_local_gem` og `grounding` — til fordel for
 * `osm-relation-20106862`, som har ingenting utover `osm_id`. Det ville skjult
 * kuratert Lokalkunnskap bak en tom rad.
 *
 * Redaksjonell tekst rangeres over Google-metadata fordi den er Placy-eid og
 * håndskrevet per sted, mens rating/åpningstider/bilder kan hentes på nytt av
 * pipelinen når som helst. Og fordi `highlightCandidates` i strøkets editorial
 * peker på KONKRETE POI-IDer: skjuler vi den kuraterte raden, forsvinner
 * høydepunktet fra boardet.
 */
export function contentRank(candidate: DedupeCandidate): number {
  if (candidate.editorialHook?.trim() || candidate.localInsight?.trim()) return 0;
  if (candidate.googlePlaceId?.trim()) return 1;
  return 2;
}

function pickWinner(
  cluster: DedupeCandidate[],
  protectedIds: ReadonlySet<string>
): DedupeCandidate {
  return [...cluster].sort((a, b) => {
    // Beskyttede IDer vinner alltid — seam for kallere som vet om
    // highlight-referanser eller andre eksterne pekere til en bestemt rad.
    const prot = Number(protectedIds.has(b.id)) - Number(protectedIds.has(a.id));
    if (prot !== 0) return prot;
    const content = contentRank(a) - contentRank(b);
    if (content !== 0) return content;
    const rank = sourceRank(a) - sourceRank(b);
    if (rank !== 0) return rank;
    const geom = osmGeometryRank(a.id) - osmGeometryRank(b.id);
    if (geom !== 0) return geom;
    // Deterministisk siste utvei — uten den kan to kjøringer velge ulikt.
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Grupperer på (kategori, normalisert navn), klynger transitivt på avstand, og
 * beholder én vinner per klynge. Returnerer BÅDE de beholdte og de droppede —
 * kalleren skal logge de droppede. Stille dedup leses som "det var bare én der".
 */
export function dedupeColocatedPins(
  candidates: DedupeCandidate[],
  options: { thresholdMeters?: number; protectedIds?: Iterable<string> } = {}
): DedupeResult {
  const threshold = options.thresholdMeters ?? COLOCATED_THRESHOLD_M;
  const protectedIds = new Set(options.protectedIds ?? []);
  const groups = new Map<string, DedupeCandidate[]>();

  for (const candidate of candidates) {
    const key = `${candidate.categoryId} ${normalizeName(candidate.name)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(candidate);
    else groups.set(key, [candidate]);
  }

  const kept: DedupeCandidate[] = [];
  const dropped: DedupeDrop[] = [];

  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      kept.push(bucket[0]);
      continue;
    }

    const unassigned = [...bucket];
    while (unassigned.length > 0) {
      // Transitiv klynging: en ny nabo utvider klyngen, så en kjede av punkter
      // 150 m fra hverandre havner i samme klynge selv om endene er 300 m unna.
      const cluster = [unassigned.shift()!];
      let grew = true;
      while (grew) {
        grew = false;
        for (let i = unassigned.length - 1; i >= 0; i--) {
          if (cluster.some((c) => haversineMeters(c, unassigned[i]) <= threshold)) {
            cluster.push(unassigned.splice(i, 1)[0]);
            grew = true;
          }
        }
      }

      if (cluster.length === 1) {
        kept.push(cluster[0]);
        continue;
      }

      const winner = pickWinner(cluster, protectedIds);
      kept.push(winner);
      for (const loser of cluster) {
        if (loser.id === winner.id) continue;
        dropped.push({
          id: loser.id,
          keptId: winner.id,
          name: loser.name,
          categoryId: loser.categoryId,
          meters: Math.round(haversineMeters(winner, loser)),
        });
      }
    }
  }

  return { kept, dropped };
}

/** Én linje for `warnings` — aldri stille. */
export function summarizeDedupe(result: DedupeResult): string {
  if (result.dropped.length === 0) return "Dedup: ingen sammenfallende pins";
  const byCategory = new Map<string, number>();
  for (const drop of result.dropped) {
    byCategory.set(drop.categoryId, (byCategory.get(drop.categoryId) ?? 0) + 1);
  }
  const parts = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, n]) => `${category} ${n}`);
  return `Dedup: skjulte ${result.dropped.length} sammenfallende pin(s) (${parts.join(", ")})`;
}
