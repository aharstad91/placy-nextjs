import { nyhavnaSiteKnowledge, searchSiteKnowledge, siteKnowledgeForTheme, type SiteKnowledgeEntry } from "@/lib/demo/nyhavna-leve/site-knowledge";
import type { ProjectInfo, ProjectInfoProvider } from "@/lib/realtime/nyhavna-chapters";

/**
 * Prosjektinnholdet fra nyhavna.no (`site-knowledge.ts`) slik samtalen leser det:
 * korte, kildebelagte utsagn med status, hentet per tema eller per spørsmål –
 * aldri hele nettstedsteksten i én tur. Adapteren finnes så kapitlene og
 * samtalen kan testes uten datamodulen (`NO_PROJECT_INFO`).
 */
const STATUS_WORDS: Record<SiteKnowledgeEntry["status"], string> = {
  existing: "eksisterende",
  planned: "planlagt",
  "adopted-plan": "vedtatt plan",
  vision: "visjon",
  unresolved: "uavklart",
};

function toProjectInfo(entry: SiteKnowledgeEntry): ProjectInfo {
  const source = nyhavnaSiteKnowledge.sources.find((s) => s.id === entry.sourceId);
  return {
    id: entry.id,
    title: entry.title,
    status: STATUS_WORDS[entry.status],
    text: entry.text,
    source: { url: source?.url ?? "", page: source?.page ?? "nyhavna.no", checked_at: source?.checkedAt ?? nyhavnaSiteKnowledge.checkedAt },
  };
}

export const nyhavnaProjectInfo: ProjectInfoProvider = {
  forTheme: (themeId, limit) => siteKnowledgeForTheme(themeId, limit).map(toProjectInfo),
  search: (query, themes, limit) => searchSiteKnowledge(query, { themes, limit }).map(toProjectInfo),
};
