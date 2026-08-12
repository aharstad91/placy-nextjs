import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * PRD 9 Unit 4 AC5 — no-photo-fallback-invarianten for Mapbox-2D-popupen.
 *
 * Foto er DEFERRED (INDEX note #9 / PRD 4). Popupen MÅ rendre kategorifarge +
 * ikon (ikke et broken image, ikke en crash) når POI-en mangler foto — og
 * `BoardPOI` bærer ikke noe `featured_image`-felt, så skallet skal aldri anta
 * at et bilde finnes. Disse testene låser den invarianten (tsc/lint fanger den
 * ikke) + AC4 (ingen `<img>` i board-UI-popupen).
 */

const h = vi.hoisted(() => ({
  poi: null as unknown,
  dispatch: vi.fn(),
  realtime: { loading: false, error: null, lastUpdated: null },
}));

// react-map-gl/mapbox Popup portaler normalt til kartet — mock til en enkel
// wrapper så children rendres i jsdom-treet.
vi.mock("react-map-gl/mapbox", () => ({
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
}));
vi.mock("./board-state", () => ({
  useBoard: () => ({ dispatch: h.dispatch }),
  useActivePOI: () => h.poi,
}));
vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: () => h.realtime,
}));
vi.mock("../blocks/POIRealtimeSection", () => ({
  POIRealtimeSection: () => null,
}));
vi.mock("@/lib/utils/map-icons-filled", () => ({
  // Returner et identifiserbart ikon-element så vi kan bevise at ikon-laget
  // (ikke et foto) er fallback-identiteten.
  getFilledIcon: () => () => <svg data-testid="category-icon" />,
}));

import { BoardPOIMiniPopup } from "./BoardPOIMiniPopup";

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

beforeEach(() => {
  h.dispatch.mockReset();
  h.poi = null;
});
afterEach(() => cleanup());

describe("BoardPOIMiniPopup — no-photo-fallback (AC5)", () => {
  it("rendrer kategorifarge + ikon (ingen foto) for en POI uten bilde", () => {
    h.poi = makePoi();
    const { getByTestId, getByText } = render(<BoardPOIMiniPopup />);
    // Ikon-laget er identiteten — ikke et foto.
    expect(getByTestId("category-icon")).toBeTruthy();
    expect(getByText("Testkafé")).toBeTruthy();
  });

  it("aldri en <img>-tag (next/image / foto rendres ikke i board-popupen, AC4)", () => {
    h.poi = makePoi();
    const { container } = render(<BoardPOIMiniPopup />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("krasjer ikke når POI har verken body, adresse eller foto-felt", () => {
    // BoardPOI har ikke noe featured_image-felt — skallet antar aldri et bilde.
    h.poi = makePoi({ address: undefined, body: undefined });
    const { getByText, container } = render(<BoardPOIMiniPopup />);
    expect(getByText("Testkafé")).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("returnerer null (ingen DOM) når ingen aktiv POI", () => {
    h.poi = null;
    const { queryByTestId } = render(<BoardPOIMiniPopup />);
    expect(queryByTestId("popup")).toBeNull();
  });
});

/**
 * Utforsk-CTA-en: modal i Placy når POI-et har innhold, ekstern lenke ellers.
 * Det visuelle skillet (sparkles vs. ekstern-lenke-ikon) er et bevisst signal om
 * at klikket forlater siden — beslutning 2026-08-12.
 */
describe("BoardPOIMiniPopup — Utforsk-CTA", () => {
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

  it("POI med bestått grounding → knapp som dispatcher OPEN_EXPLORE, ingen navigasjon", () => {
    h.poi = makePoi({
      raw: {
        id: "p1",
        name: "Testkafé",
        coordinates: { lat: 63.4, lng: 10.4 },
        category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#aa3300" },
        grounding: PASSING_GROUNDING,
      },
    });
    const { getByText } = render(<BoardPOIMiniPopup />);
    const cta = getByText("Utforsk").closest("button");
    expect(cta).toBeTruthy();
    expect(getByText("Utforsk").closest("a")).toBeNull();
    cta!.click();
    expect(h.dispatch).toHaveBeenCalledWith({ type: "OPEN_EXPLORE" });
  });

  it("POI med kun Google-fakta (ingen grounding) → også modal", () => {
    h.poi = makePoi({
      raw: {
        id: "p1",
        name: "Testkafé",
        coordinates: { lat: 63.4, lng: 10.4 },
        category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#aa3300" },
        googleRating: 4.4,
      },
    });
    const { getByText } = render(<BoardPOIMiniPopup />);
    expect(getByText("Utforsk").closest("button")).toBeTruthy();
  });

  it("POI uten innhold → ekstern lenke med target=_blank og noopener bevart", () => {
    h.poi = makePoi();
    const { getByText } = render(<BoardPOIMiniPopup />);
    const link = getByText("Utforsk").closest("a")!;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toContain("udm=50");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("strykende grounding behandles som ingen innhold → ekstern lenke", () => {
    h.poi = makePoi({
      raw: {
        id: "p1",
        name: "Testkafé",
        coordinates: { lat: 63.4, lng: 10.4 },
        category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#aa3300" },
        grounding: {
          ...PASSING_GROUNDING,
          generated: {
            ...PASSING_GROUNDING.generated,
            qualityGate: { passed: false, sourceCount: 1, charCount: 90, reason: "for få kilder" },
          },
        },
      },
    });
    const { getByText } = render(<BoardPOIMiniPopup />);
    expect(getByText("Utforsk").closest("a")).toBeTruthy();
  });
});
