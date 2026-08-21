import { describe, it, expect } from "vitest";
import {
  normalizePoiName,
  groupByAuthoritativeKey,
  dataRichnessScore,
  chooseCanonical,
  safetyProblems,
  resolveGroups,
  buildAbsorptionPatch,
  planLinkRepoint,
  type MergeablePoi,
} from "@/lib/pipeline/merge-duplicate-pois";

function poi(over: Partial<MergeablePoi> & { id: string }): MergeablePoi {
  return {
    name: "Sted",
    lat: 63.4382,
    lng: 10.5087,
    category_id: "bus",
    source: null,
    ...over,
  };
}

describe("normalizePoiName", () => {
  it("translittererer norske bokstaver før tegnfjerning", () => {
    // NFD dekomponerer ikke ø — uten eksplisitt erstatning ville «Brøset» blitt «br set».
    expect(normalizePoiName("Brøset Hageby")).toBe("broset hageby");
    expect(normalizePoiName("Grillstadfjæra")).toBe("grillstadfjaera");
    expect(normalizePoiName("Rønningsbakken")).toBe("ronningsbakken");
  });

  it("fjerner selskapsformer så «Stokkbekken barnehage AS» matcher uten AS", () => {
    expect(normalizePoiName("Stokkbekken barnehage AS")).toBe("stokkbekken barnehage");
    expect(normalizePoiName("Jakobsgrenda barnehage SA")).toBe("jakobsgrenda barnehage");
  });

  it("takler null og tom streng", () => {
    expect(normalizePoiName(null)).toBe("");
    expect(normalizePoiName(undefined)).toBe("");
  });
});

describe("groupByAuthoritativeKey", () => {
  it("grupperer rader som deler ekstern nøkkel", () => {
    const groups = groupByAuthoritativeKey([
      poi({ id: "bus-a", entur_stopplace_id: "NSR:StopPlace:1" }),
      poi({ id: "entur-NSR-StopPlace-1", entur_stopplace_id: "NSR:StopPlace:1" }),
      poi({ id: "bus-b", entur_stopplace_id: "NSR:StopPlace:2" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("entur_stopplace_id");
    expect(groups[0].rows.map((r) => r.id).sort()).toEqual(["bus-a", "entur-NSR-StopPlace-1"]);
  });

  it("plasserer en rad i ÉN gruppe selv når flere nøkler matcher", () => {
    // Ellers ville andre sammenslåing pekt på en rad som alt er slettet.
    const groups = groupByAuthoritativeKey([
      poi({ id: "a", nsr_id: "NSR-1", google_place_id: "G-1" }),
      poi({ id: "b", nsr_id: "NSR-1" }),
      poi({ id: "c", google_place_id: "G-1" }),
    ]);
    const grouped = groups.flatMap((g) => g.rows.map((r) => r.id));
    expect(grouped.filter((id) => id === "a")).toHaveLength(1);
  });

  it("ignorerer tomme og manglende nøkkelverdier", () => {
    expect(
      groupByAuthoritativeKey([
        poi({ id: "a", nsr_id: "" }),
        poi({ id: "b", nsr_id: "" }),
        poi({ id: "c" }),
        poi({ id: "d" }),
      ]),
    ).toHaveLength(0);
  });
});

describe("chooseCanonical", () => {
  it("lar en kuratert rad vinne over en rikere ukuratert", () => {
    // Kurator-bindingen er hele poenget: mister vi den, forsvinner chipsen.
    const curated = poi({ id: "uuid-kuratert" });
    const rich = poi({
      id: "bhf-slug",
      google_place_id: "G",
      opening_hours_json: { weekday_text: ["man"] },
      grounding: { generated: {} },
    });
    const { winner, losers } = chooseCanonical([rich, curated], new Set(["uuid-kuratert"]));
    expect(winner.id).toBe("uuid-kuratert");
    expect(losers.map((l) => l.id)).toEqual(["bhf-slug"]);
  });

  it("velger datarikeste når ingen er kuratert", () => {
    const thin = poi({ id: "tynn" });
    const rich = poi({ id: "rik", grounding: { curated: {} } });
    expect(chooseCanonical([thin, rich], new Set()).winner.id).toBe("rik");
  });

  it("er deterministisk ved likt innhold — eldste rad vinner", () => {
    const older = poi({ id: "b", created_at: "2026-01-25T00:00:00Z" });
    const newer = poi({ id: "a", created_at: "2026-07-06T00:00:00Z" });
    expect(chooseCanonical([newer, older], new Set()).winner.id).toBe("b");
    expect(chooseCanonical([older, newer], new Set()).winner.id).toBe("b");
  });
});

describe("dataRichnessScore", () => {
  it("rangerer kuratert over generert over ren Google-kobling", () => {
    expect(dataRichnessScore(poi({ id: "a", grounding: { curated: {} } })))
      .toBeGreaterThan(dataRichnessScore(poi({ id: "b", grounding: { generated: {} } })));
    expect(dataRichnessScore(poi({ id: "b", grounding: { generated: {} } })))
      .toBeGreaterThan(dataRichnessScore(poi({ id: "c", google_place_id: "G" })));
  });
});

describe("safetyProblems", () => {
  it("stopper Entur-retningspar som deler StopPlace", () => {
    const fra = poi({ id: "bakkegata-buss-fra", name: "Bakkegata bussholdeplass (fra sentrum)" });
    const til = poi({ id: "bakkegata-buss-til", name: "Bakkegata bussholdeplass (til sentrum)" });
    const problems = safetyProblems(fra, [til]);
    expect(problems.some((p) => p.includes("ulikt navn"))).toBe(true);
  });

  it("stopper rader som ligger for langt fra hverandre", () => {
    const a = poi({ id: "a", name: "Rønningsbakken", lat: 63.4382, lng: 10.5087 });
    const b = poi({ id: "b", name: "Rønningsbakken", lat: 63.4392, lng: 10.5087 });
    expect(safetyProblems(a, [b]).some((p) => p.includes("m mellom"))).toBe(true);
  });

  it("stopper ulik kategori", () => {
    const a = poi({ id: "a", name: "Samme sted", category_id: "bus" });
    const b = poi({ id: "b", name: "Samme sted", category_id: "train" });
    expect(safetyProblems(a, [b]).some((p) => p.includes("ulik kategori"))).toBe(true);
  });

  it("godtar identisk navn med selskapsform-suffiks på samme punkt", () => {
    const a = poi({ id: "a", name: "Stokkbekken barnehage AS", category_id: "barnehage" });
    const b = poi({ id: "b", name: "Stokkbekken barnehage", category_id: "barnehage" });
    expect(safetyProblems(a, [b])).toEqual([]);
  });
});

describe("resolveGroups", () => {
  it("skiller trygge grupper fra dem som må vurderes", () => {
    const resolved = resolveGroups(
      groupByAuthoritativeKey([
        poi({ id: "bus-x", name: "X holdeplass", entur_stopplace_id: "NSR:1" }),
        poi({ id: "entur-1", name: "X holdeplass", entur_stopplace_id: "NSR:1" }),
        poi({ id: "bus-fra", name: "Y (fra sentrum)", entur_stopplace_id: "NSR:2" }),
        poi({ id: "bus-til", name: "Y (til sentrum)", entur_stopplace_id: "NSR:2" }),
      ]),
      new Set(),
    );
    const safe = resolved.filter((g) => g.problems.length === 0);
    const review = resolved.filter((g) => g.problems.length > 0);
    expect(safe).toHaveLength(1);
    expect(review).toHaveLength(1);
    expect(review[0].value).toBe("NSR:2");
  });
});

describe("buildAbsorptionPatch", () => {
  it("arver bare felter vinneren mangler", () => {
    const winner = poi({ id: "w", google_phone: "111", opening_hours_json: null });
    const loser = poi({
      id: "l",
      google_phone: "222",
      opening_hours_json: { weekday_text: ["man"] },
      gallery_images: ["a.jpg"],
    });
    const patch = buildAbsorptionPatch(winner, [loser]);
    expect(patch.google_phone).toBeUndefined();
    expect(patch.opening_hours_json).toEqual({ weekday_text: ["man"] });
    expect(patch.gallery_images).toEqual(["a.jpg"]);
  });

  it("behandler tom array og blank streng som mangel", () => {
    const winner = poi({ id: "w", gallery_images: [], editorial_hook: "   " });
    const loser = poi({ id: "l", gallery_images: ["b.jpg"], editorial_hook: "Ekte krok" });
    const patch = buildAbsorptionPatch(winner, [loser]);
    expect(patch.gallery_images).toEqual(["b.jpg"]);
    expect(patch.editorial_hook).toBe("Ekte krok");
  });

  it("tar første taper som har verdien når flere tapere finnes", () => {
    const winner = poi({ id: "w" });
    const patch = buildAbsorptionPatch(winner, [
      poi({ id: "l1" }),
      poi({ id: "l2", google_phone: "333" }),
    ]);
    expect(patch.google_phone).toBe("333");
  });
});

describe("planLinkRepoint", () => {
  it("repeker lenker der vinneren ikke alt er lenket", () => {
    const plan = planLinkRepoint(
      [
        { project_id: "p1", poi_id: "loser" },
        { project_id: "p2", poi_id: "winner" },
      ],
      "project_id",
      "winner",
      new Set(["loser"]),
    );
    expect(plan.repoint.map((l) => l.project_id)).toEqual(["p1"]);
    expect(plan.drop).toHaveLength(0);
  });

  it("sletter lenken i stedet når begge ligger på samme board", () => {
    // Å repeke ville brutt primærnøkkelen (project_id, poi_id).
    const plan = planLinkRepoint(
      [
        { project_id: "p1", poi_id: "winner" },
        { project_id: "p1", poi_id: "loser" },
      ],
      "project_id",
      "winner",
      new Set(["loser"]),
    );
    expect(plan.repoint).toHaveLength(0);
    expect(plan.drop.map((l) => l.poi_id)).toEqual(["loser"]);
  });

  it("sletter taper nummer to når taper én alt er repeket til samme eier", () => {
    const plan = planLinkRepoint(
      [
        { project_id: "p1", poi_id: "loser1" },
        { project_id: "p1", poi_id: "loser2" },
      ],
      "project_id",
      "winner",
      new Set(["loser1", "loser2"]),
    );
    expect(plan.repoint.map((l) => l.poi_id)).toEqual(["loser1"]);
    expect(plan.drop.map((l) => l.poi_id)).toEqual(["loser2"]);
  });

  it("bevarer precomputede reisetider på lenken som repekes", () => {
    const plan = planLinkRepoint(
      [{ project_id: "p1", poi_id: "loser", travel_times: { walk: 7 } }],
      "project_id",
      "winner",
      new Set(["loser"]),
    );
    expect(plan.repoint[0].travel_times).toEqual({ walk: 7 });
  });

  it("rører ikke lenker til uvedkommende POI-er", () => {
    const plan = planLinkRepoint(
      [{ project_id: "p1", poi_id: "annen" }],
      "project_id",
      "winner",
      new Set(["loser"]),
    );
    expect(plan.repoint).toHaveLength(0);
    expect(plan.drop).toHaveLength(0);
  });
});
