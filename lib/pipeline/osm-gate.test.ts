import { describe, it, expect } from "vitest";

import fixture from "./__fixtures__/osm-ranheim-bbox.json";
import {
  OSM_GATE_RULES,
  OSM_GATE_CATEGORIES,
  PERMANENTLY_EXCLUDED,
  buildOverpassQuery,
  emptyLedger,
  evaluateOsmElement,
  recordVerdict,
  summarizeLedger,
  osmPoiId,
  osmSourceId,
  type OverpassElement,
} from "./osm-gate";
import { REPORT_THEME_DEFAULTS } from "./report-defaults";
import { GLOBAL_DISABLED_REPORT_THEMES } from "@/lib/themes/bransjeprofiler";

/**
 * Fixture: reelt Overpass-sveip over PRODUKSJONS-bboxen rundt Grilstad Marina
 * (63.43826/10.50872, radius 2 500 m), lest 2026-08-24. 781 objekter. Testene
 * under kjører porten mot ekte data i stedet for konstruerte eksempler — det
 * er hele poenget: de tallene som begrunner hvitelisten skal være etterprøvbare.
 */
// JSON-importen får en presis literal-type der utelatte tagger blir
// `undefined`, som ikke matcher Record<string, string>. Kasten er trygg:
// fila ER et Overpass-svar.
const ELEMENTS = fixture.elements as unknown as OverpassElement[];

function runFixture() {
  const ledger = emptyLedger();
  const accepted: { name: string; categoryId: string; rule: string }[] = [];
  for (const el of ELEMENTS) {
    const verdict = evaluateOsmElement(el);
    recordVerdict(ledger, verdict);
    if (verdict.accept) {
      accepted.push({
        name: verdict.name,
        categoryId: verdict.categoryId,
        rule: verdict.rule,
      });
    }
  }
  return { ledger, accepted };
}

function countRejected(tagKey: string, tagValue: string) {
  return ELEMENTS.filter((el) => el.tags?.[tagKey] === tagValue).map((el) =>
    evaluateOsmElement(el)
  );
}

describe("osm-gate: hviteliste og kategori-kobling", () => {
  it("hver regel har en begrunnelse (Port 1 skal ikke kunne utvides stille)", () => {
    for (const rule of OSM_GATE_RULES) {
      expect(rule.why.length, `${rule.key}=${rule.value} mangler why`).toBeGreaterThan(20);
    }
  });

  it("hver kategori porten produserer rendres i et AKTIVT rapport-tema", () => {
    // Recall-bug-vernet: en kategori uten tema havner i poolen uten å vises
    // noe sted (marina/hundepark hadde det før 2026-08-12), og en kategori i
    // et globalt deaktivert tema («opplevelser» siden 2026-04-28) er like død.
    const activeThemes = REPORT_THEME_DEFAULTS.filter(
      (t) => !GLOBAL_DISABLED_REPORT_THEMES.includes(t.id)
    );
    const renderable = new Set(activeThemes.flatMap((t) => t.categories));

    for (const rule of OSM_GATE_RULES) {
      expect(
        renderable.has(rule.categoryId),
        `${rule.key}=${rule.value} → ${rule.categoryId} rendres ikke i noe aktivt tema`
      ).toBe(true);
    }
  });

  it("OSM_GATE_CATEGORIES dekker nøyaktig kategoriene reglene kan produsere", () => {
    const fromRules = [...new Set(OSM_GATE_RULES.map((r) => r.categoryId))].sort();
    const declared = OSM_GATE_CATEGORIES.map((c) => c.id).sort();
    expect(declared).toEqual(fromRules);
  });

  it("bibliotek/teater/kino står IKKE i hvitelisten — temaet deres er deaktivert", () => {
    const keys = OSM_GATE_RULES.map((r) => `${r.key}=${r.value}`);
    expect(keys).not.toContain("amenity=library");
    expect(keys).not.toContain("amenity=theatre");
    expect(keys).not.toContain("amenity=cinema");
  });
});

describe("osm-gate: permanent utestengte tagger avvises faktisk", () => {
  // Tabellen skal ikke bare være kommentar. Hver utestengte tag kjøres som et
  // navngitt objekt med koordinat og uten access-tag — altså den gunstigste
  // mulige formen — og skal likevel avvises.
  it.each(Object.keys(PERMANENTLY_EXCLUDED))("%s avvises selv navngitt", (tag) => {
    const [key, value] = tag.split("=");
    const verdict = evaluateOsmElement({
      type: "node",
      id: 1,
      lat: 63.43,
      lon: 10.5,
      tags: { [key]: value, name: "Et navn som ser troverdig ut" },
    });
    expect(verdict.accept).toBe(false);
  });

  it("hver utestengt tag har en begrunnelse", () => {
    for (const [tag, reason] of Object.entries(PERMANENTLY_EXCLUDED)) {
      expect(reason.length, `${tag} mangler begrunnelse`).toBeGreaterThan(20);
    }
  });
});

describe("osm-gate: de fire feilkategoriserte radene som lå i prod", () => {
  // Reelle tagger, hentet fra OSM 2026-08-24. Alle seks er `leisure=playground`
  // med navn, og «Iladalen barnehage» har til og med `access=yes` — den ville
  // passert både navnekravet OG adgangsporten. Bare det at hele
  // `leisure=playground` er utestengt stopper dem. Det er begrunnelsen for at
  // lekeplass ikke kan filtreres på access, men må ut i sin helhet.
  const PROD_FEIL: Array<[string, Record<string, string>]> = [
    ["Ila barnehage", { leisure: "playground", name: "Ila barnehage" }],
    [
      "Iladalen barnehage",
      { leisure: "playground", name: "Iladalen barnehage", access: "yes" },
    ],
    [
      "Leo's lekeland",
      {
        leisure: "playground",
        name: "Leo's lekeland",
        fee: "yes",
        indoor: "yes",
        opening_hours: "Mo-Fr 10:00-20:00; Sa-Su 10:00-19:00",
      },
    ],
    [
      "Lekerom/stellerom",
      { leisure: "playground", name: "Lekerom/stellerom", level: "-1" },
    ],
    ["Mummyhuset", { leisure: "playground", name: "Mummyhuset" }],
  ];

  it.each(PROD_FEIL)("%s avvises", (_name, tags) => {
    const verdict = evaluateOsmElement({
      type: "node",
      id: 42,
      lat: 63.43,
      lon: 10.5,
      tags,
    });
    expect(verdict.accept).toBe(false);
    if (!verdict.accept) expect(verdict.reason).toBe("ikke-i-hviteliste");
  });
});

describe("osm-gate: portene", () => {
  const base = { type: "node", id: 7, lat: 63.43, lon: 10.5 };

  it("adgang som ekskluderer publikum avvises", () => {
    for (const access of ["private", "customers", "permit", "no", "residents"]) {
      const verdict = evaluateOsmElement({
        ...base,
        tags: { leisure: "park", name: "Gårdsrommet", access },
      });
      expect(verdict.accept, `access=${access} slapp gjennom`).toBe(false);
      if (!verdict.accept) expect(verdict.reason).toBe("adgang-ekskluderer-publikum");
    }
  });

  it("adgang som ikke ekskluderer publikum slipper gjennom", () => {
    for (const access of [undefined, "yes", "permissive"]) {
      const tags: Record<string, string> = { leisure: "park", name: "Ranheimsparken" };
      if (access) tags.access = access;
      const verdict = evaluateOsmElement({ ...base, tags });
      expect(verdict.accept, `access=${access ?? "(mangler)"} ble avvist`).toBe(true);
    }
  });

  it("navnløst objekt avvises selv når taggen er hvitelistet", () => {
    const verdict = evaluateOsmElement({ ...base, tags: { leisure: "sports_centre" } });
    expect(verdict.accept).toBe(false);
    if (!verdict.accept) expect(verdict.reason).toBe("mangler-navn");
  });

  it("kategorien kommer fra taggen, aldri fra navnet", () => {
    // Navnet sier «barnehage», taggen sier park. Taggen vinner — det er
    // navne-utledning som produserte «Leo's lekeland» som lekeplass.
    const verdict = evaluateOsmElement({
      ...base,
      tags: { leisure: "park", name: "Solstua barnehage" },
    });
    expect(verdict.accept).toBe(true);
    if (verdict.accept) expect(verdict.categoryId).toBe("park");
  });

  it("way/relation bruker center som koordinat", () => {
    const verdict = evaluateOsmElement({
      type: "way",
      id: 9,
      center: { lat: 63.44, lon: 10.51 },
      tags: { leisure: "marina", name: "Grilstad Marina" },
    });
    expect(verdict.accept).toBe(true);
    if (verdict.accept) {
      expect(verdict.lat).toBe(63.44);
      expect(verdict.lng).toBe(10.51);
    }
  });

  it("objekt uten koordinat avvises", () => {
    const verdict = evaluateOsmElement({
      type: "relation",
      id: 11,
      tags: { leisure: "park", name: "Et sted uten punkt" },
    });
    expect(verdict.accept).toBe(false);
    if (!verdict.accept) expect(verdict.reason).toBe("mangler-koordinat");
  });

  it("navngitt pitch godkjennes uansett sport — også uten sport-tagg", () => {
    // Sport-kravet ble fjernet 2026-08-24: fem hardkodede verdier (soccer,
    // football, handball, tennis, basketball) avviste «Ranheim Pumptrack»
    // (cycling), «Charlottenlund skatepark» (skateboard) og «Leangen
    // idrettspark» (ingen sport-tagg). Navnekravet gjør jobben alene.
    for (const sport of ["soccer", "soccer;ice_skating", "cycling", "skateboard", "athletics;multi", "boules", undefined]) {
      const tags: Record<string, string> = { leisure: "pitch", name: "Banen" };
      if (sport) tags.sport = sport;
      const verdict = evaluateOsmElement({ ...base, tags });
      expect(verdict.accept, `sport=${sport ?? "(mangler)"}`).toBe(true);
    }
  });

  it("navnløs pitch avvises fortsatt — navnet ER porten", () => {
    const verdict = evaluateOsmElement({ ...base, tags: { leisure: "pitch", sport: "soccer" } });
    expect(verdict.accept).toBe(false);
    if (!verdict.accept) expect(verdict.reason).toBe("mangler-navn");
  });
});

describe("osm-gate: mot det reelle Ranheim-sveipet (781 objekter)", () => {
  it("regnskapet går opp — ingen stille trunkering", () => {
    const { ledger } = runFixture();
    expect(ledger.total).toBe(ELEMENTS.length);
    expect(ledger.accepted + ledger.rejected).toBe(ledger.total);
  });

  it("godkjenner 16 av 781", () => {
    // 14 før sport-kravet på pitch ble fjernet (2026-08-24). De to nye er
    // «Ranheim Pumptrack» (sport=cycling) og «Charlottenlund skatepark»
    // (sport=skateboard) — begge navngitte, begge ekte anlegg.
    const { accepted } = runFixture();
    expect(accepted).toHaveLength(16);
  });

  it("de to nye er nettopp pumptracken og skateparken", () => {
    const { accepted } = runFixture();
    const names = accepted.map((a) => a.name);
    expect(names).toContain("Ranheim Pumptrack");
    expect(names).toContain("Charlottenlund skatepark");
  });

  it("ingen regresjon: alle 12 anleggene den gamle spørringen importerte er med", () => {
    // Den gamle hardkodede spørringen (leisure=sports_centre / pitch+sport /
    // swimming_pool, navn påkrevd) ga nøyaktig disse 12 i samme bbox.
    const { accepted } = runFixture();
    const names = accepted.map((a) => a.name);
    for (const name of [
      "EXTRA Arena",
      "Extra Arena",
      "Charlottenlund vgs. idrettshall",
      "Charlottenlundhallen",
      "Charlottenlund kunstgressbane",
      "Charlottenlund kunstgrasbane",
      "Jakobsli idrettsplass",
      "Ranheim aktivitetshall",
      "Ranheim idrettsanlegg",
      "Ranheimshallen",
      "Vikåsenhallen",
      "Svømmehall",
    ]) {
      expect(names, `${name} forsvant`).toContain(name);
    }
  });

  it("utvidelsen gir to nye steder, ikke et skred", () => {
    const { accepted } = runFixture();
    const nye = accepted.filter((a) => a.categoryId !== "idrett" && a.categoryId !== "swimming");
    expect(nye.map((a) => `${a.categoryId}:${a.name}`).sort()).toEqual([
      "badeplass:Grilstadstranda",
      "marina:Grilstad Marina",
    ]);
  });

  it("alle 171 parkeringer avvises", () => {
    const verdicts = countRejected("amenity", "parking");
    expect(verdicts).toHaveLength(171);
    expect(verdicts.every((v) => !v.accept)).toBe(true);
  });

  it("alle 57 lekeplasser avvises", () => {
    const verdicts = countRejected("leisure", "playground");
    expect(verdicts).toHaveLength(57);
    expect(verdicts.every((v) => !v.accept)).toBe(true);
  });

  it("alle 25 benker og alle 52 sykkelparkeringer avvises", () => {
    const benker = countRejected("amenity", "bench");
    const sykkel = countRejected("amenity", "bicycle_parking");
    expect(benker).toHaveLength(25);
    expect(sykkel).toHaveLength(52);
    expect([...benker, ...sykkel].every((v) => !v.accept)).toBe(true);
  });

  it("avvisnings-regnskapet navngir de største gruppene", () => {
    const { ledger } = runFixture();
    expect(ledger.byDetail["ikke-i-hviteliste:amenity=parking"]).toBe(171);
    expect(ledger.byDetail["ikke-i-hviteliste:leisure=playground"]).toBe(57);
    expect(ledger.byDetail["ikke-i-hviteliste:natural=tree"]).toBe(184);
    expect(summarizeLedger(ledger)).toContain("16 av 781 godkjent");
  });
});

describe("osm-gate: spørringen bygges fra hvitelisten", () => {
  it("én linje per regel, med bboxen", () => {
    const query = buildOverpassQuery({
      south: 63.41,
      west: 10.48,
      north: 63.46,
      east: 10.53,
    });
    for (const rule of OSM_GATE_RULES) {
      expect(query).toContain(`nwr["${rule.key}"="${rule.value}"](63.41,10.48,63.46,10.53);`);
    }
    const lines = query.split("\n").filter((l) => l.trim().startsWith("nwr["));
    expect(lines).toHaveLength(OSM_GATE_RULES.length);
  });

  it("spør ikke om noe som er permanent utestengt", () => {
    const query = buildOverpassQuery({ south: 0, west: 0, north: 1, east: 1 });
    for (const tag of Object.keys(PERMANENTLY_EXCLUDED)) {
      const [key, value] = tag.split("=");
      expect(query).not.toContain(`nwr["${key}"="${value}"]`);
    }
  });
});

describe("osm-gate: id-konvensjon", () => {
  it("følger seed-formen — den basen faktisk inneholder", () => {
    // Alle 662 osm-*-radene i v2.pois har `osm-<type>-<id>` / `<type>/<id>`.
    // Pipelinen brukte `osm-<type><id>` for BEGGE, som aldri kunne matche.
    const el = { type: "node", id: 5567649140 };
    expect(osmPoiId(el)).toBe("osm-node-5567649140");
    expect(osmSourceId(el)).toBe("node/5567649140");
  });

  it("way og relation følger samme form", () => {
    expect(osmPoiId({ type: "way", id: 84078486 })).toBe("osm-way-84078486");
    expect(osmSourceId({ type: "relation", id: 12 })).toBe("relation/12");
  });
});
