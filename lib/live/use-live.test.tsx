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
  it.each(["Stopp!", "Vent litt."])("viser lytting etter %s uten å vente på et svar som ikke skal komme", async text => {
    vi.useFakeTimers();
    const { result, peer } = await connect();
    act(() => { peer.channel.emit({ type: "session.input_transcript.delta", delta: text, start_ms: 100, end_ms: 500 }); });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(result.current.status).toBe("listening");
    act(() => { peer.channel.emit({ type: "session.input_transcript.delta", delta: "Hva med kaféer?", start_ms: 6000, end_ms: 6500 }); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe("thinking");
  });

  it("venter på svar når et avbrudd fortsetter med et spørsmål i neste fragment", async () => {
    vi.useFakeTimers();
    const { result, peer } = await connect();
    act(() => { peer.channel.emit({ type: "session.input_transcript.delta", delta: "Stopp.", start_ms: 100, end_ms: 500 }); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe("listening");
    act(() => { peer.channel.emit({ type: "session.input_transcript.delta", delta: " Hva med kaféer?", start_ms: 550, end_ms: 900 }); });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe("thinking");
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
  it("slipper ekstrautvalget gjennom SSE bare for lokal Nyhavna-demo", async () => {
    const executeTool = vi.fn(() => ({ ok: true, shown: "CrossFit Trondheim" }));
    const { events } = await connect({ ...options(executeTool), dataset: "nyhavna-lokal" });
    await act(async () => { events.emit({ type: "map", directive: { id: "reserve-1", name: "reveal_places", args: { poi_ids: ["crossfit-trondheim"] } } }); });
    expect(executeTool).toHaveBeenCalledWith("reveal_places", { poi_ids: ["crossfit-trondheim"] });
    expect(JSON.parse(String(posts("/api/prototype/live/map")[0][1]?.body)).output).toMatchObject({ ok: true });
  });
  it("avviser ekstrautvalg-direktivet på andre demoer", async () => {
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

class FakeControl {
  static OPEN = 1;
  static instances: FakeControl[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; });
  constructor(readonly url: URL) { FakeControl.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
  frames() { return this.send.mock.calls.map(([value]) => JSON.parse(value)); }
}

describe("Hosted control ownership", () => {
  beforeEach(() => {
    FakeControl.instances = [];
    vi.stubGlobal("WebSocket", FakeControl);
    const localFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (!init?.method) return { ok: true, json: async () => ({ configured: true, protocol: "live", snapshotId: "snapshot-test", transport: "websocket", warningMs: 1560000 }) } as Response;
      return localFetch(url, init);
    });
  });

  async function hosted(hookOptions = options(), ready = true) {
    const view = renderHook(() => useLive(hookOptions));
    let started!: Promise<void>;
    await act(async () => { started = view.result.current.start(); });
    const control = FakeControl.instances.at(-1)!;
    const peer = FakePeer.instances.at(-1)!;
    expect(control).toBeDefined();
    await act(async () => { control.open(); });
    if (ready) await act(async () => {
      control.emit({ type: "ready", sdp: "v=0\r\nhosted", sessionId: "hosted", warningMs: 1560000 });
      peer.channel.emit({ type: "session.started" });
      await started;
    });
    return { ...view, control, peer, started };
  }

  it("routes SDP, context and map results over one same-origin socket", async () => {
    const { control, peer, result } = await hosted({ ...options(), testRunId: "run-1", scenarioId: "scenario-1" } as LiveOptions);
    expect(control.url.pathname).toBe("/api/live/control");
    expect(control.url.host).toBe(window.location.host);
    expect(control.frames()[0]).toMatchObject({ type: "start", sdp: "v=0\r\nlocal", snapshotId: "snapshot-test", testRunId: "run-1", scenarioId: "scenario-1" });
    expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0\r\nhosted" });
    expect(control.frames()).toContainEqual({ type: "context", message: { kind: "state", selected_category_id: "mat", selected_place_id: null, travel_mode: "walk" } });
    await act(async () => { control.emit({ type: "map", directive: { id: "m1", name: "show_place", args: { poi_id: "dora" } } }); });
    expect(control.frames()).toContainEqual({ type: "map_result", id: "m1", output: { ok: true } });
    expect(result.current.status).toBe("listening");
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("does not spend the media acknowledgement timeout waiting for microphone permission", async () => {
    vi.useFakeTimers();
    let grant!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(() => new Promise(resolve => { grant = resolve; }));
    const view = renderHook(() => useLive(options()));
    let started!: Promise<void>;
    await act(async () => { started = view.result.current.start(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
    expect(FakeControl.instances).toHaveLength(0);
    await act(async () => { grant({ getTracks: () => [microphone], getAudioTracks: () => [microphone] } as unknown as MediaStream); });
    const control = FakeControl.instances[0];
    await act(async () => {
      control.open(); control.emit({ type: "ready", sdp: "answer" });
      FakePeer.instances[0].channel.emit({ type: "session.started" });
      await started;
    });
    expect(view.result.current.status).toBe("listening");
  });

  it("allows slow hosted admission before starting the separate media timeout", async () => {
    vi.useFakeTimers();
    const { result, control, peer, started } = await hosted(options(), false);
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });
    expect(result.current.status).toBe("connecting");
    expect(control.close).not.toHaveBeenCalled();
    await act(async () => { control.emit({ type: "ready", sdp: "answer" }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await act(async () => { peer.channel.emit({ type: "session.started" }); await started; });
    expect(result.current.status).toBe("listening");
  });

  it("still stops a hosted handshake that never returns", async () => {
    vi.useFakeTimers();
    const { result, control, peer, started } = await hosted(options(), false);
    await act(async () => { await vi.advanceTimersByTimeAsync(75_000); await started; });
    expect(result.current.status).toBe("error");
    expect(control.frames().at(-1)).toEqual({ type: "stop" });
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it("stops if media never acknowledges after the hosted SDP is ready", async () => {
    vi.useFakeTimers();
    const { result, control, peer, started } = await hosted(options(), false);
    await act(async () => { control.emit({ type: "ready", sdp: "answer" }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); await started; });
    expect(result.current.status).toBe("error");
    expect(control.frames().at(-1)).toEqual({ type: "stop" });
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it("isolates concurrent hooks and refuses invalid map commands", async () => {
    const firstTool = vi.fn(() => ({ ok: true }));
    const secondTool = vi.fn(() => ({ ok: true }));
    const first = await hosted(options(firstTool));
    const second = await hosted(options(secondTool));
    await act(async () => { first.control.emit({ type: "map", directive: { id: "m1", name: "show_place", args: { poi_id: "dora" } } }); second.control.emit({ type: "map", directive: { id: "bad", name: "read_secret", args: {} } }); });
    expect(firstTool).toHaveBeenCalledOnce();
    expect(secondTool).not.toHaveBeenCalled();
    expect(first.control.frames().filter(frame => frame.type === "map_result")).toEqual([{ type: "map_result", id: "m1", output: { ok: true } }]);
    expect(second.control.frames().find(frame => frame.type === "map_result").output.error).toBeTruthy();
  });

  it("mutes immediately but drains final usage until ended", async () => {
    const { result, control, peer } = await hosted();
    act(() => result.current.stop());
    expect(result.current.status).toBe("idle");
    expect(microphone.enabled).toBe(false);
    expect(control.frames().at(-1)).toEqual({ type: "stop" });
    expect(peer.close).not.toHaveBeenCalled();
    act(() => peer.channel.emit({ type: "session.usage.updated", usage: { seconds: 51 } }));
    expect(result.current.usage.voiceSeconds).toBe(51);
    act(() => control.emit({ type: "ended", reason: "client", message: "Stopped" }));
    expect(peer.close).toHaveBeenCalledOnce();
    expect(control.close).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
  });

  it("bounds drainage to eight seconds", async () => {
    vi.useFakeTimers();
    const { result, peer } = await hosted();
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(7999));
    expect(peer.close).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it("stops an in-flight creation and ignores a late ready", async () => {
    const { result, peer, control, started } = await hosted(options(), false);
    await act(async () => { result.current.stop(); await started; });
    expect(control.frames().at(-1)).toEqual({ type: "stop" });
    act(() => control.emit({ type: "ready", sdp: "late", sessionId: "late" }));
    expect(peer.setRemoteDescription).not.toHaveBeenCalled();
    act(() => control.emit({ type: "ended", reason: "client", message: "Stopped" }));
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it("warns at the hosted deadline and keeps greeting behavior", async () => {
    vi.useFakeTimers();
    const { result, peer } = await hosted();
    const greeting = peer.channel.events().find(event => event.type === "session.instructions.append");
    expect(greeting?.content).toBe("Si hei på norsk.");
    act(() => peer.channel.emit({ type: "session.instructions.appended", client_event_id: greeting?.event_id }));
    expect(peer.channel.events().filter(event => event.type === "session.commentary.append")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1560000));
    expect(result.current.notice).toContain("to minutter");
  });

  it("closes a connecting socket without sending a paid start", async () => {
    const view = renderHook(() => useLive(options()));
    let started!: Promise<void>;
    await act(async () => { started = view.result.current.start(); });
    const control = FakeControl.instances[0];
    await act(async () => { view.result.current.stop(); await started; });
    act(() => control.open());
    expect(control.close).toHaveBeenCalledOnce();
    expect(control.frames()).toHaveLength(0);
  });

  it("ignores old map results after an explicit restart", async () => {
    let finish!: (value: unknown) => void;
    const oldTool = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const first = await hosted(options(oldTool));
    act(() => first.control.emit({ type: "map", directive: { id: "slow", name: "show_place", args: {} } }));
    act(() => first.result.current.stop());
    let restarted!: Promise<void>;
    await act(async () => { restarted = first.result.current.start(); });
    expect(FakeControl.instances).toHaveLength(1);
    await act(async () => first.control.emit({ type: "ended", reason: "client", message: "Stopped" }));
    expect(FakeControl.instances).toHaveLength(2);
    const next = FakeControl.instances[1];
    const nextPeer = FakePeer.instances[1];
    await act(async () => {
      next.open(); next.emit({ type: "ready", sdp: "next", sessionId: "next" });
      nextPeer.channel.emit({ type: "session.started" }); await restarted;
      finish({ ok: true });
      first.control.emit({ type: "ended", reason: "late", message: "Late" });
    });
    expect(first.result.current.status).toBe("listening");
    expect(next.frames().filter(frame => frame.type === "map_result")).toHaveLength(0);
    expect(nextPeer.close).not.toHaveBeenCalled();
  });

  it("makes lost control explicit without reconnecting or creating another paid session", async () => {
    const { result, control, peer } = await hosted();
    act(() => control.onclose?.());
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Trykk start");
    expect(peer.close).toHaveBeenCalledOnce();
    expect(FakeControl.instances).toHaveLength(1);
  });
});
