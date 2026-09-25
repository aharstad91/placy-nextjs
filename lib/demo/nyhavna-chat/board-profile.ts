import "server-only";

import type { ResolvedLink, SiteChatPage, SiteChatProfile } from "@/lib/demo/site-chat/profile";
import { BOARD_CHAT_PAGE_ID } from "@/lib/board-agent/types";
import { chatCategories } from "@/lib/demo/site-chat/categories";
import { nhChatAccess, nhChatEnabled, nhChatVisitor } from "@/lib/demo/nyhavna-chat/access";
import { NH_SITE_SNAPSHOT_DATE } from "@/lib/demo/nyhavna-chat/pages";
import { nhBoardChatInstructions, NH_REPLIES } from "@/lib/demo/nyhavna-chat/instructions";
import { NH_CATEGORY_QUESTIONS } from "@/lib/demo/nyhavna-chat/categories";
import { nyhavnaSourceRegistry } from "@/lib/demo/nyhavna-chat/sources";
import { resolveNhLinkIds } from "@/lib/demo/nyhavna-chat/links";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";

/**
 * Boardets agentmodus «Spør Anja» (2026-09-25, KTD3/KTD4) — server-profil.
 *
 * Bygger på `nyhavnaChatProfile`: SAMME `id`, `dataset` og
 * `transcriptSecretEnv` (og samme `chatMeter`), slik at et signert
 * historikktoken herfra er gyldig for tale-fortsettelsen på `/api/prototype/live`
 * (`chatContinuity` der slår opp kunden på DATASETT, ikke på denne profilen —
 * se `app/api/prototype/live/route.ts`) og for overføringen tilbake til tekst
 * (`voice-handoff.ts`). Boardet er ikke registrert i `customers.ts`: det
 * finnes bare sin egen rute (`nyhavna-board-chat/route.ts`), og deler kunden
 * med nettsidekopien gjennom `dataset`, ikke gjennom registeret.
 *
 * Det som skiller profilen fra `nyhavnaChatProfile`: ÉN side (Boardet selv,
 * ikke et sideregister over en nettsidekopi), Board-instruksen
 * (`nhBoardChatInstructions` — kartverktøy i stedet for nettsidens
 * «intet kart»-regel), og lenker uten «board» (brukeren står alt i kartet).
 * `board: true` slår på Board-varianten i `route-handlers.ts`.
 */

const BOARD_PAGE: SiteChatPage = {
  id: BOARD_CHAT_PAGE_ID,
  title: "Nyhavna",
  kind: "board",
  chatStarters: ["Hva planlegges på Nyhavna?", "Hvilke delområder har Nyhavna?", "Hva finnes i nærområdet i dag?"],
};

function resolveBoardLinkIds(linkIds: readonly unknown[]): ResolvedLink[] {
  // «board» gir ingen mening herfra — brukeren står allerede i kartet.
  return resolveNhLinkIds(linkIds.filter((id) => id !== "board"));
}

function boardFallbackLinks(): ResolvedLink[] {
  return resolveNhLinkIds(["contact"]);
}

export const nyhavnaBoardChatProfile: SiteChatProfile = {
  id: nyhavnaChatProfile.id,
  logPrefix: "nh-board",
  dataset: nyhavnaChatProfile.dataset,
  env: nyhavnaChatProfile.env,
  enabled: nhChatEnabled,
  access: nhChatAccess,
  visitor: nhChatVisitor,
  transcriptSecretEnv: nyhavnaChatProfile.transcriptSecretEnv,
  chatMeter: nyhavnaChatProfile.chatMeter,
  // Ubrukt via denne profilen (Boardets stemme kobles via kunderegisteret på
  // datasett, se filkommentaren over) — speilet inn for å oppfylle kontrakten.
  voice: nyhavnaChatProfile.voice,
  getPage: (id) => (id === BOARD_CHAT_PAGE_ID ? BOARD_PAGE : null),
  snapshotDate: NH_SITE_SNAPSHOT_DATE,
  instructions: nhBoardChatInstructions,
  opening: () => "Spør meg om et sted, et tema eller noe du lurer på ved Nyhavna — jeg svarer ut fra offentlige kilder og viser deg det i kartet.",
  categories: (categories, starters) => chatCategories(categories, starters, NH_CATEGORY_QUESTIONS),
  sourceRegistry: nyhavnaSourceRegistry,
  resolveLinks: resolveBoardLinkIds,
  fallbackLinks: boardFallbackLinks,
  replies: NH_REPLIES,
  board: true,
};
