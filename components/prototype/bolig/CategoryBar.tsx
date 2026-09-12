"use client";

import { TOPICS, type TopicId } from "@/lib/prototype/bolig/contract";
import { getIcon } from "@/lib/utils/map-icons";
import styles from "@/components/prototype/bolig/bolig.module.css";

/**
 * Temaraden i bunndekket — samme form som rapport-boardets `StoryRail`
 * (`components/variants/report/board/story/StoryRail.tsx`): én avrundet flate,
 * brikker med farget ikonsirkel over navnet, aktiv brikke som hvit pille.
 * Ikonene står i full farge uansett tilstand; det er raden man finner fram i.
 * Ett trykk sender temaet til samtalen.
 */
export default function CategoryBar({ activeTopic, disabled, onTap }: { activeTopic: TopicId | null; disabled: boolean; onTap: (topic: TopicId) => void }) {
  return (
    <div className={styles.rail} role="tablist" aria-label="Temaer">
      <div className={styles.railTrack}>
        {TOPICS.map((topic) => {
          const Icon = getIcon(topic.icon);
          const active = activeTopic === topic.id;
          return (
            <button
              key={topic.id}
              type="button"
              role="tab"
              className={`${styles.railChip} ${active ? styles.railChipActive : ""}`}
              aria-selected={active}
              aria-current={active || undefined}
              disabled={disabled}
              onClick={() => onTap(topic.id)}
            >
              <span className={styles.railIcon} style={{ backgroundColor: topic.color }} aria-hidden="true">
                <Icon size={12} strokeWidth={2} />
              </span>
              <span>{topic.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
