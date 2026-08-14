import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Map3DInstance } from "@/components/map/map-view-3d";

/**
 * Unit 06.2 — invariant-låsende tester for BoardPOI3DMiniPopup:
 *  AC2: per-frame `translate3d` skrives DIREKTE til DOM (ikke setState), og
 *       realtime-koblingen beholdes. Eneste live konsument av projectLatLngToScreen.
 *  AC4: `@ts-nocheck` fjernet (source-guard).
 *  AC3: ÉN live projeksjons-konsument i motoren (source-guard scan).
 */

const h = vi.hoisted(() => ({
  poi: null as unknown,
  dispatch: vi.fn(),
  project: vi.fn(),
  realtime: { loading: false, error: null, lastUpdated: null },
  emit: vi.fn(),
}));
vi.mock("@/lib/instrumentation/engagement-scope", () => ({
  useEngagement: () => ({ emit: h.emit }),
}));

vi.mock("./board-state", () => ({
  useBoard: () => ({ dispatch: h.dispatch }),
  useActivePOI: () => h.poi,
}));
vi.mock("@/components/map/project-latlng-to-screen", () => ({
  projectLatLngToScreen: h.project,
}));
vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: () => h.realtime,
}));
vi.mock("../blocks/POIRealtimeSection", () => ({
  POIRealtimeSection: () => null,
}));
vi.mock("@/lib/utils/map-icons-filled", () => ({
  getFilledIcon: () => () => null,
}));

import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";

const fakeMap = {} as unknown as Map3DInstance;

function makePoi(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Testkafé",
    coordinates: { lat: 63.4, lng: 10.4 },
    address: "Gata 1",
    body: "En fin kafé.",
    raw: {
      id: "p1",
      name: "Testkafé",
      coordinates: { lat: 63.4, lng: 10.4 },
      category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#aa3300" },
    },
    ...overrides,
  };
}

// Kontrollerbar rAF (samme mønster som RevealLayer3D.test).
let rafCbs: FrameRequestCallback[] = [];
let rafCount = 0;
let cancelled: number[] = [];

beforeEach(() => {
  h.project.mockReset();
  h.dispatch.mockReset();
  h.poi = null;
  rafCbs = [];
  rafCount = 0;
  cancelled = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCbs.push(cb);
    return ++rafCount;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled.push(id);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function tick() {
  const cb = rafCbs[rafCbs.length - 1];
  act(() => {
    cb(0);
  });
}

describe("BoardPOI3DMiniPopup — per-frame translate3d direkte til DOM (AC2)", () => {
  it("skriver projeksjonen til wrapper.style.transform (ikke via React-render)", () => {
    h.poi = makePoi();
    h.project.mockReturnValue({ x: 100, y: 200 });
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    const wrapper = container.firstChild as HTMLElement;
    // y-28 = 172; translate(-50%,-100%) forankrer bunn-kant til markørtoppen
    expect(wrapper.style.transform).toContain("translate3d(100px, 172px, 0)");
    expect(wrapper.style.transform).toContain("translate(-50%, -100%)");
    expect(wrapper.style.opacity).toBe("1");
    // projiserer på POI-koordinatene med altitude 18 (matcher Marker3D)
    expect(h.project).toHaveBeenCalledWith(fakeMap, 63.4, 10.4, 18);
  });

  it("re-projiserer HVER rAF-frame (tracking, ikke en engangsskriv)", () => {
    h.poi = makePoi();
    h.project
      .mockReturnValueOnce({ x: 10, y: 30 })
      .mockReturnValueOnce({ x: 50, y: 60 });
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.transform).toContain("translate3d(10px, 2px, 0)");
    tick(); // driv den planlagte rAF-callbacken → ny projeksjon
    expect(h.project).toHaveBeenCalledTimes(2);
    expect(wrapper.style.transform).toContain("translate3d(50px, 32px, 0)");
  });

  it("projeksjon null (bak kamera) → opacity 0, ingen transform-skriv", () => {
    h.poi = makePoi();
    h.project.mockReturnValue(null);
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.opacity).toBe("0");
    expect(wrapper.style.transform).toBe("");
  });

  it("rydder opp rAF ved unmount (cancelAnimationFrame)", () => {
    h.poi = makePoi();
    h.project.mockReturnValue({ x: 0, y: 0 });
    const { unmount } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    expect(rafCount).toBeGreaterThan(0);
    unmount();
    expect(cancelled.length).toBeGreaterThan(0);
  });

  it("returnerer null (ingen DOM) når ingen aktiv POI", () => {
    h.poi = null;
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    expect(container.firstChild).toBeNull();
  });

  it("projiserer ikke når map3d er null (ingen frame planlagt)", () => {
    h.poi = makePoi();
    h.project.mockReturnValue({ x: 0, y: 0 });
    render(<BoardPOI3DMiniPopup map3d={null} />);
    expect(h.project).not.toHaveBeenCalled();
  });
});

describe("BoardPOI3DMiniPopup — source-invarianter (AC3/AC4)", () => {
  const popupPath = join(
    process.cwd(),
    "components/variants/report/board/BoardPOI3DMiniPopup.tsx",
  );
  const popupSrc = readFileSync(popupPath, "utf8");

  it("AC4: ingen @ts-nocheck (typet mot Map3DInstance)", () => {
    expect(popupSrc).not.toContain("@ts-nocheck");
    expect(popupSrc).toContain("map3d: Map3DInstance | null");
  });

  it("AC2: skriver transform direkte til DOM (el.style.transform = translate3d)", () => {
    expect(popupSrc).toContain("el.style.transform");
    expect(popupSrc).toContain("translate3d");
    // bevarer realtime-koblingen (PRD 11-grense)
    expect(popupSrc).toContain("useRealtimeData");
  });

  // Var «ÉN konsument» fram til 2026-08-14. Tids-chipen i 3D
  // (BoardTravelChip3D) er den andre, og den er tilsiktet: den erstattet et
  // SVG-merke inne i en Marker3DInteractiveElement, som ikke kunne bære et
  // utvidbart panel. Vakten står fortsatt — den skal fange en TREDJE konsument,
  // for hver ekstra rAF-løkke mot Google 3D koster frames.
  it("AC3: kun de to tilsiktede konsumentene av projectLatLngToScreen (scan)", () => {
    const roots = ["components", "lib", "app"];
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next") continue;
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          const src = readFileSync(full, "utf8");
          if (
            /import\s*\{[^}]*projectLatLngToScreen[^}]*\}\s*from/.test(src)
          ) {
            importers.push(full);
          }
        }
      }
    };
    for (const r of roots) walk(join(process.cwd(), r));
    const names = importers.map((f) => f.split("/").pop()).sort();
    expect(names).toEqual(["BoardPOI3DMiniPopup.tsx", "BoardTravelChip3D.tsx"]);
  });
});

/**
 * Utforsk-CTA-en må oppføre seg IDENTISK på 3D-flaten som på 2D-flaten.
 * Historisk har de to kart-popupene driftet fra hverandre (poi_clicked emittes
 * f.eks. bare fra 3D) — denne testen låser paritet for CTA-en.
 */
describe("BoardPOI3DMiniPopup — Utforsk-CTA (paritet med 2D)", () => {
  const PASSING_GROUNDING = {
    poiGroundingVersion: 1 as const,
    generated: {
      provider: "gemini-search-grounding" as const,
      narrative: "n".repeat(400),
      sources: [],
      searchEntryPointHtml: "<div>chip</div>",
      searchQueries: [],
      model: "gemini-2.5-flash",
      fetchedAt: "2026-08-12T10:00:00.000Z",
      qualityGate: { passed: true, sourceCount: 3, charCount: 400 },
    },
  };

  beforeEach(() => {
    h.project.mockReturnValue({ x: 100, y: 200 });
  });

  it("POI med innhold → knapp som dispatcher OPEN_EXPLORE", () => {
    h.poi = makePoi({
      raw: {
        id: "p1",
        name: "Testkafé",
        coordinates: { lat: 63.4, lng: 10.4 },
        category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#aa3300" },
        grounding: PASSING_GROUNDING,
      },
    });
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Utforsk"),
    );
    expect(button).toBeTruthy();
    button!.click();
    expect(h.dispatch).toHaveBeenCalledWith({ type: "OPEN_EXPLORE" });
  });

  it("POI uten innhold → ekstern lenke med udm=50 bevart", () => {
    h.poi = makePoi();
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    const link = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Utforsk"),
    );
    expect(link).toBeTruthy();
    expect(link!.getAttribute("href")).toContain("udm=50");
    expect(link!.getAttribute("rel")).toContain("noopener");
  });
});

describe("BoardPOI3DMiniPopup — Moat 2-paritet med 2D", () => {
  it("ekstern lenke emitter poi_outbound_clicked ogsa fra 3D-flaten", () => {
    h.project.mockReturnValue({ x: 100, y: 200 });
    h.poi = makePoi({ categoryId: "cafe" });
    const { container } = render(<BoardPOI3DMiniPopup map3d={fakeMap} />);
    const link = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Utforsk"),
    )!;
    link.click();
    expect(h.emit).toHaveBeenCalledWith("poi_outbound_clicked", {
      poiId: "p1",
      payload: { category_id: "cafe" },
    });
  });
});
