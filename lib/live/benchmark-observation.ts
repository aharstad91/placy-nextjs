import type { LiveMessage, LiveStatus } from '@/lib/live/types';

export interface AssistantCursor { id: string; length: number }
type BenchmarkWindow = Window & {
  placyVoice: { messages(): LiveMessage[]; status(): LiveStatus };
  placyBenchmarkQuiet?: { cursor: string; since: number };
};

// Each function is self-contained: Playwright serializes it into the browser.
export function readAssistantCursor(): AssistantCursor | null {
  const last = (window as BenchmarkWindow).placyVoice.messages().findLast(m => m.role === 'assistant');
  return last ? { id: last.id, length: last.text.length } : null;
}

export function benchmarkReplyArrived(before: AssistantCursor | null): boolean {
  const last = (window as BenchmarkWindow).placyVoice.messages().findLast(m => m.role === 'assistant');
  return Boolean(last?.text.length && (!before || last.id !== before.id || last.text.length > before.length));
}

export function benchmarkIsQuiet(): boolean {
  const scope = window as BenchmarkWindow;
  const last = scope.placyVoice.messages().findLast(m => m.role === 'assistant');
  const cursor = last ? `${last.id}:${last.text.length}` : '';
  const prior = scope.placyBenchmarkQuiet;
  if (!prior || prior.cursor !== cursor || scope.placyVoice.status() !== 'listening') {
    scope.placyBenchmarkQuiet = { cursor, since: Date.now() };
    return false;
  }
  return Date.now() - prior.since >= 3_000;
}
