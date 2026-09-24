import { createSiteChatRoute } from "@/lib/demo/site-chat/route-handlers";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";

/**
 * Tekstchatten på Nyhavna-nettsidekopien (2026-09-24).
 *
 * Samme endepunktlogikk og svarvakter som Leangenbukta
 * (`lib/demo/site-chat/route-handlers.ts`); profilen
 * (`lib/demo/nyhavna-chat/profile.ts`) gir datasettet `nyhavna-lokal`, egen
 * anonym besøkstilgang, egne døgnkvoter, to sider og Nyhavnas kilderegister.
 * Et produksjonsbygg uten `PLACY_NH_CHAT_ENABLED` og signeringsnøkkel gir 404.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const route = createSiteChatRoute(nyhavnaChatProfile);

export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
