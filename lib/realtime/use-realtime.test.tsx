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
  addTrack = vi.fn();
  addTransceiver = vi.fn();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0\r\n" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  close = vi.fn();
  constructor() { FakePeer.instances.push(this); }
}

function options(executeTool = vi.fn<RealtimeOptions["executeTool"]>(() => ({ ok: true }))): RealtimeOptions {
  return {
    instructions: "Test guide",
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
