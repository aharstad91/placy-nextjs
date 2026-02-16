import { ExternalLink } from "lucide-react";
import type { PlaceKnowledge, KnowledgeTopic, KnowledgeCategory } from "@/lib/types";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TOPIC_LABELS,
  KNOWLEDGE_TOPIC_LABELS_EN,
} from "@/lib/types";
import { isSafeUrl } from "@/lib/utils/url";

interface Props {
  knowledge: PlaceKnowledge[];
  locale: "no" | "en";
  hasEditorialHook?: boolean;
}

const CATEGORY_ORDER: KnowledgeCategory[] = [
  "story",
  "experience",
  "taste",
  "place",
  "inside",
];

export default function PlaceKnowledgeSection({ knowledge, locale, hasEditorialHook }: Props) {
  // Dedup: filter out backfill facts when editorial_hook already exists
  const filtered = hasEditorialHook
    ? knowledge.filter((k) => !k.sourceName?.toLowerCase().includes("backfill"))
    : knowledge;

  if (filtered.length === 0) return null;

  // Single-pass grouping by topic
  const byTopic = new Map<KnowledgeTopic, PlaceKnowledge[]>();
  for (const fact of filtered) {
    const existing = byTopic.get(fact.topic) ?? [];
    existing.push(fact);
    byTopic.set(fact.topic, existing);
  }

  const topicLabels =
    locale === "en" ? KNOWLEDGE_TOPIC_LABELS_EN : KNOWLEDGE_TOPIC_LABELS;

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((catKey) => {
        const cat = KNOWLEDGE_CATEGORIES[catKey];

        // Only topics within this category that have facts
        const activeTopics = cat.topics.filter((t) =>
          byTopic.has(t as KnowledgeTopic)
        );
        if (activeTopics.length === 0) return null;

        const catLabel = locale === "en" ? cat.labelEn : cat.labelNo;

        return (
          <section key={catKey}>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
              {catLabel}
            </h3>
            <div className="space-y-4">
              {activeTopics.map((topic) => {
                const facts = byTopic.get(topic as KnowledgeTopic)!;
                return (
                  <div key={topic} className="space-y-2">
                    {/* Show sub-topic label only when category has multiple active topics */}
                    {activeTopics.length > 1 && (
                      <h4 className="text-[11px] font-medium text-[#6a6a6a] uppercase tracking-wider">
                        {topicLabels[topic as KnowledgeTopic]}
                      </h4>
                    )}
                    {facts.map((fact) => {
                      const text =
                        locale === "en"
                          ? (fact.factTextEn ?? fact.factText)
                          : fact.factText;

                      return (
                        <div
                          key={fact.id}
                          className="text-sm text-[#4a4a4a] leading-relaxed"
                        >
                          <p>{text}</p>
                          {fact.sourceName && (
                            <p className="text-[11px] text-[#a0937d] mt-1">
                              {fact.sourceUrl && isSafeUrl(fact.sourceUrl) ? (
                                <a
                                  href={fact.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 hover:text-[#6a6a6a] transition-colors"
                                >
                                  {fact.sourceName}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span>{fact.sourceName}</span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
