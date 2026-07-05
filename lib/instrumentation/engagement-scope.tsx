"use client";

// Engagement-scope for Moat-2-emit-sites (PRD 13 Unit 5 + audit-fiks 2026-07-05).
// Løser de tre P0-ene fra build-loop-auditen: (1) kontekst-konvolutt på HVERT
// event (moat-2-build-input §2 Gap 1 — events logget kontekstløst er tapt for
// alltid), (2) project_id på alle emit-sites (ikke bare board_viewed), og
// (3) ÉN session_id per board-render-økt (ikke én per event).
//
// Mønster: `ReportReelsPage` bygger emitteren ÉN gang per mount via
// `useEngagementEmitter` og deler den nedover via `EngagementProvider`.
// Emit-sitene (BoardMap3D, DesktopStorySidebar, use-reels-audio-orchestration)
// henter den med `useEngagement()` — de trenger aldri vite om projectId,
// session eller konvolutt.

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { logEvent } from "./log-event";
import type { EngagementContextEnvelope, EventType } from "./event-types";

export interface EngagementEmitter {
  /**
   * Fire-and-forget emit. Merger scope (projectId/session/konvolutt) inn i
   * eventet; `extras.payload` legges ved som hendelses-spesifikke felt
   * (f.eks. `category_id`). Kan ALDRI kaste eller returnere en pending
   * promise til kalleren — fail-soft-kontrakten fra `logEvent` bevares.
   */
  emit: (
    eventType: EventType,
    extras?: { poiId?: string; payload?: Record<string, unknown> },
  ) => void;
}

/**
 * Anonym økt-nøkkel: ÉN per board-mount (= én render-økt), generert i
 * nettleseren. Bevisst KLIENT-generert (audit-beslutning 2026-07-05): en
 * server-generert id fra en cachebar RSC-side risikerer å dele SAMME id på
 * tvers av besøkende (cache-hit = gjenbrukt render) — verre enn per-event-id.
 * Personvern-kontrakten fra `session-id.ts` gjelder uendret: opaque UUID v4,
 * ingen kobling til IP/bruker, aldri persistert på tvers av økter, aldri i
 * Zustand. Server-side validerer formen (`isSessionIdShape`) og faller
 * tilbake til fersk server-id ved fravær/ugyldighet.
 */
function newClientSessionId(): string | undefined {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return undefined; // eldgammel nettleser → logEvent genererer server-side
}

/**
 * Bygger emitteren for én board-render-økt. Kalles av board-skallets rot
 * (ReportReelsPage) — IKKE av emit-sitene.
 */
export function useEngagementEmitter(scope: {
  projectId: string;
  productId?: string;
  envelope: EngagementContextEnvelope;
}): EngagementEmitter {
  const { projectId, productId, envelope } = scope;
  // Økt-nøkkelen ligger i en ref så den overlever at emitteren gjenskapes
  // (f.eks. locale-bytte endrer konvolutten) — én økt = ett besøk, ikke én
  // memo-generasjon. `null` = generering forsøkt og utilgjengelig (ikke retry).
  const sessionIdRef = useRef<string | null | undefined>(undefined);
  if (sessionIdRef.current === undefined) {
    sessionIdRef.current = newClientSessionId() ?? null;
  }
  const sessionId = sessionIdRef.current ?? undefined;
  return useMemo<EngagementEmitter>(() => {
    return {
      emit(eventType, extras) {
        void logEvent({
          eventType,
          projectId,
          productId,
          sessionId,
          poiId: extras?.poiId,
          payload: { ...(extras?.payload ?? {}), context: envelope },
        }).catch(() => {});
      },
    };
  }, [projectId, productId, envelope, sessionId]);
}

const EngagementContext = createContext<EngagementEmitter | null>(null);

export function EngagementProvider({
  emitter,
  children,
}: {
  emitter: EngagementEmitter;
  children: ReactNode;
}) {
  return (
    <EngagementContext.Provider value={emitter}>
      {children}
    </EngagementContext.Provider>
  );
}

// Instrumentering må aldri velte render: utenfor provider → no-op-emitter
// (dev-warn), aldri throw. Alle reelle emit-sites ligger under
// ReportReelsPage-provideren, så dette er belte-og-bukser.
const NOOP_EMITTER: EngagementEmitter = {
  emit(eventType) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[engagement] emit("${eventType}") utenfor EngagementProvider — droppet`,
      );
    }
  },
};

export function useEngagement(): EngagementEmitter {
  return useContext(EngagementContext) ?? NOOP_EMITTER;
}
