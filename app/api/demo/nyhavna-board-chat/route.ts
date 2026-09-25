import { createSiteChatRoute } from "@/lib/demo/site-chat/route-handlers";
import { nyhavnaBoardChatProfile } from "@/lib/demo/nyhavna-chat/board-profile";

/**
 * Boardets agentmodus «Spør Anja» — tekstbanen (2026-09-25, KTD3/KTD4).
 *
 * Samme endepunktlogikk og svarvakter som nettsidekopien og Leangenbukta
 * (`lib/demo/site-chat/route-handlers.ts`); profilen
 * (`lib/demo/nyhavna-chat/board-profile.ts`) slår på Board-varianten
 * (`board: true`): body godtar `intent`/`board` i tillegg til `message`,
 * verktøysettet inkluderer de allowlistede kartverktøyene, og svaret bærer
 * `directives`. Bare på en utviklingsserver (`nhBoardChatEnabled`): et
 * produksjonsbygg gir 404, også når nettsidechatten er slått på.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const route = createSiteChatRoute(nyhavnaBoardChatProfile);

export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
