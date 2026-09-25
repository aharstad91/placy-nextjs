import type { BoardData } from "@/components/variants/report/board/board-data";
import type { FaqEntry } from "@/lib/generators/faq-generator";

/**
 * Ett FAQ-spørsmål på Boardet, slått opp på ID (2026-09-25): boardets egne
 * spørsmål først, så temaenes. Samme oppslag i nettleseren (agentmodusen) og
 * på serveren (Board-tekstbanen), så begge sider er enige om hvilket svar en
 * ID peker på.
 */
export function findBoardFaq(board: Pick<BoardData, "globalFaq" | "categories">, faqId: string): FaqEntry | null {
  const global = board.globalFaq?.find((entry) => entry.id === faqId);
  if (global) return global;
  for (const category of board.categories) {
    const found = category.editorial?.faq?.find((entry) => entry.id === faqId);
    if (found) return found;
  }
  return null;
}
