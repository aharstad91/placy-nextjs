"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveMessage, LiveStatus } from "@/lib/live/types";

const EMPTY: ReadonlySet<string> = new Set();
type Pending = { ids: ReadonlySet<string>; userKey: string; interruptionVersion: number; heard: boolean };

/** Øktstatus, ikke brukerprofil. Tale fullføres etter observert lyd og ro. */
export function useFaqProgress(ids: readonly string[], status: LiveStatus, messages: readonly LiveMessage[], interruptionVersion = 0) {
  const [explored, setExplored] = useState<ReadonlySet<string>>(EMPTY);
  const [pending, setPending] = useState<Pending | null>(null);
  const known = useMemo(() => new Set(ids), [ids]);
  let user: LiveMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { user = messages[i]; break; }
  }
  const userKey = user?.id ?? "";
  const invalidated = useRef<{ version: number; userKey: string | null }>({ version: interruptionVersion, userKey: null });
  useEffect(() => {
    if (invalidated.current.version !== interruptionVersion) {
      invalidated.current = { version: interruptionVersion, userKey };
    }
  }, [interruptionVersion, userKey]);
  const clear = useCallback(() => setPending(null), []);
  const read = useCallback((id: string) => {
    if (!known.has(id)) return;
    setExplored(previous => previous.has(id) ? previous : new Set([...previous, id]));
  }, [known]);
  const queue = useCallback((values: readonly string[]) => {
    // Et sent kartresultat kan komme etter feil på lydkanalen. Vent på et nytt spørsmål.
    if (invalidated.current.version !== interruptionVersion || invalidated.current.userKey === userKey) return;
    const accepted = new Set(values.filter(id => known.has(id)));
    if (accepted.size) setPending({ ids: accepted, userKey, interruptionVersion, heard: false });
  }, [known, userKey, interruptionVersion]);
  const reset = useCallback(() => { setPending(null); setExplored(EMPTY); }, []);

  useEffect(() => {
    if (!pending) return;
    if (pending.userKey !== userKey || pending.interruptionVersion !== interruptionVersion || status === "idle" || status === "error") {
      setPending(null);
      return;
    }
    if (status === "speaking" && !pending.heard) {
      setPending({ ...pending, heard: true });
      return;
    }
    if (status !== "listening" || !pending.heard || messages.at(-1)?.role !== "assistant") return;
    // Live har ikke turgrenser. Vent gjennom korte lydpauser og avbryt hvis brukeren tar ordet.
    const timer = setTimeout(() => {
      setExplored(previous => [...pending.ids].every(id => previous.has(id)) ? previous : new Set([...previous, ...pending.ids]));
      setPending(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [status, userKey, messages, pending, interruptionVersion]);

  return { explored, active: pending?.ids ?? EMPTY, read, queue, clear, reset };
}
