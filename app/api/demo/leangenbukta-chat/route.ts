import { createSiteChatRoute } from "@/lib/demo/site-chat/route-handlers";
import { leangenbuktaChatProfile } from "@/lib/demo/leangenbukta-chat/profile";

/**
 * Leangenbukta-kundedemoens tekstchat-endepunkt (2026-09-23, U5/KTD4/KTD6).
 *
 * Logikken er felles for nettsidekopiene (`lib/demo/site-chat/route-handlers.ts`);
 * profilen (`lib/demo/leangenbukta-chat/profile.ts`) bestemmer datasett,
 * tilgang, kvote, sider, kilder og faste tekster.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const route = createSiteChatRoute(leangenbuktaChatProfile);

export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
