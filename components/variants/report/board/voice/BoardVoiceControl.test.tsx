import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BoardVoiceControl } from "@/components/variants/report/board/voice/BoardVoiceControl";
import { FAQSection } from "@/components/variants/report/board/FAQSection";
import { BoardVoiceProvider } from "@/components/variants/report/board/voice/board-voice";
import { NYHAVNA_GREETING_INSTRUCTION } from "@/lib/realtime/nyhavna-greeting";
import { LOCAL_VOICE_PACING } from "@/lib/demo/local-board/voice-instructions";

const mount = () => render(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>);

/** Funksjonsflaggene den lokale demoen har på; ingen av dem leses av slug-en. */
const LOCAL_FEATURES = {
  faqProgress: true, revealPlaces: true, followHighlightCategory: true,
  unscopedCategoryList: true, narrationFocus: true, voicePacing: true, guidedPersona: true,
};

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
  Object.assign(data, { demoSnapshotId: "nyhavna-snapshot-v1" });
  Reflect.deleteProperty(data, "assistant");
  Reflect.deleteProperty(data, "contentVersion");
  Reflect.deleteProperty(data, "voiceProjectSlug");
  Reflect.deleteProperty(data, "projectCustomer");
  Reflect.deleteProperty(data, "demoDataset");
  resetLive();
});

resetLive();

it("uses hosted standard-board voice instead of the sidecar when a public binding is supplied", () => {
  Object.assign(data, {
    assistant: { enabled: true, name: "Anja" },
    contentVersion: "report-version-2",
    voiceProjectSlug: "nyhavna",
    projectCustomer: "nyhavna-utvikling",
  });
  mount();
  expect(capturedOptions).toMatchObject({ hostedProjectSlug: "nyhavna", hostedSource: "report", snapshotId: "report-version-2" });
  expect(capturedOptions).not.toHaveProperty("endpoint");
  expect(capturedOptions).not.toHaveProperty("project");
});

it("uses the exact local dataset through hosted voice on the public board", () => {
  Object.assign(data, {
    assistant: { enabled: true, name: "Anja" },
    contentVersion: "report-version-2",
    voiceProjectSlug: "nyhavna",
    demoDataset: "nyhavna-lokal",
  });
  mount();

  expect(capturedOptions).toMatchObject({
    hostedProjectSlug: "nyhavna",
    dataset: "nyhavna-lokal",
  });
  expect(capturedOptions).not.toHaveProperty("hostedSource");
  expect(capturedOptions).not.toHaveProperty("snapshotId");
  Reflect.deleteProperty(data, "demoDataset");
});

describe("BoardVoiceControl", () => {
  it("krever eksplisitt samtykke før tale starter, og tømmer fremhevingen ved ny samtale", () => {
    mount();
    // Før samtalen er feltet én linje: hele linjen er knappen, uten statusfelt
    // og hjelpetekst (2026-09-14).
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("board-voice")).toHaveAttribute("data-s", "idle");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Snakk med Placy" }));
    expect(screen.getByTestId("board-voice-consent")).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tillat og start" }));
    expect(pause).toHaveBeenCalledWith("manual");
    expect(dispatch).toHaveBeenCalledWith({ type: "END_INTRO" });
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_HIGHLIGHTS" });
    expect(start).toHaveBeenCalledOnce();
    expect(capturedOptions).toMatchObject({ snapshotId: "nyhavna-snapshot-v1", greeting: NYHAVNA_GREETING_INSTRUCTION });
    expect(String(capturedOptions?.greeting)).not.toMatch(/Placy/);
  });

  it("navngir boardets eget sted i standardhilsenen, aldri et annet prosjekt", () => {
    // Fallbacken var tidligere Nyhavnas egen hilsen. Et tredje prosjekt uten
    // egen `assistant.greeting` presenterte seg da som Nyhavna
    // (funnet under Lillebytunet-gjenbrukstesten 2026-09-20).
    const original = data.home.name;
    data.home.name = "Lillebytunet";
    try {
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Snakk med Placy" }));
      fireEvent.click(screen.getByRole("button", { name: "Tillat og start" }));
      const greeting = String(capturedOptions?.greeting);
      expect(greeting).toContain("Lillebytunet");
      expect(greeting).not.toMatch(/Nyhavna/);
    } finally {
      data.home.name = original;
    }
  });

  it("sier «Snakker» uten transkript mens samtalen går, og sirkelen avslutter og rydder kartet på trykk", () => {
    resetLive({ status: "speaking", messages: [{ id: "u1", role: "user", text: "Hvor handler jeg?" }, { id: "a1", role: "assistant", text: "REMA 1000 Solsiden er nærmest, seks minutter til fots." }] });
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Snakker");
    expect(screen.getByTestId("board-voice")).toHaveAttribute("data-s", "speaking");
    expect(screen.queryByText(/REMA 1000/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Avslutt samtalen" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_HIGHLIGHTS" });
    expect(start).not.toHaveBeenCalled();
  });

  it("blir «Snakk med Placy igjen» etter samtalen — én linje, uten «Samtalen er avsluttet»", () => {
    resetLive({ status: "speaking" });
    const utils = mount();
    resetLive({ status: "idle" });
    utils.rerender(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>);
    const knapp = screen.getByRole("button", { name: "Snakk med Placy igjen" });
    expect(screen.getByTestId("board-voice")).toHaveAttribute("data-s", "ended");
    expect(screen.queryByText(/avsluttet/i)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(knapp);
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tillat og start" }));
    expect(start).toHaveBeenCalledOnce();
  });

  it("avbryter ikke guiden ved kartklikk – Live stopper selv når brukeren snakker", () => {
    resetLive({ status: "listening" });
    mount();
    sendContext.mockClear();
    fireEvent.click(document.body);
    expect(sendContext).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it("viser feilen som hovedtekst og instruksjonen under, og sirkelen prøver igjen", () => {
    resetLive({ status: "error", error: "Mikrofonen er ikke tilgjengelig. Tillat mikrofon i nettleseren, og prøv igjen.", messages: [{ id: "a1", role: "assistant", text: "Hei!" }] });
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Mikrofonen er ikke tilgjengelig");
    expect(screen.getByText("Tillat mikrofon i nettleseren, og prøv igjen.")).toBeTruthy();
    expect(screen.getByTestId("board-voice")).toHaveAttribute("data-s", "attention");
    fireEvent.click(screen.getByRole("button", { name: "Prøv igjen" }));
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tillat og start" }));
    expect(start).toHaveBeenCalledOnce();
  });

  it("kan aktiveres av ordinær assistentkonfig uten demoSnapshotId", () => {
    Reflect.deleteProperty(data, "demoSnapshotId");
    Object.assign(data, {
      contentVersion: "content-v1",
      assistant: { enabled: true, name: "Anja", guided: true },
    });
    mount();
    expect(screen.getByRole("button", { name: "Snakk med Anja" })).toBeTruthy();
  });

  it("lar ordinær assistentkonfig aktivere de samme funksjonene som demo-orakelet", () => {
    Reflect.deleteProperty(data, "demoSnapshotId");
    Object.assign(data, {
      contentVersion: "content-v1",
      assistant: {
        enabled: true,
        name: "Anja",
        guided: true,
        features: {
          revealPlaces: true,
          voicePacing: true,
          guidedPersona: true,
        },
      },
    });
    mount();
    expect(screen.getByRole("button", { name: "Snakk med Anja" })).toBeTruthy();
    expect(capturedOptions?.allowRevealPlaces).toBe(true);
    expect(String(capturedOptions?.greeting)).toContain(LOCAL_VOICE_PACING);
  });

  it("skiller åpen mikrofon fra å høre brukeren, uten å endre teksten", () => {
    resetLive({ status: "listening" });
    const view = mount();
    expect(screen.getByRole("status")).toHaveTextContent("Jeg lytter");
    expect(screen.getByTestId("board-voice")).toHaveAttribute("data-s", "listening");
    resetLive({ status: "listening", hearing: true });
    view.rerender(<BoardVoiceProvider><BoardVoiceControl /></BoardVoiceProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("Jeg lytter");
    expect(screen.getByTestId("board-voice")).toHaveAttribute("data-s", "hearing");
  });

  it("rendrer ingenting uten samtalekontekst, så andre boards er urørt", () => {
    render(<BoardVoiceControl />);
    expect(screen.queryByTestId("board-voice")).toBeNull();
  });

  it("sender bare kartstatus tilbake fra klientverktøyet, og fremhever flere steder i rekkefølge", async () => {
    mount();
    const executeTool = capturedOptions?.executeTool as (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    await expect(executeTool("show_place", { poi_id: poi.id })).resolves.toEqual({ ok: true, shown: "Dora Kaffebar", poi_id: poi.id });
    expect(flyToPoint).toHaveBeenCalled();
    expect(begin).toHaveBeenCalledWith(0);
    await expect(executeTool("highlight_places", { poi_ids: [brew.id, poi.id] })).resolves.toEqual({ ok: true, shown: "Monkey Brew, Dora Kaffebar", highlighted: [{ ord: 1, id: brew.id, name: "Monkey Brew" }, { ord: 2, id: poi.id, name: "Dora Kaffebar" }] });
    expect(dispatch).toHaveBeenCalledWith({ type: "HIGHLIGHT_POIS", ids: [brew.id, poi.id] });
    expect(fitCoordinates).toHaveBeenCalledOnce();
    await expect(executeTool("reset_board", {})).resolves.toEqual({ ok: true, shown: "Hele nabolaget" });
    expect(begin).toHaveBeenCalledWith(-1);
    await expect(executeTool("show_place", { poi_id: "finnes-ikke" })).resolves.toHaveProperty("error");
    await expect(executeTool("find_places", { query: "kaffe" })).resolves.toEqual({ error: "Ukjent kartkommando." });
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


describe("lokal FAQ, stemme og kart", () => {
  const faq = { id: "kaffe", question: "Hvor finner vi kaffe?", answer: "Se [Dora Kaffebar](poi:dora-kaffebar).", source: "curated" as const };
  const renderLocal = () => {
    Object.assign(data, { demoDataset: "nyhavna-lokal", demoFeatures: LOCAL_FEATURES });
    Object.assign(category, { editorial: { faq: [faq] } });
    return render(<BoardVoiceProvider><FAQSection entries={[faq]} poisById={data.poisById} categoryIds={["mat"]} /></BoardVoiceProvider>);
  };
  afterEach(() => {
    Reflect.deleteProperty(data, "demoDataset");
    Reflect.deleteProperty(data, "demoFeatures");
    Reflect.deleteProperty(category, "editorial");
  });
  it("åpner tekst og fremhever kartsteder uten å starte mikrofonen", () => {
    renderLocal();
    fireEvent.click(screen.getByTestId("faq-question"));
    expect(dispatch).toHaveBeenCalledWith({ type: "HIGHLIGHT_POIS", ids: ["dora-kaffebar"] });
    expect(screen.getByLabelText("Utforsket")).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Nullstill haker"));
    expect(screen.queryByLabelText("Utforsket")).toBeNull();
  });
  it("sender senere temavalg selv om FAQ-en fremhevet steder der", () => {
    resetLive({ status: "listening" });
    const { rerender } = renderLocal();
    fireEvent.click(screen.getByTestId("faq-question"));
    sendContext.mockClear();
    storyStop = category;
    rerender(<BoardVoiceProvider><FAQSection entries={[faq]} poisById={data.poisById} categoryIds={["mat"]} /></BoardVoiceProvider>);
    expect(sendContext).toHaveBeenCalledWith({ kind: "theme", id: "mat", label: category.label });
  });
  it("sender valgt FAQ inn i aktiv samtale uten å markere den ferdig på klikk", async () => {
    resetLive({ status: "listening" });
    renderLocal();
    fireEvent.click(screen.getByTestId("faq-question"));
    expect(sendText).toHaveBeenCalledWith(faq.question);
    expect(screen.queryByLabelText("Utforsket")).toBeNull();
    expect(start).not.toHaveBeenCalled();
    const tool = capturedOptions?.executeTool as (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    // Verktøyet svarer med kartstatus, ikke med en ferdig-markering: FAQ-en
    // forblir uavkrysset til samtalen faktisk har besvart den.
    await act(async () => { await expect(tool("highlight_places", { poi_ids: ["dora-kaffebar"], answered_faq_ids: ["kaffe"] })).resolves.toMatchObject({ ok: true }); });
    expect(screen.queryByLabelText("Utforsket")).toBeNull();
  });
});


/**
 * Hvert funksjonsflagg for seg (`LocalDemoFeatures`). Før dette avgjorde
 * datasett-navnet alle seks samtidig, og et nytt datasett måtte arve enten alt
 * eller ingenting. Testene slår derfor på ETT flagg om gangen og sjekker at
 * bare den funksjonen slår ut.
 */
describe("funksjonsflagg styrer samtalen, ikke datasett-navnet", () => {
  const withFeatures = (features: Record<string, boolean>) => {
    Object.assign(data, { demoDataset: "et-datasett", demoFeatures: features });
    return mount();
  };
  afterEach(() => {
    Reflect.deleteProperty(data, "demoDataset");
    Reflect.deleteProperty(data, "demoFeatures");
  });

  it("navngir guiden bare når demoen har en navngitt guide", () => {
    withFeatures({ guidedPersona: true });
    expect(screen.getByRole("button", { name: "Snakk med Anja" })).toBeTruthy();
    cleanup();
    withFeatures({ faqProgress: true, revealPlaces: true });
    expect(screen.getByRole("button", { name: "Snakk med Placy" })).toBeTruthy();
  });

  it("legger tempoinstruksen på hilsenen bare når demoen ber om den", () => {
    withFeatures({ voicePacing: true });
    expect(String(capturedOptions?.greeting)).toContain(LOCAL_VOICE_PACING);
    cleanup();
    withFeatures({ guidedPersona: true });
    expect(String(capturedOptions?.greeting)).toBe(NYHAVNA_GREETING_INSTRUCTION);
  });

  it("åpner ekstrautvalget og melder viste steder bare når demoen har det", () => {
    withFeatures({ revealPlaces: true });
    expect(capturedOptions?.allowRevealPlaces).toBe(true);
    expect((capturedOptions?.getContext as () => Record<string, unknown>)()).toHaveProperty("revealed_place_ids");
    cleanup();
    withFeatures({ faqProgress: true });
    expect(capturedOptions?.allowRevealPlaces).toBe(false);
    expect((capturedOptions?.getContext as () => Record<string, unknown>)()).not.toHaveProperty("revealed_place_ids");
  });

  it("kjører ikke ekstrautvalget som kartkommando når flagget er av", async () => {
    withFeatures({ faqProgress: true });
    const tool = capturedOptions?.executeTool as (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    // Uten flagget er `reveal_places` en ukjent kommando, ikke en stille utvidelse.
    await expect(tool("reveal_places", { poi_ids: [poi.id], category_id: "mat", radius_km: 2 })).resolves.toHaveProperty("error");
  });

  it("gir ingen FAQ-fremdrift når flagget er av", () => {
    const faq = { id: "kaffe", question: "Hvor finner vi kaffe?", answer: "Se [Dora Kaffebar](poi:dora-kaffebar).", source: "curated" as const };
    Object.assign(category, { editorial: { faq: [faq] } });
    Object.assign(data, { demoDataset: "et-datasett", demoFeatures: { revealPlaces: true } });
    render(<BoardVoiceProvider><FAQSection entries={[faq]} poisById={data.poisById} categoryIds={["mat"]} /></BoardVoiceProvider>);
    fireEvent.click(screen.getByTestId("faq-question"));
    expect(screen.queryByLabelText("Utforsket")).toBeNull();
    expect(screen.queryByText("Nullstill haker")).toBeNull();
    Reflect.deleteProperty(category, "editorial");
  });
});
