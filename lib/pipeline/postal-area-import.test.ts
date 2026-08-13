import { describe, it, expect } from "vitest";
import {
  KOMMUNER,
  NORGE_BBOX,
  buildWfsQuery,
  parsePostalAreaGml,
  needsWrite,
  WFS_URL,
  type PostalAreaRow,
} from "./postal-area-import";

// ── Test-fixtures ─────────────────────────────────────────────────────────
//
// Formen er kopiert fra et ekte WFS-uttrekk (Kartverket, 2026-08-13). Det som
// betyr noe for parseren: postnummer og poststed ligger nestet to nivåer ned
// under `app:postnummerOmrådeId`, `app:kommune` er et søsken-felt, og
// koordinatene i `gml:posList` er **lat før lon** (EPSG:4258).

/** Ranheim-aktige koordinater som lat-lon-streng, slik WFS-en leverer dem. */
const POSLIST_LATLON = "63.469560 10.539321 63.446336 10.571055 63.437885 10.582588";

/** Samme tre punkter som GeoJSON forventer dem: [lng, lat]. */
const EXPECTED_LNGLAT = [
  [10.539321, 63.46956],
  [10.571055, 63.446336],
  [10.582588, 63.437885],
];

interface FeatureOptions {
  postnummer?: string;
  poststed?: string;
  kommune?: string;
  lokalId?: string | null;
  oppdateringsdato?: string | null;
  /** Rå geometri-XML. Default: én gml:Polygon med POSLIST_LATLON. */
  geometry?: string;
}

function polygonXml(posList: string, interior?: string): string {
  return `<gml:Polygon gml:id="p1" srsName="urn:ogc:def:crs:EPSG::4258">
    <gml:exterior><gml:LinearRing><gml:posList>${posList}</gml:posList></gml:LinearRing></gml:exterior>
    ${interior ? `<gml:interior><gml:LinearRing><gml:posList>${interior}</gml:posList></gml:LinearRing></gml:interior>` : ""}
  </gml:Polygon>`;
}

function feature(opts: FeatureOptions = {}): string {
  const {
    postnummer = "7053",
    poststed = "RANHEIM",
    kommune = "5001",
    lokalId = "ab4c863a-0530-4d3c-bc36-fbcfc5c2dedd",
    oppdateringsdato = "2015-10-01",
    geometry = polygonXml(POSLIST_LATLON),
  } = opts;

  return `<wfs:member>
    <app:Postnummerområde gml:id="postnummeromraade.1">
      ${lokalId === null ? "" : `<app:identifikasjon><app:Identifikasjon><app:lokalId>${lokalId}</app:lokalId></app:Identifikasjon></app:identifikasjon>`}
      <app:datauttaksdato>2026-07-28T04:08:26</app:datauttaksdato>
      ${oppdateringsdato === null ? "" : `<app:oppdateringsdato>${oppdateringsdato}</app:oppdateringsdato>`}
      <app:område>${geometry}</app:område>
      <app:postnummerOmrådeId><app:PostnummerområdeId>
        <app:postnummer>${postnummer}</app:postnummer>
        <app:poststed>${poststed}</app:poststed>
      </app:PostnummerområdeId></app:postnummerOmrådeId>
      <app:kommune>${kommune}</app:kommune>
    </app:Postnummerområde>
  </wfs:member>`;
}

function collection(...members: string[]): string {
  return `<?xml version='1.0' encoding='UTF-8'?>
<wfs:FeatureCollection
  xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:app="http://skjema.geonorge.no/SOSI/produktspesifikasjon/Postnummeromrader/20180215">
  ${members.join("\n")}
</wfs:FeatureCollection>`;
}

function exceptionReport(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0">
  <ows:Exception exceptionCode="InvalidParameterValue">
    <ows:ExceptionText>${text}</ows:ExceptionText>
  </ows:Exception>
</ows:ExceptionReport>`;
}

/** Minimal rad, for needsWrite-testene. */
function row(overrides: Partial<PostalAreaRow> = {}): PostalAreaRow {
  return {
    postnummer: "7053",
    poststed: "RANHEIM",
    kommunenummer: "5001",
    kommunenavn: "Trondheim",
    boundary: { type: "MultiPolygon", coordinates: [[EXPECTED_LNGLAT.concat([EXPECTED_LNGLAT[0]])]] },
    source_local_id: "abc",
    source_updated_at: "2015-10-01",
    ...overrides,
  };
}

// ── Kommunekonstanten ─────────────────────────────────────────────────────

describe("KOMMUNER", () => {
  it("dekker markedet (Trondheim, Stjørdal, Melhus, Malvik) pluss de to kommunene der vi alt har kuraterte områder", () => {
    const numre = KOMMUNER.map((k) => k.nummer);
    expect(numre).toContain("5001"); // Trondheim
    expect(numre).toContain("5035"); // Stjørdal
    expect(numre).toContain("5028"); // Melhus
    expect(numre).toContain("5031"); // Malvik
    expect(numre).toContain("5021"); // Oppdal — Oppdal-området
    expect(numre).toContain("5053"); // Inderøy — Straumen-området
  });

  it("summerer til 114 forventede postnumre (verifisert mot Brings register 2026-08-13)", () => {
    const sum = KOMMUNER.reduce((n, k) => n + k.forventetAntall, 0);
    expect(sum).toBe(114);
  });

  it("skiller marked fra ikke-marked, slik at dekningsgraden ikke pyntes", () => {
    const marked = KOMMUNER.filter((k) => k.marked);
    expect(marked.reduce((n, k) => n + k.forventetAntall, 0)).toBe(105);
    expect(KOMMUNER.filter((k) => !k.marked).map((k) => k.nummer).sort()).toEqual([
      "5021",
      "5053",
    ]);
  });
});

describe("buildWfsQuery", () => {
  it("ber om riktig typenavn og filtrerer på kommune", () => {
    const params = buildWfsQuery("5001");
    expect(params.typenames).toBe("app:Postnummerområde");
    expect(params.request).toBe("GetFeature");
    expect(params.version).toBe("2.0.0");
    expect(params.filter).toContain("5001");
    expect(params.filter).toContain("kommune");
  });

  it("peker på Kartverkets WFS uten API-nøkkel i URL-en", () => {
    expect(WFS_URL).toBe("https://wfs.geonorge.no/skwms1/wfs.postnummeromrader");
    expect(WFS_URL).not.toMatch(/key|token|apikey/i);
  });
});

// ── Parsing: happy path ───────────────────────────────────────────────────

describe("parsePostalAreaGml — happy path", () => {
  it("plukker ut postnummer, poststed, kommune og kilde-metadata", () => {
    const { rows, rejected } = parsePostalAreaGml(collection(feature()));

    expect(rejected).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].postnummer).toBe("7053");
    expect(rows[0].poststed).toBe("RANHEIM");
    expect(rows[0].kommunenummer).toBe("5001");
    expect(rows[0].kommunenavn).toBe("Trondheim");
    expect(rows[0].source_local_id).toBe("ab4c863a-0530-4d3c-bc36-fbcfc5c2dedd");
    expect(rows[0].source_updated_at).toBe("2015-10-01");
  });

  it("snur koordinatparene fra lat-lon til [lng, lat]", () => {
    const { rows } = parsePostalAreaGml(collection(feature()));
    const ring = (rows[0].boundary.coordinates as number[][][][])[0][0];

    // Ringen lukkes, så siste punkt er en kopi av det første.
    expect(ring.slice(0, 3)).toEqual(EXPECTED_LNGLAT);
    // Lengdegrad i Norge er ~4-32, breddegrad ~57-72. Er rekkefølgen snudd feil
    // vei havner første tall i 63-tallet i stedet for 10-tallet.
    expect(ring[0][0]).toBeLessThan(32);
    expect(ring[0][1]).toBeGreaterThan(57);
  });

  it("normaliserer én flate til MultiPolygon", () => {
    const { rows } = parsePostalAreaGml(collection(feature()));
    expect(rows[0].boundary.type).toBe("MultiPolygon");
    expect(rows[0].boundary.coordinates).toHaveLength(1);
  });

  it("beholder indre ringer (hull) som ring nr. 2 i samme flate", () => {
    const hull = "63.45 10.55 63.451 10.551 63.452 10.552";
    const { rows } = parsePostalAreaGml(
      collection(feature({ geometry: polygonXml(POSLIST_LATLON, hull) }))
    );
    const flate = (rows[0].boundary.coordinates as number[][][][])[0];
    expect(flate).toHaveLength(2);
    expect(flate[1][0]).toEqual([10.55, 63.45]);
  });

  it("håndterer MultiSurface med flere flater (eksklaver/øyer)", () => {
    const andre = "63.30 10.80 63.31 10.81 63.32 10.82";
    const geometry = `<gml:MultiSurface gml:id="m1" srsName="urn:ogc:def:crs:EPSG::4258">
      <gml:surfaceMember>${polygonXml(POSLIST_LATLON)}</gml:surfaceMember>
      <gml:surfaceMember>${polygonXml(andre)}</gml:surfaceMember>
    </gml:MultiSurface>`;

    const { rows, rejected } = parsePostalAreaGml(collection(feature({ geometry })));

    expect(rejected).toEqual([]);
    expect(rows[0].boundary.coordinates).toHaveLength(2);
    expect((rows[0].boundary.coordinates as number[][][][])[1][0][0]).toEqual([10.8, 63.3]);
  });

  it("parser flere features i samme svar", () => {
    const { rows } = parsePostalAreaGml(
      collection(
        feature({ postnummer: "7053" }),
        feature({ postnummer: "7054" }),
        feature({ postnummer: "7055" })
      )
    );
    expect(rows.map((r) => r.postnummer)).toEqual(["7053", "7054", "7055"]);
  });

  it("returnerer tom liste for en FeatureCollection uten members", () => {
    const { rows, rejected } = parsePostalAreaGml(collection());
    expect(rows).toEqual([]);
    expect(rejected).toEqual([]);
  });
});

// ── Parsing: kanttilfeller ────────────────────────────────────────────────

describe("parsePostalAreaGml — kanttilfeller", () => {
  it("lukker en ring som ikke er lukket i kilden", () => {
    const { rows } = parsePostalAreaGml(collection(feature()));
    const ring = (rows[0].boundary.coordinates as number[][][][])[0][0];
    expect(ring).toHaveLength(EXPECTED_LNGLAT.length + 1);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });

  it("lukker ikke en ring som allerede er lukket", () => {
    const lukket = `${POSLIST_LATLON} 63.469560 10.539321`;
    const { rows } = parsePostalAreaGml(
      collection(feature({ geometry: polygonXml(lukket) }))
    );
    const ring = (rows[0].boundary.coordinates as number[][][][])[0][0];
    expect(ring).toHaveLength(4);
    expect(ring[3]).toEqual(ring[0]);
  });

  it("bevarer ledende null i postnummer som streng", () => {
    // 0010 finnes ikke i Trøndelag, men er et gyldig norsk postnummer. Blir det
    // tolket som tall et sted i kjeden, ender det som «10».
    const { rows } = parsePostalAreaGml(
      collection(feature({ postnummer: "0010", poststed: "OSLO", kommune: "5001" }))
    );
    expect(rows[0].postnummer).toBe("0010");
    expect(typeof rows[0].postnummer).toBe("string");
  });

  it("godtar feature uten oppdateringsdato, med source_updated_at = null", () => {
    const { rows, rejected } = parsePostalAreaGml(
      collection(feature({ oppdateringsdato: null }))
    );
    expect(rejected).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].source_updated_at).toBeNull();
  });

  it("trunkerer et fullt tidsstempel i oppdateringsdato til dato", () => {
    // Kolonnen er `date` (migrasjon 087). Sender kilden en gang et tidsstempel,
    // skal det bli «2026-03-04» — ikke en verdi som aldri matcher det basen
    // returnerer, slik at raden blir evig «endret».
    const { rows } = parsePostalAreaGml(
      collection(feature({ oppdateringsdato: "2026-03-04T11:22:33" }))
    );
    expect(rows[0].source_updated_at).toBe("2026-03-04");
  });

  it("forkaster en oppdateringsdato som ikke er en dato, framfor å lagre søppel", () => {
    const { rows } = parsePostalAreaGml(collection(feature({ oppdateringsdato: "ukjent" })));
    expect(rows[0].source_updated_at).toBeNull();
  });

  it("godtar feature uten lokalId, med source_local_id = null", () => {
    const { rows } = parsePostalAreaGml(collection(feature({ lokalId: null })));
    expect(rows[0].source_local_id).toBeNull();
  });

  it("forkaster feature med oddetall antall koordinat-tall, og fortsetter med resten", () => {
    const odde = "63.469560 10.539321 63.446336";
    const { rows, rejected } = parsePostalAreaGml(
      collection(
        feature({ postnummer: "7053", geometry: polygonXml(odde) }),
        feature({ postnummer: "7054" })
      )
    );

    expect(rows.map((r) => r.postnummer)).toEqual(["7054"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].postnummer).toBe("7053");
    expect(rejected[0].reason).toMatch(/oddetall|par/i);
  });

  it("forkaster feature med koordinat utenfor Norges bbox", () => {
    // 10.53 / 63.46 snudd feil vei: lat 10.53 er utenfor 57-72.
    const snudd = "10.539321 63.469560 10.571055 63.446336";
    const { rows, rejected } = parsePostalAreaGml(
      collection(feature({ geometry: polygonXml(snudd) }))
    );

    expect(rows).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/bbox|Norge/i);
  });

  it("har en bbox som faktisk dekker Norge fra Lindesnes til Nordkapp", () => {
    expect(NORGE_BBOX.minLat).toBeLessThanOrEqual(57.9); // Lindesnes ~57.98
    expect(NORGE_BBOX.maxLat).toBeGreaterThanOrEqual(71.2); // Nordkapp ~71.17
    expect(NORGE_BBOX.minLng).toBeLessThanOrEqual(4.9); // Utsira ~4.87
    expect(NORGE_BBOX.maxLng).toBeGreaterThanOrEqual(31.1); // Grense Jakobselv ~30.9
  });

  it("forkaster feature med ukjent kommune i stedet for å gjette navnet", () => {
    const { rows, rejected } = parsePostalAreaGml(
      collection(feature({ kommune: "9999" }))
    );
    expect(rows).toEqual([]);
    expect(rejected[0].reason).toMatch(/kommune/i);
  });

  it("forkaster feature uten postnummer", () => {
    const { rows, rejected } = parsePostalAreaGml(
      collection(feature({ postnummer: "" }))
    );
    expect(rows).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].postnummer).toBeNull();
  });

  it("forkaster feature uten geometri", () => {
    const { rows, rejected } = parsePostalAreaGml(
      collection(feature({ geometry: "" }))
    );
    expect(rows).toEqual([]);
    expect(rejected[0].reason).toMatch(/geometri|flate/i);
  });
});

// ── Parsing: feilstier ────────────────────────────────────────────────────

describe("parsePostalAreaGml — feilstier", () => {
  it("kaster med Kartverkets egen feiltekst når svaret er en ExceptionReport", () => {
    expect(() =>
      parsePostalAreaGml(exceptionReport("Unknown type name 'app:Feil'"))
    ).toThrow(/Unknown type name 'app:Feil'/);
  });

  it("kaster på et svar som verken er FeatureCollection eller ExceptionReport", () => {
    expect(() => parsePostalAreaGml("<html><body>502 Bad Gateway</body></html>")).toThrow(
      /FeatureCollection/i
    );
  });
});

// ── Idempotens ────────────────────────────────────────────────────────────

describe("needsWrite", () => {
  it("skriver når raden ikke finnes fra før", () => {
    expect(needsWrite(undefined, row())).toBe(true);
  });

  it("skriver ikke når kilden er uendret", () => {
    expect(needsWrite(row(), row())).toBe(false);
  });

  it("skriver når Kartverket har oppdatert datoen", () => {
    expect(needsWrite(row({ source_updated_at: "2015-10-01" }), row({ source_updated_at: "2026-01-01" }))).toBe(
      true
    );
  });

  it("skriver når geometrien er endret", () => {
    const endret = row({
      boundary: { type: "MultiPolygon", coordinates: [[[[10.1, 63.1], [10.2, 63.2], [10.1, 63.1]]]] },
    });
    expect(needsWrite(row(), endret)).toBe(true);
  });

  it("skriver når poststedet er endret", () => {
    expect(needsWrite(row(), row({ poststed: "TRONDHEIM" }))).toBe(true);
  });

  it("bryr seg ikke om imported_at — den endrer seg hver kjøring og ville gjort alt skrivbart", () => {
    const a = { ...row(), imported_at: "2026-08-13T10:00:00Z" } as PostalAreaRow;
    const b = { ...row(), imported_at: "2026-08-14T10:00:00Z" } as PostalAreaRow;
    expect(needsWrite(a, b)).toBe(false);
  });
});
