"use client";

import { useState, useMemo } from "react";
import type { PlaceKnowledge, KnowledgeTopic, KnowledgeConfidence } from "@/lib/types";
import { KNOWLEDGE_TOPICS, KNOWLEDGE_TOPIC_LABELS } from "@/lib/types";
import {
  BookOpen,
  Filter,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface Props {
  knowledge: PlaceKnowledge[];
}

export function KnowledgeAdminClient({ knowledge }: Props) {
  const [topicFilter, setTopicFilter] = useState<KnowledgeTopic | "all">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<KnowledgeConfidence | "all">("all");
  const [displayReadyFilter, setDisplayReadyFilter] = useState<"all" | "ready" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return knowledge.filter((k) => {
      if (topicFilter !== "all" && k.topic !== topicFilter) return false;
      if (confidenceFilter !== "all" && k.confidence !== confidenceFilter) return false;
      if (displayReadyFilter === "ready" && !k.displayReady) return false;
      if (displayReadyFilter === "draft" && k.displayReady) return false;
      if (searchQuery && !k.factText.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [knowledge, topicFilter, confidenceFilter, displayReadyFilter, searchQuery]);

  // Stats (single-pass, memoized)
  const { totalCount, verifiedCount, displayReadyCount } = useMemo(() => {
    let verified = 0;
    let ready = 0;
    for (const k of knowledge) {
      if (k.confidence === "verified") verified++;
      if (k.displayReady) ready++;
    }
    return { totalCount: knowledge.length, verifiedCount: verified, displayReadyCount: ready };
  }, [knowledge]);
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const k of knowledge) {
      counts[k.topic] = (counts[k.topic] ?? 0) + 1;
    }
    return counts;
  }, [knowledge]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Kunnskapsbase</h1>
        <span className="text-sm text-gray-500">({totalCount} fakta)</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
          <div className="text-xs text-gray-500">Totalt</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-2xl font-bold text-emerald-600">{verifiedCount}</div>
          <div className="text-xs text-gray-500">
            Verifisert ({totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0}%)
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-2xl font-bold text-blue-600">{displayReadyCount}</div>
          <div className="text-xs text-gray-500">Publisert</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-2xl font-bold text-gray-400">
            {Object.keys(topicCounts).length}
          </div>
          <div className="text-xs text-gray-500">Topics i bruk</div>
        </div>
      </div>

      {/* Topic distribution */}
      <div className="flex flex-wrap gap-2 mb-6">
        {KNOWLEDGE_TOPICS.map((topic) => {
          const count = topicCounts[topic] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={topic}
              onClick={() => setTopicFilter(topicFilter === topic ? "all" : topic)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                topicFilter === topic
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {KNOWLEDGE_TOPIC_LABELS[topic]} ({count})
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </div>
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as KnowledgeConfidence | "all")}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5"
        >
          <option value="all">Alle confidence</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="disputed">Disputed</option>
        </select>
        <select
          value={displayReadyFilter}
          onChange={(e) => setDisplayReadyFilter(e.target.value as "all" | "ready" | "draft")}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5"
        >
          <option value="all">Alle status</option>
          <option value="ready">Publisert</option>
          <option value="draft">Utkast</option>
        </select>
        <input
          type="text"
          placeholder="Sok i fakta..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 w-48"
        />
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultater</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-500">Topic</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Fakta</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Kilde</th>
                <th className="text-center px-3 py-2 font-medium text-gray-500">Status</th>
                <th className="text-center px-3 py-2 font-medium text-gray-500">Synlig</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">
                      {KNOWLEDGE_TOPIC_LABELS[k.topic]}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-md">
                    <p className="text-gray-900 line-clamp-2">{k.factText}</p>
                    {k.factTextEn && (
                      <p className="text-gray-400 line-clamp-1 mt-0.5">{k.factTextEn}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {k.sourceName ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {k.confidence === "verified" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : k.confidence === "disputed" ? (
                      <AlertCircle className="w-4 h-4 text-red-500 mx-auto" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {k.displayReady ? (
                      <Eye className="w-4 h-4 text-blue-500 mx-auto" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-300 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    Ingen fakta funnet med valgte filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
