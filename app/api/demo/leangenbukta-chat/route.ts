import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSitePage, SITE_SNAPSHOT_DATE } from "@/lib/demo/leangenbukta-site/pages";
import { lbDemoAccess } from "@/lib/demo/leangenbukta-site/access";
import { consumeDemoQuota } from "@/lib/demo/leangenbukta-site/usage";
import { loadLiveDemo } from "@/lib/live/demos";
import { backendModel, backendEffort } from "@/lib/live/session-config";
import { textChatTools } from "@/lib/demo/leangenbukta-chat/text-tools";
import { textModeAddendum, KNOWLEDGE_GAP_REPLY, BACKEND_ERROR_REPLY } from "@/lib/demo/leangenbukta-chat/instructions";
import { runLeangenbuktaChat, ChatBackendError } from "@/lib/demo/leangenbukta-chat/backend";
import { issueTranscript, verifyTranscript } from "@/lib/demo/leangenbukta-chat/transcript";
import { fallbackLinks, resolveLinkIds } from "@/lib/demo/leangenbukta-chat/links";
import { sanitizeReply } from "@/lib/demo/leangenbukta-chat/sanitize";

/**
 * Leangenbukta-kundedemoens tekstchat-endepunkt (2026-09-23, U5/KTD4/KTD6).
 *
 * Ingen sesjon lagres på serveren: historikken bæres av et signert token
 * klienten sender inn og får tilbake (`transcript.ts`). Alt av fakta og
 * statusregler kommer fra `loadLiveDemo("leangenbukta-lokal")` — SAMME
 * kunnskap og verktøyimplementasjon som Anjas taleflate, minus kartstyrende
 * verktøy (`text-tools.ts`).
 *
 * `CLAUDE.md`s regel om ingen runtime-LLM-kall har et navngitt, dokumentert
 * unntak for akkurat denne demoen (plandokumentets KTD4), etter Andreas'
 * uttrykkelige bestilling om en fungerende tekstchat.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const CHAT_MODEL_ENV = "PLACY_LB_CHAT_MODEL";

const bodySchema = z
  .object({
    message: z.string().min(1).max(600),
    pageId: z.string().min(1).max(80),
    transcript: z.string().max(8192).optional(),
  })
  .strict();

function allowedOrigins(): string[] {
  return (process.env.PLACY_LB_CHAT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Om forespørselen kommer fra et sted som har lov til å bruke chatten.
 *
 * Uten `Origin`-header (typisk en samme-side-forespørsel serveren selv gjør,
 * eller en enkel `fetch` fra samme opprinnelse i eldre nettlesere) godtas
 * kallet: det er kryssopprinnelse som skal begrenses, ikke fravær av headeren.
 * Med `Origin` kreves enten nøyaktig samme opprinnelse som ruta selv kjører
 * på, eller et medlem av `PLACY_LB_CHAT_ALLOWED_ORIGINS`.
 *
 * Kryss-site-innbygging på kundens WordPress (utenfor denne demoens eget
 * domene) krever enten et token i URL-en widgeten sendes med, eller en
 * SameSite=None-cookie — ingen av delene er bygget her; det er en kjent
 * grense, ikke en forglemmelse (se sluttrapporten).
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === request.nextUrl.origin) return true;
  return allowedOrigins().includes(origin);
}

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || origin === request.nextUrl.origin) return {};
  if (!allowedOrigins().includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

export async function OPTIONS(request: NextRequest) {
  if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(request), "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

const QUOTA_MESSAGES: Record<string, string> = {
  visitor: "Du har brukt opp dagens spørsmål i denne demoen. Prøv igjen i morgen, eller bruk Boardet i mellomtiden.",
  global: "Demoen har mange samtaler akkurat nå. Prøv igjen om litt, eller bruk Boardet i mellomtiden.",
  store: "Chatten er midlertidig utilgjengelig. Prøv igjen om litt, eller bruk Boardet i mellomtiden.",
};

export async function GET(request: NextRequest) {
  if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
  const headers = { ...corsHeaders(request), "Cache-Control": "no-store" };
  const visitor = lbDemoAccess(request);
  if (!visitor) return NextResponse.json({ error: "Ingen tilgang til demoen. Last siden på nytt, eller åpne demolenken du fikk tilsendt." }, { status: 401, headers });
  const pageId = request.nextUrl.searchParams.get("pageId") ?? "";
  const page = getSitePage(pageId);
  if (!page) return NextResponse.json({ error: "Chatten kjenner ikke denne siden. Bruk Boardet eller kontakt salgsteamet.", links: fallbackLinks() }, { status: 400, headers });
  try {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    return NextResponse.json(
      { pageTitle: page.title, starters: page.chatStarters, snapshotDate: SITE_SNAPSHOT_DATE, datasetVersion: demo.snapshotId },
      { headers },
    );
  } catch (error) {
    console.error("lb_chat_dataset_load_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Chatten er midlertidig utilgjengelig." }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
  const headers = { ...corsHeaders(request), "Cache-Control": "no-store" };

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return new NextResponse(null, { status: 413, headers });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413, headers });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400, headers });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400, headers });

  const visitor = lbDemoAccess(request);
  if (!visitor) return NextResponse.json({ error: "Ingen tilgang til demoen. Last siden på nytt, eller åpne demolenken du fikk tilsendt." }, { status: 401, headers });

  const page = getSitePage(parsed.data.pageId);
  if (!page) return NextResponse.json({ error: "Chatten kjenner ikke denne siden. Bruk Boardet eller kontakt salgsteamet.", links: fallbackLinks() }, { status: 400, headers });

  const quota = await consumeDemoQuota(visitor.visitorId, "chat_message");
  if (!quota.allowed) {
    return NextResponse.json({ error: QUOTA_MESSAGES[quota.reason ?? "store"], links: fallbackLinks() }, { status: 429, headers });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Chatten er ikke koblet til akkurat nå. Bruk Boardet eller kontakt salgsteamet.", links: fallbackLinks() }, { status: 503, headers });
  }

  let demo;
  try {
    demo = await loadLiveDemo("leangenbukta-lokal");
  } catch (error) {
    console.error("lb_chat_dataset_load_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Chattens datagrunnlag kunne ikke lastes.", links: fallbackLinks() }, { status: 503, headers });
  }

  const verified = verifyTranscript(parsed.data.transcript, visitor.visitorId);
  if (verified && verified.snapshotId !== demo.snapshotId) {
    return NextResponse.json({ error: "Innholdet er oppdatert – last siden på nytt." }, { status: 409, headers });
  }
  const previousTurns = verified?.turns ?? [];

  const conversation = demo.createConversation();
  const instructions = `${demo.backendInstructions}\n\n${textModeAddendum(page)}`;
  const tools = textChatTools(demo.tools);
  const model = process.env[CHAT_MODEL_ENV] || backendModel();

  let result;
  try {
    result = await runLeangenbuktaChat({
      apiKey: process.env.OPENAI_API_KEY,
      model,
      effort: backendEffort(),
      instructions,
      tools,
      parallelToolCalls: demo.parallelTools ?? true,
      conversation,
      previousTurns,
      userText: parsed.data.message,
      // Overstyres bare i tester: produksjon bruker `runLeangenbuktaChat`s eget standardtak (25 s).
      ...(process.env.PLACY_LB_CHAT_TIMEOUT_MS ? { timeoutMs: Number(process.env.PLACY_LB_CHAT_TIMEOUT_MS) } : {}),
    });
  } catch (error) {
    const kind = error instanceof ChatBackendError ? error.kind : "upstream";
    console.error("lb_chat_backend_failed", { kind, ms: Date.now() - startedAt, message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return NextResponse.json({ error: BACKEND_ERROR_REPLY, links: fallbackLinks() }, { status: kind === "timeout" ? 504 : 502, headers });
  }

  // AE5/R9: et "fact"-svar uten verktøybevis erstattes av et fast
  // kunnskapshull-svar — modellen skal ikke kunne late som den har bevis den
  // ikke har, uansett hva JSON-en sier.
  const noEvidence = result.answerType === "fact" && result.evidence.length === 0;
  const reply = sanitizeReply(noEvidence ? KNOWLEDGE_GAP_REPLY : result.reply);
  const answerType = noEvidence ? "gap" : result.answerType;
  const links = resolveLinkIds(result.linkIds);

  const transcript = issueTranscript({
    visitorId: visitor.visitorId,
    snapshotId: demo.snapshotId,
    previousTurns,
    userText: parsed.data.message,
    assistantText: reply,
  });

  console.warn("lb_chat_turn", {
    ms: Date.now() - startedAt,
    answerType,
    evidenceTools: result.evidence.map((e) => e.tool),
    usage: result.usage,
    pageId: page.id,
  });

  return NextResponse.json(
    { reply, answerType, links, transcript, datasetVersion: demo.snapshotId, evidence: result.evidence },
    { headers },
  );
}
