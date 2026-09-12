"use client";

import { useCallback, useState } from "react";
import type { BoligFixture, VoiceSession } from "@/lib/prototype/bolig/contract";
import Landing from "@/components/prototype/bolig/Landing";
import ConversationFeed from "@/components/prototype/bolig/ConversationFeed";
import CategoryBar from "@/components/prototype/bolig/CategoryBar";
import StatusBar from "@/components/prototype/bolig/StatusBar";
import FullscreenMap from "@/components/prototype/bolig/FullscreenMap";
import styles from "@/components/prototype/bolig/bolig.module.css";

const IDLE_STATUSES = new Set(["idle", "connecting", "ended"]);

/**
 * Mobilskall for bruktbolig-prototypen. Ren presentasjon — all samtalelogikk
 * (simulert eller ekte Realtime) lever i `session`, all kunnskap i `fixture`.
 */
export default function BoligShell({ session, fixture }: { session: VoiceSession; fixture: BoligFixture }) {
  const [expandedPlaceIds, setExpandedPlaceIds] = useState<string[] | null>(null);

  const handleExpandMap = useCallback((placeIds: string[]) => setExpandedPlaceIds(placeIds), []);
  const closeFullscreen = useCallback(() => setExpandedPlaceIds(null), []);
  const handlePickPlace = useCallback((placeId: string) => { session.selectPlace(placeId); closeFullscreen(); }, [session, closeFullscreen]);

  const showLanding = session.status === "idle" && session.blocks.length === 0;
  const controllable = !IDLE_STATUSES.has(session.status);

  return (
    <div className={styles.app}>
      {showLanding ? (
        <Landing fixture={fixture} simulated={session.simulated} onStart={session.start} />
      ) : (
        <>
          <ConversationFeed session={session} fixture={fixture} onExpandMap={handleExpandMap} />
          <div className={styles.bottomPanel}>
            <CategoryBar activeTopic={session.activeTopic} disabled={!controllable} onTap={session.tapCategory} />
            <StatusBar session={session} />
          </div>
        </>
      )}
      {expandedPlaceIds && (
        <FullscreenMap
          fixture={fixture}
          placeIds={expandedPlaceIds}
          selectedPlaceId={session.selectedPlaceId}
          onSelect={handlePickPlace}
          onClose={closeFullscreen}
        />
      )}
    </div>
  );
}
