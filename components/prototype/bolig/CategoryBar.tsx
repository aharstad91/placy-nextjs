"use client";

import { TOPICS, type TopicId } from "@/lib/prototype/bolig/contract";
import styles from "@/components/prototype/bolig/bolig.module.css";

/** Horisontalt scrollbar rad med tema-chips. Ett trykk sender temaet til samtalen. */
export default function CategoryBar({ activeTopic, disabled, onTap }: { activeTopic: TopicId | null; disabled: boolean; onTap: (topic: TopicId) => void }) {
  return (
    <div className={styles.categoryBar} role="tablist" aria-label="Temaer">
      {TOPICS.map((topic) => (
        <button
          key={topic.id}
          type="button"
          role="tab"
          className={`${styles.categoryChip} ${activeTopic === topic.id ? styles.categoryChipActive : ""}`}
          aria-selected={activeTopic === topic.id}
          disabled={disabled}
          onClick={() => onTap(topic.id)}
        >
          {topic.label}
        </button>
      ))}
    </div>
  );
}
