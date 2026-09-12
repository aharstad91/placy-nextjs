"use client";

import { ChevronRight } from "lucide-react";
import { TOPICS, type TopicId } from "@/lib/prototype/bolig/contract";
import { getIcon } from "@/lib/utils/map-icons";
import styles from "@/components/prototype/bolig/bolig.module.css";

/**
 * Inngangen til samtalen, vist under hilsenen til første spørsmål er stilt.
 *
 * Skjermen var tom etter hilsenen: én tekstblokk og en rad små brikker i
 * bunnen (Andreas, 2026-09-12: «i starten er det ganske tomt. vanskelig å
 * komme i gang»). Her står temaene som hele spørsmål, i samme radform som
 * boardets kategorikort — ikon, spørsmålet, pil. Et trykk er det samme som et
 * trykk i temaraden; stemmen er alltid et alternativ.
 */
export default function StarterPrompts({ disabled, onTap }: { disabled: boolean; onTap: (topic: TopicId) => void }) {
  return (
    <section className={styles.starter} aria-label="Kom i gang">
      <h2 className={styles.starterTitle}>Hva vil du vite om nabolaget?</h2>
      <div className={styles.starterList}>
        {TOPICS.map((topic) => {
          const Icon = getIcon(topic.icon);
          return (
            <button key={topic.id} type="button" className={styles.starterRow} disabled={disabled} onClick={() => onTap(topic.id)}>
              <span className={styles.starterIcon} style={{ backgroundColor: topic.color }} aria-hidden="true">
                <Icon size={15} strokeWidth={2.2} />
              </span>
              <span className={styles.starterText}>{topic.tapPrompt}</span>
              <ChevronRight size={16} className={styles.starterChevron} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className={styles.starterNote}>Eller bare spør med stemmen.</p>
    </section>
  );
}
