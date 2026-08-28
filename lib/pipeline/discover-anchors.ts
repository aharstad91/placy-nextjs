/**
 * Anker-søk utenfor prosjektsirkelen (kjøpesenter-anker, Unit 3).
 *
 * Prosjektets discovery-radius (`BOLIG_DISCOVERY_RADIUS_M`, 3 000 m) er
 * kontrakten for vanlige POI-er og røres ikke. Den bærer riktig premiss for et
 * enkeltsted: folk bruker området rundt hjemmet sitt. Men den bærer FEIL
 * premiss for et kjøpesenter, fordi «nærsenter» er relativt — Wesselsløkkas
 * ligger 510 m unna, Vikhammers 470 m, og Sundsøyas 12,1 km. En fast radius
 * bommer begge veier.
 *
 * Derfor et eget pass, med en egen regel: **alle innenfor prosjektsirkelen,
 * pluss de tre nærmeste uansett avstand.** Et antall tilpasser seg selv. Et
 * board i byen får ingenting nytt (det har allerede tre innenfor sirkelen), og
 * et board på bygda får sine tre — som er hele poenget, siden det er nettopp
 * der inkumbenten (FINNs Nærområdet-kart) er svakest.
 *
 * ## Realitets-gaten når poolen ikke kan svare
 *
 * Passet importerer BARE ankeret, ikke medlemmene. Et anker utenfor sirkelen
 * har derfor null medlemmer i poolen, og `resolve-anchors-step` — som krever
 * fire — ville aldri forfremmet det. Uten mottiltak ville Thon Senter Verdal
 * landet som et vanlig butikk-sted, og et mistypet «senter» sluppet inn like
 * lett.
 *
 * Mottiltaket er å skille «har medlemmer» fra «lagrer medlemmer»: kravet i
 * regelen er at fire virksomheter FINNES i bygget, ikke at de ligger i basen.
 * `probeAnchorMembers` teller dem med ett kall mot Google og bygger
 * `anchor_summary` av kategoriene deres, uten at én butikk importeres. Et
 * fjernt anker som ikke består firetallet blir ikke importert i det hele tatt.
 *
 * `anchor_summary IS NOT NULL` er dermed ankerflagget, uansett hvilken av de
 * to veiene stedet kom inn: poolen (`resolve-anchors-step`) eller proben.
 */

import {
  discoverAnchorCandidates,
  probeAnchorMembers,
  ANCHOR_GOOGLE_TYPE,
  ANCHOR_SEARCH_RADIUS_M,
  type AnchorHit,
  type AnchorMemberProbe,
} from "@/lib/pipeline/poi-discovery";
import { persistDiscoveredPOIs } from "@/lib/pipeline/import-pois";
import { buildAnchorSummary } from "@/lib/pipeline/resolve-anchors-step";
import { DEFAULT_MIN_MEMBERS } from "@/lib/board/anchor-membership";
import { createServerClient } from "@/lib/supabase/client";

export { ANCHOR_GOOGLE_TYPE, ANCHOR_SEARCH_RADIUS_M };

/**
 * Hvor mange ankre et board garanteres, uansett hvor de ligger.
 *
 * Tre, ikke ett: ett anker sier «her er senteret ditt» uten å si noe om
 * alternativene, og for et ruralt board er nettopp valget mellom Verdal og
 * Levanger den reelle hverdagsinformasjonen. Tre, ikke fem: den fjerde og
 * femte ligger målt 18,7 og 19,3 km fra Sundsøya — det er ikke lenger
 * nabolaget, det er fylket.
 */
export const ANCHOR_MIN_COUNT = 3;

export interface AnchorImportReport {
  id: string;
  name: string;
  distanceMeters: number;
  /** Ligger utenfor prosjektsirkelen — altså et sted standardpasset ikke fant. */
  beyondCircle: boolean;
  /** Målt medlemstall. Bare satt for ankre utenfor sirkelen (proben). */
  memberCount?: number;
  /** «minst N» — kallet traff Googles tak på 20. */
  memberCountIsFloor?: boolean;
  /** Teksten som ble skrevet til `anchor_summary`. */
  summary?: string;
}

export interface DiscoverAnchorsStepResult {
  /** Kandidater Google returnerte og som overlevde kvalitetskjeden. */
  candidatesFound: number;
  imported: AnchorImportReport[];
  /** Hvor mange av de importerte som lå utenfor prosjektsirkelen. */
  beyondCircle: number;
  /** Fjerne kandidater som ikke besto realitets-gaten — ikke importert. */
  rejected: Array<{ name: string; distanceMeters: number; memberCount: number }>;
  warnings: string[];
}

/**
 * Utvalgsregelen, ren og testbar: alle innenfor sirkelen + de `minCount`
 * nærmeste.
 *
 * Sortert på avstand er «innenfor sirkelen» nødvendigvis et PREFIKS av lista,
 * så unionen av de to mengdene er bare det lengste av de to prefiksene. Det er
 * derfor regelen ikke trenger noen dedup: den leser aldri det samme to ganger.
 *
 * Merk hva regelen IKKE gjør: den henter ikke inn et senter som ligger like
 * utenfor sirkelen når tre nærmere allerede finnes innenfor. Målt tilfelle —
 * City Lade ligger 3 010 m fra Strindfjordvegen 10, ti meter utenfor, og blir
 * fortsatt stående ute fordi Grilstad mall, Hangaren og Lade Arena er nærmere.
 * Det er tilsiktet: regelen garanterer DEKNING, den utvider ikke sirkelen.
 *
 * ## Rating-gaten gjelder bare utenfor sirkelen
 *
 * Et senter uten Google-rating slipper inn når det ligger INNENFOR
 * prosjektsirkelen, og avvises utenfor. Grunnen er hva rating-gaten faktisk
 * er et proxy for: «kjenner Google dette stedet i det hele tatt». Innenfor
 * sirkelen har vi en bedre kilde — poolen selv. Oppløses fire virksomheter
 * inn i bygget, er det et senter uansett hva anmeldelsene sier (Unit 1s
 * realitets-gate). Utenfor sirkelen importeres ingen medlemmer, så den
 * kontrollen finnes ikke, og da er Googles egen kjennskap det vi har.
 *
 * Uten dette skillet er passet AKTIVT skadelig på nettopp de boardene det er
 * bygget for. Målt på Utsikten 6: Vikhammer senteret har null anmeldelser og
 * ryker på gaten, hvorpå «de tre nærmeste» fyller de tomme plassene med
 * Grilstad mall (6,3 km), Sveberg Handelspark (6,4 km) og Hangaren Lade
 * (8,3 km). Boardet mistet altså nærsenteret sitt OG fikk tre feil i stedet.
 */
export function selectAnchorImports(
  hits: AnchorHit[],
  projectRadiusMeters: number,
  minCount: number = ANCHOR_MIN_COUNT
): AnchorHit[] {
  const eligible = hits.filter(
    (h) => h.distanceMeters <= projectRadiusMeters || h.hasQualitySignals
  );
  const sorted = eligible.sort(
    (a, b) => a.distanceMeters - b.distanceMeters || a.poi.id.localeCompare(b.poi.id)
  );
  const insideCount = sorted.filter(
    (h) => h.distanceMeters <= projectRadiusMeters
  ).length;
  return sorted.slice(0, Math.max(insideCount, Math.max(0, minCount)));
}

/**
 * Kjør anker-passet for ett prosjekt og lagre treffene.
 *
 * Fail-soft som `resolve-anchors-step`: et manglende anker-pass skal aldri
 * felle en provisjonering. Alt som går galt blir en warning kalleren logger.
 */
export async function discoverAnchorsForProject(options: {
  projectId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  searchRadiusMeters?: number;
  minCount?: number;
  /** Terskelen for realitets-gaten. Delt med `resolveAnchors` (Unit 1). */
  minMembers?: number;
  /**
   * Tørrkjøring: Google spørres som vanlig (les-kall), men INGENTING skrives.
   * Rapporten er identisk i form, så en backfill kan planlegges og gjennomgås
   * før den kjøres. Går gjennom nøyaktig samme kodevei som den ekte kjøringen
   * — en tørrkjøring som simulerer i en egen gren ville ikke bevist noe.
   */
  dryRun?: boolean;
}): Promise<DiscoverAnchorsStepResult> {
  const {
    projectId,
    lat,
    lng,
    radiusMeters,
    searchRadiusMeters = ANCHOR_SEARCH_RADIUS_M,
    minCount = ANCHOR_MIN_COUNT,
    minMembers = DEFAULT_MIN_MEMBERS,
    dryRun = false,
  } = options;

  const empty: DiscoverAnchorsStepResult = {
    candidatesFound: 0,
    imported: [],
    beyondCircle: 0,
    rejected: [],
    warnings: [],
  };

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      ...empty,
      warnings: ["⚠️  Anker-søk hoppet over: GOOGLE_PLACES_API_KEY mangler"],
    };
  }

  let hits: AnchorHit[];
  try {
    hits = await discoverAnchorCandidates(
      { center: { lat, lng }, radius: searchRadiusMeters },
      apiKey
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...empty, warnings: [`⚠️  Anker-søk feilet: ${msg}`] };
  }

  if (hits.length === 0) {
    return {
      ...empty,
      warnings: [
        `⚠️  Ingen kjøpesenter funnet innen ${Math.round(searchRadiusMeters / 1000)} km — boardet får ingen ankre`,
      ],
    };
  }

  const warnings: string[] = [];
  const selected = selectAnchorImports(hits, radiusMeters, minCount);
  const inside = selected.filter((h) => h.distanceMeters <= radiusMeters);
  const beyond = selected.filter((h) => h.distanceMeters > radiusMeters);

  // Ankre INNENFOR sirkelen probes ikke: medlemmene deres importeres av
  // standardpasset, så poolen svarer på firetallet gratis i Steg 5b.
  const accepted: Array<{ hit: AnchorHit; probe: AnchorMemberProbe }> = [];
  const rejected: DiscoverAnchorsStepResult["rejected"] = [];

  for (const hit of beyond) {
    const googlePlaceId = hit.poi.googlePlaceId;
    if (!googlePlaceId) {
      // Proben slår opp containment på Googles egen id. Uten den kan vi ikke
      // telle, og et utellet sted importeres ikke — men tapet skal ikke være
      // stille.
      warnings.push(
        `⚠️  ${hit.poi.name} hoppet over: mangler Google place-id, kan ikke telles`
      );
      continue;
    }

    let probe: AnchorMemberProbe;
    try {
      probe = await probeAnchorMembers(
        { googlePlaceId, coordinates: hit.poi.coordinates },
        apiKey
      );
    } catch (err) {
      // Uverifisert er ikke det samme som godkjent. Et sted 12 km unna som vi
      // ikke fikk telt, importeres ikke — men tapet skal være synlig.
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`⚠️  Kunne ikke telle medlemmer i ${hit.poi.name}: ${msg}`);
      continue;
    }

    if (probe.memberCount < minMembers) {
      rejected.push({
        name: hit.poi.name,
        distanceMeters: Math.round(hit.distanceMeters),
        memberCount: probe.memberCount,
      });
      continue;
    }
    accepted.push({ hit, probe });
  }

  const toPersist = [...inside, ...accepted.map((a) => a.hit)];
  if (toPersist.length === 0) {
    return {
      ...empty,
      candidatesFound: hits.length,
      rejected,
      warnings: [
        ...warnings,
        `⚠️  Ingen av de ${beyond.length} nærmeste kjøpesentrene besto realitets-gaten (≥${minMembers} virksomheter)`,
      ],
    };
  }

  try {
    if (!dryRun) {
      await persistDiscoveredPOIs(
        toPersist.map((h) => h.poi),
        projectId,
        { label: "discoverAnchorsForProject" }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...empty,
      candidatesFound: hits.length,
      rejected,
      warnings: [...warnings, `⚠️  Anker-import feilet: ${msg}`],
    };
  }

  const summaries = await writeProbedAnchorSummaries(accepted, warnings, dryRun);

  const imported: AnchorImportReport[] = toPersist.map((h) => {
    const probe = accepted.find((a) => a.hit.poi.id === h.poi.id)?.probe;
    return {
      id: h.poi.id,
      name: h.poi.name,
      distanceMeters: Math.round(h.distanceMeters),
      beyondCircle: h.distanceMeters > radiusMeters,
      ...(probe
        ? {
            memberCount: probe.memberCount,
            memberCountIsFloor: probe.saturated,
            summary: summaries.get(h.poi.id) ?? "",
          }
        : {}),
    };
  });

  const beyondCircle = imported.filter((a) => a.beyondCircle).length;
  if (beyondCircle > 0) {
    const first = imported.find((a) => a.beyondCircle)!;
    warnings.push(
      `ℹ️  ${beyondCircle} anker hentet utenfor prosjektsirkelen (nærmeste: ${first.name} ${(first.distanceMeters / 1000).toFixed(1)} km, ${first.memberCountIsFloor ? "minst " : ""}${first.memberCount} virksomheter) — medlemmene deres importeres ikke`
    );
  }
  for (const r of rejected) {
    warnings.push(
      `ℹ️  ${r.name} (${(r.distanceMeters / 1000).toFixed(1)} km) hoppet over: bare ${r.memberCount} virksomheter i bygget`
    );
  }

  return { candidatesFound: hits.length, imported, beyondCircle, rejected, warnings };
}

/**
 * Skriver `anchor_summary` på de probede ankrene, og tagger radene så hele
 * passet kan angres:
 *
 *   UPDATE v2.pois SET anchor_summary = NULL,
 *          poi_metadata = poi_metadata - 'anchor_probe'
 *   WHERE poi_metadata->>'anchor_probe' IS NOT NULL;
 *
 * Fail-soft: en skrivefeil her betyr et anker uten register, ikke et board
 * uten anker.
 */
async function writeProbedAnchorSummaries(
  accepted: Array<{ hit: AnchorHit; probe: AnchorMemberProbe }>,
  warnings: string[],
  dryRun = false
): Promise<Map<string, string>> {
  const written = new Map<string, string>();
  if (accepted.length === 0) return written;

  // Tørrkjøring: teksten bygges (det er den som skal gjennomgås) men ingen rad
  // røres, og Supabase kontaktes ikke i det hele tatt.
  if (dryRun) {
    for (const { hit, probe } of accepted) {
      written.set(hit.poi.id, buildAnchorSummary(probe.categoryNames));
    }
    return written;
  }

  let db: ReturnType<ReturnType<typeof createServerClient>["schema"]>;
  try {
    // `createServerClient` KASTER uten service-role-config (fail-fast, PRD 1
    // Besl. 10). Her er kontrakten fail-soft, så kastet fanges.
    db = createServerClient().schema("v2");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`⚠️  Anker-tekst ikke skrevet (Supabase utilgjengelig): ${msg}`);
    return written;
  }

  const ids = accepted.map((a) => a.hit.poi.id);
  const { data: rows, error: readError } = await db
    .from("pois")
    .select("id, poi_metadata")
    .in("id", ids);

  if (readError) {
    warnings.push(`⚠️  Kunne ikke lese anker-metadata: ${readError.message}`);
    return written;
  }

  const metadataById = new Map(
    (rows ?? []).map((r) => [
      r.id as string,
      (r.poi_metadata ?? {}) as Record<string, unknown>,
    ])
  );
  const today = new Date().toISOString().slice(0, 10);

  for (const { hit, probe } of accepted) {
    const summary = buildAnchorSummary(probe.categoryNames);
    const { error } = await db
      .from("pois")
      .update({
        anchor_summary: summary || null,
        poi_metadata: {
          ...(metadataById.get(hit.poi.id) ?? {}),
          anchor_probe: {
            date: today,
            member_count: probe.memberCount,
            saturated: probe.saturated,
          },
        },
        // Et anker er aldri medlem av noe.
        parent_poi_id: null,
      })
      .eq("id", hit.poi.id);

    if (error) {
      warnings.push(
        `⚠️  Kunne ikke skrive anker-tekst for ${hit.poi.name}: ${error.message}`
      );
      continue;
    }
    written.set(hit.poi.id, summary);
  }

  return written;
}
