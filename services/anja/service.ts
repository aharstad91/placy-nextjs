import "server-only";

import { timingSafeEqual } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { createLiveSession, LiveSessionError } from "@/lib/live/create-session";
import { liveHangup, LIVE_SESSION_ID } from "@/lib/live/hangup";
import { getMapBridge, peekMapBridge } from "@/lib/live/map-bridge";
import {
  boardIdentitySchema,
  liveContextSchema,
  mapResultSchema,
  startBoardSessionSchema,
  type StartBoardSession,
} from "@/lib/live/anja-protocol";
import { loadProductionAssistantSource } from "@/lib/live/production-board";
import { liveSessionConfig } from "@/lib/live/session-config";
import { LiveSessionRegistry } from "@/lib/live/session-registry";
import { connectLiveSideband, getLiveSideband } from "@/lib/live/sideband";
import type { DelegationTiming, LiveServerMessage, LiveUsage } from "@/lib/live/types";

const HEARTBEAT_MS = 15_000;
const MAX_BODY = 50_000;

export class AnjaServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "AnjaServiceError";
  }
}

type Source = NonNullable<Awaited<ReturnType<typeof loadProductionAssistantSource>>>;

export interface AnjaServiceDependencies {
  loadSource?: typeof loadProductionAssistantSource;
  createSession?: typeof createLiveSession;
  connectSideband?: typeof connectLiveSideband;
  registry?: LiveSessionRegistry;
  operationalReporter?: (event: AnjaOperationalEvent) => void | Promise<void>;
}

export type AnjaOperationalEvent =
  | {
      type: "turn";
      recordedAt: string;
      customer: string;
      projectSlug: string;
      contentVersion: string;
      durationMs: number;
      mapTool: string | null;
      backendRounds: number;
      end: DelegationTiming["end"];
    }
  | {
      type: "session";
      recordedAt: string;
      customer: string;
      projectSlug: string;
      contentVersion: string;
      wallDurationMs: number;
      usage: LiveUsage;
      reason: string;
    };

async function appendOperationalReport(event: AnjaOperationalEvent) {
  const directory = join(process.cwd(), ".context");
  await mkdir(directory, { recursive: true });
  await appendFile(join(directory, "anja-sessions.jsonl"), `${JSON.stringify(event)}\n`);
}

/** Den langlivede prosessen som eier hele livsløpet til en Anja-samtale. */
export class AnjaConversationService {
  readonly registry: LiveSessionRegistry;
  private readonly loadSource: typeof loadProductionAssistantSource;
  private readonly createSession: typeof createLiveSession;
  private readonly connectSideband: typeof connectLiveSideband;
  private readonly operationalReporter: (event: AnjaOperationalEvent) => void | Promise<void>;
  private readonly sources = new Map<string, Promise<Source>>();

  constructor(dependencies: AnjaServiceDependencies = {}) {
    this.loadSource = dependencies.loadSource ?? loadProductionAssistantSource;
    this.createSession = dependencies.createSession ?? createLiveSession;
    this.connectSideband = dependencies.connectSideband ?? connectLiveSideband;
    this.operationalReporter = dependencies.operationalReporter ?? appendOperationalReport;
    this.registry = dependencies.registry ?? new LiveSessionRegistry({
      stop: liveHangup,
      maxMs: Number(process.env.ANJA_SESSION_MAX_MS) || 15 * 60_000,
      maxConcurrent: Number(process.env.ANJA_MAX_CONCURRENT) || 20,
      startsPerHour: Number(process.env.ANJA_STARTS_PER_HOUR) || 600,
    });
  }

  private async source(customer: string, projectSlug: string, contentVersion: string): Promise<Source> {
    const key = `${customer}/${projectSlug}/${contentVersion}`;
    let pending = this.sources.get(key);
    if (!pending) {
      pending = this.loadSource(customer, projectSlug).then((source) => {
        if (!source) throw new AnjaServiceError(404, "Assistenten er ikke aktivert for dette boardet.");
        return source;
      });
      this.sources.set(key, pending);
      if (this.sources.size > 20) this.sources.delete(this.sources.keys().next().value!);
      pending.catch(() => this.sources.delete(key));
    }
    return pending;
  }

  async health(identity: z.infer<typeof boardIdentitySchema>) {
    const source = await this.source(identity.customer, identity.projectSlug, identity.contentVersion);
    if (source.contentVersion !== identity.contentVersion) {
      throw new AnjaServiceError(409, "Datagrunnlaget er oppdatert. Last boardet på nytt.");
    }
    return { configured: Boolean(process.env.OPENAI_API_KEY), protocol: "live" as const };
  }

  async start(input: StartBoardSession) {
    if (!process.env.OPENAI_API_KEY) throw new AnjaServiceError(503, "Tale er ikke koblet til ennå.");
    const source = await this.source(input.customer, input.projectSlug, input.contentVersion);
    if (source.contentVersion !== input.contentVersion) {
      throw new AnjaServiceError(409, "Datagrunnlaget er oppdatert. Last boardet på nytt.");
    }
    let token: string;
    try { token = this.registry.reserve(); }
    catch { throw new AnjaServiceError(429, "Samtalegrensen er nådd. Prøv igjen senere."); }
    let identityKnown = false;
    const startedAt = Date.now();
    const report = (event: AnjaOperationalEvent) => {
      void Promise.resolve(this.operationalReporter(event)).catch(() => {});
    };
    try {
      const config = liveSessionConfig(source.voiceInstructions, source.backendInstructions, source.tools, input.voice);
      const created = await this.createSession(config, input.sdp);
      identityKnown = true;
      if (!LIVE_SESSION_ID.test(created.sessionId)) {
        throw new AnjaServiceError(503, "Taletjenesten svarte med en ukjent sesjon.");
      }
      this.registry.attach(token, created.sessionId);
      if (created.model && !created.model.startsWith("gpt-live")) {
        throw new AnjaServiceError(503, "Taletjenesten svarte med en ukjent sesjon.");
      }
      await this.connectSideband(created.sessionId, token, source.createConversation(), {
        backendInstructions: source.backendInstructions,
        sessionOwner: this.registry,
        logging: "silent",
        onTiming: (timing) => report({
          type: "turn",
          recordedAt: new Date().toISOString(),
          customer: input.customer,
          projectSlug: input.projectSlug,
          contentVersion: input.contentVersion,
          durationMs: timing.backend_done_ms ?? 0,
          mapTool: timing.first_map_call,
          backendRounds: timing.rounds.length,
          end: timing.end,
        }),
        onUsage: ({ reason, ...usage }) => report({
          type: "session",
          recordedAt: new Date().toISOString(),
          customer: input.customer,
          projectSlug: input.projectSlug,
          contentVersion: input.contentVersion,
          wallDurationMs: Date.now() - startedAt,
          usage,
          reason,
        }),
      });
      return { token, sdp: created.sdp, sessionId: created.sessionId };
    } catch (error) {
      await this.registry.end(token, "error").catch(() => {});
      if (error instanceof AnjaServiceError) throw error;
      if (error instanceof LiveSessionError) {
        const quota = error.code === "insufficient_quota" || error.code === "credit_balance_exhausted";
        throw new AnjaServiceError(error.status === 429 || quota ? 429 : 502, quota
          ? "Samtalegrensen er nådd. Prøv igjen senere."
          : "Samtalen kunne ikke klargjøres. Prøv igjen.");
      }
      if (!identityKnown) throw new AnjaServiceError(503, "Samtalen kunne ikke klargjøres. Prøv igjen.");
      throw new AnjaServiceError(503, "Samtalen kunne ikke klargjøres. Prøv igjen.");
    }
  }

  async context(token: string, message: z.infer<typeof liveContextSchema>) {
    if (!this.registry.isActive(token)) throw new AnjaServiceError(404, "Samtalen er ikke aktiv.");
    const sideband = getLiveSideband(token);
    if (!sideband) throw new AnjaServiceError(409, "Samtalen er ikke klar ennå.");
    sideband.onContext(message);
    return { ok: true };
  }

  mapStream(token: string, signal: AbortSignal): Response {
    if (!this.registry.isActive(token)) throw new AnjaServiceError(404, "Samtalen er ikke aktiv.");
    const bridge = getMapBridge(token);
    const encoder = new TextEncoder();
    let unsubscribe = () => {};
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (message: LiveServerMessage) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`)); } catch { /* lukket */ }
        };
        write({ type: "hello" });
        unsubscribe = bridge.subscribe((message) => {
          write(message);
          if (message.type === "ended") { try { controller.close(); } catch { /* lukket */ } }
        });
        heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { /* lukket */ }
        }, HEARTBEAT_MS);
        heartbeat.unref?.();
        signal.addEventListener("abort", () => { try { controller.close(); } catch { /* lukket */ } }, { once: true });
      },
      cancel() { unsubscribe(); clearInterval(heartbeat); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    } });
  }

  mapResult(token: string, result: z.infer<typeof mapResultSchema>) {
    if (!this.registry.isActive(token)) throw new AnjaServiceError(404, "Samtalen er ikke aktiv.");
    return { accepted: Boolean(peekMapBridge(token)?.resolve(result.id, result.output)) };
  }

  async end(token: string) {
    return { ended: await this.registry.end(token, "manual") };
  }
}

function authorized(request: Request): boolean {
  const configured = process.env.ANJA_SERVICE_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function jsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY) throw new AnjaServiceError(413, "Forespørselen er for stor.");
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new AnjaServiceError(413, "Forespørselen er for stor.");
  try { return JSON.parse(raw); }
  catch { throw new AnjaServiceError(400, "Ugyldig forespørsel."); }
}

/** HTTP-kontrakten brukes både av Node-adapteren og deterministiske tester. */
export function createAnjaServiceHandler(service = new AnjaConversationService()) {
  return async (request: Request): Promise<Response> => {
    if (!authorized(request)) return new Response(null, { status: 404 });
    const url = new URL(request.url);
    const token = request.headers.get("x-anja-session") ?? "";
    try {
      let result: unknown;
      if (request.method === "GET" && url.pathname === "/health") {
        result = await service.health(boardIdentitySchema.parse(Object.fromEntries(url.searchParams)));
      } else if (request.method === "POST" && url.pathname === "/sessions") {
        result = await service.start(startBoardSessionSchema.parse(await jsonBody(request)));
      } else if (request.method === "DELETE" && url.pathname === "/sessions") {
        if (!token) throw new AnjaServiceError(400, "Samtale mangler.");
        result = await service.end(token);
      } else if (request.method === "POST" && url.pathname === "/sessions/context") {
        if (!token) throw new AnjaServiceError(400, "Samtale mangler.");
        result = await service.context(token, liveContextSchema.parse(await jsonBody(request)));
      } else if (request.method === "GET" && url.pathname === "/sessions/map") {
        if (!token) throw new AnjaServiceError(400, "Samtale mangler.");
        return service.mapStream(token, request.signal);
      } else if (request.method === "POST" && url.pathname === "/sessions/map") {
        if (!token) throw new AnjaServiceError(400, "Samtale mangler.");
        result = service.mapResult(token, mapResultSchema.parse(await jsonBody(request)));
      } else return new Response(null, { status: 404 });
      const response = result as Record<string, unknown>;
      const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
      const internalToken = typeof response.token === "string" ? response.token : null;
      if (internalToken) { headers.set("X-Anja-Session", internalToken); delete response.token; }
      return new Response(JSON.stringify(response), { status: 200, headers });
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "Ugyldig forespørsel." }, { status: 400 });
      const status = error instanceof AnjaServiceError ? error.status : 503;
      const message = error instanceof AnjaServiceError ? error.message : "Tjenesten er midlertidig utilgjengelig.";
      return Response.json({ error: message }, { status });
    }
  };
}
