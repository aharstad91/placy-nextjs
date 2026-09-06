import { describe, it, expect } from "vitest";
import {
  buildPortfolioPins,
  selectMapEngine,
  OVERVIEW_PIN_SCALE,
} from "@/components/portfolio/portfolio-pins";
import type { ResolvedPortfolioProject } from "@/lib/portfolio/types";

const base = {
  chain: "HEM",
  developer: "ukjent",
} as const;

const WESSELSLOKKA: ResolvedPortfolioProject = {
  ...base,
  id: "wesselslokka",
  name: "Wesselsløkka",
  lat: 63.422074,
  lng: 10.450617,
  subtitle: "Trondheim, Brøset",
  boardUrl: "/eiendom/broset-utvikling-as/wesselslokka/rapport-board",
};

const BERG_HAGEBY: ResolvedPortfolioProject = {
  ...base,
  id: "berg-hageby",
  name: "Berg Hageby",
  lat: 63.41784,
  lng: 10.427406,
  subtitle: "Trondheim, Berg",
};

// Under 2 km fra hverandre (AE11).
const MELHUSTORGET: ResolvedPortfolioProject = {
  ...base,
  id: "melhustorget",
  name: "Melhustorget",
  lat: 63.28665,
  lng: 10.27878,
  subtitle: "Melhus sentrum",
};

const SOLLIA: ResolvedPortfolioProject = {
  ...base,
  id: "sollia-melhus-vest",
  name: "Sollia - Melhus Vest",
  lat: 63.275654,
  lng: 10.251293,
  subtitle: "Melhus vest",
};

describe("buildPortfolioPins", () => {
  it("skiller prosjekt med board fra prosjekt uten", () => {
    const [w, b] = buildPortfolioPins([WESSELSLOKKA, BERG_HAGEBY]);
    expect(w.tone).toBe("board");
    expect(b.tone).toBe("muted");
  });

  it("gir valgt-tilstand til nøyaktig én chip (AE9)", () => {
    const pins = buildPortfolioPins([WESSELSLOKKA, BERG_HAGEBY, MELHUSTORGET], {
      selectedId: "berg-hageby",
    });
    expect(pins.filter((p) => p.selected).map((p) => p.id)).toEqual(["berg-hageby"]);
  });

  it("viser ingen navn når ingenting er valgt eller hovret", () => {
    const pins = buildPortfolioPins([WESSELSLOKKA, BERG_HAGEBY, MELHUSTORGET]);
    expect(pins.every((p) => p.showName === false)).toBe(true);
  });

  it("viser navn bare på valgt og hovret chip", () => {
    const pins = buildPortfolioPins([WESSELSLOKKA, BERG_HAGEBY, MELHUSTORGET], {
      selectedId: "wesselslokka",
      hoveredId: "melhustorget",
    });
    const named = pins.filter((p) => p.showName).map((p) => p.id).sort();
    expect(named).toEqual(["melhustorget", "wesselslokka"]);
  });

  it("gir to separate chips for prosjekter under 2 km fra hverandre (AE11)", () => {
    const pins = buildPortfolioPins([MELHUSTORGET, SOLLIA]);
    expect(pins).toHaveLength(2);
    expect(pins[0].lat).not.toBe(pins[1].lat);
    expect(pins[0].lng).not.toBe(pins[1].lng);
    expect(pins.every((p) => p.showName === false)).toBe(true);
  });

  it("tegner chips i redusert størrelse på oversikten", () => {
    const pins = buildPortfolioPins([WESSELSLOKKA]);
    expect(pins[0].scale).toBe(OVERVIEW_PIN_SCALE);
    expect(OVERVIEW_PIN_SCALE).toBeLessThan(1);
    // Teksten skal IKKE krympe i takt med disc-en — da hadde navnet på den
    // valgte chip-en blitt uleselig.
    expect(pins[0].labelScale).toBeGreaterThan(OVERVIEW_PIN_SCALE);
  });

  it("faller aldri tilbake til chip-ens hardkodede undertittel", () => {
    const pins = buildPortfolioPins([{ ...BERG_HAGEBY, subtitle: undefined }]);
    expect(pins[0].subtitle).toBe("HEM");
    expect(pins[0].subtitle).not.toBe("Nybygg 2028");
  });

  it("beholder rekkefølgen fra kjedefila", () => {
    const pins = buildPortfolioPins([SOLLIA, WESSELSLOKKA, BERG_HAGEBY]);
    expect(pins.map((p) => p.id)).toEqual([
      "sollia-melhus-vest",
      "wesselslokka",
      "berg-hageby",
    ]);
  });
});

describe("selectMapEngine (AE10)", () => {
  it("velger 3D når WebGL finnes", () => {
    expect(selectMapEngine(true)).toBe("3d");
  });

  it("velger 2D-reserven uten WebGL", () => {
    expect(selectMapEngine(false)).toBe("2d");
  });
});
