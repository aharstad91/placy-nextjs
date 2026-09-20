"use client";

import { useEffect, useRef } from "react";
import type { LiveMessage, LiveStatus } from "@/lib/live/types";

interface PlaceName { id: string; name: string }
const normalized = (text: string) => text.toLocaleLowerCase("nb-NO").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Last complete place-name mention wins; longest name wins overlapping matches. */
export function mentionedPlace(text: string, places: readonly PlaceName[]): string | null {
  const haystack = ` ${normalized(text)} `;
  let best: { id: string; end: number; length: number } | null = null;
  for (const place of places) {
    const name = normalized(place.name);
    if (!name) continue;
    const at = haystack.lastIndexOf(` ${name} `);
    if (at < 0) continue;
    const end = at + name.length;
    if (!best || end > best.end || (end === best.end && name.length > best.length)) best = { id: place.id, end, length: name.length };
  }
  return best?.id ?? null;
}

/** Transcript-assisted focus, gated on audible speech. No timed marker queue
 * can continue running after an interruption. This is not word-level alignment. */
export function useNarrationFocus(
  enabled: boolean, places: readonly PlaceName[], status: LiveStatus,
  messages: readonly LiveMessage[], onFocus: (id: string | null) => void,
) {
  const last = useRef<string | null>(null);
  const previousPlaces = useRef(places);
  const callback = useRef(onFocus);
  callback.current = onFocus;
  useEffect(() => {
    const message = messages.at(-1);
    if (previousPlaces.current !== places) {
      previousPlaces.current = places;
      if (last.current !== null) callback.current(null);
      last.current = null;
    }
    if (!enabled || status !== "speaking" || message?.role !== "assistant") {
      if (last.current === null) return;
      last.current = null;
      callback.current(null);
      return;
    }
    const id = mentionedPlace(message.text, places);
    if (id && last.current !== id) {
      last.current = id;
      callback.current(id);
    }
  }, [enabled, places, status, messages]);
}
