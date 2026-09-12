"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { BoligFixture, VoiceSession } from "@/lib/prototype/bolig/contract";
import ConversationBlock from "@/components/prototype/bolig/ConversationBlocks";
import styles from "@/components/prototype/bolig/bolig.module.css";

const NEAR_BOTTOM_PX = 120;

/**
 * Scrollbar feed av samtaleblokker. Følger bunnen automatisk mens brukeren er
 * der (også under strømmende svar); slutter å rykke feeden når brukeren har
 * scrollet opp for å lese eldre innhold, og viser i stedet "Nytt svar ↓".
 */
export default function ConversationFeed({ session, fixture, onExpandMap }: {
  session: VoiceSession;
  fixture: BoligFixture;
  onExpandMap: (placeIds: string[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stuckToBottom = useRef(true);
  const [hasNewReply, setHasNewReply] = useState(false);

  const scrollBehavior = useCallback((): ScrollBehavior => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "smooth";
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    else el.scrollTop = el.scrollHeight;
    stuckToBottom.current = true;
    setHasNewReply(false);
  }, [scrollBehavior]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stuckToBottom.current = distanceFromBottom < NEAR_BOTTOM_PX;
    if (stuckToBottom.current) setHasNewReply(false);
  }, []);

  useEffect(() => {
    if (stuckToBottom.current) scrollToBottom();
    else setHasNewReply(true);
  }, [session.blocks, scrollToBottom]);

  return (
    <div className={styles.feedWrap}>
      <div ref={scrollRef} className={styles.feedScroll} onScroll={handleScroll}>
        {session.blocks.map((block, index) => {
          const previousTurn = session.blocks[index - 1]?.turn;
          const turnStart = previousTurn !== undefined && previousTurn !== block.turn;
          return (
            <div key={block.id} className={turnStart ? styles.turnGap : undefined}>
              <ConversationBlock block={block} fixture={fixture} session={session} onExpandMap={onExpandMap} />
            </div>
          );
        })}
      </div>
      {hasNewReply && (
        <button type="button" className={styles.jumpButton} onClick={scrollToBottom}>
          <ArrowDown size={13} /> Nytt svar
        </button>
      )}
    </div>
  );
}
