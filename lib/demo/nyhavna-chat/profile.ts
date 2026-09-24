import "server-only";

import { consumeDemoQuota } from "@/lib/demo/leangenbukta-site/usage";
import { chatCategories } from "@/lib/demo/leangenbukta-chat/categories";
import { nhChatAccess, nhChatEnabled } from "@/lib/demo/nyhavna-chat/access";
import { getNhSitePage, NH_SITE_SNAPSHOT_DATE } from "@/lib/demo/nyhavna-chat/pages";
import { nhPageOpening, nhTextChatInstructions, NH_REPLIES } from "@/lib/demo/nyhavna-chat/instructions";
import { NH_CATEGORY_QUESTIONS } from "@/lib/demo/nyhavna-chat/categories";
import { nyhavnaSourceRegistry } from "@/lib/demo/nyhavna-chat/sources";
import { nhFallbackLinks, resolveNhLinkIds } from "@/lib/demo/nyhavna-chat/links";
import type { SiteChatProfile } from "@/lib/demo/site-chat/profile";

/**
 * Nyhavna-kopiens chatprofil (2026-09-24).
 *
 * Datagrunnlaget er `nyhavna-lokal` — samme datasett som boardet kopiens
 * «Utforsk Nyhavna med Placy» åpner (`/demo/nyhavna-lokal`), med samme
 * kildekontrollerte temaer, steder og status-ord (eksisterende, planlagt,
 * vedtatt plan, visjon, uavklart).
 */
export const nyhavnaChatProfile: SiteChatProfile = {
  logPrefix: "nh",
  dataset: "nyhavna-lokal",
  env: { allowedOrigins: "PLACY_NH_CHAT_ALLOWED_ORIGINS", model: "PLACY_NH_CHAT_MODEL", timeoutMs: "PLACY_NH_CHAT_TIMEOUT_MS" },
  enabled: nhChatEnabled,
  access: nhChatAccess,
  consumeChatQuota: (visitorId) => consumeDemoQuota(visitorId, "nh_chat_message"),
  getPage: getNhSitePage,
  snapshotDate: NH_SITE_SNAPSHOT_DATE,
  instructions: nhTextChatInstructions,
  opening: nhPageOpening,
  categories: (categories, starters) => chatCategories(categories, starters, NH_CATEGORY_QUESTIONS),
  sourceRegistry: nyhavnaSourceRegistry,
  resolveLinks: resolveNhLinkIds,
  fallbackLinks: nhFallbackLinks,
  replies: NH_REPLIES,
};
