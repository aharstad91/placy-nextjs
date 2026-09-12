import 'server-only';
import { randomUUID } from 'node:crypto';

interface SupervisorIO {
  stop: (callId: string) => Promise<void>;
  save: (callId: string | null) => Promise<void>;
  read: () => Promise<string | null>;
  maxMs?: number;
  retryDelaysMs?: number[];
}
/** One local Node process owns admission and upstream cleanup, independently of the tab. */
export class RealtimeSupervisor {
  private active: { token: string; callId?: string; timer?: ReturnType<typeof setTimeout>; retryTimer?: ReturnType<typeof setTimeout>; retryAttempt: number; cleanup?: () => void } | null = null;
  private ready: Promise<void> | null = null;
  private starts: number[] = [];
  private ending: Promise<boolean> | null = null;
  constructor(private io: SupervisorIO) {}
  private retryDelays() {
    return this.io.retryDelaysMs ?? [1000, 2000, 4000, 8000, 16000];
  }
  private delay(ms: number) {
    return new Promise<void>(resolve => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });
  }
  private recover() {
    return this.ready ??= (async () => {
      const prior = await this.io.read();
      if (!prior) return;
      const delays = this.retryDelays();
      for (let attempt = 0; ; attempt += 1) {
        try {
          await this.io.stop(prior);
          await this.io.save(null);
          return;
        } catch (error) {
          if (attempt >= delays.length) throw error;
          await this.delay(delays[attempt]);
        }
      }
    })();
  }
  async reserve() {
    await this.recover();
    const now = Date.now();
    this.starts = this.starts.filter(t => now - t < 3600000);
    if (this.active || this.starts.length >= 60) throw new Error('En samtale er allerede aktiv, eller startgrensen er nådd. Avslutt den før du starter en ny.');
    const token = randomUUID();
    this.active = { token, retryAttempt: 0 };
    this.starts.push(now);
    return token;
  }
  async blockUnknown(token: string) {
    if (this.active?.token !== token) return;
    this.active.callId = "unknown";
    await this.io.save("unknown");
  }
  async attach(token: string, callId: string) {
    if (!this.active || this.active.token !== token) throw new Error('Ugyldig samtale');
    this.active.callId = callId;
    await this.io.save(callId);
    this.active.timer = setTimeout(() => { void this.end(token).catch(() => {}); }, this.io.maxMs ?? 720000);
    this.active.timer.unref?.();
  }
  setCleanup(token: string, cleanup: () => void) {
    if (this.active?.token === token) this.active.cleanup = cleanup;
    else cleanup();
  }
  async end(token: string): Promise<boolean> {
    if (!this.active || this.active.token !== token) return false;
    if (this.ending) return this.ending;
    const active = this.active;
    this.ending = (async () => {
      if (active.timer) clearTimeout(active.timer);
      if (active.retryTimer) {
        clearTimeout(active.retryTimer);
        active.retryTimer = undefined;
      }
      active.cleanup?.();
      active.cleanup = undefined;
      try {
        if (active.callId) await this.io.stop(active.callId);
        await this.io.save(null);
        this.active = null;
        return true;
      } catch (error) {
        const delay = this.retryDelays()[active.retryAttempt];
        active.retryAttempt += 1;
        if (delay !== undefined && this.active === active) {
          active.retryTimer = setTimeout(() => {
            active.retryTimer = undefined;
            void this.end(token).catch(() => {});
          }, delay);
          active.retryTimer.unref?.();
        }
        throw error;
      }
    })();
    try { return await this.ending; } finally { this.ending = null; }
  }
}
