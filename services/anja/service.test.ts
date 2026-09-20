import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnjaConversationService, createAnjaServiceHandler } from "@/services/anja/service";
import { LiveSessionRegistry } from "@/lib/live/session-registry";
import type { DelegationTiming, LiveUsage } from "@/lib/live/types";

const version = "a".repeat(64);
const source = {
  contentVersion: version,
  backendInstructions: "backend",
  voiceInstructions: "voice",
  tools: [],
  createConversation: vi.fn(() => ({ execute: vi.fn(), observeBrowserResult: vi.fn(), onContext: vi.fn() })),
  board: {},
} as never;

describe("long-lived Anja service", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test";
    process.env.ANJA_SERVICE_SECRET = "service-secret";
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANJA_SERVICE_SECRET;
  });

  it("avviser stale versjon før en betalt sesjon reserveres", async () => {
    const createSession = vi.fn();
    const service = new AnjaConversationService({
      loadSource: vi.fn(async () => source),
      createSession,
    });
    await expect(service.start({
      customer: "kunde", projectSlug: "prosjekt", contentVersion: "b".repeat(64), sdp: "v=0\r\n",
    })).rejects.toMatchObject({ status: 409 });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("beholder samme interne sesjon gjennom start og avslutning", async () => {
    const stop = vi.fn(async () => {});
    const connectSideband = vi.fn(async () => ({ onContext: vi.fn(), end: vi.fn() }));
    const registry = new LiveSessionRegistry({ stop, maxMs: 60_000 });
    const service = new AnjaConversationService({
      loadSource: vi.fn(async () => source),
      createSession: vi.fn(async () => ({ sessionId: "live_test", sdp: "answer", model: "gpt-live-1" })),
      connectSideband,
      registry,
    });
    const started = await service.start({
      customer: "kunde", projectSlug: "prosjekt", contentVersion: version, sdp: "v=0\r\n",
    });
    expect(service.registry.isActive(started.token)).toBe(true);
    expect(connectSideband).toHaveBeenCalledWith("live_test", started.token, expect.anything(), expect.objectContaining({ sessionOwner: service.registry }));
    await expect(service.end(started.token)).resolves.toEqual({ ended: true });
    expect(stop).toHaveBeenCalledWith("live_test");
  });

  it("gjenbruker samme validerte boardkilde mellom health og start", async () => {
    const loadSource = vi.fn(async () => source);
    const service = new AnjaConversationService({
      loadSource,
      createSession: vi.fn(async () => ({ sessionId: "live_test", sdp: "answer", model: "gpt-live-1" })),
      connectSideband: vi.fn(async () => ({ onContext: vi.fn(), end: vi.fn() })),
    });
    await service.health({ customer: "kunde", projectSlug: "prosjekt", contentVersion: version });
    await service.start({ customer: "kunde", projectSlug: "prosjekt", contentVersion: version, sdp: "v=0\r\n" });
    expect(loadSource).toHaveBeenCalledOnce();
  });

  it("leser på nytt når nettleseren kommer med en ny innholdsversjon", async () => {
    const next = { ...(source as unknown as Record<string, unknown>), contentVersion: "b".repeat(64) } as never;
    const loadSource = vi.fn()
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(next);
    const service = new AnjaConversationService({ loadSource });
    await service.health({ customer: "kunde", projectSlug: "prosjekt", contentVersion: version });
    await service.health({ customer: "kunde", projectSlug: "prosjekt", contentVersion: "b".repeat(64) });
    expect(loadSource).toHaveBeenCalledTimes(2);
  });

  it("lagrer bare innholdsfri driftstelemetri for tur og avsluttet samtale", async () => {
    const operationalReporter = vi.fn();
    let options: Record<string, unknown> = {};
    const service = new AnjaConversationService({
      loadSource: vi.fn(async () => source),
      createSession: vi.fn(async () => ({ sessionId: "live_test", sdp: "answer", model: "gpt-live-1" })),
      connectSideband: vi.fn(async (_session, _token, _conversation, supplied) => {
        options = supplied as unknown as Record<string, unknown>;
        return { onContext: vi.fn(), end: vi.fn() };
      }),
      operationalReporter,
    });
    await service.start({ customer: "kunde", projectSlug: "prosjekt", contentVersion: version, sdp: "v=0\r\n" });
    (options.onTiming as (timing: DelegationTiming) => void)({
      delegation_id: "discarded", offset_ms: 0, user_end_ms: 0, ack_words: "discarded", ack_ms: 1,
      first_map_call: "show_category", first_map_args: "discarded", first_map_call_ms: 2, map_ok_ms: 3,
      rounds: [], backend_done_ms: 50, answer_words: "discarded", answer_ms: 60, end: "done",
    });
    (options.onUsage as (usage: LiveUsage & { reason: string }) => void)({
      voiceSeconds: 30, backendResponses: 1, backendInputTokens: 100, backendCachedTokens: 50,
      backendOutputTokens: 20, estimatedUsd: 0.03, complete: true, reason: "manual",
    });
    await vi.waitFor(() => expect(operationalReporter).toHaveBeenCalledTimes(2));
    expect(JSON.stringify(operationalReporter.mock.calls)).not.toContain("discarded");
    expect(operationalReporter).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: "turn", customer: "kunde", projectSlug: "prosjekt", mapTool: "show_category", durationMs: 50,
    }));
    expect(operationalReporter).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: "session", customer: "kunde", projectSlug: "prosjekt", usage: expect.objectContaining({ voiceSeconds: 30 }),
    }));
  });

  it("skjuler tjenesten uten riktig intern auth", async () => {
    const handler = createAnjaServiceHandler(new AnjaConversationService({ loadSource: vi.fn(async () => source) }));
    const response = await handler(new Request(`http://anja/health?customer=kunde&projectSlug=prosjekt&contentVersion=${version}`));
    expect(response.status).toBe(404);
  });
});
