import "server-only";

import { chatCategories } from "@/lib/demo/site-chat/categories";
import { sameOriginOrNone } from "@/lib/demo/site-chat/origin";
import { CONTINUED_VOICE_GREETING } from "@/lib/demo/site-chat/voice-channel";
import { nhChatAccess, nhChatEnabled, nhChatVisitor, nhChatVoiceEnabled } from "@/lib/demo/nyhavna-chat/access";
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
  id: "nyhavna",
  logPrefix: "nh",
  dataset: "nyhavna-lokal",
  env: { allowedOrigins: "PLACY_NH_CHAT_ALLOWED_ORIGINS", model: "PLACY_NH_CHAT_MODEL", timeoutMs: "PLACY_NH_CHAT_TIMEOUT_MS" },
  enabled: nhChatEnabled,
  access: nhChatAccess,
  visitor: nhChatVisitor,
  transcriptSecretEnv: "PLACY_NH_CHAT_COOKIE_SECRET",
  // Åpen side uten innlogging: den per-besøkende grensen kan omgås ved å slette
  // cookien, så den samlede døgnkvoten er lavere enn Leangenbuktas.
  chatMeter: {
    meter: "nh_chat_message",
    envPrefix: "PLACY_NH_CHAT_MESSAGE",
    storeEnv: "PLACY_NH_CHAT_USAGE_STORE",
    defaults: { visitor: 40, global: 300 },
  },
  voice: {
    placeName: "Nyhavna",
    salesContact: "Nyhavna Utvikling",
    greeting: "Si en kort hilsen på norsk: at du er Anja fra Placy, og spør om de vil høre om bydelen som planlegges på Nyhavna eller om nærområdet slik det er i dag. Høyst to setninger.",
    continuedGreeting: CONTINUED_VOICE_GREETING,
    meter: {
      meter: "nh_voice_session",
      envPrefix: "PLACY_NH_CHAT_VOICE_SESSION",
      storeEnv: "PLACY_NH_CHAT_USAGE_STORE",
      defaults: { visitor: 5, global: 30 },
    },
    // Nyhavna-besøkende får bare chatboksen (aldri boardets kartstemme), og i et
    // produksjonsbygg bare med `PLACY_NH_CHAT_VOICE=true`. Lokalt er besøkende
    // `local` på loopback.
    remoteVisitor: (request, surface) => {
      if (surface === "board") return null;
      if (process.env.NODE_ENV === "production" && !nhChatVoiceEnabled()) return null;
      return sameOriginOrNone(request) ? nhChatVisitor(request) : null;
    },
  },
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
