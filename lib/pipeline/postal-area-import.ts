/**
 * Import av postnummerområder fra Kartverket (WFS) → `v2.postal_areas`.
 *
 * Ren logikk: bygger WFS-spørringen, parser GML til GeoJSON, og avgjør om en rad
 * faktisk trenger å skrives. Nettverk og databaseskriving ligger i
 * `scripts/import-postal-areas.ts` — samme deling som
 * `scripts/ground-poi-content-lib.ts` mot `scripts/ground-poi-content.ts`.
 *
 * HVORFOR GML OG IKKE GeoJSON: Kartverkets WFS tilbyr bare GML og text/xml
 * (verifisert i GetCapabilities 2026-08-13). Geonorges nedlastings-API kan gi
 * GeoJSON, men krever en asynkron bestill → poll → hent-zip-flyt med
 * filartefakter. Ett synkront GET per kommune med `fes:Filter` er enklere, og
 * `fast-xml-parser` er allerede en avhengighet. Blir GML-formen mer variert enn
 * de seks kommunene her avslører, er nedlastings-APIet reserveløsningen.
 *
 * KOORDINATREKKEFØLGE: GML-en er EPSG:4258 med **lat før lon**. GeoJSON krever
 * [lng, lat]. Dette er den farligste stille feilen i hele importen — en ombyttet
 * form havner i havet uten å kaste noen feil, og `pointInGeometry` ville bare
 * returnert `false` for alt. Derfor snus parene her, og hver koordinat sjekkes
 * mot Norges bbox slik at en snuing som slipper gjennom blir en forkastet
 * feature i stedet for en usynlig feil rad.
 */

import { XMLParser } from "fast-xml-parser";

/** Kartverkets WFS for postnummerområder. Ingen API-nøkkel. */
export const WFS_URL = "https://wfs.geonorge.no/skwms1/wfs.postnummeromrader";

const TYPENAME = "app:Postnummerområde";

export interface Kommune {
  nummer: string;
  navn: string;
  /** Geografiske postnumre (type G/B) i Brings register, hentet 2026-08-13. */
  forventetAntall: number;
  /**
   * `true` = del av markedet vi selger inn i. `false` = tatt med bare fordi vi
   * allerede har et kuratert område der, og det må kunne telles.
   */
  marked: boolean;
}

/**
 * Kommunene importen dekker.
 *
 * De fire første er markedet (105 postnumre). Oppdal og Inderøy er med fordi to
 * av våre ni ferdig kuraterte områder ligger der — Oppdal-området og
 * Straumen-området. Uten dem ville de to falt ut av dekningsregnskapet, og de er
 * blant de beste vi har. Ikke fjern dem fordi de ser ut som støy i en
 * Trondheim-liste.
 */
export const KOMMUNER: readonly Kommune[] = [
  { nummer: "5001", navn: "Trondheim", forventetAntall: 77, marked: true },
  { nummer: "5035", navn: "Stjørdal", forventetAntall: 16, marked: true },
  { nummer: "5028", navn: "Melhus", forventetAntall: 8, marked: true },
  { nummer: "5031", navn: "Malvik", forventetAntall: 4, marked: true },
  { nummer: "5021", navn: "Oppdal", forventetAntall: 7, marked: false },
  { nummer: "5053", navn: "Inderøy", forventetAntall: 2, marked: false },
];

const KOMMUNENAVN = new Map(KOMMUNER.map((k) => [k.nummer, k.navn]));

/**
 * Grov bbox rundt Norge, romslig satt. Formålet er ikke å avgrense Norge presist
 * men å fange en ombyttet lat/lon: en breddegrad på 10 eller en lengdegrad på 63
 * faller utenfor med god margin.
 */
export const NORGE_BBOX = {
  minLat: 57,
  maxLat: 72,
  minLng: 4,
  maxLng: 32,
} as const;

export interface PostalAreaRow {
  postnummer: string;
  poststed: string;
  kommunenummer: string;
  kommunenavn: string;
  boundary: { type: "MultiPolygon"; coordinates: number[][][][] };
  source_local_id: string | null;
  source_updated_at: string | null;
}

export interface RejectedFeature {
  /** `null` når selve postnummeret manglet — da har vi ingen id å vise. */
  postnummer: string | null;
  reason: string;
}

export interface ParsedPostalAreas {
  rows: PostalAreaRow[];
  rejected: RejectedFeature[];
}

/**
 * WFS 2.0 GetFeature-parametere for én kommune.
 *
 * Filteret er `fes:Filter` på `kommune` — verifisert mot Kartverket 2026-08-13:
 * kommune 5001 gir 77 features, som er identisk med antallet geografiske
 * postnumre for Trondheim i Brings register.
 */
export function buildWfsQuery(kommunenummer: string): Record<string, string> {
  return {
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typenames: TYPENAME,
    // count settes høyt nok til å dekke Norges største kommune i én runde.
    count: "1000",
    filter:
      `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">` +
      `<fes:PropertyIsEqualTo>` +
      `<fes:ValueReference>kommune</fes:ValueReference>` +
      `<fes:Literal>${kommunenummer}</fes:Literal>` +
      `</fes:PropertyIsEqualTo>` +
      `</fes:Filter>`,
  };
}

// ── GML → GeoJSON ─────────────────────────────────────────────────────────

/**
 * `parseTagValue: false` er ikke kosmetikk: uten den ville «0010» blitt tallet
 * 10, og postnummeret ødelagt før det når validering. Alt holdes som streng, og
 * koordinatene parses eksplisitt nedenfor.
 */
const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

/**
 * fast-xml-parser gir objekt for ett element og array for flere — begge må
 * behandles likt.
 *
 * Ikke-objekter filtreres bort med vilje: et tomt element (`<app:område/>`)
 * parses til tom streng, og den skal behandles som «feltet finnes ikke» slik at
 * kalleren kaster «uten geometri» i stedet for å lese egenskaper på en streng.
 */
function asArray(value: unknown): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null
  );
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * Kartverkets `oppdateringsdato` er en dato («2015-10-01»), og kolonnen er `date`
 * (migrasjon 087). Trunkeringen til YYYY-MM-DD gjør at et fullt tidsstempel fra
 * kilden en gang i framtiden fortsatt sammenlignes stabilt mot det basen
 * returnerer — ellers ville raden vært evig «endret» og idempotens-signalet
 * ubrukelig. Se 087 for hvordan den feilen faktisk oppsto.
 */
function dateOnly(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * «63.469560 10.539321 63.446336 10.571055» → [[10.539321, 63.469560], …]
 *
 * Kaster ved oddetall antall tall eller koordinater utenfor Norge — kalleren
 * gjør det om til en forkastet feature med årsak.
 */
function parsePosList(posList: string): number[][] {
  const parts = posList.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new Error("tom posList");
  if (parts.length % 2 !== 0) {
    throw new Error(`oddetall antall koordinat-tall (${parts.length}) — ikke hele par`);
  }

  const ring: number[][] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const lat = Number(parts[i]);
    const lng = Number(parts[i + 1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`ikke-numerisk koordinat: «${parts[i]} ${parts[i + 1]}»`);
    }
    if (
      lat < NORGE_BBOX.minLat ||
      lat > NORGE_BBOX.maxLat ||
      lng < NORGE_BBOX.minLng ||
      lng > NORGE_BBOX.maxLng
    ) {
      throw new Error(
        `koordinat utenfor Norges bbox: lat ${lat}, lng ${lng} — mistenkt ombyttet lat/lon`
      );
    }
    // GML gir lat før lon; GeoJSON vil ha [lng, lat].
    ring.push([lng, lat]);
  }
  return ring;
}

/** GeoJSON krever at første og siste punkt i en ring er identiske. */
function closeRing(ring: number[][]): number[][] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, [...first]];
}

/** Ett `gml:Polygon`-element → GeoJSON-flate (ytre ring først, deretter hull). */
function polygonToRings(polygon: Record<string, unknown>): number[][][] {
  const rings: number[][][] = [];

  const exterior = asArray(polygon.exterior)[0];
  const exteriorPosList = text(
    (exterior?.LinearRing as Record<string, unknown> | undefined)?.posList
  );
  if (!exteriorPosList) throw new Error("gml:Polygon uten ytre ring");
  rings.push(closeRing(parsePosList(exteriorPosList)));

  for (const interior of asArray(polygon.interior)) {
    const posList = text((interior?.LinearRing as Record<string, unknown> | undefined)?.posList);
    if (posList) rings.push(closeRing(parsePosList(posList)));
  }

  return rings;
}

/**
 * `app:område` → liste av GeoJSON-flater. Håndterer både `gml:Polygon` (det
 * vanlige) og `gml:MultiSurface` med flere `surfaceMember` (eksklaver og øyer).
 */
function omradeToMultiPolygon(omrade: Record<string, unknown> | undefined): number[][][][] {
  if (!omrade) throw new Error("feature uten app:område — ingen geometri");

  const flater: number[][][][] = [];

  for (const polygon of asArray(omrade.Polygon)) {
    flater.push(polygonToRings(polygon));
  }

  for (const multi of asArray(omrade.MultiSurface)) {
    for (const member of asArray(multi.surfaceMember)) {
      for (const polygon of asArray(member.Polygon)) {
        flater.push(polygonToRings(polygon));
      }
    }
  }

  if (flater.length === 0) throw new Error("app:område uten gml:Polygon eller gml:MultiSurface");
  return flater;
}

/**
 * Parser et WFS GetFeature-svar. Kaster ved kontraktsbrudd (ExceptionReport
 * eller ukjent rot-element) — det skal stoppe kjøringen, ikke bli en tom liste
 * som ser ut som «ingen data». Feil på enkeltfeatures samles i `rejected` slik at
 * resten av kommunen fortsatt importeres.
 */
export function parsePostalAreaGml(xml: string): ParsedPostalAreas {
  const doc = parser.parse(xml) as Record<string, unknown>;

  const exceptionReport = doc.ExceptionReport as Record<string, unknown> | undefined;
  if (exceptionReport) {
    const texts = asArray(exceptionReport.Exception)
      .map((e) => text(e.ExceptionText))
      .filter(Boolean);
    throw new Error(
      `WFS returnerte ExceptionReport: ${texts.join("; ") || "(ingen ExceptionText)"}`
    );
  }

  // Sjekk NØKKELEN, ikke verdien: en FeatureCollection uten members parses til
  // tom streng, som er falsy. En truthy-sjekk her ville gjort «kommunen har ingen
  // treff» om til «gateway-feil» — to helt ulike ting for kalleren.
  if (!("FeatureCollection" in doc)) {
    throw new Error(
      "svaret er verken en wfs:FeatureCollection eller en ows:ExceptionReport — " +
        "sannsynligvis en HTTP-feilside fra proxy eller gateway"
    );
  }
  const collection = (doc.FeatureCollection ?? {}) as Record<string, unknown>;

  const rows: PostalAreaRow[] = [];
  const rejected: RejectedFeature[] = [];

  for (const member of asArray(collection.member)) {
    for (const feature of asArray(member.Postnummerområde)) {
      const id = asArray(feature.postnummerOmrådeId)[0];
      const idInner = asArray(id?.PostnummerområdeId)[0];
      const postnummer = text(idInner?.postnummer);
      const poststed = text(idInner?.poststed);

      if (!postnummer) {
        rejected.push({ postnummer: null, reason: "feature uten app:postnummer" });
        continue;
      }

      try {
        if (!poststed) throw new Error("feature uten app:poststed");

        const kommunenummer = text(feature.kommune);
        if (!kommunenummer) throw new Error("feature uten app:kommune");
        const kommunenavn = KOMMUNENAVN.get(kommunenummer);
        if (!kommunenavn) {
          throw new Error(
            `ukjent kommune ${kommunenummer} — legg den i KOMMUNER hvis den skal med`
          );
        }

        const coordinates = omradeToMultiPolygon(
          asArray(feature.område)[0]
        );

        const identifikasjon = asArray(feature.identifikasjon)[0];
        const inner = asArray(identifikasjon?.Identifikasjon)[0];

        rows.push({
          postnummer,
          poststed,
          kommunenummer,
          kommunenavn,
          boundary: { type: "MultiPolygon", coordinates },
          source_local_id: text(inner?.lokalId),
          source_updated_at: dateOnly(feature.oppdateringsdato),
        });
      } catch (err) {
        rejected.push({
          postnummer,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { rows, rejected };
}

// ── Idempotens ────────────────────────────────────────────────────────────

/**
 * Skal denne raden skrives?
 *
 * `imported_at` er bevisst utenfor sammenligningen — den endrer seg hver kjøring,
 * og tatt med ville hver kjøring rapportert alle 114 rader som endret. Da ville
 * «andre kjøring gir 0 endringer» ikke lenger vært et brukbart signal på at
 * importen er idempotent.
 */
export function needsWrite(
  existing: PostalAreaRow | undefined,
  incoming: PostalAreaRow
): boolean {
  if (!existing) return true;
  return (
    existing.postnummer !== incoming.postnummer ||
    existing.poststed !== incoming.poststed ||
    existing.kommunenummer !== incoming.kommunenummer ||
    existing.kommunenavn !== incoming.kommunenavn ||
    existing.source_local_id !== incoming.source_local_id ||
    existing.source_updated_at !== incoming.source_updated_at ||
    JSON.stringify(existing.boundary) !== JSON.stringify(incoming.boundary)
  );
}
