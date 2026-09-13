import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BoardVoiceControl } from "@/components/variants/report/board/voice/BoardVoiceControl";
import { BoardVoiceProvider } from "@/components/variants/report/board/voice/board-voice";
import { NYHAVNA_GREETING_INSTRUCTION } from "@/lib/realtime/nyhavna-greeting";

const mount = () => render(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>);

const dispatch = vi.fn();
const flyToPoint = vi.fn();
const fitCoordinates = vi.fn();
const begin = vi.fn();
const pause = vi.fn();
const start = vi.fn();
const stop = vi.fn();
const sendContext = vi.fn();
const sendText = vi.fn();
const replaceMicrophoneTrack = vi.fn();

const poi = {
  id: "dora-kaffebar",
  name: "Dora Kaffebar",
  categoryId: "mat",
  coordinates: { lat: 63.44, lng: 10.42 },
  icon: "Coffee",
  color: "#215d48",
  raw: { id: "dora-kaffebar", name: "Dora Kaffebar", category: { id: "cafe", name: "Kafé" } },
};
const brew = { ...poi, id: "monkey-brew", name: "Monkey Brew", raw: { ...poi.raw, id: "monkey-brew", name: "Monkey Brew" } };
const category = { id: "mat", label: "Kafé og servering", lead: "", body: "", icon: "Coffee", color: "#215d48", pois: [poi, brew], topRankedPois: [poi, brew] };
const data = {
  projectSlug: "nyhavna",
  demoSnapshotId: "nyhavna-snapshot-v1",
  home: { name: "Nyhavna", address: "Nyhavna", coordinates: { lat: 63.44, lng: 10.42 } },
  categories: [category],
  poisById: new Map([[poi.id, poi.raw], [brew.id, brew.raw]]),
  audioTourEnabled: false,
};

let boardState: Record<string, unknown> = {};
let storyStop: typeof category | null = null;
let live: Record<string, unknown>;
let capturedOptions: Record<string, unknown> | undefined;

vi.mock("@/components/variants/report/board/board-state", () => ({
  useBoard: () => ({
    data,
    state: { phase: "default", activeCategoryId: null, activePOIId: null, travelMode: "walk", highlightedPoiIds: [], ...boardState },
    dispatch,
    mapCamera: { flyToPoint, fitCoordinates },
  }),
}));
vi.mock("@/components/variants/report/board/story/story-tour", () => ({
  AREA_STEP: -1,
  useStoryTour: () => ({ stop: storyStop, begin }),
}));
vi.mock("@/lib/stores/audio-tour-store", () => ({ useAudioTourStore: () => pause }));
vi.mock("@/lib/live/use-live", () => ({
  useLive: (options: Record<string, unknown>) => {
    capturedOptions = options;
    return live;
  },
}));

function resetLive(overrides: Record<string, unknown> = {}) {
  const messages = (overrides.messages as Array<{ role: string; text: string }> | undefined) ?? [];
  live = {
    status: "idle", messages, error: null, notice: null,
    latest: messages.filter(message => message.role === "assistant").at(-1)?.text ?? null,
    usage: { voiceSeconds: 0, estimatedUsd: 0 },
    start, stop, sendContext, sendText, replaceMicrophoneTrack, ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedOptions = undefined;
  boardState = {};
  storyStop = null;
  resetLive();
});

resetLive();

describe("BoardVoiceControl", () => {
  it("er én knapp som starter tale med den navnløse hilsenen, og tømmer fremhevingen ved ny samtale", () => {
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Snakk med Placy om nabolaget");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start samtale med Placy" }));
    expect(pause).toHaveBeenCalledWith("manual");
    expect(dispatch).toHaveBeenCalledWith({ type: "END_INTRO" });
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_HIGHLIGHTS" });
    expect(start).toHaveBeenCalledOnce();
    expect(capturedOptions).toMatchObject({ snapshotId: "nyhavna-snapshot-v1", greeting: NYHAVNA_GREETING_INSTRUCTION });
    expect(String(capturedOptions?.greeting)).not.toMatch(/Placy/);
  });

  it("viser stopp og guidens siste setning mens samtalen går, og stopper og rydder kartet på trykk", () => {
    resetLive({ status: "speaking", messages: [{ id: "u1", role: "user", text: "Hvor handler jeg?" }, { id: "a1", role: "assistant", text: "REMA 1000 Solsiden er nærmest, seks minutter til fots." }] });
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Placy svarer");
    expect(screen.getByTestId("board-voice-latest")).toHaveTextContent("REMA 1000 Solsiden er nærmest");
    fireEvent.click(screen.getByRole("button", { name: "Stopp samtalen med Placy" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_HIGHLIGHTS" });
    expect(start).not.toHaveBeenCalled();
  });

  it("avbryter ikke guiden ved kartklikk – Live stopper selv når brukeren snakker", () => {
    resetLive({ status: "listening" });
    mount();
    sendContext.mockClear();
    fireEvent.click(document.body);
    expect(sendContext).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it("viser feilen i stedet for siste setning, og lar knappen starte på nytt", () => {
    resetLive({ status: "error", error: "Forbindelsen ble brutt.", messages: [{ id: "a1", role: "assistant", text: "Hei!" }] });
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Forbindelsen ble brutt.");
    expect(screen.queryByTestId("board-voice-latest")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start samtale med Placy" }));
    expect(start).toHaveBeenCalledOnce();
  });

  it("rendrer ingenting uten samtalekontekst, så andre boards er urørt", () => {
    render(<BoardVoiceControl />);
    expect(screen.queryByTestId("board-voice")).toBeNull();
  });

  it("sender bare kartstatus tilbake fra klientverktøyet, og fremhever flere steder i rekkefølge", () => {
    mount();
    const executeTool = capturedOptions?.executeTool as (name: string, args: Record<string, unknown>) => Record<string, unknown>;
    expect(executeTool("show_place", { poi_id: poi.id })).toEqual({ ok: true, shown: "Dora Kaffebar", poi_id: poi.id });
    expect(flyToPoint).toHaveBeenCalled();
    expect(begin).toHaveBeenCalledWith(0);
    expect(executeTool("highlight_places", { poi_ids: [brew.id, poi.id] })).toEqual({ ok: true, shown: "Monkey Brew, Dora Kaffebar", highlighted: [{ ord: 1, id: brew.id, name: "Monkey Brew" }, { ord: 2, id: poi.id, name: "Dora Kaffebar" }] });
    expect(dispatch).toHaveBeenCalledWith({ type: "HIGHLIGHT_POIS", ids: [brew.id, poi.id] });
    expect(fitCoordinates).toHaveBeenCalledOnce();
    expect(executeTool("reset_board", {})).toEqual({ ok: true, shown: "Hele nabolaget" });
    expect(begin).toHaveBeenCalledWith(-1);
    expect(executeTool("show_place", { poi_id: "finnes-ikke" })).toHaveProperty("error");
    expect(executeTool("find_places", { query: "kaffe" })).toEqual({ error: "Ukjent kartkommando." });
  });

  it("melder brukerens egne tema- og stedstrykk som kontekst, men ikke guidens egne kartendringer", () => {
    resetLive({ status: "listening" });
    const view = mount();
    // Brukeren velger et tema i raden: serveren åpner kapittelet, ikke en
    // oppdiktet brukerytring i nettleseren.
    storyStop = category;
    act(() => { view.rerender(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>); });
    expect(sendContext).toHaveBeenCalledWith({ kind: "theme", id: "mat", label: "Kafé og servering" });
    expect(sendText).not.toHaveBeenCalled();
    // Brukeren trykker på et sted.
    boardState = { activePOIId: brew.id };
    act(() => { view.rerender(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>); });
    expect(sendContext).toHaveBeenCalledWith({ kind: "place", id: brew.id });
    sendContext.mockClear();
    // Guiden åpner et sted selv: endringen meldes ikke tilbake.
    const executeTool = capturedOptions?.executeTool as (name: string, args: Record<string, unknown>) => Record<string, unknown>;
    executeTool("show_place", { poi_id: poi.id });
    boardState = { activePOIId: poi.id };
    act(() => { view.rerender(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>); });
    expect(sendContext.mock.calls.filter(([message]) => message.kind === "place")).toHaveLength(0);
  });

  it("melder ikke trykk når samtalen ikke er i gang", () => {
    const view = mount();
    storyStop = category;
    act(() => { view.rerender(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>); });
    expect(sendContext).not.toHaveBeenCalled();
  });
});
