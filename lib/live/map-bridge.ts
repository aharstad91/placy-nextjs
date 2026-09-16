import type { LiveServerMessage, MapDirective } from '@/lib/live/types';

/**
 * Broen mellom serveren og kartet i nettleseren (2026-09-13).
 *
 * Kartkommandoer går ikke lenger via modellens datakanal: serveren sender et
 * direktiv over SSE og venter på kartstatus tilbake over HTTP. Én eier per
 * handling. Brua lever i minnet på `globalThis` – demoen er én Node-prosess,
 * akkurat som supervisoren.
 */
const DISPATCH_TIMEOUT_MS = 10000;
const QUEUE_MAX = 20;
export const MAP_TIMEOUT_OUTPUT = { error: 'Kartet svarte ikke. Ikke påstå at det ble flyttet.' } as const;
export const MAP_CANCELLED_OUTPUT = { error: 'superseded: brukeren gikk videre' } as const;

type Listener = (message: LiveServerMessage) => void;

export interface MapBridge {
  /** Send et direktiv til kartet. `result` løses ALLTID – timeout gir en feiltekst. `id` kan kanselleres. */
  dispatch(name: string, args: Record<string, unknown>): { id: string; result: Promise<unknown> };
  /** Én nettleser om gangen; en ny abonnent overtar strømmen. Returnerer avmelding. */
  subscribe(listener: Listener): () => void;
  /** Nettleserens svar. false = ukjent eller alt avgjort direktiv (dobbelt svar). */
  resolve(id: string, output: unknown): boolean;
  /** Direktivet gjelder ikke lenger (brukeren gikk videre): svaret ignoreres. */
  cancel(id: string): void;
  send(message: LiveServerMessage): void;
  close(): void;
}

interface Pending { resolve: (output: unknown) => void; timer: ReturnType<typeof setTimeout> }

class Bridge implements MapBridge {
  private listener: Listener | null = null;
  private queue: LiveServerMessage[] = [];
  private pending = new Map<string, Pending>();
  private closed = false;
  private counter = 0;

  dispatch(name: string, args: Record<string, unknown>) {
    const directive: MapDirective = { id: `map_${++this.counter}_${Date.now().toString(36)}`, name, args };
    if (this.closed) return { id: directive.id, result: Promise.resolve(MAP_TIMEOUT_OUTPUT as unknown) };
    const result = new Promise<unknown>(resolve => {
      const timer = setTimeout(() => {
        // Samme frist dekker «nettleseren svarte ikke» og «ingen nettleser lyttet».
        this.pending.delete(directive.id);
        this.drop(directive.id);
        resolve(MAP_TIMEOUT_OUTPUT);
      }, DISPATCH_TIMEOUT_MS);
      timer.unref?.();
      this.pending.set(directive.id, { resolve, timer });
      this.send({ type: 'map', directive });
    });
    return { id: directive.id, result };
  }

  subscribe(listener: Listener) {
    this.listener = listener;
    const queued = this.queue;
    this.queue = [];
    for (const message of queued) listener(message);
    return () => { if (this.listener === listener) this.listener = null; };
  }

  resolve(id: string, output: unknown) {
    const pending = this.pending.get(id);
    if (!pending) return false;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    pending.resolve(output);
    return true;
  }

  cancel(id: string) {
    const pending = this.pending.get(id);
    if (pending) {
      this.pending.delete(id);
      clearTimeout(pending.timer);
      pending.resolve(MAP_CANCELLED_OUTPUT);
    }
    this.drop(id);
  }

  send(message: LiveServerMessage) {
    if (this.closed) return;
    if (this.listener) { this.listener(message); return; }
    // Direktiver før SSE er koblet til: køen tømmes ved første abonnent. Taket
    // hindrer at en nettleser som aldri kommer tilbake spiser minne.
    this.queue.push(message);
    if (this.queue.length > QUEUE_MAX) this.queue.shift();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const [id] of this.pending) this.resolve(id, MAP_TIMEOUT_OUTPUT);
    this.queue = [];
    this.listener = null;
  }

  /** Fjern et direktiv som fortsatt ligger i køen (ingen nettleser har sett det). */
  private drop(id: string) {
    this.queue = this.queue.filter(message => message.type !== 'map' || message.directive.id !== id);
  }
}

/** A connection-owned bridge, independent of the local demo registry. */
export function createMapBridge(): MapBridge { return new Bridge(); }

const globals = globalThis as typeof globalThis & { placyMapBridges?: Map<string, MapBridge> };

export function getMapBridge(token: string): MapBridge {
  globals.placyMapBridges ??= new Map();
  let bridge = globals.placyMapBridges.get(token);
  if (!bridge) { bridge = new Bridge(); globals.placyMapBridges.set(token, bridge); }
  return bridge;
}

export function peekMapBridge(token: string): MapBridge | undefined {
  return globals.placyMapBridges?.get(token);
}

export function disposeMapBridge(token: string) {
  const bridge = globals.placyMapBridges?.get(token);
  if (!bridge) return;
  bridge.close();
  globals.placyMapBridges?.delete(token);
}
