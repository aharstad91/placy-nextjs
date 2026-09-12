import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BoligFixture, Block, VoiceSession } from "@/lib/prototype/bolig/contract";
import BoligShell from "@/components/prototype/bolig/BoligShell";

// Mobilskallet importerer MiniMap/FullscreenMap, som begge laster
// react-map-gl/mapbox. Ingen av testene under rendrer et "places"-kort, men
// modulgrafen evalueres uansett ved import, så Mapbox mockes ut her.
vi.mock("react-map-gl/mapbox", () => {
  const Stub = () => null;
  return { __esModule: true, default: Stub, Map: Stub, Marker: Stub, NavigationControl: Stub };
});

const FIXTURE: BoligFixture = {
  version: 1,
  house: {
    id: "house-test",
    title: "Enebolig på Ranheim",
    addressLabel: "Eksempelvegen 12 · fiktiv eksempelbolig",
    provenance: "example",
    lat: 63.4318,
    lng: 10.5165,
    intro: "En enebolig i et etablert boligfelt.",
    facts: [],
  },
  topics: [],
  places: [],
  seller: [],
  unknowns: [],
  sources: [],
};

function buildSession(overrides: Partial<VoiceSession>): VoiceSession {
  return {
    status: "idle",
    blocks: [],
    error: null,
    notice: null,
    muted: false,
    activeTopic: null,
    selectedPlaceId: null,
    simulated: true,
    usage: null,
    start: vi.fn(),
    stop: vi.fn(),
    interrupt: vi.fn(),
    toggleMute: vi.fn(),
    tapCategory: vi.fn(),
    selectPlace: vi.fn(),
    clearSelection: vi.fn(),
    ...overrides,
  };
}

describe("BoligShell", () => {
  it("viser startknappen i ankomst-tilstand (idle, ingen blokker)", () => {
    render(<BoligShell session={buildSession({})} fixture={FIXTURE} />);
    expect(screen.getByRole("button", { name: "Snakk om nabolaget" })).toBeInTheDocument();
  });

  it("rendrer bruker- og svarblokker i samtalefeeden", () => {
    const blocks: Block[] = [
      { id: "b-user", turn: 1, kind: "user", text: "Hva finnes av dagligvare i nærheten?" },
      { id: "b-answer", turn: 1, kind: "answer", text: "Nærmeste Rema er sju minutter å gå.", done: true },
    ];
    render(<BoligShell session={buildSession({ status: "idle", blocks })} fixture={FIXTURE} />);
    expect(screen.getByText("Hva finnes av dagligvare i nærheten?")).toBeInTheDocument();
    expect(screen.getByText("Nærmeste Rema er sju minutter å gå.")).toBeInTheDocument();
  });
});
