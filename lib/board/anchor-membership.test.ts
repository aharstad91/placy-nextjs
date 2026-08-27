import { describe, it, expect } from "vitest";
import fixture from "./__fixtures__/anchor-membership.fixture.json";
import {
  parseAddress,
  normalizeStreet,
  hasHouseNumber,
  resolveAnchors,
  distanceMeters,
  type AnchorCandidate,
  type MemberCandidate,
} from "./anchor-membership";

/**
 * Fixturen er EKTE prod-data hentet 2026-08-27, ikke oppdiktet:
 *  - `board`     = de 533 POI-ene på Strindfjordvegen 10 (Sirkus + Lade)
 *  - `vikhammer` = bbox rundt Utsikten 6 (det lille senteret, 5 medlemmer)
 *  - `malls`     = alle `shopping`-POI-er i regionen + Vikhammer senteret, som
 *                  Google kjenner men basen mangler (recall-bug, Unit 8)
 */
const BOARD = fixture.board as MemberCandidate[];
const VIKHAMMER = fixture.vikhammer as MemberCandidate[];
const MALLS = fixture.malls as AnchorCandidate[];

const SIRKUS = "google-ChIJVZdRQJoxbUYRTcToJ4smjeM";
const VIKHAMMER_SENTERET = "google-ChIJ_VIKHAMMER_SENTERET";

const byName = (id: string) => MALLS.find((m) => m.id === id)?.name ?? id;

describe("parseAddress — Google-fritekst fra prod", () => {
  it("enkleste form", () => {
    expect(parseAddress("Falkenborgvegen 1, Trondheim")).toEqual({
      street: "falkenborgvegen",
      houseNumbers: ["1"],
    });
  });

  it("hopper over venue-navnet foran gata", () => {
    expect(parseAddress("Sirkus Shopping, Falkenborgvegen 9, Trondheim")).toEqual({
      street: "falkenborgvegen",
      houseNumbers: ["9"],
    });
    expect(parseAddress("SIRKUS SHOPPING, Falkenborgvegen 1, Trondheim")).toEqual({
      street: "falkenborgvegen",
      houseNumbers: ["1"],
    });
  });

  it("hopper over støy på begge sider — «i 1 etg» er ikke et husnummer", () => {
    expect(parseAddress("Nye lokaler, Falkenborgvegen 5, i 1 etg, Trondheim")).toEqual({
      street: "falkenborgvegen",
      houseNumbers: ["5"],
    });
  });

  it("absorberer ekstra husnummer som eget segment", () => {
    expect(parseAddress("Peder Falcks veg 3, 8, Trondheim")).toEqual({
      street: "peder falcks veg",
      houseNumbers: ["3", "8"],
    });
    expect(parseAddress("Falkenborgvegen 5, 9")).toEqual({
      street: "falkenborgvegen",
      houseNumbers: ["5", "9"],
    });
  });

  it("utvider husnummer-intervall", () => {
    expect(parseAddress("Falkenborgvegen 4-6")?.houseNumbers).toEqual(["4", "5", "6"]);
  });

  it("romertall i gatenavnet leses ikke som husnummer", () => {
    expect(parseAddress("Haakon VIIs gt. 12, Trondheim")).toEqual({
      street: "haakon viis gate",
      houseNumbers: ["12"],
    });
  });

  it("«gt.» og «gate» og apostrof er samme gate — prod har alle tre", () => {
    expect(normalizeStreet("Haakon VIIs gt.")).toBe("haakon viis gate");
    expect(normalizeStreet("Haakon VIIs gate")).toBe("haakon viis gate");
    expect(normalizeStreet("Haakon VII's gate")).toBe("haakon viis gate");
  });

  it("husnummer-bokstav beholdes", () => {
    expect(parseAddress("Falkenborgvegen 35c, Trondheim")?.houseNumbers).toEqual(["35c"]);
  });

  it("bynavn uten gate avvises — 42 POI-er i poolen har bare «Trondheim»", () => {
    expect(parseAddress("Trondheim")).toBeNull();
    expect(parseAddress("Oslo")).toBeNull();
    expect(hasHouseNumber("Trondheim")).toBe(false);
    expect(hasHouseNumber(null)).toBe(false);
    expect(hasHouseNumber("Falkenborgvegen 1, Trondheim")).toBe(true);
  });
});

describe("resolveAnchors — Sirkus Shopping (adresse-gaten)", () => {
  const result = resolveAnchors(MALLS, BOARD);
  const sirkus = result.anchors.find((a) => a.anchorId === SIRKUS);

  it("blir et anker", () => {
    expect(sirkus).toBeDefined();
  });

  it("samler husnummer 1, 5 og 9 — ikke 35/38-halen 419 m unna", () => {
    expect(sirkus!.houseNumbers).toEqual(expect.arrayContaining(["1", "5", "9"]));
    expect(sirkus!.houseNumbers).not.toContain("35");
    expect(sirkus!.houseNumbers).not.toContain("38");
  });

  it("samler minst 50 medlemmer", () => {
    expect(sirkus!.memberIds.length).toBeGreaterThanOrEqual(50);
  });

  it("Falkenborgvegen 35c er IKKE medlem", () => {
    const utenfor = BOARD.filter((p) => /35c/i.test(p.address ?? ""));
    expect(utenfor.length).toBeGreaterThan(0);
    for (const p of utenfor) {
      expect(result.parentByPoiId.get(p.id)).not.toBe(SIRKUS);
    }
  });

  it("ingen medlem ligger lenger enn 250 m fra ankeret", () => {
    const anchor = MALLS.find((m) => m.id === SIRKUS)!;
    for (const id of sirkus!.memberIds) {
      const poi = BOARD.find((p) => p.id === id)!;
      expect(distanceMeters(anchor, poi)).toBeLessThanOrEqual(250);
    }
  });
});

describe("resolveAnchors — Vikhammer senteret (nærhets-gaten)", () => {
  const result = resolveAnchors(MALLS, VIKHAMMER);
  const vik = result.anchors.find((a) => a.anchorId === VIKHAMMER_SENTERET);

  it("blir et anker selv om gatenavnet er et annet enn medlemmenes", () => {
    // Google: senteret på «Utsikten 13», medlemmene på «Stasjonsvegen 1».
    expect(vik).toBeDefined();
    expect(vik!.memberIds.length).toBeGreaterThanOrEqual(4);
  });

  it("samler nøyaktig de fem på Stasjonsvegen 1", () => {
    const names = vik!.memberIds
      .map((id) => VIKHAMMER.find((p) => p.id === id)!.name)
      .sort();
    expect(names).toEqual([
      "Apotek 1 Malvik",
      "Extra Vikhammer",
      "Pizzabakeren Vikhammer",
      "Vikhamar Hårsenter AS",
      "Vikhammer Post i Butikk",
    ]);
  });

  it("drar ikke inn legekontoret på Stasjonsvegen 14", () => {
    const legekontor = VIKHAMMER.filter((p) => /Stasjonsvegen 14/.test(p.address ?? ""));
    expect(legekontor.length).toBeGreaterThan(0);
    for (const p of legekontor) {
      expect(result.parentByPoiId.has(p.id)).toBe(false);
    }
  });
});

describe("resolveAnchors — containment slår heuristikken", () => {
  it("Googles containingPlaces vinner over adresse og nærhet", () => {
    const anchors: AnchorCandidate[] = [
      { id: "a-riktig", name: "Riktig senter", address: "Annen veg 1", lat: 63.4, lng: 10.4 },
      { id: "a-naer", name: "Nabosenter", address: "Gata 1", lat: 63.4, lng: 10.4 },
    ];
    const pois: MemberCandidate[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`,
      name: `Butikk ${i}`,
      address: "Gata 1, By",
      lat: 63.4,
      lng: 10.4,
      categoryId: "butikk",
      containedInIds: ["a-riktig"],
    }));
    const r = resolveAnchors(anchors, pois);
    expect(r.parentByPoiId.get("p0")).toBe("a-riktig");
    expect(r.anchors.find((a) => a.anchorId === "a-riktig")!.via["p0"]).toBe("containment");
  });
});

describe("resolveAnchors — realitets-gaten", () => {
  const result = resolveAnchors(MALLS, BOARD);

  it("kandidater uten medlemmer blir ikke ankre", () => {
    // `category_id = shopping` er forurenset: prod har «Tem Im thaimat»,
    // «Parkering ikea leangen» og «Falkenborgvegen 3» med samme Google-type.
    const rejectedNames = result.rejected.map((r) => r.name);
    expect(rejectedNames).toContain("Parkering ikea leangen");
    expect(rejectedNames).toContain("Falkenborgvegen 3");
    for (const r of result.rejected) expect(r.memberCount).toBeLessThan(4);
  });

  it("et anker er aldri medlem av et annet anker", () => {
    const anchorIds = new Set(result.anchors.map((a) => a.anchorId));
    for (const id of result.parentByPoiId.keys()) {
      expect(anchorIds.has(id)).toBe(false);
    }
  });

  it("hvert medlem har nøyaktig ett anker", () => {
    const counts = new Map<string, number>();
    for (const a of result.anchors) {
      for (const id of a.memberIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [, n] of counts) expect(n).toBe(1);
  });

  it("er deterministisk — omstokket input gir samme resultat", () => {
    const shuffled = [...BOARD].reverse();
    const shuffledMalls = [...MALLS].reverse();
    const a = resolveAnchors(MALLS, BOARD);
    const b = resolveAnchors(shuffledMalls, shuffled);
    expect(
      a.anchors.map((x) => [x.anchorId, x.memberIds.join(",")]).sort(),
    ).toEqual(b.anchors.map((x) => [x.anchorId, x.memberIds.join(",")]).sort());
  });
});

describe("resolveAnchors — Lade blir flere ankre, ikke ett", () => {
  const result = resolveAnchors(MALLS, BOARD);

  it("Lade Arena, Hangaren og City Lade stjeler ikke hverandres medlemmer", () => {
    // Målt mot Places API: de tre ligger 305/490/520 m fra tyngdepunktet, altså
    // godt utenfor maxMemberDistance på 250 m fra hverandre.
    const ladeAnchors = result.anchors.filter((a) =>
      /Lade Arena|Hangaren Lade|City Lade/.test(byName(a.anchorId)),
    );
    expect(ladeAnchors.length).toBeGreaterThanOrEqual(2);
    const seen = new Set<string>();
    for (const a of ladeAnchors) {
      for (const id of a.memberIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });
});
