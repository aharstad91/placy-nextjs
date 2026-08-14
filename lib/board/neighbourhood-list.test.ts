import { describe, it, expect } from "vitest";
import {
  availableTravelModes,
  buildNeighbourhoodList,
  categorySubline,
  type NeighbourhoodCategoryInput,
  type NeighbourhoodPOIInput,
} from "./neighbourhood-list";
import type { ViewportRect } from "./board-types";

/**
 * Unit 2 — nabolagsmodellen. Ren logikk: gitt kategoriene, kartutsnittet og
 * de precomputede gangtidene skal modellen produsere den grupperte, sorterte
 * lista. Ingen React, ingen kart-instans — dette er den eneste unitten i
 * planen der korrektheten er fullt avgjørbar uten en telefon, så den bærer
 * testdekningen for hele flaten.
 */

/** Utsnitt som dekker lat 63.42–63.44 og lng 10.39–10.41. */
const RECT: ViewportRect = {
  west: 10.39,
  east: 10.41,
  south: 63.42,
  north: 63.44,
};

/** Utenfor RECT i alle retninger. */
const FAR = { lat: 63.5, lng: 10.6 };

function poi(
  id: string,
  opts: {
    lat?: number;
    lng?: number;
    walk?: number;
    bike?: number;
    car?: number;
    /** Rå travel_times, for korrupte verdier som typen ikke tillater. */
    rawTravelTime?: Record<string, unknown>;
    sub?: string;
    name?: string;
  } = {},
): NeighbourhoodPOIInput {
  const travelTime = opts.rawTravelTime ?? {
    ...(opts.walk === undefined ? {} : { walk: opts.walk }),
    ...(opts.bike === undefined ? {} : { bike: opts.bike }),
    ...(opts.car === undefined ? {} : { car: opts.car }),
  };
  return {
    id,
    name: opts.name ?? id,
    coordinates: { lat: opts.lat ?? 63.43, lng: opts.lng ?? 10.4 },
    raw: {
      category: { id: opts.sub ?? "restaurant" },
      ...(Object.keys(travelTime).length === 0
        ? {}
        : { travelTime: travelTime as NeighbourhoodPOIInput["raw"]["travelTime"] }),
    },
  };
}

function cat(
  id: string,
  pois: NeighbourhoodPOIInput[],
  label = id,
): NeighbourhoodCategoryInput<NeighbourhoodPOIInput> {
  return { id, label, icon: "MapPin", color: "#111111", pois };
}

const idsOf = (rows: { poi: { id: string } }[]) => rows.map((r) => r.poi.id);

describe("buildNeighbourhoodList — gruppering og sortering", () => {
  it("sorterer kategoriene på gangtiden til sitt nærmeste synlige punkt (R10)", () => {
    const list = buildNeighbourhoodList(
      [
        cat("natur", [poi("n1", { walk: 12 }), poi("n2", { walk: 20 })]),
        cat("mat", [poi("m1", { walk: 4 }), poi("m2", { walk: 9 })]),
        cat("transport", [poi("t1", { walk: 7 })]),
      ],
      RECT,
    );
    expect(list.categories.map((c) => c.id)).toEqual([
      "mat",
      "transport",
      "natur",
    ]);
  });

  it("sorterer punktene innen en kategori på gangtid (stigende)", () => {
    const list = buildNeighbourhoodList(
      [cat("mat", [poi("b", { walk: 9 }), poi("a", { walk: 3 })])],
      RECT,
    );
    expect(idsOf(list.categories[0].rows)).toEqual(["a", "b"]);
  });

  it("utelater kategorier uten synlige punkter HELT (R14)", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [poi("m1", { walk: 4 })]),
        cat("natur", [poi("n1", { ...FAR, walk: 6 })]),
      ],
      RECT,
    );
    expect(list.categories.map((c) => c.id)).toEqual(["mat"]);
  });

  it("gir tom liste — ikke kategorier med tomme kort — når ingenting er synlig", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [poi("m1", { ...FAR, walk: 4 })]),
        cat("natur", [poi("n1", { ...FAR, walk: 6 })]),
      ],
      RECT,
    );
    expect(list.categories).toEqual([]);
    expect(list.visibleCount).toBe(0);
  });
});

describe("buildNeighbourhoodList — dekning og tidsspenn", () => {
  it("teller dekning mot BOARD-settet: 9 av 17 synlig, spenn fra de ni", () => {
    // 9 innenfor (gangtid 4..12), 8 utenfor (gangtid 30..37 — skal ikke
    // påvirke spennet selv om de er en del av nevneren).
    const inside = Array.from({ length: 9 }, (_, i) =>
      poi(`in${i}`, { walk: 4 + i }),
    );
    const outside = Array.from({ length: 8 }, (_, i) =>
      poi(`out${i}`, { ...FAR, walk: 30 + i }),
    );
    const list = buildNeighbourhoodList(
      [cat("hverdag", [...inside, ...outside])],
      RECT,
    );
    const c = list.categories[0];
    expect(c.visibleCount).toBe(9);
    expect(c.totalCount).toBe(17);
    expect(c.minMinutes).toBe(4);
    expect(c.maxMinutes).toBe(12);
  });

  it("ett synlig punkt gir sammenfallende min/max (renderer viser ett tall)", () => {
    const list = buildNeighbourhoodList([cat("mat", [poi("m1", { walk: 6 })])], RECT);
    expect(list.categories[0].minMinutes).toBe(6);
    expect(list.categories[0].maxMinutes).toBe(6);
  });

  it("alle punkter synlige gir «17 av 17» (sant, men Unit 5 gjør det sjeldent)", () => {
    const pois = Array.from({ length: 17 }, (_, i) => poi(`p${i}`, { walk: i + 1 }));
    const list = buildNeighbourhoodList([cat("hverdag", pois)], RECT);
    expect(list.categories[0].visibleCount).toBe(17);
    expect(list.categories[0].totalCount).toBe(17);
  });

  it("eksponerer ALLE synlige POI-IDer, ikke bare de tre som står som rader", () => {
    // Markørsettet på kartet er ikke det samme som radene på kortet.
    const pois = Array.from({ length: 6 }, (_, i) => poi(`p${i}`, { walk: i + 1 }));
    const list = buildNeighbourhoodList(
      [cat("mat", [...pois, poi("borte", { ...FAR, walk: 2 })])],
      RECT,
    );
    expect(list.categories[0].rows).toHaveLength(3);
    expect(list.visiblePoiIds.sort()).toEqual(pois.map((p) => p.id).sort());
  });

  it("teller ikke skjulte punkter i visibleCount på tvers av kategoriene", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [poi("m1", { walk: 4 }), poi("m2", { ...FAR, walk: 5 })]),
        cat("natur", [poi("n1", { walk: 8 })]),
      ],
      RECT,
    );
    expect(list.visibleCount).toBe(2);
  });
});

describe("buildNeighbourhoodList — utsnittet", () => {
  it("inkluderer punkter nøyaktig på kanten (deterministisk, ikke flakete)", () => {
    const corners = [
      poi("nw", { lat: RECT.north, lng: RECT.west, walk: 1 }),
      poi("ne", { lat: RECT.north, lng: RECT.east, walk: 2 }),
      poi("sw", { lat: RECT.south, lng: RECT.west, walk: 3 }),
      poi("se", { lat: RECT.south, lng: RECT.east, walk: 4 }),
    ];
    const list = buildNeighbourhoodList([cat("mat", corners)], RECT, {
      rowsPerCategory: 4,
    });
    expect(idsOf(list.categories[0].rows)).toEqual(["nw", "ne", "sw", "se"]);
  });

  it("ekskluderer punkter like utenfor kanten", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [
          poi("inne", { lat: RECT.north, lng: RECT.east, walk: 1 }),
          poi("ute", { lat: RECT.north + 1e-9, lng: RECT.east, walk: 2 }),
        ]),
      ],
      RECT,
    );
    expect(idsOf(list.categories[0].rows)).toEqual(["inne"]);
  });

  it("rect = null degraderer til «vis alt», ALDRI til tom liste", () => {
    // Kartet kunne ikke leses (ikke lastet, sheeten dekker alt, unproject
    // ga ikke-endelige tall). En tom liste uten årsak leses som en bug.
    const list = buildNeighbourhoodList(
      [cat("mat", [poi("m1", { ...FAR, walk: 4 }), poi("m2", { walk: 6 })])],
      null,
    );
    expect(list.scoped).toBe(false);
    expect(list.visibleCount).toBe(2);
    expect(list.categories[0].totalCount).toBe(2);
  });

  it("markerer lista som scopet når et utsnitt finnes", () => {
    const list = buildNeighbourhoodList([cat("mat", [poi("m1", { walk: 4 })])], RECT);
    expect(list.scoped).toBe(true);
  });
});

describe("buildNeighbourhoodList — sub-kategori-diversifisering", () => {
  it("slipper bussen inn blant fem bysykler (klynge-buggen fra 2026-03-04)", () => {
    // Rå gangtidssortering ville gitt tre bysykkelstasjoner på rad.
    const list = buildNeighbourhoodList(
      [
        cat("transport", [
          poi("sykkel1", { walk: 1, sub: "bike" }),
          poi("sykkel2", { walk: 2, sub: "bike" }),
          poi("sykkel3", { walk: 3, sub: "bike" }),
          poi("sykkel4", { walk: 4, sub: "bike" }),
          poi("sykkel5", { walk: 5, sub: "bike" }),
          poi("buss1", { walk: 6, sub: "bus" }),
        ]),
      ],
      RECT,
    );
    const ids = idsOf(list.categories[0].rows);
    expect(ids).toHaveLength(3);
    expect(ids).toContain("buss1");
    expect(ids.filter((id) => id.startsWith("sykkel"))).toHaveLength(2);
  });

  it("presenterer de valgte radene som en gangtidsstige, ikke i round-robin-rekkefølge", () => {
    const list = buildNeighbourhoodList(
      [
        cat("transport", [
          poi("sykkel1", { walk: 1, sub: "bike" }),
          poi("sykkel2", { walk: 2, sub: "bike" }),
          poi("buss1", { walk: 9, sub: "bus" }),
        ]),
      ],
      RECT,
    );
    expect(idsOf(list.categories[0].rows)).toEqual([
      "sykkel1",
      "sykkel2",
      "buss1",
    ]);
  });

  it("beholder ren gangtidsrekkefølge når kategorien har én sub-kategori", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [
          poi("r1", { walk: 2, sub: "restaurant" }),
          poi("r2", { walk: 4, sub: "restaurant" }),
          poi("r3", { walk: 6, sub: "restaurant" }),
          poi("r4", { walk: 8, sub: "restaurant" }),
        ]),
      ],
      RECT,
    );
    expect(idsOf(list.categories[0].rows)).toEqual(["r1", "r2", "r3"]);
  });

  it("diversifiserer ikke bort punkter når det er tre eller færre synlige", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [
          poi("a", { walk: 2, sub: "cafe" }),
          poi("b", { walk: 4, sub: "cafe" }),
        ]),
      ],
      RECT,
    );
    expect(idsOf(list.categories[0].rows)).toEqual(["a", "b"]);
    expect(list.categories[0].hasMore).toBe(false);
  });

  it("setter hasMore når kategorien har flere synlige punkter enn rader (R11)", () => {
    const list = buildNeighbourhoodList(
      [
        cat(
          "mat",
          Array.from({ length: 5 }, (_, i) => poi(`p${i}`, { walk: i + 1 })),
        ),
      ],
      RECT,
    );
    expect(list.categories[0].rows).toHaveLength(3);
    expect(list.categories[0].hasMore).toBe(true);
  });
});

describe("buildNeighbourhoodList — manglende gangtid (R26)", () => {
  it("sorterer punkt uten gangtid SIST i sin gruppe, uten minutt-tall", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [
          poi("ukjent"),
          poi("nær", { walk: 3 }),
          poi("fjern", { walk: 25 }),
        ]),
      ],
      RECT,
    );
    const rows = list.categories[0].rows;
    expect(idsOf(rows)).toEqual(["nær", "fjern", "ukjent"]);
    expect(rows[2].minutes).toBeUndefined();
  });

  it("holder NaN ute av tidsspennet når ett punkt mangler gangtid", () => {
    const list = buildNeighbourhoodList(
      [cat("mat", [poi("ukjent"), poi("nær", { walk: 3 })])],
      RECT,
    );
    const c = list.categories[0];
    expect(c.minMinutes).toBe(3);
    expect(c.maxMinutes).toBe(3);
    expect(Number.isNaN(c.minMinutes)).toBe(false);
  });

  it("rendrer kortet uten tidsspenn når ALLE punktene mangler gangtid", () => {
    const list = buildNeighbourhoodList(
      [cat("mat", [poi("u1"), poi("u2")])],
      RECT,
    );
    const c = list.categories[0];
    expect(c.visibleCount).toBe(2);
    expect(c.minMinutes).toBeUndefined();
    expect(c.maxMinutes).toBeUndefined();
  });

  it("sorterer kategori uten gangtider sist blant kategoriene", () => {
    const list = buildNeighbourhoodList(
      [
        cat("ukjent-tid", [poi("u1")]),
        cat("mat", [poi("m1", { walk: 30 })]),
      ],
      RECT,
    );
    expect(list.categories.map((c) => c.id)).toEqual(["mat", "ukjent-tid"]);
  });

  it("behandler ikke-endelig gangtid som manglende (ingen NaN lekker ut)", () => {
    const broken = poi("rar", { walk: 5 });
    broken.raw.travelTime = { walk: Number.NaN };
    const list = buildNeighbourhoodList(
      [cat("mat", [broken, poi("ok", { walk: 8 })])],
      RECT,
    );
    const rows = list.categories[0].rows;
    expect(idsOf(rows)).toEqual(["ok", "rar"]);
    expect(rows[1].minutes).toBeUndefined();
    expect(list.categories[0].maxMinutes).toBe(8);
  });
});

describe("buildNeighbourhoodList — determinisme", () => {
  it("bryter gangtids-likhet på navn, så rekkefølgen ikke flakker mellom renders", () => {
    const list = buildNeighbourhoodList(
      [
        cat("mat", [
          poi("z", { walk: 5, name: "Zanzibar" }),
          poi("a", { walk: 5, name: "Ambrosia" }),
        ]),
      ],
      RECT,
    );
    expect(idsOf(list.categories[0].rows)).toEqual(["a", "z"]);
  });

  it("bryter kategori-likhet på etikett", () => {
    const list = buildNeighbourhoodList(
      [
        cat("b", [poi("b1", { walk: 5 })], "Barn & oppvekst"),
        cat("a", [poi("a1", { walk: 5 })], "Aktiviteter"),
      ],
      RECT,
    );
    expect(list.categories.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("muterer ikke input-kategoriene", () => {
    const pois = [poi("b", { walk: 9 }), poi("a", { walk: 3 })];
    const input = [cat("mat", pois)];
    buildNeighbourhoodList(input, RECT);
    expect(input[0].pois.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

// ── Reisemodus (R2, R4, R6) ───────────────────────────────────────────────

describe("buildNeighbourhoodList — reisemodus", () => {
  it("default er gange når ingen modus sendes med", () => {
    const list = buildNeighbourhoodList([cat("mat", [poi("a", { walk: 12, car: 3 })])], null);
    expect(list.categories[0].rows[0].minutes).toBe(12);
  });

  it("samme kategori i gå og sykkel gir ulike tall og ulikt tidsspenn", () => {
    const categories = [
      cat("mat", [
        poi("a", { walk: 6, bike: 3 }),
        poi("b", { walk: 22, bike: 8 }),
      ]),
    ];

    const gaa = buildNeighbourhoodList(categories, null, { travelMode: "walk" }).categories[0];
    const sykkel = buildNeighbourhoodList(categories, null, { travelMode: "bike" }).categories[0];

    expect(gaa.rows.map((r) => r.minutes)).toEqual([6, 22]);
    expect([gaa.minMinutes, gaa.maxMinutes]).toEqual([6, 22]);
    expect(sykkel.rows.map((r) => r.minutes)).toEqual([3, 8]);
    expect([sykkel.minMinutes, sykkel.maxMinutes]).toEqual([3, 8]);
  });

  // R4: målt på intern_martin-barstads-veg-23c — Hansbakkfjæra er 28. nærmeste
  // til fots og nesten først i bil. Rekkefølgen MÅ følge modusen, ellers er
  // stigen usann.
  it("et punkt som er langt unna til fots og nært i bil rykker oppover (R4)", () => {
    const categories = [
      cat("utsikt", [
        poi("hansbakkfjaera", { walk: 28, car: 8, name: "Hansbakkfjæra" }),
        poi("naerbutikk", { walk: 6, car: 12, name: "Nærbutikken" }),
      ]),
    ];

    expect(
      idsOf(buildNeighbourhoodList(categories, null, { travelMode: "walk" }).categories[0].rows),
    ).toEqual(["naerbutikk", "hansbakkfjaera"]);
    expect(
      idsOf(buildNeighbourhoodList(categories, null, { travelMode: "car" }).categories[0].rows),
    ).toEqual(["hansbakkfjaera", "naerbutikk"]);
  });

  it("kategori-rekkefølgen følger også modusen (samme premiss som radene)", () => {
    const categories = [
      cat("langt-til-fots", [poi("x", { walk: 30, car: 4 })]),
      cat("naert-til-fots", [poi("y", { walk: 8, car: 14 })]),
    ];

    expect(
      buildNeighbourhoodList(categories, null, { travelMode: "walk" }).categories.map((c) => c.id),
    ).toEqual(["naert-til-fots", "langt-til-fots"]);
    expect(
      buildNeighbourhoodList(categories, null, { travelMode: "car" }).categories.map((c) => c.id),
    ).toEqual(["langt-til-fots", "naert-til-fots"]);
  });

  it("punkter uten verdi for valgt modus sorteres sist og rendres uten tall", () => {
    const categories = [
      cat("mat", [
        poi("uten", { walk: 2, name: "Uten sykkeltid" }),
        poi("med", { walk: 25, bike: 9, name: "Med sykkeltid" }),
      ]),
    ];

    const rows = buildNeighbourhoodList(categories, null, { travelMode: "bike" }).categories[0].rows;

    expect(idsOf(rows)).toEqual(["med", "uten"]);
    expect(rows[1].minutes).toBeUndefined();
  });

  it("kategori der ALLE punkter mangler valgt modus faller ikke ut — bare tidsspennet mangler", () => {
    const built = buildNeighbourhoodList([cat("mat", [poi("a", { walk: 5 })])], null, {
      travelMode: "car",
    });

    expect(built.categories).toHaveLength(1);
    expect(built.categories[0].minMinutes).toBeUndefined();
    expect(built.categories[0].maxMinutes).toBeUndefined();
    expect(built.categories[0].rows[0].minutes).toBeUndefined();
  });

  it("korrupt verdi for valgt modus siles bort (lekker ikke inn i spenn eller sortering)", () => {
    const categories = [
      cat("mat", [
        poi("nan", { rawTravelTime: { walk: 5, bike: NaN } }),
        poi("streng", { rawTravelTime: { walk: 5, bike: "ni" } }),
        poi("uendelig", { rawTravelTime: { walk: 5, bike: Infinity } }),
        poi("gyldig", { rawTravelTime: { walk: 5, bike: 7 } }),
      ]),
    ];

    const built = buildNeighbourhoodList(categories, null, {
      travelMode: "bike",
      rowsPerCategory: Number.POSITIVE_INFINITY,
    }).categories[0];

    expect([built.minMinutes, built.maxMinutes]).toEqual([7, 7]);
    expect(built.rows.filter((r) => r.minutes !== undefined).map((r) => r.poi.id)).toEqual([
      "gyldig",
    ]);
  });

  it("uten utsnitt (kartet kunne ikke leses) påvirker modusen fortsatt tallene", () => {
    const categories = [cat("mat", [poi("a", { lat: FAR.lat, lng: FAR.lng, walk: 40, car: 9 })])];

    const built = buildNeighbourhoodList(categories, null, { travelMode: "car" });

    expect(built.scoped).toBe(false);
    expect(built.categories[0].rows[0].minutes).toBe(9);
  });

  it("modusen endrer ALDRI hvilke punkter som er med — bare tallene og rekkefølgen", () => {
    const categories = [
      cat("mat", [poi("a", { walk: 5 }), poi("b", { walk: 9, car: 2 }), poi("c", { car: 3 })]),
    ];

    for (const travelMode of ["walk", "bike", "car"] as const) {
      const built = buildNeighbourhoodList(categories, RECT, {
        travelMode,
        rowsPerCategory: Number.POSITIVE_INFINITY,
      });
      expect(built.visibleCount).toBe(3);
      expect(built.visiblePoiIds.sort()).toEqual(["a", "b", "c"]);
    }
  });
});

describe("availableTravelModes (R6)", () => {
  it("rapporterer bare modus som har data på boardet", () => {
    expect(
      availableTravelModes([cat("mat", [poi("a", { walk: 5 }), poi("b", { walk: 9, car: 3 })])]),
    ).toEqual(["walk", "car"]);
  });

  it("full dekning → alle tre, i kanonisk rekkefølge (tregeste først)", () => {
    expect(availableTravelModes([cat("mat", [poi("a", { walk: 5, bike: 3, car: 2 })])])).toEqual([
      "walk",
      "bike",
      "car",
    ]);
  });

  it("bare gangtid → bare gange (UI-et rendrer da ingen veksler)", () => {
    expect(availableTravelModes([cat("mat", [poi("a", { walk: 5 })])])).toEqual(["walk"]);
  });

  it("ÉN POI med verdi er nok — modusen er tilgjengelig selv med delvis dekning", () => {
    expect(
      availableTravelModes([cat("mat", [poi("a", { walk: 5 }), poi("b", { walk: 9, bike: 4 })])]),
    ).toEqual(["walk", "bike"]);
  });

  it("korrupte verdier gir ikke tilgjengelighet", () => {
    expect(
      availableTravelModes([cat("mat", [poi("a", { rawTravelTime: { walk: 5, car: "tre" } })])]),
    ).toEqual(["walk"]);
  });

  it("ingen data i det hele tatt → ingen modus", () => {
    expect(availableTravelModes([cat("mat", [poi("a")])])).toEqual([]);
    expect(availableTravelModes([])).toEqual([]);
  });
});

describe("categorySubline — modus-nøytral form", () => {
  it("identisk min og maks skrives som ett tall", () => {
    expect(categorySubline({ visibleCount: 2, totalCount: 2, minMinutes: 4, maxMinutes: 4 })).toBe(
      "2 steder · 4 min",
    );
  });

  it("spenn skrives med tankestrek", () => {
    expect(categorySubline({ visibleCount: 9, totalCount: 17, minMinutes: 4, maxMinutes: 21 })).toBe(
      "9 av 17 synlig · 4–21 min",
    );
  });

  it("uten tidsspenn skrives bare dekningen — ingen modus-ord noe sted", () => {
    const text = categorySubline({ visibleCount: 3, totalCount: 8 });
    expect(text).toBe("3 av 8 synlig");
    // Chipen og kontrollen sier hvilken modus som er valgt; sublinja skal ikke
    // gjenta det, ellers må hver tekst-flate oppdateres ved modusbytte.
    for (const word of ["gange", "gangavstand", "sykkel", "bil"]) {
      expect(text).not.toContain(word);
    }
  });
});
