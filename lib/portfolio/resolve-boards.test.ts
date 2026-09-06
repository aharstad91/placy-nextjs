import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PortfolioProject } from "@/lib/portfolio/types";

const createServerClient = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: () => createServerClient(),
}));

const { resolvePortfolioBoards, portfolioBoardUrl } = await import(
  "@/lib/portfolio/resolve-boards"
);

/** Minimal stand-in for `supabase.schema("v2").from("projects").select(...)`. */
function supabaseReturning(result: {
  data?: { id: string; customer_id: string; url_slug: string }[];
  error?: { message: string };
}) {
  return {
    schema: () => ({
      from: () => ({
        select: async () => result,
      }),
    }),
  };
}

const WESSELSLOKKA: PortfolioProject = {
  id: "wesselslokka",
  name: "Wesselsløkka",
  lat: 63.422074,
  lng: 10.450617,
  chain: "HEM",
  developer: "Brøset Utvikling",
  board: { customerId: "broset-utvikling-as", slug: "wesselslokka" },
};

const SUNDSOYA: PortfolioProject = {
  id: "sundsoya",
  name: "Sundsøya",
  lat: 63.865218,
  lng: 11.303152,
  chain: "HEM",
  developer: "ukjent",
  board: { customerId: "placy-demo", slug: "sundsoya" },
};

const BERG_HAGEBY: PortfolioProject = {
  id: "berg-hageby",
  name: "Berg Hageby",
  lat: 63.41784,
  lng: 10.427406,
  chain: "HEM",
  developer: "Farga AS",
};

const ROWS = [
  { id: "1", customer_id: "broset-utvikling-as", url_slug: "wesselslokka" },
  { id: "2", customer_id: "placy-demo", url_slug: "sundsoya" },
  { id: "3", customer_id: "placy-demo", url_slug: "byggetrinn-4" },
];

describe("resolvePortfolioBoards", () => {
  beforeEach(() => {
    createServerClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gir boardUrl til prosjektene som har en rad (AE1, AE5)", async () => {
    createServerClient.mockReturnValue(supabaseReturning({ data: ROWS }));

    const [w, s] = await resolvePortfolioBoards([WESSELSLOKKA, SUNDSOYA]);

    expect(w.boardUrl).toBe("/eiendom/broset-utvikling-as/wesselslokka/rapport-board");
    // Sundsøya-boardet er registrert på kunden placy-demo, men prosjektet er
    // merket HEM. Kjede-merkingen og kunde-id-en er to ulike akser (AE5).
    expect(s.boardUrl).toBe("/eiendom/placy-demo/sundsoya/rapport-board");
  });

  it("lar prosjekt uten board-referanse stå uten lenke (AE2)", async () => {
    createServerClient.mockReturnValue(supabaseReturning({ data: ROWS }));

    const [berg] = await resolvePortfolioBoards([BERG_HAGEBY]);

    expect(berg.boardUrl).toBeUndefined();
  });

  it("gir ingen lenke når board-referansen ikke finnes i tabellen", async () => {
    createServerClient.mockReturnValue(supabaseReturning({ data: ROWS }));

    const [ghost] = await resolvePortfolioBoards([
      { ...WESSELSLOKKA, board: { customerId: "broset-utvikling-as", slug: "skrivefeil" } },
    ]);

    expect(ghost.boardUrl).toBeUndefined();
  });

  it("krysser ikke kunde og slug fra ulike rader", async () => {
    createServerClient.mockReturnValue(supabaseReturning({ data: ROWS }));

    const [mismatch] = await resolvePortfolioBoards([
      { ...WESSELSLOKKA, board: { customerId: "placy-demo", slug: "wesselslokka" } },
    ]);

    expect(mismatch.boardUrl).toBeUndefined();
  });

  it("gir alle prosjekter uten lenke og logger når Supabase svarer med feil", async () => {
    createServerClient.mockReturnValue(
      supabaseReturning({ error: { message: "boom" } }),
    );

    const resolved = await resolvePortfolioBoards([WESSELSLOKKA, BERG_HAGEBY]);

    expect(resolved.every((p) => p.boardUrl === undefined)).toBe(true);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("krasjer ikke når klienten mangler config", async () => {
    createServerClient.mockImplementation(() => {
      throw new Error("mangler service-role");
    });

    const resolved = await resolvePortfolioBoards([WESSELSLOKKA]);

    expect(resolved[0].boardUrl).toBeUndefined();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("spør ikke databasen når ingen prosjekter har board-referanse", async () => {
    const resolved = await resolvePortfolioBoards([BERG_HAGEBY]);

    expect(createServerClient).not.toHaveBeenCalled();
    expect(resolved[0].boardUrl).toBeUndefined();
  });
});

describe("portfolioBoardUrl", () => {
  it("legger rapport-board-suffikset på eiendom-URL-en", () => {
    expect(portfolioBoardUrl("placy-demo", "sundsoya")).toBe(
      "/eiendom/placy-demo/sundsoya/rapport-board",
    );
  });
});
