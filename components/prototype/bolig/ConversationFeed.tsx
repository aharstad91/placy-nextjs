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
 * Scrollbar feed av samtaleblokker, lest OVENFRA per tur.
 *
 * Når en ny tur begynner (trykk på tema, valg i kartet, nytt spørsmål med
 * stemmen), stilles feeden slik at turens spørsmål står i toppen — og der blir
 * den. Svaret, kortene og kildene fylles på nedenfor i leserekkefølge, og
 * brukeren ruller selv videre. Tidligere fulgte feeden bunnen mens svaret
 * strømmet, og hver kategori sendte deg til slutten av et langt svar som du så
 * måtte rulle opp gjennom for å finne starten (Andreas, 2026-09-12: «da må en
 * scrolle oppover hele tiden … det blir tungvindt»).
 *
 * Spørsmålet holdes i toppen mens turen fylles: første blokk i en ny tur er kort,
 * så feeden rekker ikke å stilles helt til turens topp før resten har kommet.
 * Derfor stilles den på nytt for hver blokk i turen, til brukeren selv tar i
 * feeden (hjul, finger, peker) — da er det brukerens posisjon som gjelder.
 *
 * «Nytt svar ↓» vises bare når brukeren har rullet selv og innhold så har
 * kommet til under det som er synlig.
 */
export default function ConversationFeed({ session, fixture, onExpandMap }: {
  session: VoiceSession;
  fixture: BoligFixture;
  onExpandMap: (placeIds: string[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shownTurn = useRef<number | null>(null);
  /** Feeden følger turens topp til brukeren tar i den. */
  const pinnedToTurn = useRef(false);
  const [hasNewReply, setHasNewReply] = useState(false);
  const turns = useMemo(() => groupByTurn(session.blocks), [session.blocks]);

  const scrollBehavior = useCallback((): ScrollBehavior => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "smooth";
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }, []);

  const scrollTo = useCallback((top: number, behavior: ScrollBehavior = scrollBehavior()) => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior });
    else el.scrollTop = top;
  }, [scrollBehavior]);

  const turnTop = useCallback((turn: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const section = el.querySelector<HTMLElement>(`[data-turn="${turn}"]`);
    return section ? Math.max(0, section.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop) : el.scrollHeight;
  }, []);

  const release = useCallback(() => { pinnedToTurn.current = false; }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    scrollTo(el.scrollHeight);
    setHasNewReply(false);
  }, [scrollTo]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < NEAR_BOTTOM_PX) setHasNewReply(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const latest = session.blocks[session.blocks.length - 1];
    if (!el || !latest) return;
    if (shownTurn.current !== latest.turn) {
      // Ny tur: still spørsmålet i toppen og hold det der mens turen fylles.
      shownTurn.current = latest.turn;
      pinnedToTurn.current = true;
      scrollTo(turnTop(latest.turn));
      setHasNewReply(false);
      return;
    }
    if (pinnedToTurn.current) {
      scrollTo(turnTop(latest.turn), "auto");
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > NEAR_BOTTOM_PX) setHasNewReply(true);
  }, [session.blocks, scrollTo, turnTop]);

  return (
    <div className={styles.feedWrap}>
      <div ref={scrollRef} className={styles.feedScroll} onScroll={handleScroll} onWheel={release} onTouchStart={release} onPointerDown={release}>
        {turns.map((group) => (
          <section key={group.turn} data-turn={group.turn} className={styles.turn} aria-label={`Tur ${group.turn}`}>
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
