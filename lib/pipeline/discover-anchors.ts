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
 * Passet importerer BARE ankeret, ikke medlemmene. Et anker utenfor sirkelen
 * har derfor null medlemmer i poolen og blir ikke forfremmet av
 * `resolve-anchors-step` (som krever fire). Det lever som et vanlig
 * kjøpesenter-sted til noe gir det innhold — se plan-dokumentet.
 */

import {
  discoverAnchorCandidates,
  ANCHOR_GOOGLE_TYPE,
  ANCHOR_SEARCH_RADIUS_M,
  type AnchorHit,
} from "@/lib/pipeline/poi-discovery";
import { persistDiscoveredPOIs } from "@/lib/pipeline/import-pois";

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
}

export interface DiscoverAnchorsStepResult {
  /** Kandidater Google returnerte og som overlevde kvalitetskjeden. */
  candidatesFound: number;
  imported: AnchorImportReport[];
  /** Hvor mange av de importerte som lå utenfor prosjektsirkelen. */
  beyondCircle: number;
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
}): Promise<DiscoverAnchorsStepResult> {
  const {
    projectId,
    lat,
    lng,
    radiusMeters,
    searchRadiusMeters = ANCHOR_SEARCH_RADIUS_M,
    minCount = ANCHOR_MIN_COUNT,
  } = options;

  const empty: DiscoverAnchorsStepResult = {
    candidatesFound: 0,
    imported: [],
    beyondCircle: 0,
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
      candidatesFound: 0,
      imported: [],
      beyondCircle: 0,
      warnings: [
        `⚠️  Ingen kjøpesenter funnet innen ${Math.round(searchRadiusMeters / 1000)} km — boardet får ingen ankre`,
      ],
    };
  }

  const selected = selectAnchorImports(hits, radiusMeters, minCount);
  const imported: AnchorImportReport[] = selected.map((h) => ({
    id: h.poi.id,
    name: h.poi.name,
    distanceMeters: Math.round(h.distanceMeters),
    beyondCircle: h.distanceMeters > radiusMeters,
  }));
  const beyondCircle = imported.filter((a) => a.beyondCircle).length;

  const warnings: string[] = [];
  try {
    await persistDiscoveredPOIs(
      selected.map((h) => h.poi),
      projectId,
      { label: "discoverAnchorsForProject" }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      candidatesFound: hits.length,
      imported: [],
      beyondCircle: 0,
      warnings: [`⚠️  Anker-import feilet: ${msg}`],
    };
  }

  if (beyondCircle > 0) {
    const nearest = imported.find((a) => a.beyondCircle);
    warnings.push(
      `ℹ️  ${beyondCircle} anker hentet utenfor prosjektsirkelen (nærmeste: ${nearest?.name} ${((nearest?.distanceMeters ?? 0) / 1000).toFixed(1)} km) — medlemmene deres importeres ikke`
    );
  }

  return { candidatesFound: hits.length, imported, beyondCircle, warnings };
}
