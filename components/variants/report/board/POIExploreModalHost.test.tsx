import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { BoardState } from "./board-state";

/**
 * Verner de to invariantene som ikke kan uttrykkes i typer:
 *   1. Modalen monteres ÉN gang på boardet — ikke fra kart-komponentene, som er
 *      montert SAMTIDIG ved 3D-addon (to modaler + dobbelttelt Moat 2-event).
 *   2. Mobil åpner modalen på POI-tap, men KUN når POI-en har innhold. Uten
 *      innholds-gatingen ville mobilen blitt dårligere enn i dag på boards uten
 *      grounded innhold.
 */

const h = vi.hoisted(() => ({
  state: {} as BoardState,
  dispatch: vi.fn(),
  poi: null as unknown,
  popupMode: "mini" as "mini" | "sheet",
  emit: vi.fn(),
}));

vi.mock("./board-state", () => ({
  useBoard: () => ({ state: h.state, dispatch: h.dispatch }),
  useActivePOI: () => h.poi,
}));
vi.mock("./use-popup-mode", () => ({
  useBoardPopupMode: () => h.popupMode,
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock("@/lib/utils/map-icons-filled", () => ({
  getFilledIcon: () => () => null,
}));
vi.mock("@/lib/instrumentation/engagement-scope", () => ({
  useEngagement: () => ({ emit: h.emit }),
}));

import { POIExploreModalHost } from "./POIExploreModalHost";

const GROUNDING = {
  poiGroundingVersion: 1 as const,
  generated: {
    provider: "gemini-search-grounding" as const,
    narrative: "Parken ligger langs elva og brukes til uteopphold hele året.",
    sources: [
      {
        title: "Kilde",
        url: "https://inderoy.kommune.no/x",
        redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a",
        domain: "inderoy.kommune.no",
      },
    ],
    searchEntryPointHtml: '<div class="chip">chip</div>',
    searchQueries: [],
    model: "gemini-2.5-flash",
    fetchedAt: "2026-08-12T10:00:00.000Z",
    qualityGate: { passed: true, sourceCount: 1, charCount: 400 },
  },
};

function poiWith(raw: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Muustrøparken",
    coordinates: { lat: 63.87, lng: 11.27 },
    address: "Muustrøa 4, Inderøy",
    categoryId: "park",
    raw: {
      id: "p1",
      name: "Muustrøparken",
      coordinates: { lat: 63.87, lng: 11.27 },
      address: "Muustrøa 4, Inderøy",
      category: { id: "park", name: "Park", icon: "Trees", color: "#2f855a" },
      ...raw,
    },
  };
}

const BASE_STATE: BoardState = {
  phase: "poi",
  activeCategoryId: "park" as BoardState["activeCategoryId"],
  activePOIId: "p1" as BoardState["activePOIId"],
  introPlaying: false,
  exploreOpen: false,
  travelMode: "walk",
  exploreSuppressed: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.state = { ...BASE_STATE };
  h.popupMode = "mini";
  h.poi = poiWith({ grounding: GROUNDING });
});
afterEach(() => cleanup());

describe("desktop (mini)", () => {
  it("modalen er lukket til exploreOpen settes", () => {
    render(<POIExploreModalHost />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exploreOpen åpner modalen", () => {
    h.state = { ...BASE_STATE, exploreOpen: true };
    render(<POIExploreModalHost />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("lukking dispatcher CLOSE_EXPLORE — mini-popupen bak skal bli stående", () => {
    h.state = { ...BASE_STATE, exploreOpen: true };
    render(<POIExploreModalHost />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(h.dispatch).toHaveBeenCalledWith({ type: "CLOSE_EXPLORE" });
  });

  it("exploreOpen på et POI uten innhold åpner ikke modalen", () => {
    h.poi = poiWith();
    h.state = { ...BASE_STATE, exploreOpen: true };
    render(<POIExploreModalHost />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("mobil (sheet)", () => {
  beforeEach(() => {
    h.popupMode = "sheet";
  });

  it("POI-tap åpner modalen direkte, uten mellomliggende popup", () => {
    render(<POIExploreModalHost />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("POI UTEN innhold åpner ingen modal — dagens kart-oppførsel beholdes", () => {
    h.poi = poiWith();
    render(<POIExploreModalHost />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("POI uten grounding men MED Google-fakta gir modal + ekstern-lenke-CTA", () => {
    h.poi = poiWith({ googleRating: 4.4, googleReviewCount: 8 });
    render(<POIExploreModalHost />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    const link = screen.getByText("Se mer på Google").closest("a")!;
    expect(link.getAttribute("href")).toContain("udm=50");
  });

  it("grounded POI får IKKE en ekstra «gå til Google»-knapp — kildene er utveien", () => {
    render(<POIExploreModalHost />);
    expect(screen.queryByText("Se mer på Google")).toBeNull();
  });

  it("lukking dispatcher BACK_TO_DEFAULT så markør-label og kart kommer tilbake", () => {
    render(<POIExploreModalHost />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(h.dispatch).toHaveBeenCalledWith({ type: "BACK_TO_DEFAULT" });
  });

  it("ikke i poi-fase → ingen modal", () => {
    h.state = { ...BASE_STATE, phase: "default", activePOIId: null };
    render(<POIExploreModalHost />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("POI åpnet fra et FAQ-svar gir INGEN modal — kartflyten skal være synlig", () => {
    // En 85vh-modal i samme øyeblikk kameraet begynner å fly dit ville skjult
    // hele grunnen til at stedsnavnet er klikkbart.
    h.state = { ...BASE_STATE, exploreSuppressed: true };
    render(<POIExploreModalHost />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("påfølgende trykk på selve punktet åpner modalen", () => {
    // Markørtrykket dispatcher uten kilde, og reduseren nullstiller flagget.
    h.state = { ...BASE_STATE, exploreSuppressed: false };
    render(<POIExploreModalHost />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("kilde-vakter — én modal-instans", () => {
  const boardDir = join(process.cwd(), "components", "variants", "report", "board");

  it("kart-komponentene rendrer ALDRI modalen (dobbel-mount ved 3D-addon)", () => {
    for (const file of ["BoardMap.tsx", "BoardMap3D.tsx"]) {
      const src = readFileSync(join(boardDir, file), "utf8");
      expect(src, `${file} skal ikke rendre POIExploreModal`).not.toMatch(
        /<POIExploreModal(Host)?\b/,
      );
    }
  });

  it("kun ÉN fil i kodebasen rendrer <POIExploreModalHost", () => {
    const roots = [
      join(process.cwd(), "components"),
      join(process.cwd(), "app"),
    ];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;
        if (/<POIExploreModalHost\b/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    for (const r of roots) walk(r);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/ReportReelsPage\.tsx$/);
  });

  it("TransitDashboardCard sin udm=50-lenke er bevisst URØRT (utenfor scope)", () => {
    const src = readFileSync(
      join(process.cwd(), "components", "variants", "report", "blocks", "TransitDashboardCard.tsx"),
      "utf8",
    );
    expect(src).toContain("udm=50");
  });
});

describe("Moat 2-emit", () => {
  it("emitter poi_explore_opened EN gang med poiId, kategori og has_grounding", () => {
    h.state = { ...BASE_STATE, exploreOpen: true };
    const { rerender } = render(<POIExploreModalHost />);
    rerender(<POIExploreModalHost />);

    expect(h.emit).toHaveBeenCalledTimes(1);
    expect(h.emit).toHaveBeenCalledWith("poi_explore_opened", {
      poiId: "p1",
      payload: { category_id: "park", has_grounding: true },
    });
  });

  it("has_grounding=false nar modalen apnes pa bare Google-fakta", () => {
    h.poi = poiWith({ googleRating: 4.4 });
    h.state = { ...BASE_STATE, exploreOpen: true };
    render(<POIExploreModalHost />);
    expect(h.emit).toHaveBeenCalledWith("poi_explore_opened", {
      poiId: "p1",
      payload: { category_id: "park", has_grounding: false },
    });
  });

  it("emitter ikke nar modalen ikke apnes", () => {
    render(<POIExploreModalHost />);
    expect(h.emit).not.toHaveBeenCalled();
  });

  // ToS: interaksjoner med spesifikke Grounded Results / Search Suggestions skal
  // ALDRI spores. Kildelenkene og chips-blokken far ingen onClick-handler.
  it("kildelenkene har ingen klikk-handler (ToS-forbudt sporing)", () => {
    h.state = { ...BASE_STATE, exploreOpen: true };
    const { baseElement } = render(<POIExploreModalHost />);
    const sourceLink = Array.from(baseElement.querySelectorAll("a")).find((a) =>
      a.getAttribute("href")?.includes("inderoy.kommune.no"),
    );
    expect(sourceLink).toBeTruthy();
    sourceLink!.click();
    expect(h.emit).not.toHaveBeenCalledWith(
      "poi_outbound_clicked",
      expect.anything(),
    );
  });
});
