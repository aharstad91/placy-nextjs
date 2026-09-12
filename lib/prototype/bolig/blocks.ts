import type { Block, ToolResult, TopicId } from "@/lib/prototype/bolig/contract";

/**
 * Oversetter ett verktøyresultat til UI-blokker. Deles av simulatoren og den
 * ekte hooken, slik at samme data gir samme skjerm. Blokk-ID-er avledes av
 * `callId`, så dupliserte hendelser (samme kall to ganger) ikke gir doble kort.
 */
export function blocksFromToolResult(result: ToolResult, turn: number, callId: string): Block[] {
  const blocks: Block[] = [];
  switch (result.kind) {
    case "topic": {
      if (result.places.length) blocks.push({ id: `${callId}-places`, turn, kind: "places", placeIds: result.places.map(p => p.id), topic: result.topic });
      if (result.seller.length) blocks.push({ id: `${callId}-seller`, turn, kind: "seller", noteIds: result.seller.map(s => s.id) });
      if (result.unknowns.length) blocks.push({ id: `${callId}-unknown`, turn, kind: "unknown", unknownIds: result.unknowns.map(u => u.id) });
      if (result.source_ids.length) blocks.push({ id: `${callId}-sources`, turn, kind: "sources", sourceIds: result.source_ids });
      break;
    }
    case "place": {
      blocks.push({ id: `${callId}-places`, turn, kind: "places", placeIds: [result.place.id] });
      if (result.seller.length) blocks.push({ id: `${callId}-seller`, turn, kind: "seller", noteIds: result.seller.map(s => s.id) });
      if (result.place.sources.length) blocks.push({ id: `${callId}-sources`, turn, kind: "sources", sourceIds: result.place.sources.map(s => s.id) });
      break;
    }
    case "search": {
      if (result.places.length) blocks.push({ id: `${callId}-places`, turn, kind: "places", placeIds: result.places.map(p => p.id) });
      break;
    }
    case "house":
    case "map":
    case "error":
      break;
  }
  return blocks;
}

/** Legger til blokker uten duplikater (samme id → behold første). */
export function mergeBlocks(previous: Block[], next: Block[]): Block[] {
  const seen = new Set(previous.map(b => b.id));
  const fresh = next.filter(b => !seen.has(b.id));
  return fresh.length ? [...previous, ...fresh].slice(-200) : previous;
}

/** Oppdaterer eller legger til en svarblokk (strømmende transkript). */
export function upsertAnswer(previous: Block[], id: string, turn: number, delta: string, done: boolean, replace = false): Block[] {
  const index = previous.findIndex(b => b.id === id);
  if (index < 0) { const created: Block = { id, turn, kind: "answer", text: delta, done }; return [...previous, created].slice(-200); }
  const existing = previous[index];
  if (existing.kind !== "answer") return previous;
  const text = replace ? delta : existing.text + delta;
  const copy = previous.slice();
  copy[index] = { ...existing, text, done };
  return copy;
}

/** Topic-ID fra et verktøyresultat, når agenten selv har skiftet tema. */
export function topicFromResult(result: ToolResult): TopicId | null {
  return result.kind === "topic" ? result.topic : null;
}
