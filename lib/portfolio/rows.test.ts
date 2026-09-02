import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PortfolioProject, ResolvedPortfolioProject } from "@/lib/portfolio/types";

const resolvePortfolioBoards = vi.fn();
const getPortfolio = vi.fn();

vi.mock("@/lib/portfolio/resolve-boards", () => ({
  resolvePortfolioBoards: (projects: PortfolioProject[]) =>
    resolvePortfolioBoards(projects),
}));

vi.mock("@/lib/portfolio/portfolios", () => ({
  getPortfolio: (slug: string) => getPortfolio(slug),
}));

const {
  buildPortfolioRows,
  buildPortfolioPageData,
  BOARD_LABEL,
  NO_BOARD_LABEL,
} = await import("@/lib/portfolio/rows");

const WESSELSLOKKA: ResolvedPortfolioProject = {
  id: "wesselslokka",
  name: "Wesselsløkka",
  lat: 63.422074,
  lng: 10.450617,
  subtitle: "Trondheim, Brøset",
  chain: "HEM",
  developer: "Brøset Utvikling",
  boardUrl: "/eiendom/broset-utvikling-as/wesselslokka/rapport-board",
};

const BERG_HAGEBY: ResolvedPortfolioProject = {
  id: "berg-hageby",
  name: "Berg Hageby",
  lat: 63.41784,
  lng: 10.427406,
  subtitle: "Trondheim, Berg",
  chain: "HEM",
  developer: "Farga AS",
};

describe("buildPortfolioRows", () => {
  it("gir lenke og åpne-status til prosjekt med board (AE1)", () => {
    const [row] = buildPortfolioRows([WESSELSLOKKA]);
    expect(row.hasBoard).toBe(true);
    expect(row.href).toBe("/eiendom/broset-utvikling-as/wesselslokka/rapport-board");
    expect(row.statusLabel).toBe(BOARD_LABEL);
  });

  it("gir ingen lenke og synlig uten-board-status til resten (AE2)", () => {
    const [row] = buildPortfolioRows([BERG_HAGEBY]);
    expect(row.hasBoard).toBe(false);
    expect(row.href).toBeUndefined();
    expect(row.statusLabel).toBe(NO_BOARD_LABEL);
  });

  it("skiller de to statustekstene fra hverandre", () => {
    expect(BOARD_LABEL).not.toBe(NO_BOARD_LABEL);
  });

  it("beholder kjedefilas rekkefølge", () => {
    const rows = buildPortfolioRows([BERG_HAGEBY, WESSELSLOKKA]);
    expect(rows.map((r) => r.id)).toEqual(["berg-hageby", "wesselslokka"]);
  });

  it("bærer ingen pris og ingen salgstekst (AE7)", () => {
    const [row] = buildPortfolioRows([WESSELSLOKKA]);
    // Visningsmodellen er hele kontrakten mellom data og skjerm. Har den ingen
    // pris-akse, kan ingen rad vise pris.
    expect(Object.keys(row).sort()).toEqual([
      "developer",
      "hasBoard",
      "href",
      "id",
      "name",
      "statusLabel",
      "subtitle",
    ]);
  });
});

describe("buildPortfolioPageData (AE8)", () => {
  beforeEach(() => {
    resolvePortfolioBoards.mockReset();
    getPortfolio.mockReset();
    resolvePortfolioBoards.mockImplementation(async (projects: PortfolioProject[]) =>
      projects.map((p) => ({ ...p })),
    );
  });

  it("gir null for ukjent kjede", async () => {
    getPortfolio.mockReturnValue(null);
    expect(await buildPortfolioPageData("finnes-ikke")).toBeNull();
  });

  it("gir null for registrert kjede uten prosjekter", async () => {
    getPortfolio.mockReturnValue({ slug: "tom", name: "Tom", projects: [] });
    expect(await buildPortfolioPageData("tom")).toBeNull();
  });

  it("gir rader, prosjekter og kamera for en kjede med prosjekter", async () => {
    getPortfolio.mockReturnValue({
      slug: "hem",
      name: "HEM",
      projects: [WESSELSLOKKA, BERG_HAGEBY],
    });
    resolvePortfolioBoards.mockResolvedValue([WESSELSLOKKA, BERG_HAGEBY]);

    const data = (await buildPortfolioPageData("hem"))!;

    expect(data.chainName).toBe("HEM");
    expect(data.rows).toHaveLength(2);
    expect(data.projects).toHaveLength(2);
    expect(data.camera.range).toBeGreaterThan(0);
    expect(data.camera.bounds.north).toBeGreaterThanOrEqual(data.camera.bounds.south);
  });
});
