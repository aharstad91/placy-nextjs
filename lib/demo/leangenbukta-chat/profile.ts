import "server-only";

import { getSitePage, SITE_SNAPSHOT_DATE } from "@/lib/demo/leangenbukta-site/pages";
import { lbDemoAccess } from "@/lib/demo/leangenbukta-site/access";
import { CONTINUED_VOICE_GREETING } from "@/lib/demo/site-chat/voice-channel";
import { sameOriginOrNone } from "@/lib/demo/site-chat/origin";
import {
  textChatInstructions, pageOpening, unsupportedYearReply, KNOWLEDGE_GAP_REPLY, BACKEND_ERROR_REPLY, LB_NOTICE_TEXTS,
} from "@/lib/demo/leangenbukta-chat/instructions";
import { leangenbuktaSourceRegistry } from "@/lib/demo/leangenbukta-chat/sources";
import { fallbackLinks, resolveLinkIds } from "@/lib/demo/leangenbukta-chat/links";
import { chatCategories } from "@/lib/demo/site-chat/categories";
import { CATEGORY_QUESTIONS } from "@/lib/demo/leangenbukta-chat/categories";
import type { SiteChatProfile } from "@/lib/demo/site-chat/profile";

/**
 * Leangenbukta-kopiens chatprofil (2026-09-23, profil fra 2026-09-24).
 *
 * Oppførselen er uendret fra det frittstående endepunktet: demotilgangen
 * (`placy_lb_demo`-cookien, eller loopback på en ukonfigurert dev-server),
 * Leangenbuktas døgnkvote, sideregister, kilderegister og faste tekster.
 */
export const leangenbuktaChatProfile: SiteChatProfile = {
  id: "leangenbukta",
  logPrefix: "lb",
  dataset: "leangenbukta-lokal",
  env: { allowedOrigins: "PLACY_LB_CHAT_ALLOWED_ORIGINS", model: "PLACY_LB_CHAT_MODEL", timeoutMs: "PLACY_LB_CHAT_TIMEOUT_MS" },
  // Tilgangen avgjør alt her: uten gyldig cookie er svaret 401, som før.
  enabled: () => true,
  access: (request) => {
    const visitor = lbDemoAccess(request);
    return visitor ? { visitor } : null;
  },
  visitor: lbDemoAccess,
  // Samme nøkkel som demotilgangens cookie, som før; tokenet er i tillegg
  // bundet til kunde og datasett (`lib/demo/site-chat/transcript.ts`).
  transcriptSecretEnv: "PLACY_LB_DEMO_COOKIE_SECRET",
  chatMeter: {
    meter: "chat_message",
    envPrefix: "PLACY_LB_DEMO_CHAT",
    storeEnv: "PLACY_LB_DEMO_USAGE_STORE",
    defaults: { visitor: 60, global: 600 },
  },
  voice: {
    placeName: "Leangenbukta",
    salesContact: "salgsteamet",
    greeting: "Si en kort hilsen på norsk: at du er Anja fra Placy, og spør hva de lurer på om å bo i Leangenbukta. Høyst to setninger.",
    continuedGreeting: CONTINUED_VOICE_GREETING,
    meter: {
      meter: "voice_session",
      envPrefix: "PLACY_LB_DEMO_VOICE",
      storeEnv: "PLACY_LB_DEMO_USAGE_STORE",
      defaults: { visitor: 8, global: 60 },
    },
    // Demotilgangen gjelder både boardets kartstemme og chatboksen, fra samme origin.
    // Leangenbukta har ingen binding i den delte stemmens register; stemmen
    // finnes bare i den lokale ruta.
    hosted: null,
    remoteVisitor: (request) => (sameOriginOrNone(request) ? lbDemoAccess(request) : null),
  },
  getPage: (id) => getSitePage(id),
  snapshotDate: SITE_SNAPSHOT_DATE,
  instructions: textChatInstructions,
  opening: pageOpening,
  categories: (categories, starters) => chatCategories(categories, starters, CATEGORY_QUESTIONS),
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
