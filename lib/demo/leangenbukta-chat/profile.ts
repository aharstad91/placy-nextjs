import "server-only";

import { getSitePage, SITE_SNAPSHOT_DATE } from "@/lib/demo/leangenbukta-site/pages";
import { lbDemoAccess } from "@/lib/demo/leangenbukta-site/access";
import { consumeDemoQuota } from "@/lib/demo/leangenbukta-site/usage";
import {
  textChatInstructions, pageOpening, unsupportedYearReply, KNOWLEDGE_GAP_REPLY, BACKEND_ERROR_REPLY, LB_NOTICE_TEXTS,
} from "@/lib/demo/leangenbukta-chat/instructions";
import { leangenbuktaSourceRegistry } from "@/lib/demo/leangenbukta-chat/sources";
import { fallbackLinks, resolveLinkIds } from "@/lib/demo/leangenbukta-chat/links";
import { chatCategories } from "@/lib/demo/leangenbukta-chat/categories";
import type { SiteChatProfile } from "@/lib/demo/site-chat/profile";

/**
 * Leangenbukta-kopiens chatprofil (2026-09-23, profil fra 2026-09-24).
 *
 * Oppførselen er uendret fra det frittstående endepunktet: demotilgangen
 * (`placy_lb_demo`-cookien, eller loopback på en ukonfigurert dev-server),
 * Leangenbuktas døgnkvote, sideregister, kilderegister og faste tekster.
 */
export const leangenbuktaChatProfile: SiteChatProfile = {
  logPrefix: "lb",
  dataset: "leangenbukta-lokal",
  env: { allowedOrigins: "PLACY_LB_CHAT_ALLOWED_ORIGINS", model: "PLACY_LB_CHAT_MODEL", timeoutMs: "PLACY_LB_CHAT_TIMEOUT_MS" },
  // Tilgangen avgjør alt her: uten gyldig cookie er svaret 401, som før.
  enabled: () => true,
  access: (request) => {
    const visitor = lbDemoAccess(request);
    return visitor ? { visitor } : null;
  },
  consumeChatQuota: (visitorId) => consumeDemoQuota(visitorId, "chat_message"),
  getPage: (id) => getSitePage(id),
  snapshotDate: SITE_SNAPSHOT_DATE,
  instructions: textChatInstructions,
  opening: pageOpening,
  categories: (categories, starters) => chatCategories(categories, starters),
  sourceRegistry: leangenbuktaSourceRegistry,
  resolveLinks: resolveLinkIds,
  fallbackLinks,
  replies: {
    knowledgeGap: KNOWLEDGE_GAP_REPLY,
    backendError: BACKEND_ERROR_REPLY,
    unsupportedYear: unsupportedYearReply,
    notices: LB_NOTICE_TEXTS,
    noAccess: "Ingen tilgang til demoen. Last siden på nytt, eller åpne demolenken du fikk tilsendt.",
    unknownPage: "Chatten kjenner ikke denne siden. Bruk Boardet eller kontakt salgsteamet.",
    notConnected: "Chatten er ikke koblet til akkurat nå. Bruk Boardet eller kontakt salgsteamet.",
    quota: {
      visitor: "Du har brukt opp dagens spørsmål i denne demoen. Prøv igjen i morgen, eller bruk Boardet i mellomtiden.",
      global: "Demoen har mange samtaler akkurat nå. Prøv igjen om litt, eller bruk Boardet i mellomtiden.",
      store: "Chatten er midlertidig utilgjengelig. Prøv igjen om litt, eller bruk Boardet i mellomtiden.",
    },
  },
};
