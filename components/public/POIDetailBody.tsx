"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { PlaceKnowledge, KnowledgeTopic } from "@/lib/types";
import {
  KNOWLEDGE_TOPIC_LABELS,
  KNOWLEDGE_TOPIC_LABELS_EN,
} from "@/lib/types";
import { isSafeUrl } from "@/lib/utils/url";

interface KnowledgeTopicGroup {
  topic: KnowledgeTopic;
  facts: PlaceKnowledge[];
  showLabel: boolean;
}

export interface KnowledgeCategoryTab {
  key: string;
  label: string;
  topicGroups: KnowledgeTopicGroup[];
}

interface POIDetailBodyProps {
  categories: KnowledgeCategoryTab[];
  locale: "no" | "en";
  children: React.ReactNode; // sidebar
}

export default function POIDetailBody({
  categories,
  locale,
  children,
}: POIDetailBodyProps) {
  const [activeTab, setActiveTab] = useState(categories[0]?.key ?? "");

  const topicLabels =
    locale === "en" ? KNOWLEDGE_TOPIC_LABELS_EN : KNOWLEDGE_TOPIC_LABELS;

  if (categories.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2" />
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className="mb-12">
      {/* Tab bar */}
      <div className="flex border-b border-[#eae6e1] overflow-x-auto scrollbar-hide mb-8">
        {categories.map((cat) => (
          <button
            key={cat.key}
            className={`whitespace-nowrap px-4 py-3 text-[15px] font-medium transition-colors ${
              activeTab === cat.key
                ? "text-[#1a1a1a] border-b-2 border-[#1a1a1a]"
                : "text-[#767676] hover:text-[#4a4a4a]"
            }`}
            onClick={() => setActiveTab(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tab content — all rendered in DOM for SEO, visibility toggled */}
        <div className="lg:col-span-2">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className={activeTab === cat.key ? "" : "hidden"}
            >
              <div className="space-y-6">
                {cat.topicGroups.map((group) => (
                  <div key={group.topic} className="space-y-2">
                    {group.showLabel && (
                      <h4 className="text-[15px] font-semibold text-[#6a6a6a]">
                        {topicLabels[group.topic]}
                      </h4>
                    )}
                    {group.facts.map((fact) => {
                      const text =
                        locale === "en"
                          ? (fact.factTextEn ?? fact.factText)
                          : fact.factText;
                      return (
                        <div
                          key={fact.id}
                          className="text-base text-[#4a4a4a] leading-relaxed"
                        >
                          <p>{text}</p>
                          {fact.sourceName && (
                            <p className="text-[15px] text-[#6a6a6a] mt-1">
                              {fact.sourceUrl && isSafeUrl(fact.sourceUrl) ? (
                                <a
                                  href={fact.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 hover:text-[#4a4a4a] transition-colors"
                                >
                                  {fact.sourceName}
                                  <ExternalLink className="w-3.5 h-3.5" />
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
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div>{children}</div>
      </div>
    </div>
  );
}
