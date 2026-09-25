import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialBoardState, type BoardState } from "@/components/variants/report/board/board-state";

const dispatch = vi.fn();
const camera = { snapshot: vi.fn(() => ({ engine: "google", center: { lng: 10, lat: 63 } })), restore: vi.fn(), fitVisible: vi.fn(), fitCoordinates: vi.fn(), flyToPoint: vi.fn() };
const storySnapshot = { tour: { step: 2, pane: "places" as const }, openPoiIds: new Set(["dora-1"]) };
const story = { stop: null as null | { id: string }, snapshot: vi.fn(() => storySnapshot), restore: vi.fn(), begin: vi.fn() };
let boardState: BoardState = initialBoardState;

const poi = (id: string, categoryId: string, name: string) => ({ id, categoryId, name, coordinates: { lng: 10, lat: 63 } });
const data = {
  globalFaq: [{ id: "g1", question: "Hva er Nyhavna?", answer: "En bydel." }],
  categories: [
    { id: "opplevelser", label: "Opplevelser", pois: [poi("dora-1", "opplevelser", "Dora 1 Bowling"), poi("havet", "opplevelser", "HAVET Arena")], editorial: { body: "", highlights: [], faq: [{ id: "o1", question: "Hva kan vi gjøre?", answer: "Bowle." }] } },
  ],
};

const restoreRevealedPlaces = vi.fn();
let revealedPlaceIds: ReadonlySet<string> = new Set();
vi.mock("@/components/variants/report/board/board-state", async (original) => ({
  ...(await original<typeof import("@/components/variants/report/board/board-state")>()),
  useBoard: () => ({ data, state: boardState, dispatch, mapCamera: camera, revealedPlaceIds, restoreRevealedPlaces }),
}));
vi.mock("@/components/variants/report/board/board-data", async (original) => ({
  ...(await original<typeof import("@/components/variants/report/board/board-data")>()),
  findBoardPOI: (categories: typeof data.categories, id: string) => categories.flatMap((c) => c.pois).find((p) => p.id === id) ?? null,
}));
vi.mock("@/components/variants/report/board/story/story-tour", () => ({ useStoryTour: () => story }));

const voice = {
  name: "Anja",
  connected: false,
  running: false,
  sendPlaceContext: vi.fn(),
  consentPending: false,
  messages: [] as { id: string; role: "user" | "assistant"; text: string }[],
  toggle: vi.fn(),
  hangUp: vi.fn(),
  sendText: vi.fn(),
  runTool: vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ ok: true; shown: string }>>(async () => ({ ok: true, shown: "x" })),
  linkAgent: vi.fn(),
};
vi.mock("@/components/variants/report/board/voice/board-voice", () => ({ useBoardVoice: () => voice }));

const { BoardAgentProvider, useBoardAgent } = await import("@/components/variants/report/board/agent/board-agent");

const wrapper = ({ children }: { children: ReactNode }) => <BoardAgentProvider enabled>{children}</BoardAgentProvider>;
const reply = (extra: Record<string, unknown> = {}) => ({ reply: "Svar.", answerType: "fact", links: [], sources: [], notice: null, transcript: "tok-1", datasetVersion: "v", directives: [], ...extra });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  boardState = initialBoardState;
  revealedPlaceIds = new Set();
  voice.connected = false;
  voice.running = false;
  fetchMock = vi.fn(async () => new Response(JSON.stringify(reply()), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe("BoardAgentProvider", () => {
  it("uten prototypen finnes ingen agent", () => {
    const { result } = renderHook(() => useBoardAgent(), { wrapper: ({ children }) => <BoardAgentProvider enabled={false}>{children}</BoardAgentProvider> });
    expect(result.current).toBeNull();
  });

  it("å gå inn i «Spør Anja» starter verken mikrofon eller modellkall", () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    expect(result.current.mode).toBe("agent");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(voice.toggle).not.toHaveBeenCalled();
    expect(voice.linkAgent).toHaveBeenCalled();
  });

  it("ett kartklikk gir ett stedsinnslag og ett spørsmål; samme klikk igjen gir ingenting", async () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("dora-1", "map"));
    act(() => result.current.selectPlace("dora-1", "map"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.entries.filter((e) => e.kind === "place")).toHaveLength(1);
    expect(result.current.entries.filter((e) => e.kind === "assistant")).toHaveLength(1);
    expect(bodies()).toEqual([expect.objectContaining({ intent: { kind: "place", poiId: "dora-1" } })]);
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_POI", id: "dora-1", source: "agent" });
    // Kartklikket står der fingeren er.
    expect(camera.flyToPoint).not.toHaveBeenCalled();
  });

  it("ukjent sted gir verken innslag, kartendring eller kall", () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("finnes-ikke", "map"));
    expect(result.current.entries).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("et nytt sted før svaret avbryter det forrige: bare siste valg får svar", async () => {
    let first: ((r: Response) => void) | null = null;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      first = resolve;
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("dora-1", "map"));
    await waitFor(() => expect(first).not.toBeNull());
    act(() => result.current.selectPlace("havet", "map"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.entries.map((e) => e.kind)).toEqual(["place", "place", "assistant"]);
    expect(bodies().map((b) => b.intent.poiId)).toEqual(["dora-1", "havet"]);
  });

  it("Anjas kartdirektiver utføres som hennes egne, og blir aldri et nytt spørsmål", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(reply({ directives: [{ name: "highlight_places", args: { poi_ids: ["havet"] } }, { name: "reset_board", args: {} }] })), { status: 200 }));
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.send("Vis kaféer i nærheten"));
    await waitFor(() => expect(voice.runTool).toHaveBeenCalledTimes(1));
    expect(voice.runTool).toHaveBeenCalledWith("highlight_places", { poi_ids: ["havet"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodies()[0]).toMatchObject({ message: "Vis kaféer i nærheten", pageId: "board" });
  });

  it("neste melding bærer det nye historikktokenet", async () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.send("Hei"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => result.current.send("Og mer?"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodies()[1].transcript).toBe("tok-1");
  });

  it("FAQ uten tale går som strukturert valg og starter ikke mikrofonen", async () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectSuggestion({ key: "faq:g1", kind: "faq", faqId: "g1", label: "Hva er Nyhavna?" }));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.entries[0]).toMatchObject({ kind: "faq", question: "Hva er Nyhavna?" });
    expect(bodies()[0].intent).toEqual({ kind: "faq", faqId: "g1" });
    expect(voice.toggle).not.toHaveBeenCalled();
    expect(result.current.suggestions.some((s) => s.key === "faq:g1")).toBe(false);
  });

  it("med talen i gang går et stedsvalg eksplisitt til talen, ikke til tekstbanen", () => {
    voice.connected = true;
    voice.running = true;
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("dora-1", "map"));
    expect(result.current.entries.filter((e) => e.kind === "place")).toHaveLength(1);
    expect(voice.sendPlaceContext).toHaveBeenCalledWith("dora-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mens talen kobler til venter valget i kø og går til talen når den står (review #5)", () => {
    voice.running = true;
    const { result, rerender } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("dora-1", "map"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(voice.sendPlaceContext).not.toHaveBeenCalled();
    voice.connected = true;
    rerender();
    expect(voice.sendPlaceContext).toHaveBeenCalledWith("dora-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("kom talen aldri i gang, går valget i kø til tekstbanen", async () => {
    voice.running = true;
    const { result, rerender } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("dora-1", "map"));
    voice.running = false;
    rerender();
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(bodies()).toEqual([expect.objectContaining({ intent: { kind: "place", poiId: "dora-1" } })]);
  });

  it("stedsvalget sender det valgte stedet som kartstatus, ikke forrige render (review #12)", async () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("havet", "map"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(bodies()[0].board).toMatchObject({ selectedPlaceId: "havet", selectedCategoryId: "opplevelser" });
  });

  it("et nytt valg stopper kartkommandoene fra forrige svar midt i rekken (review #4)", async () => {
    let releaseTool: (() => void) | null = null;
    voice.runTool.mockImplementationOnce(() => new Promise((resolve) => { releaseTool = () => resolve({ ok: true, shown: "x" }); }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(reply({ directives: [
      { name: "show_category", args: { category_id: "opplevelser" } },
      { name: "show_place", args: { poi_id: "dora-1" } },
    ] })), { status: 200 }));
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.send("Vis opplevelser"));
    await waitFor(() => expect(releaseTool).not.toBeNull());
    act(() => result.current.selectPlace("havet", "map"));
    await act(async () => { releaseTool!(); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(voice.runTool.mock.calls.map((c) => c[0])).toEqual(["show_category"]);
  });

  it("et valg som feilet kan prøves igjen med samme trykk (review #15)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Nede." }), { status: 502 }));
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectPlace("dora-1", "map"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => result.current.selectPlace("dora-1", "map"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("FAQ under talen vises én gang, som talens egen melding (review #16)", () => {
    voice.connected = true;
    voice.running = true;
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectSuggestion({ key: "faq:g1", kind: "faq", faqId: "g1", label: "Hva er Nyhavna?" }));
    expect(result.current.entries.filter((e) => e.kind === "faq")).toHaveLength(0);
    expect(voice.sendText).toHaveBeenCalledWith("Hva er Nyhavna?");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("temavalg viser temaet i kartet straks og spør tekstbanen om det (review #6)", async () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectSuggestion({ key: "theme:opplevelser", kind: "theme", categoryId: "opplevelser", label: "Opplevelser" }));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.entries[0]).toMatchObject({ kind: "theme", label: "Opplevelser" });
    expect(voice.runTool).toHaveBeenCalledWith("show_category", { category_id: "opplevelser" });
    expect(bodies()[0]).toMatchObject({ intent: { kind: "theme", categoryId: "opplevelser" }, board: { selectedCategoryId: "opplevelser", selectedPlaceId: null } });
  });

  it("temavalg under talen åpner temaet i omvisningen, som talen melder videre", () => {
    voice.connected = true;
    voice.running = true;
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.selectSuggestion({ key: "theme:opplevelser", kind: "theme", categoryId: "opplevelser", label: "Opplevelser" }));
    expect(story.begin).toHaveBeenCalledWith(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("et stedskort i samtalen viser stedet i kartet igjen uten nytt spørsmål (review #6)", () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.focusPlace("havet"));
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_POI", id: "havet", source: "agent" });
    expect(camera.flyToPoint).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Snakk flytter et tekstsvar på vei over til talen (review #5)", async () => {
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const { result, rerender } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.send("Hva med kafeer?"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    voice.running = true;
    act(() => result.current.setInput("talk"));
    expect(result.current.busy).toBe(false);
    expect(result.current.entries.map((e) => e.kind)).toEqual(["user"]);
    voice.connected = true;
    rerender();
    expect(voice.sendText).toHaveBeenCalledWith("Hva med kafeer?");
  });

  it("Snakk ber om talen, Skriv legger på", () => {
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.setInput("talk"));
    expect(voice.toggle).toHaveBeenCalledTimes(1);
    act(() => result.current.setInput("write"));
    expect(voice.hangUp).toHaveBeenCalledTimes(1);
  });

  it("utgang til Utforsk stopper talen og legger tilbake tilstand, omvisning og kamera", async () => {
    boardState = { ...initialBoardState, activeCategoryId: "opplevelser" as never, activePOIId: "dora-1" as never, travelMode: "bike" };
    const revealedAtEntry = new Set<string>();
    revealedPlaceIds = revealedAtEntry;
    const { result, rerender } = renderHook(() => useBoardAgent()!, { wrapper });
    const before = boardState;
    act(() => result.current.setMode("agent"));
    boardState = { ...initialBoardState, travelMode: "car" };
    revealedPlaceIds = new Set(["reserve-1"]);
    rerender();
    act(() => result.current.send("Hei"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => result.current.setMode("explore"));
    expect(voice.hangUp).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "RESTORE_STATE", state: before });
    expect(story.restore).toHaveBeenCalledWith(storySnapshot);
    expect(restoreRevealedPlaces).toHaveBeenCalledWith(revealedAtEntry);
    expect(camera.restore).toHaveBeenCalled();
    expect(result.current.mode).toBe("explore");
    // Samtalen er der igjen ved retur, uten å starte noe av seg selv.
    act(() => result.current.setMode("agent"));
    expect(result.current.entries.map((e) => e.kind)).toEqual(["user", "assistant"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("et svar som kommer etter utgang vises, men styrer ikke kartet i Utforsk", async () => {
    let release: ((r: Response) => void) | null = null;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.send("Vis natur"));
    await waitFor(() => expect(release).not.toBeNull());
    act(() => result.current.setMode("explore"));
    await act(async () => { release!(new Response(JSON.stringify(reply({ directives: [{ name: "show_category", args: { category_id: "opplevelser" } }] })), { status: 200 })); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.entries.at(-1)).toMatchObject({ kind: "assistant" });
    expect(voice.runTool).not.toHaveBeenCalled();
  });

  it("en feil fra tekstbanen vises i samtalen og beholder historikken", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Du har brukt opp dagens spørsmål." }), { status: 429 }));
    const { result } = renderHook(() => useBoardAgent()!, { wrapper });
    act(() => result.current.setMode("agent"));
    act(() => result.current.send("Hei"));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.entries.map((e) => e.kind)).toEqual(["user", "status"]);
    expect(result.current.entries[1]).toMatchObject({ tone: "error", text: "Du har brukt opp dagens spørsmål." });
  });
});
