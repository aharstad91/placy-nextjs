import { describe, it, expect } from "vitest";
import { HEM_PORTFOLIO } from "@/data/portfolios/hem";
import { getPortfolio, listPortfolioSlugs } from "@/lib/portfolio/portfolios";
import { isInsideNorway } from "@/lib/portfolio/types";

describe("kjedefilene", () => {
  const portfolios = listPortfolioSlugs().map((slug) => getPortfolio(slug)!);

  it("har minst én registrert kjede", () => {
    expect(portfolios.length).toBeGreaterThan(0);
  });

  it("legger alle koordinater innenfor Norges bounding-boks", () => {
    // Fanger den vanligste håndskrivingsfeilen: byttet lat/lng. Et punkt med
    // lat 10 / lng 63 faller utenfor boksen og stoppes her, før kamera-
    // innrammingen får se det.
    for (const portfolio of portfolios) {
      for (const p of portfolio.projects) {
        expect(
          isInsideNorway(p.lat, p.lng),
          `${portfolio.slug}/${p.id} har ugyldig koordinat (${p.lat}, ${p.lng})`,
        ).toBe(true);
      }
    }
  });

  it("har unike prosjekt-id-er innenfor hver kjede", () => {
    for (const portfolio of portfolios) {
      const ids = portfolio.projects.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("har komplett board-referanse der en er satt", () => {
    for (const portfolio of portfolios) {
      for (const p of portfolio.projects) {
        if (!p.board) continue;
        expect(p.board.customerId.length).toBeGreaterThan(0);
        expect(p.board.slug.length).toBeGreaterThan(0);
      }
    }
  });

  it("har navn, kjede og utbygger på hvert prosjekt", () => {
    for (const portfolio of portfolios) {
      for (const p of portfolio.projects) {
        expect(p.name.trim().length).toBeGreaterThan(0);
        expect(p.chain.trim().length).toBeGreaterThan(0);
        expect(p.developer.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("registeret", () => {
  it("returnerer HEM for slug hem", () => {
    expect(getPortfolio("hem")).toBe(HEM_PORTFOLIO);
  });

  it("returnerer null for ukjent slug", () => {
    expect(getPortfolio("finnes-ikke")).toBeNull();
  });
});

describe("HEM-lista", () => {
  it("har minst 15 prosjekter", () => {
    expect(HEM_PORTFOLIO.projects.length).toBeGreaterThanOrEqual(15);
  });

  it("har board-referanse på Wesselsløkka og Sundsøya", () => {
    const wesselslokka = HEM_PORTFOLIO.projects.find((p) => p.id === "wesselslokka");
    const sundsoya = HEM_PORTFOLIO.projects.find((p) => p.id === "sundsoya");
    expect(wesselslokka?.board).toEqual({
      customerId: "broset-utvikling-as",
      slug: "wesselslokka",
    });
    expect(sundsoya?.board).toEqual({
      customerId: "placy-demo",
      slug: "sundsoya",
    });
  });

  it("har board-referanse på nøyaktig de to prosjektene", () => {
    const withBoard = HEM_PORTFOLIO.projects.filter((p) => p.board);
    expect(withBoard.map((p) => p.id).sort()).toEqual(["sundsoya", "wesselslokka"]);
  });

  it("inneholder ikke boards som ikke selges av HEM (AE4)", () => {
    // Grilstad Marina og StasjonsKvartalet har boards, men er ikke HEM-prosjekter.
    // Kjede-merkingen er det som holder dem ute — ikke board-eksistens.
    const names = HEM_PORTFOLIO.projects.map((p) => p.name.toLowerCase());
    expect(names.some((n) => n.includes("grilstad"))).toBe(false);
    expect(names.some((n) => n.includes("stasjonskvartal"))).toBe(false);
  });

  it("merker alle prosjektene som HEM", () => {
    for (const p of HEM_PORTFOLIO.projects) {
      expect(p.chain).toBe("HEM");
    }
  });
});
