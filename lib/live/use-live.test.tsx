import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLive, type LiveOptions } from "@/lib/live/use-live";

class FakeChannel extends EventTarget {
  readyState = "open";
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = "closed"; });
  emit(event: unknown) { this.onmessage?.({ data: JSON.stringify(event) }); }
  events(): Array<Record<string, unknown>> {
    return this.send.mock.calls.map(([payload]) => JSON.parse(payload));
  }
}

class FakePeer {
  static instances: FakePeer[] = [];
  channel = new FakeChannel();
  connectionState = "connected";
  iceGatheringState = "complete";
  localDescription = { type: "offer", sdp: "v=0\r\nlocal" };
  ontrack = null;
  onconnectionstatechange = null;
  createDataChannel = vi.fn(() => this.channel);
  sender = { track: null as MediaStreamTrack | null, replaceTrack: vi.fn(async (track: MediaStreamTrack | null) => { this.sender.track = track; }) };
  transceiver = { direction: "sendrecv", sender: this.sender };
  addTransceiver = vi.fn(() => this.transceiver);
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0\r\n" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  close = vi.fn();
  constructor() { FakePeer.instances.push(this); }
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) { FakeEventSource.instances.push(this); }
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
}

let microphone: { enabled: boolean; stop: ReturnType<typeof vi.fn> };
/** Amplituden måleren «hører» på den mottatte lyden. */
let amplitude = 0;

function options(executeTool = vi.fn<LiveOptions["executeTool"]>(() => ({ ok: true }))): LiveOptions {
  return {
    executeTool,
    greeting: "Si hei på norsk.",
    snapshotId: "snapshot-test",
    getContext: () => ({ selected_category_id: "mat", selected_place_id: null, travel_mode: "walk" }),
  };
}

function posts(path: string) {
  return vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url) === path && init?.method === "POST");
}

/** Start og kvitter sesjonen, slik en ekte oppkobling gjør. */
async function connect(hookOptions: LiveOptions = options()) {
  const view = renderHook(() => useLive(hookOptions));
  let started!: Promise<void>;
  await act(async () => { started = view.result.current.start(); });
  const peer = FakePeer.instances[0];
  await act(async () => { peer.channel.emit({ type: "session.started" }); await started; });
  return { ...view, peer, events: FakeEventSource.instances[0] };
}

beforeEach(() => {
  FakePeer.instances = [];
  FakeEventSource.instances = [];
  microphone = { enabled: true, stop: vi.fn() };
  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal("EventSource", FakeEventSource);
  amplitude = 0;
  vi.stubGlobal("AudioContext", class {
    createAnalyser = () => ({ fftSize: 512, getFloatTimeDomainData: (samples: Float32Array) => samples.fill(amplitude) });
    createMediaStreamSource = () => ({ connect: () => {} });
    close = async () => {};
  });
  vi.stubGlobal("Audio", class {
    autoplay = false;
    srcObject = null;
    play = vi.fn(async () => {});
    pause = vi.fn();
    remove = vi.fn();
  });
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [microphone], getAudioTracks: () => [microphone] })) },
  });
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const target = String(url);
    if (init?.method === "DELETE") return { ok: true } as Response;
    if (target === "/api/prototype/live" && init?.method === "POST") {
      return { ok: true, headers: { get: () => "token-1" }, json: async () => ({ sdp: "v=0\r\nanswer", sessionId: "live_1" }) } as unknown as Response;
    }
    if (init?.method === "POST") return { ok: true, json: async () => ({}) } as unknown as Response;
    return { ok: true, json: async () => ({ configured: true, protocol: "live", snapshotId: "snapshot-test" }) } as Response;
  }));
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Live-oppkobling", () => {
  it("bruker cookie-bundet gateway for et ordinært board uten token i URL eller JavaScript", async () => {
    vi.mocked(fetch).mockImplementation(async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (target.startsWith("/api/board-assistant?") && !init?.method) {
        return { ok: true, json: async () => ({ configured: true, protocol: "live" }) } as Response;
      }
      if (target === "/api/board-assistant" && init?.method === "POST") {
        return { ok: true, headers: { get: () => null }, json: async () => ({ sdp: "v=0\r\nanswer", sessionId: "live_1" }) } as unknown as Response;
      }
      if (init?.method === "DELETE" || init?.method === "POST") return { ok: true, json: async () => ({}) } as Response;
      return { ok: false, json: async () => ({}) } as Response;
    });
    const project = { customer: "kunde", projectSlug: "prosjekt", contentVersion: "a".repeat(64) };
    const { events } = await connect({ ...options(), snapshotId: undefined, endpoint: "/api/board-assistant", project });
    expect(events.url).toBe("/api/board-assistant/map");
    const start = posts("/api/board-assistant")[0];
    expect(JSON.parse(String(start[1]?.body))).toMatchObject(project);
    expect(start[1]?.headers).toEqual({ "Content-Type": "application/json" });
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url)).join(" ")).not.toContain("session=");
  });

  it("varsler før lokal tidsgrense og rydder varselet ved stopp", async () => {
    vi.useFakeTimers();
    const { result, peer } = await connect();
    await act(async () => { vi.advanceTimersByTime(27 * 60 * 1000); });
    expect(result.current.notice).toBeNull();
    // Duplisert started-event må ikke flytte varselet framover.
    act(() => { peer.channel.emit({ type: "session.started" }); });
    await act(async () => { vi.advanceTimersByTime(60 * 1000); });
    expect(result.current.notice).toContain("to minutter");
    expect(result.current.status).not.toBe("error");
    act(() => { result.current.stop(); });
    expect(result.current.notice).toBeNull();
    await act(async () => { vi.advanceTimersByTime(30 * 60 * 1000); });
    expect(result.current.notice).toBeNull();
  });

  it("kobler opp, hilser over datakanalen og lytter", async () => {
    const { result, peer, events } = await connect();
    expect(peer.createDataChannel).toHaveBeenCalledWith("oai-events");
    // Datakanalen må finnes før tilbudet lages.
    expect(peer.createDataChannel.mock.invocationCallOrder[0]).toBeLessThan(peer.createOffer.mock.invocationCallOrder[0]);
    expect(JSON.parse(String(posts("/api/prototype/live")[0][1]?.body))).toEqual({ sdp: "v=0\r\nlocal", snapshotId: "snapshot-test" });
    expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0\r\nanswer" });
    expect(result.current.status).toBe("listening");
    expect(events.url).toBe("/api/prototype/live/map?session=token-1");
    const greeting = peer.channel.events().find(event => event.type === "session.instructions.append");
    expect(greeting).toMatchObject({ delegation_id: null, content: "Si hei på norsk." });
    expect(greeting?.event_id).toBeTruthy();
    expect(JSON.parse(String(posts("/api/prototype/live/context")[0][1]?.body))).toEqual({
      kind: "state", selected_category_id: "mat", selected_place_id: null, travel_mode: "walk",
    });
  });

  it("puffer stemmen i gang med en kommentar først når hilsen-instruksen er kvittert", async () => {
    const { peer } = await connect();
    const greeting = peer.channel.events().find(event => event.type === "session.instructions.append");
    // Målt 2026-09-13: instruksen alene ga ingen tale. Puffet må vente på
    // kvitteringen, og komme bare én gang.
    expect(peer.channel.events().some(event => event.type === "session.commentary.append")).toBe(false);
    await act(async () => {
      peer.channel.emit({ type: "session.instructions.appended", client_event_id: greeting?.event_id });
      peer.channel.emit({ type: "session.instructions.appended", client_event_id: greeting?.event_id });
    });
    const kicks = peer.channel.events().filter(event => event.type === "session.commentary.append");
    expect(kicks).toHaveLength(1);
    expect(kicks[0]).toMatchObject({ delegation_id: null });
    expect(String(kicks[0].content)).toContain("Begynn samtalen nå");
  });

  it("holder mikrofonsporet på hele tiden, også under hilsenen", async () => {
    const { peer } = await connect();
    expect(peer.sender.track).toBe(microphone);
    // Live kvitterer ikke kontekst-appends uten lydrammer: en dempet mikrofon
    // ville holdt hilsenen tilbake.
    expect(microphone.enabled).toBe(true);
    expect(peer.channel.events().some(event => String(event.type).includes("clear"))).toBe(false);
  });

  it("avviser en server som ikke svarer med Live-protokollen, uten å be om mikrofon", async () => {
    vi.mocked(fetch).mockImplementation(async () => ({ ok: true, json: async () => ({ configured: true, protocol: "realtime" }) }) as Response);
    const { result } = renderHook(() => useLive(options()));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Live-protokollen");
    expect(FakePeer.instances).toHaveLength(0);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});

describe("Kartdirektiver over SSE", () => {
  it("slipper ekstrautvalget gjennom SSE bare når boardet har slått det på", async () => {
    const executeTool = vi.fn(() => ({ ok: true, shown: "CrossFit Trondheim" }));
    // Flagget, ikke datasett-navnet: en hvilken som helst registrert demo med
    // `revealPlaces` skal få kommandoen gjennom.
    const { events } = await connect({ ...options(executeTool), dataset: "en-annen-demo", allowRevealPlaces: true });
    await act(async () => { events.emit({ type: "map", directive: { id: "reserve-1", name: "reveal_places", args: { poi_ids: ["crossfit-trondheim"] } } }); });
    expect(executeTool).toHaveBeenCalledWith("reveal_places", { poi_ids: ["crossfit-trondheim"] });
    expect(JSON.parse(String(posts("/api/prototype/live/map")[0][1]?.body)).output).toMatchObject({ ok: true });
  });
  it("viser serverens beskjed om å laste på nytt når datagrunnlaget er nyere (409)", async () => {
    // AE6: fanen sto åpen mens datasettet ble endret. Samtalen skal ikke starte
    // på gammelt grunnlag, og beskjeden skal si hva brukeren gjør.
    vi.mocked(fetch).mockImplementation(async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (init?.method === "DELETE") return { ok: true } as Response;
      if (target === "/api/prototype/live" && init?.method === "POST") {
        return { ok: false, status: 409, json: async () => ({ error: "Datagrunnlaget er oppdatert. Last boardet på nytt." }) } as unknown as Response;
      }
      return { ok: true, json: async () => ({ configured: true, protocol: "live", snapshotId: "snapshot-test" }) } as Response;
    });
    const view = renderHook(() => useLive({ ...options(), dataset: "en-annen-demo" }));
    await act(async () => { await view.result.current.start(); });
    expect(view.result.current.status).toBe("error");
    expect(view.result.current.error).toBe("Datagrunnlaget er oppdatert. Last boardet på nytt.");
  });

  it("navngir ingen demo i beskjeden om manglende dataversjon", async () => {
    vi.mocked(fetch).mockImplementation(async (url: unknown, init?: RequestInit) => {
      if (init?.method === "DELETE") return { ok: true } as Response;
      return { ok: true, json: async () => ({ configured: true, protocol: "live" }) } as Response;
    });
    const view = renderHook(() => useLive({ ...options(), snapshotId: undefined }));
    await act(async () => { await view.result.current.start(); });
    expect(view.result.current.error).toBe("Last boardet på nytt med riktig dataversjon før du starter samtalen.");
    expect(view.result.current.error).not.toMatch(/Nyhavna/);
  });

  it("avviser ekstrautvalg-direktivet når boardet ikke har slått det på", async () => {
    const executeTool = vi.fn(() => ({ ok: true }));
    const { events } = await connect(options(executeTool));
    await act(async () => { events.emit({ type: "map", directive: { id: "reserve-2", name: "reveal_places", args: { poi_ids: ["crossfit-trondheim"] } } }); });
    expect(executeTool).not.toHaveBeenCalled();
  });
  it("utfører direktivet i nettleseren og leverer kartstatus tilbake", async () => {
    const executeTool = vi.fn(() => ({ ok: true, shown: "Dora Kaffebar" }));
    const { events } = await connect(options(executeTool));
    await act(async () => { events.emit({ type: "map", directive: { id: "d1", name: "show_place", args: { poi_id: "dora" } } }); });
    expect(executeTool).toHaveBeenCalledWith("show_place", { poi_id: "dora" });
    expect(JSON.parse(String(posts("/api/prototype/live/map")[0][1]?.body))).toEqual({ id: "d1", output: { ok: true, shown: "Dora Kaffebar" } });
  });

  it("svarer med en feil, ikke en bekreftelse, når kommandoen er ukjent", async () => {
    const executeTool = vi.fn(() => ({ ok: true }));
    const { events } = await connect(options(executeTool));
    await act(async () => { events.emit({ type: "map", directive: { id: "d2", name: "finn_noe", args: {} } }); });
    expect(executeTool).not.toHaveBeenCalled();
    expect(JSON.parse(String(posts("/api/prototype/live/map")[0][1]?.body)).output).toHaveProperty("error");
  });

  it("viser serverens avslutning og rydder uten en ny DELETE", async () => {
    const { result, peer, events } = await connect();
    await act(async () => { events.emit({ type: "ended", reason: "limit", message: "Samtalen er avsluttet etter tolv minutter." }); });
    expect(result.current.error).toBe("Samtalen er avsluttet etter tolv minutter.");
    expect(result.current.status).toBe("error");
    expect(peer.close).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(0);
  });
});

describe("Transkript uten turgrenser", () => {
  it("grupperer fragmenter per taler og bryter på lange pauser", async () => {
    const { result, peer } = await connect();
    await act(async () => {
      peer.channel.emit({ type: "session.input_transcript.delta", delta: "Hvor ", start_ms: 0, end_ms: 400 });
      peer.channel.emit({ type: "session.input_transcript.delta", delta: "handler jeg?", start_ms: 400, end_ms: 900 });
      peer.channel.emit({ type: "session.output_transcript.delta", delta: "Rema ", start_ms: 1200, end_ms: 1600 });
      peer.channel.emit({ type: "session.output_transcript.delta", delta: "er nærmest.", start_ms: 1600, end_ms: 2000 });
      peer.channel.emit({ type: "session.output_transcript.delta", delta: "Noe mer?", start_ms: 9000, end_ms: 9500 });
    });
    expect(result.current.messages.map(message => `${message.role}: ${message.text}`)).toEqual([
      "user: Hvor handler jeg?",
      "assistant: Rema er nærmest.",
      "assistant: Noe mer?",
    ]);
    expect(result.current.latest).toBe("Noe mer?");
  });

  it("melder en avbrutt tur som notis, og legger ikke på", async () => {
    const { result, peer } = await connect();
    await act(async () => { peer.channel.emit({ type: "error", error: { code: "moderation", message: "kuttet" } }); });
    expect(result.current.notice).toContain("Noe avbrøt svaret");
    expect(result.current.interruptionVersion).toBe(1);
    await act(async () => { peer.channel.emit({ type: "error", error: { code: "moderation", message: "kuttet" } }); });
    expect(result.current.interruptionVersion).toBe(2);
    expect(result.current.status).not.toBe("error");
    expect(peer.close).not.toHaveBeenCalled();
  });

  it("teller stemmesekunder som et øyeblikksbilde, ikke som en sum", async () => {
    const { result, peer } = await connect();
    await act(async () => {
      peer.channel.emit({ type: "session.usage.updated", usage: { seconds: 30 } });
      peer.channel.emit({ type: "session.usage.updated", usage: { seconds: 45 } });
    });
    expect(result.current.usage.voiceSeconds).toBe(45);
    expect(result.current.usage.estimatedUsd).toBeCloseTo(45 * 0.05 / 60, 8);
  });
});

describe("Status følger faktisk lyd", () => {
  it("viser «snakker» mens lyden spilles, og faller tilbake til «lytter» etterpå", async () => {
    vi.useFakeTimers();
    const { result, peer } = await connect();
    act(() => { (peer.ontrack as unknown as (event: unknown) => void)({ streams: [{}], track: {} }); });
    amplitude = 0.4;
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.status).toBe("speaking");
    amplitude = 0;
    // Et pusterom mellom to setninger er ikke slutten på svaret: etiketten står.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.status).toBe("speaking");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.status).toBe("listening");
  });

  it("bryter «snakker» med en gang brukeren selv sier noe i pausen", async () => {
    vi.useFakeTimers();
    const { result, peer } = await connect();
    act(() => { (peer.ontrack as unknown as (event: unknown) => void)({ streams: [{}], track: {} }); });
    amplitude = 0.4;
    act(() => { vi.advanceTimersByTime(200); });
    amplitude = 0;
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.status).toBe("speaking");
    act(() => { peer.channel.emit({ type: "session.input_transcript.delta", delta: "Vent litt", start_ms: 0, end_ms: 300 }); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.status).toBe("listening");
  });

  it("viser «undersøker» når brukeren har spurt og stemmen er stille", async () => {
    vi.useFakeTimers();
    const { result, peer } = await connect();
    act(() => { peer.channel.emit({ type: "session.input_transcript.delta", delta: "Hvor handler jeg?", start_ms: 0, end_ms: 500 }); });
    act(() => { vi.advanceTimersByTime(1600); });
    expect(result.current.status).toBe("thinking");
  });
});

describe("Stopp og opprydding", () => {
  it("ber serveren avslutte og river ned alt lokalt", async () => {
    const { result, peer, events } = await connect();
    act(() => result.current.stop());
    expect(fetch).toHaveBeenCalledWith("/api/prototype/live", expect.objectContaining({
      method: "DELETE", headers: { "X-Placy-Session": "token-1" }, keepalive: true,
    }));
    expect(peer.close).toHaveBeenCalledOnce();
    expect(peer.channel.close).toHaveBeenCalledOnce();
    expect(events.close).toHaveBeenCalledOnce();
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
  });

  it("sender bare endret karttilstand videre", async () => {
    const { result } = await connect();
    act(() => { result.current.sendContext({ kind: "state", selected_category_id: "mat", selected_place_id: null, travel_mode: "walk" }); });
    expect(posts("/api/prototype/live/context")).toHaveLength(1);
    act(() => { result.current.sendContext({ kind: "state", selected_category_id: "kultur", selected_place_id: null, travel_mode: "walk" }); });
    expect(posts("/api/prototype/live/context")).toHaveLength(2);
  });

  it("lar dev-hooken bytte mikrofonspor og tilbake til den ekte mikrofonen", async () => {
    const { result, peer } = await connect();
    const clip = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
    await act(async () => { await result.current.replaceMicrophoneTrack(clip); });
    expect(peer.sender.track).toBe(clip);
    await act(async () => { await result.current.replaceMicrophoneTrack(null); });
    expect(peer.sender.track).toBe(microphone);
  });
});
