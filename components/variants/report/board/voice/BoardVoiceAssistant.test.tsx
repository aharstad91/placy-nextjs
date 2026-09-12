import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BoardVoiceAssistant } from "./BoardVoiceAssistant";

const dispatch = vi.fn();
const flyToPoint = vi.fn();
const fitCoordinates = vi.fn();
const begin = vi.fn();
const pause = vi.fn();
const start = vi.fn();
const stop = vi.fn();
const newConversation = vi.fn();
const switchMode = vi.fn(async () => true);
const sendText = vi.fn();
const interrupt = vi.fn();
const toggleMute = vi.fn();

const poi = {
  id: "dora-kaffebar",
  name: "Dora Kaffebar",
  categoryId: "mat",
  coordinates: { lat: 63.44, lng: 10.42 },
  icon: "Coffee",
  color: "#215d48",
  raw: { id: "dora-kaffebar", name: "Dora Kaffebar", category: { id: "cafe", name: "Kafé" } },
};
const category = { id: "mat", label: "Kafé og servering", lead: "", body: "", icon: "Coffee", color: "#215d48", pois: [poi], topRankedPois: [poi] };
const data = {
  projectSlug: "nyhavna-leve",
  demoSnapshotId: "nyhavna-snapshot-v1",
  home: { name: "Nyhavna", address: "Nyhavna", coordinates: { lat: 63.44, lng: 10.42 } },
  categories: [category],
  poisById: new Map([[poi.id, poi.raw]]),
  audioTourEnabled: false,
};

let realtime: Record<string, unknown>;
let capturedOptions: Record<string, unknown> | undefined;

vi.mock("@/components/variants/report/board/board-state", () => ({
  useBoard: () => ({
    data,
    state: { phase: "default", activeCategoryId: null, activePOIId: null, travelMode: "walk" },
    dispatch,
    mapCamera: { flyToPoint, fitCoordinates },
  }),
}));
vi.mock("@/components/variants/report/board/story/story-tour", () => ({
  AREA_STEP: -1,
  useStoryTour: () => ({ stop: null, begin }),
}));
vi.mock("@/lib/stores/audio-tour-store", () => ({ useAudioTourStore: () => pause }));
vi.mock("@/lib/realtime/use-realtime", () => ({
  useRealtime: (options: Record<string, unknown>) => {
    capturedOptions = options;
    return realtime;
  },
}));

function resetRealtime(overrides: Record<string, unknown> = {}) {
  realtime = {
    status: "idle",
    mode: "text",
    messages: [],
    references: [],
    error: null,
    muted: true,
    usage: { model: "", responses: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimatedUsd: 0, complete: true },
    start,
    stop,
    newConversation,
    switchMode,
    sendText,
    interrupt,
    toggleMute,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedOptions = undefined;
  resetRealtime();
});

resetRealtime();

describe("BoardVoiceAssistant", () => {
  it("forklarer temaene og lar brukeren velge tekst eller tale før mikrofonen aktiveres", () => {
    render(<BoardVoiceAssistant />);

    expect(screen.getAllByTestId("start-suggestion")).toHaveLength(3);
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start med tale" }));
    expect(start).toHaveBeenCalledWith({ mode: "voice" });
  });

  it("bytter modus i den samme samtalen og beholder historikken", () => {
    resetRealtime({
      status: "listening",
      mode: "text",
      messages: [{ id: "m1", role: "assistant", text: "Dora Kaffebar ligger ved havna." }],
    });
    render(<BoardVoiceAssistant />);

    expect(screen.getByText("Dora Kaffebar ligger ved havna.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bytt til tale" }));
    expect(switchMode).toHaveBeenCalledWith("voice");
    expect(start).not.toHaveBeenCalled();
  });

  it("åpner strukturerte stedsreferanser i kartet og viser sikre kilder", () => {
    resetRealtime({
      status: "listening",
      references: [{
        id: "reference-1",
        name: "Dora Kaffebar",
        mapPoiId: "dora-kaffebar",
        sources: [
          { id: "source-1", label: "Nyhavna", url: "https://nyhavna.no/dora", checkedAt: "2026-09-10" },
          { id: "source-2", title: "Utrygg", url: "javascript:alert(1)" },
        ],
      }],
    });
    render(<BoardVoiceAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "Vis Dora Kaffebar i kartet" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_POI", id: "dora-kaffebar", source: "voice" });
    expect(flyToPoint).toHaveBeenCalled();
    const source = screen.getByRole("link", { name: "Nyhavna" });
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(/Kontrollert 10\. sep\. 2026/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Utrygg" })).toBeNull();
  });

  it("merker kunnskap uten kartplassering uten å finne opp en stedslenke", () => {
    resetRealtime({ references: [{ id: "future", name: "Planlagt møteplass", mapPoiId: null, sources: [] }] });
    render(<BoardVoiceAssistant />);

    const references = screen.getByLabelText("Steder og kilder");
    expect(within(references).getByText("Planlagt møteplass")).toBeTruthy();
    expect(within(references).getByText("Ikke plassert i kartet")).toBeTruthy();
    expect(within(references).queryByRole("button")).toBeNull();
  });

  it("starter en ren samtale og nullstiller kartet", () => {
    resetRealtime({ status: "error", error: "Tidsgrensen er nådd.", mode: "text" });
    render(<BoardVoiceAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "Ny samtale" }));
    expect(newConversation).toHaveBeenCalledWith({ mode: "text" });
    expect(dispatch).toHaveBeenCalledWith({ type: "RESET_TO_DEFAULT" });
    expect(fitCoordinates).toHaveBeenCalled();
  });

  it("sender bare kartstatus tilbake fra klientverktøyet", () => {
    render(<BoardVoiceAssistant />);
    const executeTool = capturedOptions?.executeTool as (name: string, args: Record<string, unknown>) => unknown;

    expect(executeTool("show_place", { poi_id: "dora-kaffebar" })).toEqual({ ok: true, shown: "Dora Kaffebar", poi_id: "dora-kaffebar" });
    expect(executeTool("show_place", { poi_id: "ukjent" })).toEqual({ error: "Ukjent sted. Finn ID med find_places før du forsøker igjen." });
    expect(capturedOptions).toMatchObject({ serverControlled: true, snapshotId: "nyhavna-snapshot-v1" });
  });
});
