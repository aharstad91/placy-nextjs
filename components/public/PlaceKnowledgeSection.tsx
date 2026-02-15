import { ExternalLink } from "lucide-react";
import type { PlaceKnowledge, KnowledgeTopic } from "@/lib/types";
import { KNOWLEDGE_TOPIC_LABELS, KNOWLEDGE_TOPIC_LABELS_EN, KNOWLEDGE_TOPICS } from "@/lib/types";
import { isSafeUrl } from "@/lib/utils/url";

interface Props {
  knowledge: PlaceKnowledge[];
  locale: "no" | "en";
  hasEditorialHook?: boolean;
}

export default function PlaceKnowledgeSection({ knowledge, locale, hasEditorialHook }: Props) {
  // Dedup: filter out backfill facts when editorial_hook already exists
  const filtered = hasEditorialHook
    ? knowledge.filter((k) => !k.sourceName?.toLowerCase().includes("backfill"))
    : knowledge;

  if (filtered.length === 0) return null;

  // Group by topic, preserving topic order from KNOWLEDGE_TOPICS
  const grouped = new Map<KnowledgeTopic, PlaceKnowledge[]>();
  for (const fact of filtered) {
    const existing = grouped.get(fact.topic) ?? [];
    existing.push(fact);
    grouped.set(fact.topic, existing);
  }

  const labels = locale === "en" ? KNOWLEDGE_TOPIC_LABELS_EN : KNOWLEDGE_TOPIC_LABELS;

  // Render topics in canonical order (only those with data)
  const orderedTopics = KNOWLEDGE_TOPICS.filter((t) => grouped.has(t));

  return (
    <div className="space-y-6">
      {orderedTopics.map((topic) => {
        const facts = grouped.get(topic)!;
        return (
          <section key={topic}>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
              {labels[topic]}
            </h3>
            <div className="space-y-3">
              {facts.map((fact) => {
                const text = locale === "en"
                  ? (fact.factTextEn ?? fact.factText)
                  : fact.factText;

                return (
                  <div key={fact.id} className="text-sm text-[#4a4a4a] leading-relaxed">
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
          </section>
        );
      })}
    </div>
  );
}
