import { describe, it, expect } from "vitest";

import {
  COLOCATED_THRESHOLD_M,
  contentRank,
  dedupeColocatedPins,
  mergeNameSubsetPins,
  normalizeName,
  sourceRank,
  summarizeDedupe,
  type DedupeCandidate,
} from "./dedupe-colocated-pins";

function poi(over: Partial<DedupeCandidate> & { id: string }): DedupeCandidate {
  return {
    name: "Et sted",
    lat: 63.43,
    lng: 10.5,
    categoryId: "idrett",
    source: null,
    ...over,
  };
}

describe("normalizeName", () => {
  it("gjør bare store/små bokstaver og skilletegn likegyldig", () => {
    expect(normalizeName("EXTRA Arena")).toBe(normalizeName("Extra Arena"));
    expect(normalizeName("Rema 1000 - Ranheim")).toBe("rema 1000 ranheim");
    expect(normalizeName("  Café  Benoni ")).toBe("café benoni");
  });

  it("beholder norske bokstaver — ingen diakritikk-stripping", () => {
    expect(normalizeName("Hansbakkfjæra")).toBe("hansbakkfjæra");
    expect(normalizeName("Grilstadstranda")).not.toBe(normalizeName("Grilstadstrand"));
  });

  it("slår IKKE sammen kunstgress og kunstgras", () => {
    // To reelle baner 430 m fra hverandre på Charlottenlund. Fuzzy matching
    // ville gjort dem til én.
    expect(normalizeName("Charlottenlund kunstgressbane")).not.toBe(
      normalizeName("Charlottenlund kunstgrasbane")
    );
  });
});

describe("rangeringen", () => {
  it("kilde-rang: google < registre < osm < interne seeds", () => {
    expect(sourceRank(poi({ id: "google-ChIJ1" }))).toBe(0);
    expect(sourceRank(poi({ id: "nsr-974600218" }))).toBe(1);
    expect(sourceRank(poi({ id: "bhf-leistad-barnehage" }))).toBe(1);
    expect(sourceRank(poi({ id: "uuid-1", source: "barnehagefakta" }))).toBe(1);
    expect(sourceRank(poi({ id: "osm-node-1" }))).toBe(2);
    expect(sourceRank(poi({ id: "badeplass-grilstadstranda" }))).toBe(3);
  });

  it("innholds-rang: redaksjonell tekst < google-metadata < ingenting", () => {
    expect(contentRank(poi({ id: "a", editorialHook: "En setning om stedet." }))).toBe(0);
    expect(contentRank(poi({ id: "b", localInsight: "Lokal innsikt." }))).toBe(0);
    expect(contentRank(poi({ id: "c", googlePlaceId: "ChIJ1" }))).toBe(1);
    expect(contentRank(poi({ id: "d" }))).toBe(2);
    // Tom streng er ikke innhold.
    expect(contentRank(poi({ id: "e", editorialHook: "   " }))).toBe(2);
  });
});

describe("dedupeColocatedPins: de reelle prod-tilfellene", () => {
  it("Grilstadstranda: kuratert seed vinner over tom OSM-flate", () => {
    // Regresjonsvernet for feilen ren kilde-prioritet ga: OSM (rang 2) slo den
    // interne seeden (rang 3) og skjulte editorial_hook + poi_tier bak en rad
    // som bare hadde osm_id.
    const result = dedupeColocatedPins([
      poi({
        id: "badeplass-grilstadstranda",
        name: "Grilstadstranda",
        categoryId: "badeplass",
        lat: 63.4361,
        lng: 10.5203,
        editorialHook: "Sandstrand med grill- og badeplass.",
      }),
      poi({
        id: "osm-relation-20106862",
        name: "Grilstadstranda",
        categoryId: "badeplass",
        lat: 63.43622,
        lng: 10.52045,
        source: "osm",
      }),
    ]);
    expect(result.kept.map((k) => k.id)).toEqual(["badeplass-grilstadstranda"]);
    expect(result.dropped[0].id).toBe("osm-relation-20106862");
  });

  it("Extra Arena: raden med redaksjonell tekst vinner, uansett geometri-type", () => {
    const result = dedupeColocatedPins([
      poi({
        id: "osm-node-5567649140",
        name: "EXTRA Arena",
        lat: 63.4282828,
        lng: 10.525104,
        source: "osm",
      }),
      poi({
        id: "osm-way-84078486",
        name: "Extra Arena",
        lat: 63.428356,
        lng: 10.5240648,
        source: "osm",
        editorialHook: "Extra Arena er Ranheims storstue for fotball og arrangementer.",
      }),
    ]);
    expect(result.kept.map((k) => k.id)).toEqual(["osm-way-84078486"]);
    expect(result.dropped[0].meters).toBeGreaterThan(40);
    expect(result.dropped[0].meters).toBeLessThan(70);
  });

  it("Leistad barnehage: uten redaksjonell tekst avgjør kilden — Barnehagefakta over OSM", () => {
    const result = dedupeColocatedPins([
      poi({
        id: "osm-node-11690125109",
        name: "Leistad barnehage",
        categoryId: "barnehage",
        lat: 63.4402,
        lng: 10.5511,
        source: "osm",
      }),
      poi({
        id: "bhf-leistad-barnehage",
        name: "Leistad barnehage",
        categoryId: "barnehage",
        lat: 63.44021,
        lng: 10.55118,
        source: "barnehagefakta",
      }),
    ]);
    expect(result.kept.map((k) => k.id)).toEqual(["bhf-leistad-barnehage"]);
  });

  it("fire like Google-ladestasjoner på samme anlegg blir én pin", () => {
    // Prod-tilfellet: «Recharge Charging Station» som fire distinkte
    // Google-place-IDer, 0 / 5 / 103 / 183 m fra hverandre. Fire reelle
    // ladepunkter, men fire identiske kort som leseren ikke kan skille.
    const base = 63.43;
    const chargers = [
      { id: "google-ChIJ1", lat: base },
      { id: "google-ChIJ2", lat: base + 0.0000449 },
      { id: "google-ChIJ3", lat: base + 0.000925 },
      { id: "google-ChIJ4", lat: base + 0.001644 },
    ].map((c) =>
      poi({ ...c, name: "Recharge Charging Station", categoryId: "charging_station", googlePlaceId: c.id })
    );
    const result = dedupeColocatedPins(chargers);
    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(3);
    expect(result.dropped.map((d) => d.meters).sort((a, b) => a - b)).toEqual([5, 103, 183]);
  });

  it("men et ladepunkt på et ANNET anlegg beholdes", () => {
    // 450 m unna er et eget sted, ikke en dublett — Lade mot Ranheim.
    const result = dedupeColocatedPins([
      poi({ id: "google-A", name: "Recharge Charging Station", categoryId: "charging_station", lat: 63.43, googlePlaceId: "A" }),
      poi({ id: "google-B", name: "Recharge Charging Station", categoryId: "charging_station", lat: 63.43404, googlePlaceId: "B" }),
    ]);
    expect(result.kept).toHaveLength(2);
  });
});

describe("dedupeColocatedPins: grensene", () => {
  it("samme navn men ulik kategori er ikke samme sted", () => {
    const result = dedupeColocatedPins([
      poi({ id: "a", name: "Hansbakkfjæra", categoryId: "badeplass" }),
      poi({ id: "b", name: "Hansbakkfjæra", categoryId: "lekeplass" }),
    ]);
    expect(result.kept).toHaveLength(2);
    expect(result.dropped).toHaveLength(0);
  });

  it("samme navn og kategori, men lenger unna enn terskelen, beholdes begge", () => {
    // ~0,01° breddegrad ≈ 1 113 m.
    const result = dedupeColocatedPins([
      poi({ id: "a", name: "Rema 1000", categoryId: "supermarket", lat: 63.43 }),
      poi({ id: "b", name: "Rema 1000", categoryId: "supermarket", lat: 63.44 }),
    ]);
    expect(result.kept).toHaveLength(2);
  });

  it("terskelen er 200 m og kan overstyres", () => {
    expect(COLOCATED_THRESHOLD_M).toBe(200);
    const pair = [
      poi({ id: "a", name: "Samme sted", lat: 63.43 }),
      poi({ id: "b", name: "Samme sted", lat: 63.4315 }), // ~167 m
    ];
    expect(dedupeColocatedPins(pair).kept).toHaveLength(1);
    expect(dedupeColocatedPins(pair, { thresholdMeters: 100 }).kept).toHaveLength(2);
  });

  it("klynger transitivt — en kjede henger sammen selv om endene er langt fra hverandre", () => {
    const result = dedupeColocatedPins([
      poi({ id: "a", name: "Kjede", lat: 63.43 }),
      poi({ id: "b", name: "Kjede", lat: 63.4315 }), // ~167 m fra a
      poi({ id: "c", name: "Kjede", lat: 63.433 }), // ~167 m fra b, ~334 m fra a
    ]);
    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(2);
  });

  it("beskyttede IDer vinner alltid", () => {
    const pair = [
      poi({ id: "kuratert", name: "Stedet", editorialHook: "Har tekst." }),
      poi({ id: "tom", name: "Stedet" }),
    ];
    expect(dedupeColocatedPins(pair).kept.map((k) => k.id)).toEqual(["kuratert"]);
    expect(
      dedupeColocatedPins(pair, { protectedIds: ["tom"] }).kept.map((k) => k.id)
    ).toEqual(["tom"]);
  });

  it("er deterministisk — samme input gir samme vinner uansett rekkefølge", () => {
    const a = poi({ id: "osm-node-2", name: "Likt", source: "osm" });
    const b = poi({ id: "osm-node-1", name: "Likt", source: "osm" });
    expect(dedupeColocatedPins([a, b]).kept[0].id).toBe(
      dedupeColocatedPins([b, a]).kept[0].id
    );
  });

  it("summen går opp — hver kandidat er enten beholdt eller droppet", () => {
    const input = [
      poi({ id: "a", name: "X" }),
      poi({ id: "b", name: "X" }),
      poi({ id: "c", name: "Y" }),
    ];
    const result = dedupeColocatedPins(input);
    expect(result.kept.length + result.dropped.length).toBe(input.length);
  });

  it("tom input gir tomt resultat", () => {
    const result = dedupeColocatedPins([]);
    expect(result.kept).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(summarizeDedupe(result)).toContain("ingen sammenfallende");
  });

  it("oppsummeringen navngir kategoriene — aldri stille dedup", () => {
    const result = dedupeColocatedPins([
      poi({ id: "a", name: "X", categoryId: "idrett", editorialHook: "tekst" }),
      poi({ id: "b", name: "X", categoryId: "idrett" }),
      poi({ id: "c", name: "Y", categoryId: "barnehage", editorialHook: "tekst" }),
      poi({ id: "d", name: "Y", categoryId: "barnehage" }),
    ]);
    const summary = summarizeDedupe(result);
    expect(summary).toContain("2");
    expect(summary).toContain("idrett");
    expect(summary).toContain("barnehage");
  });
});

/**
 * Andre pass (2026-08-24): delvis navnelikhet. Alle casene under er MÅLT på de
 * 12 boardene i prod — både de som skal slås sammen og de som ikke skal.
 */
describe("mergeNameSubsetPins — samme sted under to navn", () => {
  const at = (
    id: string,
    name: string,
    categoryId: string,
    metersEast: number,
    extra: Partial<DedupeCandidate> = {},
  ): DedupeCandidate => ({
    id,
    name,
    categoryId,
    lat: 63.435107,
    // ~1 grad lengde ≈ 49 700 m på 63,4°N — nok presisjon for terskeltesting.
    lng: 10.505335 + metersEast / 49700,
    source: null,
    ...extra,
  });

  it("«Extra Arena» (OSM) og «Ranheim Extra Arena» (Google) 62 m er samme hall", () => {
    const { kept, dropped } = mergeNameSubsetPins([
      at("osm-way-1", "Extra Arena", "idrett", 0, { source: "osm" }),
      at("google-1", "Ranheim Extra Arena", "idrett", 62, { source: "google" }),
    ]);
    expect(kept).toHaveLength(1);
    // Google vinner på kilde-rang, så det lengste og mest presise navnet står.
    expect(kept[0].name).toBe("Ranheim Extra Arena");
    expect(dropped[0].name).toBe("Extra Arena");
  });

  it("selskapsform og «Stiftelsen» er ikke et eget sted", () => {
    const { kept } = mergeNameSubsetPins([
      at("bhf-1", "Fjæraskogen barnehage", "barnehage", 0, { source: "barnehagefakta" }),
      at("osm-2", "Stiftelsen Fjæraskogen barnehage", "barnehage", 10, { source: "osm" }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("bhf-1");
  });

  it("to bysykkelstativ med nesten samme navn er to stativ", () => {
    const { kept } = mergeNameSubsetPins([
      at("bike-1", "Trondheim Bysykkel: Skansen", "bike", 0),
      at("bike-2", "Trondheim Bysykkel: Skansen bru", "bike", 40),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("to avdelinger av samme barnehage står begge", () => {
    // Delmengde-regelen alene tok disse: den ene avdelingens ordsett ER en
    // delmengde av den andres. Avstanden (180 m) er det som skiller dem.
    const { kept } = mergeNameSubsetPins([
      at("a", "Planetringen-Vikhammeråsen barnehager Avdeling Basunvegen", "barnehage", 0),
      at("b", "Planetringen-Vikhammeråsen barnehager Avdeling Planetringen", "barnehage", 180),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("ettords-navn er for tynt grunnlag", () => {
    const { kept } = mergeNameSubsetPins([
      at("a", "Lekeplass", "lekeplass", 0),
      at("b", "Kanalen lekeplass", "lekeplass", 20),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("to baner på samme anlegg 86 m fra hverandre står begge", () => {
    const { kept } = mergeNameSubsetPins([
      at("a", "Ranheim Kunstgress", "idrett", 0),
      at("b", "Ranheim Kunstgress 9'er", "idrett", 86),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("delvis overlapp uten delmengde er to steder", () => {
    const { kept } = mergeNameSubsetPins([
      at("a", "Charlottenlund kunstgressbane", "idrett", 0),
      at("b", "Charlottenlund kunstgrasbane", "idrett", 30),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("redaksjonelt innhold vinner over kortere navn og bedre kilde", () => {
    const { kept } = mergeNameSubsetPins([
      at("osm-way-9", "Leangen gård park", "park", 0, {
        source: "osm",
        editorialHook: "Gården er byens eldste …",
      }),
      at("google-9", "Leangen Gård", "park", 33, { source: "google" }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("osm-way-9");
  });

  it("dedupeColocatedPins kjører begge passene", () => {
    const { kept, dropped } = dedupeColocatedPins([
      at("osm-way-1", "Extra Arena", "idrett", 0, { source: "osm" }),
      at("osm-node-1", "Extra Arena", "idrett", 30, { source: "osm" }),
      at("google-1", "Ranheim Extra Arena", "idrett", 62, { source: "google" }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].name).toBe("Ranheim Extra Arena");
    expect(dropped).toHaveLength(2);
  });
});
