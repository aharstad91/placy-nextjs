import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  REPORT_THEME_DEFAULTS,
  NAERING_THEME_DEFAULTS,
  getThemeDefaults,
  getDiscoveryRadius,
  BOLIG_DISCOVERY_RADIUS_M,
} from "./report-defaults";
import { GOOGLE_CATEGORY_MAP, TRANSPORT_CATEGORIES } from "./poi-discovery";
import { PUBLIC_POI_CATEGORIES } from "./import-public-pois";
import {
  BOLIG_GOOGLE_CATEGORIES,
  NAERING_GOOGLE_CATEGORIES,
} from "./enrich-report-pois";

/**
 * Tema↔kategori-DRIFTVERN (bug-klassen fra cutover-funnet 2026-07-06).
 *
 * Boardet grupperer POI-er UTELUKKENDE via theme.categories
 * (board-data.ts bygger kategorilisten fra report.themes — en POI hvis
 * category_id ikke finnes i noe temas categories-liste rendres ALDRI).
 * Kategori-id-ene produseres av pipelinen (GOOGLE_CATEGORY_MAP,
 * PUBLIC_POI_CATEGORIES, natur-linking, transport) og tema-listene bor i
 * report-defaults.ts. Kommentaren i report-defaults sier slugene er
 * «verifisert mot GOOGLE_CATEGORY_MAP» — manuelt. Disse testene gjør
 * verifiseringen maskinell: renames/tillegg på én side uten den andre
 * feiler her i stedet for å stille tømme et tema på boardet.
 */

// Speiler linkNaturPois i import-public-pois.ts (modul-intern literal, kan
// ikke importeres). Kilde-drift fanges av den statiske sjekken nedenfor.
const NATUR_LINK_CATEGORIES = ["lekeplass", "badeplass", "park", "outdoor"];

/** Kategori-id-er bolig-pipelinen kan produsere (alle kilder). */
function boligProducibleCategoryIds(): string[] {
  return [
    ...BOLIG_GOOGLE_CATEGORIES.map((c) => GOOGLE_CATEGORY_MAP[c].id),
    ...PUBLIC_POI_CATEGORIES.map((c) => c.id),
    ...NATUR_LINK_CATEGORIES,
    ...Object.values(TRANSPORT_CATEGORIES).map((c) => c.id),
  ];
}

/** Kategori-id-er nærings-pipelinen kan produsere (offentlige kilder + natur skippes for næring, provision.ts steg 3). */
function naeringProducibleCategoryIds(): string[] {
  return [
    ...NAERING_GOOGLE_CATEGORIES.map((c) => GOOGLE_CATEGORY_MAP[c].id),
    ...Object.values(TRANSPORT_CATEGORIES).map((c) => c.id),
  ];
}

function themeCategoryUnion(themes: { categories: string[] }[]): Set<string> {
  return new Set(themes.flatMap((t) => t.categories));
}

describe("tema↔kategori-kontrakt (driftvern)", () => {
  it("alle Google-kategorier i profil-listene finnes i GOOGLE_CATEGORY_MAP (ellers fallback-kategori uten tema)", () => {
    for (const cat of [...BOLIG_GOOGLE_CATEGORIES, ...NAERING_GOOGLE_CATEGORIES]) {
      expect(GOOGLE_CATEGORY_MAP[cat], `'${cat}' mangler i GOOGLE_CATEGORY_MAP`).toBeDefined();
    }
  });

  it("bolig: produserbare kategorier uten tema-hjem er NØYAKTIG de tre kjente (museum/library/cinema — rapportert funn)", () => {
    // KJENT GJELD (rapportert til Andreas, ikke fikset her): bolig-discovery
    // bestiller museum/library/movie_theater, men ingen bolig-temaer inkluderer
    // id-ene museum/library/cinema → POI-ene importeres (koster Places-kvote),
    // lagres og linkes, men rendres aldri på bolig-board. Testen låser at
    // gjelden ikke VOKSER: en ny kategori uten tema-hjem feiler her, og en
    // beslutning om de tre kjente (tema-hjem eller ut av discovery-lista)
    // krever bevisst oppdatering av lista under.
    const union = themeCategoryUnion(REPORT_THEME_DEFAULTS);
    const orphans = [...new Set(boligProducibleCategoryIds())]
      .filter((id) => !union.has(id))
      .sort();
    // hotel kom inn i BOLIG_GOOGLE_CATEGORIES i recall-fiksen 2026-08-12 som
    // BEVISST datalag-kategori uten bolig-tema («svigermor-spørsmålet» — POI-en
    // skal finnes i poolen/søk, men har ikke pin-plass på bolig-boardet ennå).
    expect(orphans).toEqual(["cinema", "hotel", "library", "museum"]);
  });

  it("næring: ALLE produserbare kategorier har tema-hjem (0 orphans)", () => {
    const union = themeCategoryUnion(NAERING_THEME_DEFAULTS);
    const orphans = [...new Set(naeringProducibleCategoryIds())]
      .filter((id) => !union.has(id))
      .sort();
    expect(orphans).toEqual([]);
  });

  it("Google-type→kategori-id-avvikene er pinnet (rename her uten tema-oppdatering = stille tema-tømming)", () => {
    // Disse fire divergerer mellom Google Places-typen og Placy-kategori-id-en.
    // Temaene refererer ID-EN — endres mappingen, mister temaet POI-ene stille.
    expect(GOOGLE_CATEGORY_MAP.post_office.id).toBe("post");
    expect(GOOGLE_CATEGORY_MAP.shopping_mall.id).toBe("shopping");
    expect(GOOGLE_CATEGORY_MAP.movie_theater.id).toBe("cinema");
    expect(GOOGLE_CATEGORY_MAP.hair_care.id).toBe("haircare");
  });

  it("skole/barnehage/idrett ligger i Barn & Oppvekst-temaet (original-bugen)", () => {
    const barnOppvekst = REPORT_THEME_DEFAULTS.find((t) => t.id === "barn-oppvekst");
    expect(barnOppvekst).toBeDefined();
    for (const id of ["skole", "barnehage", "idrett"]) {
      expect(barnOppvekst!.categories).toContain(id);
    }
  });

  it("ALLE kategorier den offentlige pipelinen kan skrive rendres i et tema", () => {
    // Generaliseringen av testen over: fra 2026-08-24 arver
    // PUBLIC_POI_CATEGORIES Overpass-hvitelisten fra osm-gate, og de nye
    // kategoriene hører hjemme i andre temaer enn Barn & Oppvekst (badeplass/
    // marina/park/outdoor → Natur & Friluftsliv, swimming → Trening). Kravet
    // er derfor «et tema», ikke «dette temaet» — en kategori uten tema havner
    // i poolen uten å vises noe sted.
    const union = themeCategoryUnion(REPORT_THEME_DEFAULTS);
    const orphans = PUBLIC_POI_CATEGORIES.map((c) => c.id)
      .filter((id) => !union.has(id))
      .sort();
    expect(orphans).toEqual([]);
  });

  it("statisk: NATUR_LINK_CATEGORIES-speilet matcher literalen i import-public-pois.ts", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "import-public-pois.ts"),
      "utf8"
    );
    expect(src).toContain(`["lekeplass", "badeplass", "park", "outdoor"]`);
  });

  it("natur-linkede kategorier har tema-hjem i bolig-temaene", () => {
    const union = themeCategoryUnion(REPORT_THEME_DEFAULTS);
    for (const cat of NATUR_LINK_CATEGORIES) {
      expect(union.has(cat), `natur-kategori '${cat}' mangler tema-hjem`).toBe(true);
    }
  });
});

describe("getThemeDefaults", () => {
  it("bolig (default) → REPORT_THEME_DEFAULTS, næring → NAERING_THEME_DEFAULTS", () => {
    expect(getThemeDefaults()).toBe(REPORT_THEME_DEFAULTS);
    expect(getThemeDefaults("bolig")).toBe(REPORT_THEME_DEFAULTS);
    expect(getThemeDefaults("naering")).toBe(NAERING_THEME_DEFAULTS);
  });

  it("alle temaer i begge profiler har unike id-er og minst én kategori", () => {
    for (const themes of [REPORT_THEME_DEFAULTS, NAERING_THEME_DEFAULTS]) {
      const ids = themes.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const t of themes) {
        expect(t.categories.length, `tema '${t.id}' har tom kategoriliste`).toBeGreaterThan(0);
      }
    }
  });
});

describe("getDiscoveryRadius", () => {
  it("bolig er BY-UAVHENGIG — å kjenne byen skal ikke krympe nabolaget", () => {
    expect(getDiscoveryRadius("Trondheim")).toBe(BOLIG_DISCOVERY_RADIUS_M);
    expect(getDiscoveryRadius("TRONDHEIM")).toBe(BOLIG_DISCOVERY_RADIUS_M);
    expect(getDiscoveryRadius("Oslo")).toBe(BOLIG_DISCOVERY_RADIUS_M);
    expect(getDiscoveryRadius("Snåsa")).toBe(BOLIG_DISCOVERY_RADIUS_M);
    expect(getDiscoveryRadius(undefined)).toBe(BOLIG_DISCOVERY_RADIUS_M);
  });

  it("bolig-radiusen er 3000 m", () => {
    expect(BOLIG_DISCOVERY_RADIUS_M).toBe(3000);
  });

  it("næring beholder per-by-tabellen (eget premiss, ikke berørt)", () => {
    expect(getDiscoveryRadius("Trondheim", "naering")).toBe(1500);
    expect(getDiscoveryRadius("Oslo", "naering")).toBe(1200);
    expect(getDiscoveryRadius("Snåsa", "naering")).toBe(1500);
    expect(getDiscoveryRadius(undefined, "naering")).toBe(1500);
  });
});
