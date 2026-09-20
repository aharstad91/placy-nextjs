import "server-only";

import { randomUUID } from "node:crypto";
import type { LiveSessionOwner } from "@/lib/live/sideband";

interface RunningSession {
  upstreamId?: string;
  timer?: ReturnType<typeof setTimeout>;
  cleanup?: (reason: string) => void;
}

/**
 * Prosesslokal eier for en langlivet Anja-tjeneste.
 *
 * Next-gatewayen er statsløs; denne prosessen eier sideband, kartbro og
 * opprydding for flere samtidige boards. En instans skal derfor aldri bo i en
 * serverless route.
 */
export class LiveSessionRegistry implements LiveSessionOwner {
  private sessions = new Map<string, RunningSession>();
  private starts: number[] = [];

  constructor(
    private readonly options: {
      stop: (upstreamId: string) => Promise<void>;
      maxMs: number;
      maxConcurrent?: number;
      startsPerHour?: number;
    },
  ) {}

  reserve(): string {
    const now = Date.now();
    this.starts = this.starts.filter((time) => now - time < 3_600_000);
    if (this.sessions.size >= (this.options.maxConcurrent ?? 20)) {
      throw new Error("Samtaletjenesten har nådd kapasitetsgrensen.");
    }
    if (this.starts.length >= (this.options.startsPerHour ?? 600)) {
      throw new Error("Samtaletjenesten har nådd startgrensen.");
    }
    const token = randomUUID();
    this.sessions.set(token, {});
    this.starts.push(now);
    return token;
  }

  isActive(token: string): boolean {
    return this.sessions.has(token);
  }

  attach(token: string, upstreamId: string): void {
    const session = this.sessions.get(token);
    if (!session) throw new Error("Ukjent samtale.");
    session.upstreamId = upstreamId;
    session.timer = setTimeout(() => {
      void this.end(token, "limit").catch(() => {});
    }, this.options.maxMs);
    session.timer.unref?.();
  }

  setCleanup(token: string, cleanup: (reason: string) => void): void {
    const session = this.sessions.get(token);
    if (session) session.cleanup = cleanup;
    else cleanup("connection");
  }

  async end(token: string, reason = "manual"): Promise<boolean> {
    const session = this.sessions.get(token);
    if (!session) return false;
    this.sessions.delete(token);
    if (session.timer) clearTimeout(session.timer);
    session.cleanup?.(reason);
    if (session.upstreamId) await this.options.stop(session.upstreamId);
    return true;
  }
}
