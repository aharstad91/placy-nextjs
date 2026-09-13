import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtime } from "@/lib/realtime/use-realtime";
import type { RealtimeOptions } from "@/lib/realtime/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

class FakeChannel extends EventTarget {
  readyState = "open";
  onmessage: ((message: { data: string }) => Promise<void>) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = "closed"; });
  async emit(event: unknown) { await this.onmessage?.({ data: JSON.stringify(event) }); }
  events(): Array<Record<string, unknown>> {
    return this.send.mock.calls.map(([payload]) => JSON.parse(payload));
  }
}

class FakePeer {
  static instances: FakePeer[] = [];
  channel = new FakeChannel();
  connectionState = "connected";
  ontrack = null;
  onconnectionstatechange = null;
  createDataChannel = vi.fn(() => this.channel);
  sender = { track: null as MediaStreamTrack | null, replaceTrack: vi.fn(async (track: MediaStreamTrack | null) => { this.sender.track = track; }) };
  transceiver = { direction: "sendrecv", sender: this.sender };
  addTrack = vi.fn();
  addTransceiver = vi.fn(() => this.transceiver);
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0\r\n" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  close = vi.fn();
  constructor() { FakePeer.instances.push(this); }
}

function options(executeTool = vi.fn<RealtimeOptions["executeTool"]>(() => ({ ok: true }))): RealtimeOptions {
  return {
    instructions: "Test guide",
    snapshotId: "snapshot-test",
    tools: [{ type: "function", name: "show_place", description: "Show a place", parameters: {} }],
    executeTool,
    getContext: () => "selected: home",
  };
}

function toolResponse(status = "completed", id = "call-1") {
  return { type: "response.done", response: { status, output: [
    { type: "function_call", name: "show_place", call_id: id, arguments: '{"id":"poi-1"}' },
  ] } };
}

beforeEach(() => {
  FakePeer.instances = [];
  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal("Audio", class {
    autoplay = false;
    srcObject = null;
    play = vi.fn(async () => {});
    pause = vi.fn();
    remove = vi.fn();
  });
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => init?.method === "POST"
    ? { ok: true, text: async () => "v=0\r\n" }
    : { ok: true, json: async () => ({ configured: true, model: "gpt-realtime-2.1-mini" }) }));
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Realtime lifecycle", () => {
  it("stops late microphone tracks after the user has stopped connecting", async () => {
    const microphone = deferred<MediaStream>();
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(() => microphone.promise);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const { result } = renderHook(() => useRealtime(options()));
    let started!: Promise<void>;
    await act(async () => { started = result.current.start(); });
    expect(getUserMedia).toHaveBeenCalledOnce();
    act(() => result.current.stop());
    await act(async () => {
      microphone.resolve({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
      await started;
    });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(FakePeer.instances[0].close).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not allocate a connection after stopping while health JSON is pending", async () => {
    const json = deferred<{ configured: boolean }>();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => json.promise } as Response);
    const { result } = renderHook(() => useRealtime(options()));
    let started!: Promise<void>;
    await act(async () => { started = result.current.start({ mode: "text" }); });
    act(() => result.current.stop());
    await act(async () => { json.resolve({ configured: true }); await started; });
    expect(FakePeer.instances).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("closes media and ignores a pending tool completion after unmount", async () => {
    const pending = deferred<unknown>();
    const execute = vi.fn(() => pending.promise);
    const { result, unmount } = renderHook(() => useRealtime(options(execute)));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const peer = FakePeer.instances[0];
    let received!: Promise<void>;
    await act(async () => { received = peer.channel.emit(toolResponse()); });
    const beforeUnmount = peer.channel.events().length;
    unmount();
    pending.resolve({ ok: true });
    await received;
    expect(peer.close).toHaveBeenCalledOnce();
    expect(peer.channel.close).toHaveBeenCalledOnce();
    expect(peer.channel.events()).toHaveLength(beforeUnmount);
  });

  it("asks the server to end an identified session when stopped", async () => {
    vi.mocked(fetch).mockImplementation(async (_url: unknown, init?: RequestInit) => init?.method === "POST"
      ? { ok: true, headers: { get: () => "opaque-session" }, text: async () => "v=0\r\n" } as unknown as Response
      : { ok: true, json: async () => ({ configured: true, model: "gpt-realtime-2.1-mini" }) } as Response);
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    act(() => result.current.stop());
    expect(fetch).toHaveBeenCalledWith("/api/prototype/realtime", expect.objectContaining({
      method: "DELETE",
      headers: { "X-Placy-Session": "opaque-session" },
      keepalive: true,
    }));
  });
});

describe("server cleanup and manual takeover regressions", () => {
  it("waits for DELETE before a new conversation can POST", async () => {
    const cleanup = deferred<Response>();
    vi.mocked(fetch).mockImplementation(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "DELETE") return cleanup.promise;
      if (init?.method === "POST") return { ok: true, headers: { get: () => "opaque" }, text: async () => "v=0" } as unknown as Response;
      return { ok: true, json: async () => ({ configured: true }) } as Response;
    });
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    let restart!: Promise<void>;
    await act(async () => { restart = result.current.newConversation({ mode: "text" }); });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    await act(async () => { cleanup.resolve({ ok: true } as Response); await restart; });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
    expect(result.current.status).toBe("listening");
  });
  it("retries failed cleanup on an explicit start instead of keeping a sticky failure", async () => {
    let cleanupOk = false;
    vi.mocked(fetch).mockImplementation(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "DELETE") return { ok: cleanupOk } as Response;
      if (init?.method === "POST") return { ok: true, headers: { get: () => "opaque" }, text: async () => "v=0" } as unknown as Response;
      return { ok: true, json: async () => ({ configured: true }) } as Response;
    });
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    await act(async () => { await result.current.newConversation({ mode: "text" }); });
    expect(result.current.status).toBe("error");
    cleanupOk = true;
    await act(async () => { await result.current.start({ mode: "text" }); });
    expect(result.current.status).toBe("listening");
  });
  it("never executes late map commands after manual map takeover", async () => {
    const execute = vi.fn(() => ({ ok: true }));
    const { result } = renderHook(() => useRealtime(options(execute)));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit({ type: "response.created", response: { id: "old" } }); });
    act(() => result.current.interruptForMap());
    const done = toolResponse();
    await act(async () => { await channel.emit({ ...done, response: { ...done.response, id: "old" } }); });
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(channel.events())).toContain("brukeren tar over kartet");
  });
});

describe("Realtime mode switching", () => {
  it("keeps one connection and waits for the voice session acknowledgement before attaching the microphone", async () => {
    const track = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const peer = FakePeer.instances[0];
    expect(peer.addTransceiver).toHaveBeenCalledWith("audio", { direction: "sendrecv" });

    let switching!: Promise<boolean>;
    act(() => { switching = result.current.switchMode("voice"); });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(peer.sender.replaceTrack).not.toHaveBeenCalled();
    expect(result.current.status).toBe("connecting");
    await act(async () => {
      await peer.channel.emit({ type: "session.updated", session: { output_modalities: ["audio"] } });
      await switching;
    });
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(peer.sender.replaceTrack).toHaveBeenCalledWith(track);
    expect(result.current.mode).toBe("voice");
    expect(FakePeer.instances).toHaveLength(1);
  });

  it("falls back to the same text conversation when microphone permission is denied", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => { throw new DOMException("Denied", "NotAllowedError"); }) } });
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    act(() => result.current.sendText("Behold denne historikken"));
    const peer = FakePeer.instances[0];
    let switching!: Promise<boolean>;
    act(() => { switching = result.current.switchMode("voice"); });
    await act(async () => {
      await peer.channel.emit({ type: "session.updated", session: { output_modalities: ["audio"] } });
      expect(await switching).toBe(false);
    });
    expect(result.current.mode).toBe("text");
    expect(result.current.messages.at(-1)?.text).toBe("Behold denne historikken");
    expect(result.current.error).toContain("Mikrofonen er ikke tilgjengelig");
    expect(FakePeer.instances).toHaveLength(1);
    expect(peer.channel.events().filter(event => event.type === "session.update")).toHaveLength(2);
  });

  it("removes and stops the microphone when switching back to text without greeting again", async () => {
    const track = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] })) } });
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const peer = FakePeer.instances[0];
    let toVoice!: Promise<boolean>;
    act(() => { toVoice = result.current.switchMode("voice"); });
    await act(async () => { await peer.channel.emit({ type: "session.updated", session: { output_modalities: ["audio"] } }); await toVoice; });
    let toText!: Promise<boolean>;
    act(() => { toText = result.current.switchMode("text"); });
    expect(peer.sender.replaceTrack).toHaveBeenLastCalledWith(null);
    await act(async () => { await peer.channel.emit({ type: "session.updated", session: { output_modalities: ["text"] } }); await toText; });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.mode).toBe("text");
    expect(peer.channel.events().filter(event => event.type === "response.create")).toHaveLength(0);
  });

  it("serializes a double switch and ignores a late acknowledgement for the old mode", async () => {
    const track = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] })) } });
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    let toVoice!: Promise<boolean>;
    let backToText!: Promise<boolean>;
    act(() => {
      toVoice = result.current.switchMode("voice");
      backToText = result.current.switchMode("text");
    });
    await act(async () => { await channel.emit({ type: "session.updated", session: { output_modalities: ["audio"] } }); await toVoice; });
    let finished = false;
    void backToText.then(() => { finished = true; });
    await act(async () => { await channel.emit({ type: "session.updated", session: { output_modalities: ["audio"] } }); });
    expect(finished).toBe(false);
    await act(async () => { await channel.emit({ type: "session.updated", session: { output_modalities: ["text"] } }); await backToText; });
    expect(result.current.mode).toBe("text");
    expect(FakePeer.instances).toHaveLength(1);
  });

  it("cancels a pending mode acknowledgement immediately when stopped", async () => {
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    let switching!: Promise<boolean>;
    act(() => { switching = result.current.switchMode("voice"); });
    act(() => result.current.stop());
    await expect(switching).resolves.toBe(false);
    expect(result.current.status).toBe("idle");
  });

  it("starts a new conversation explicitly and clears transcript and references", async () => {
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    act(() => result.current.sendText("Old conversation"));
    const first = FakePeer.instances[0];
    await act(async () => { await result.current.newConversation({ mode: "text" }); });
    expect(first.close).toHaveBeenCalledOnce();
    expect(result.current.messages).toEqual([]);
    expect(result.current.references).toEqual([]);
    expect(FakePeer.instances).toHaveLength(2);
  });
});

describe("Realtime response ownership", () => {
  it("executes duplicate tool calls only once and returns outputs before requesting continuation", async () => {
    const execute = vi.fn(() => ({ ok: true }));
    const { result } = renderHook(() => useRealtime(options(execute)));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit(toolResponse()); await channel.emit(toolResponse()); });
    expect(execute).toHaveBeenCalledOnce();
    expect(channel.events().filter(event => event.type !== "session.update").map(event => event.type)).toEqual([
      "conversation.item.create", "response.create",
    ]);
  });

  it("does not execute a tool from a cancelled response", async () => {
    const execute = vi.fn(() => ({ ok: true }));
    const { result } = renderHook(() => useRealtime(options(execute)));
    await act(async () => { await result.current.start({ mode: "text" }); });
    await act(async () => { await FakePeer.instances[0].channel.emit(toolResponse("cancelled")); });
    expect(execute).not.toHaveBeenCalled();
  });

  it("lets the server own knowledge tools and response continuation", async () => {
    const execute = vi.fn(() => ({ ok: true }));
    const { result } = renderHook(() => useRealtime({ ...options(execute), serverControlled: true, snapshotId: "snapshot-1" }));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit({ type: "response.done", response: { status: "completed", output: [
      { type: "function_call", name: "lookup_nyhavna", call_id: "knowledge-1", arguments: "{}" },
    ] } }); });
    expect(execute).not.toHaveBeenCalled();
    expect(channel.events().filter(event => event.type === "response.create")).toHaveLength(0);
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ snapshotId: "snapshot-1" });
  });

  it("returns map tool output but does not create the continuation when server-controlled", async () => {
    const execute = vi.fn(() => ({ ok: true, selected: "poi-1" }));
    const { result } = renderHook(() => useRealtime({ ...options(execute), serverControlled: true }));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit(toolResponse()); });
    expect(execute).toHaveBeenCalledOnce();
    expect(channel.events().map(event => event.type)).toContain("conversation.item.create");
    expect(channel.events().filter(event => event.type === "response.create")).toHaveLength(0);
  });

  it("exposes structured place references returned by a map tool", async () => {
    const execute = vi.fn(() => ({ places: [{ id: "poi-1", name: "Kafé", sources: [{ title: "Source", url: "https://example.com" }] }] }));
    const { result } = renderHook(() => useRealtime(options(execute)));
    await act(async () => { await result.current.start({ mode: "text" }); });
    await act(async () => { await FakePeer.instances[0].channel.emit(toolResponse()); });
    expect(result.current.references).toMatchObject([{ id: "poi-1", name: "Kafé", sources: [{ title: "Source", url: "https://example.com" }] }]);
  });

  it("does not resume an old tool response after the user asks a new question", async () => {
    const pending = deferred<unknown>();
    const { result } = renderHook(() => useRealtime(options(vi.fn(() => pending.promise))));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    let received!: Promise<void>;
    await act(async () => { received = channel.emit(toolResponse()); });
    act(() => result.current.sendText("Show somewhere else"));
    await act(async () => { pending.resolve({ ok: true }); await received; });
    expect(channel.events().filter(event => event.type === "response.create")).toHaveLength(1);
  });

  it("uses the newest context and handler when options change", async () => {
    const first = options();
    const updated = { ...options(), instructions: "Updated guide", getContext: () => "selected: poi-2" };
    const { result, rerender } = renderHook((props: RealtimeOptions) => useRealtime(props), { initialProps: first });
    await act(async () => { await result.current.start({ mode: "text" }); });
    rerender(updated);
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit(toolResponse()); });
    expect(first.executeTool).not.toHaveBeenCalled();
    expect(updated.executeTool).toHaveBeenCalledOnce();
    expect(channel.events().some(event => event.type === "session.update")).toBe(false);
    const context = channel.events().find(event => event.type === "conversation.item.create" && (event.item as { role?: string }).role === "system");
    expect(JSON.stringify(context)).toContain("selected: poi-2");
    const before = channel.events().length;
    rerender({ ...updated });
    expect(channel.events()).toHaveLength(before);
  });
});


describe("Realtime early map execution", () => {
  it("runs a server-controlled map call as soon as its item is done, once, and skips it at response.done", async () => {
    const executeTool = vi.fn(() => ({ ok: true, shown: "A" }));
    const { result } = renderHook(() => useRealtime({ ...options(executeTool), serverControlled: true }));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit({ type: "response.created", response: { id: "r1" } }); });
    await act(async () => { await channel.emit({ type: "response.output_item.done", response_id: "r1", item: { type: "function_call", name: "show_place", call_id: "call-early", arguments: '{"poi_id":"a"}' } }); });
    expect(executeTool).toHaveBeenCalledOnce();
    expect(channel.events().filter(event => event.type === "conversation.item.create" && (event.item as { call_id?: string }).call_id === "call-early")).toHaveLength(1);
    await act(async () => { await channel.emit({ type: "response.done", response: { id: "r1", status: "completed", output: [{ type: "function_call", name: "show_place", call_id: "call-early", arguments: '{"poi_id":"a"}' }] } }); });
    expect(executeTool).toHaveBeenCalledOnce();
    expect(channel.events().filter(event => event.type === "response.create")).toHaveLength(0);
  });
  it("does not run an early map call from a response that belongs to an interrupted turn", async () => {
    const executeTool = vi.fn(() => ({ ok: true }));
    const { result } = renderHook(() => useRealtime({ ...options(executeTool), serverControlled: true }));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    await act(async () => { await channel.emit({ type: "response.created", response: { id: "old" } }); });
    act(() => { result.current.interruptForMap(); });
    await act(async () => { await channel.emit({ type: "response.output_item.done", response_id: "old", item: { type: "function_call", name: "show_place", call_id: "late", arguments: "{}" } }); });
    expect(executeTool).not.toHaveBeenCalled();
  });
  it("greets without naming itself when no greeting is given", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => ({ getAudioTracks: () => [{ stop: vi.fn(), enabled: true }], getTracks: () => [{ stop: vi.fn() }] })) } });
    const { result } = renderHook(() => useRealtime({ ...options(), serverControlled: true }));
    await act(async () => { await result.current.start({ mode: "voice" }); });
    const greeting = FakePeer.instances[0].channel.events().find(event => event.type === "response.create") as { response?: { instructions?: string } } | undefined;
    expect(greeting?.response?.instructions).toBeTruthy();
    expect(greeting?.response?.instructions).not.toMatch(/Placy/);
  });
});

describe("Realtime cost controls", () => {
  it("closes an idle connection after two minutes but lets an active answer finish", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const peer = FakePeer.instances[0];
    await act(async () => { await peer.channel.emit({ type: "response.created" }); });
    act(() => { vi.advanceTimersByTime(130000); });
    expect(peer.close).not.toHaveBeenCalled();
    await act(async () => { await peer.channel.emit({ type: "response.done", response: { status: "completed" } }); });
    act(() => { vi.advanceTimersByTime(120000); });
    expect(peer.close).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
  });
  it("finishes a long tool chain without tools and resets for the next question", async () => {
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const channel = FakePeer.instances[0].channel;
    for (let i = 0; i < 6; i++) await act(async () => { await channel.emit(toolResponse("completed", `call-${i}`)); });
    expect(channel.events().at(-1)).toMatchObject({ type: "response.create", response: { tool_choice: "none" } });
    act(() => { result.current.sendText("Et nytt spørsmål"); });
    await act(async () => { await channel.emit(toolResponse("completed", "new-call")); });
    expect(channel.events().at(-1)).toEqual({ type: "response.create" });
  });
  it("counts billable failed responses once and retains the estimate when stopped", async () => {
    const { result } = renderHook(() => useRealtime(options()));
    await act(async () => { await result.current.start({ mode: "text" }); });
    const event = { type: "response.done", response: { id: "resp-1", status: "failed", usage: { input_tokens: 1000, output_tokens: 100, input_token_details: { text_tokens: 1000 }, output_token_details: { text_tokens: 100 } } } };
    await act(async () => { await FakePeer.instances[0].channel.emit(event); await FakePeer.instances[0].channel.emit(event); });
    act(() => result.current.stop());
    expect(result.current.usage.responses).toBe(1);
    expect(result.current.usage.estimatedUsd).toBeCloseTo(0.00084, 8);
  });
});

it("stops acquired microphone tracks if attaching them fails", async () => {
  const track = { stop: vi.fn(), enabled: true };
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] })) } });
  const { result } = renderHook(() => useRealtime(options()));
  await act(async () => { await result.current.start({ mode: "text" }); });
  const peer = FakePeer.instances[0];
  peer.sender.replaceTrack.mockRejectedValueOnce(new Error("attach failed"));
  let switching!: Promise<boolean>;
  await act(async () => { switching = result.current.switchMode("voice"); });
  await act(async () => { await peer.channel.emit({ type: "session.updated", session: { output_modalities: ["audio"] } }); await switching; });
  expect(track.stop).toHaveBeenCalledOnce();
  expect(result.current.mode).toBe("text");
  expect(result.current.muted).toBe(true);
});
