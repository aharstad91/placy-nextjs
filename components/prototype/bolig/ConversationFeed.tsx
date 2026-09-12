"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { Block, BoligFixture, VoiceSession } from "@/lib/prototype/bolig/contract";
import ConversationBlock from "@/components/prototype/bolig/ConversationBlocks";
import styles from "@/components/prototype/bolig/bolig.module.css";

const NEAR_BOTTOM_PX = 120;

/** Blokkene gruppert per tur, i rekkefølge. Turen er enheten spørsmålet fester seg til. */
function groupByTurn(blocks: Block[]): { turn: number; blocks: Block[] }[] {
  const groups: { turn: number; blocks: Block[] }[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (last && last.turn === block.turn) last.blocks.push(block);
    else groups.push({ turn: block.turn, blocks: [block] });
  }
  return groups;
}

/**
 * Scrollbar feed av samtaleblokker. Følger bunnen automatisk mens brukeren er
 * der (også under strømmende svar); slutter å rykke feeden når brukeren har
 * scrollet opp for å lese eldre innhold, og viser i stedet "Nytt svar ↓".
 *
 * Blokkene rendres per tur. Spørsmålet (user-blokken) ligger sticky i toppen
 * av sin tur, slik rapport-boardets mobilflate fester stoppets spørsmål: mens
 * svaret, kortene og kildene ruller forbi, står det synlig hva de svarer på.
 */
export default function ConversationFeed({ session, fixture, onExpandMap }: {
  session: VoiceSession;
  fixture: BoligFixture;
  onExpandMap: (placeIds: string[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stuckToBottom = useRef(true);
  const [hasNewReply, setHasNewReply] = useState(false);
  const turns = useMemo(() => groupByTurn(session.blocks), [session.blocks]);

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
        {turns.map((group) => (
          <section key={group.turn} className={styles.turn} aria-label={`Tur ${group.turn}`}>
            {group.blocks.map((block) => (
              <ConversationBlock key={block.id} block={block} fixture={fixture} session={session} onExpandMap={onExpandMap} />
            ))}
          </section>
        ))}
      </div>
      {hasNewReply && (
        <button type="button" className={styles.jumpButton} onClick={scrollToBottom}>
          <ArrowDown size={13} /> Nytt svar
        </button>
      )}
    </div>
  );
}
