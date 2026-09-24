import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadLiveDemo } from "@/lib/live/demos";
import { backendModel, backendEffort } from "@/lib/live/session-config";
import { textChatTools } from "@/lib/demo/leangenbukta-chat/text-tools";
import { replyNotice } from "@/lib/demo/leangenbukta-chat/instructions";
import { runLeangenbuktaChat, ChatBackendError } from "@/lib/demo/leangenbukta-chat/backend";
import { issueTranscript, MAX_TRANSCRIPT_TOKEN_LENGTH, verifyTranscript } from "@/lib/demo/leangenbukta-chat/transcript";
import { sanitizeReply } from "@/lib/demo/leangenbukta-chat/sanitize";
import type { SiteChatProfile } from "@/lib/demo/site-chat/profile";

/**
 * Tekstchattens endepunkt for en nettsidekopi (2026-09-23, felles fra 2026-09-24).
 *
 * Opprinnelig Leangenbuktas `app/api/demo/leangenbukta-chat/route.ts`; nå
 * delt med Nyhavna-kopien gjennom en profil (`profile.ts`). Logikken er den
 * samme for begge:
 *
 * Ingen sesjon lagres på serveren: historikken bæres av et signert token
 * klienten sender inn og får tilbake (`transcript.ts`). Alt av fakta kommer
 * fra `loadLiveDemo(profile.dataset)` — SAMME kunnskap og verktøyimplementasjon
 * som Anjas taleflate, minus kartstyrende verktøy (`text-tools.ts`).
 * Instruksen er tekstchattens egen kompakte versjon, ikke Anjas lange manus.
 *
 * `CLAUDE.md`s regel om ingen runtime-LLM-kall har et navngitt, dokumentert
 * unntak for disse demoene (Leangenbukta: plandokumentets KTD4; Nyhavna:
 * bestilt av Andreas 2026-09-24 med de samme vaktene).
 */

const MAX_BODY_BYTES = 32 * 1024;

const bodySchema = z
  .object({
    message: z.string().min(1).max(600),
    pageId: z.string().min(1).max(80),
    transcript: z.string().max(MAX_TRANSCRIPT_TOKEN_LENGTH).optional(),
  })
  .strict();

const VOICE_HISTORY_NOTE =
  "Noen av de tidligere turene er fra en talesamtale med Anja i samme chatboks, automatisk transkribert og derfor med mulige hørefeil. Bruk dem som kontekst for hva brukeren viser til; fakta hentes fortsatt med verktøyene.";

export function createSiteChatRoute(profile: SiteChatProfile) {
  const prefix = profile.logPrefix;

  function allowedOrigins(): string[] {
    return (process.env[profile.env.allowedOrigins] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function isSameOrigin(request: NextRequest, origin: string): boolean {
    if (origin === request.nextUrl.origin) return true;
    // Next dev kan normalisere `nextUrl` til localhost selv når nettleseren
    // faktisk åpnet 127.0.0.1. Host er den opprinnelige forespørselens vert.
    const host = request.headers.get("host");
    return !!host && origin === `${request.nextUrl.protocol}//${host}`;
  }

  /**
   * Om forespørselen kommer fra et sted som har lov til å bruke chatten.
   *
   * Uten `Origin`-header (typisk en samme-side-forespørsel serveren selv gjør,
   * eller en enkel `fetch` fra samme opprinnelse i eldre nettlesere) godtas
   * kallet: det er kryssopprinnelse som skal begrenses, ikke fravær av headeren.
   * Med `Origin` kreves enten nøyaktig samme opprinnelse som ruta selv kjører
   * på, eller et medlem av profilens liste over tillatte opprinnelser.
   *
   * Kryss-site-innbygging på kundens eget nettsted (utenfor demoens domene)
   * krever enten et token i URL-en widgeten sendes med, eller en
   * SameSite=None-cookie — ingen av delene er bygget her; det er en kjent
   * grense, ikke en forglemmelse.
   */
  function isAllowedOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return true;
    if (isSameOrigin(request, origin)) return true;
    return allowedOrigins().includes(origin);
  }

  function corsHeaders(request: NextRequest): Record<string, string> {
    const origin = request.headers.get("origin");
    if (!origin || isSameOrigin(request, origin)) return {};
    if (!allowedOrigins().includes(origin)) return {};
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }

  function withCookie(response: NextResponse, cookie: string | undefined): NextResponse {
    if (cookie) response.headers.append("Set-Cookie", cookie);
    return response;
  }

  async function OPTIONS(request: NextRequest) {
    if (!profile.enabled()) return new NextResponse(null, { status: 404 });
    if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
    return new NextResponse(null, {
      status: 204,
      headers: { ...corsHeaders(request), "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
    });
  }

  async function GET(request: NextRequest) {
    if (!profile.enabled()) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
    const headers = { ...corsHeaders(request), "Cache-Control": "no-store" };
    const access = profile.access(request);
    if (!access) return NextResponse.json({ error: profile.replies.noAccess }, { status: 401, headers });
    const pageId = request.nextUrl.searchParams.get("pageId") ?? "";
    const page = profile.getPage(pageId);
    if (!page) return withCookie(NextResponse.json({ error: profile.replies.unknownPage, links: profile.fallbackLinks() }, { status: 400, headers }), access.setCookie);
    try {
      const demo = await loadLiveDemo(profile.dataset);
      // Datoen er nyeste registrerte kildekontroll, ikke en godkjenning av alt innhold.
      return withCookie(
        NextResponse.json(
          {
            pageTitle: page.title,
            opening: profile.opening(page),
            starters: page.chatStarters,
            // Temaraden: bare id, navn, ikon, farge og tre forslag per tema.
            categories: profile.categories(demo.board.categories, page.chatStarters),
            snapshotDate: profile.snapshotDate,
            contentCheckedAt: profile.sourceRegistry().latestCheckedAt,
            datasetVersion: demo.snapshotId,
          },
          { headers },
        ),
        access.setCookie,
      );
    } catch (error) {
      console.error(`${prefix}_chat_dataset_load_failed`, error instanceof Error ? error.message : "unknown");
      return NextResponse.json({ error: "Chatten er midlertidig utilgjengelig." }, { status: 503, headers });
    }
  }

  async function POST(request: NextRequest) {
    const startedAt = Date.now();
    if (!profile.enabled()) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
    const headers = { ...corsHeaders(request), "Cache-Control": "no-store" };
    const replies = profile.replies;

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

    const access = profile.access(request);
    if (!access) return NextResponse.json({ error: replies.noAccess }, { status: 401, headers });
    const { visitor, setCookie } = access;
    const respond = (body: unknown, init: { status?: number } = {}) =>
      withCookie(NextResponse.json(body, { ...init, headers }), setCookie);

    const page = profile.getPage(parsed.data.pageId);
    if (!page) return respond({ error: replies.unknownPage, links: profile.fallbackLinks() }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      return respond({ error: replies.notConnected, links: profile.fallbackLinks() }, { status: 503 });
    }

    let demo;
    try {
      demo = await loadLiveDemo(profile.dataset);
    } catch (error) {
      console.error(`${prefix}_chat_dataset_load_failed`, error instanceof Error ? error.message : "unknown");
      return respond({ error: "Chattens datagrunnlag kunne ikke lastes.", links: profile.fallbackLinks() }, { status: 503 });
    }

    const verified = verifyTranscript(parsed.data.transcript, visitor.visitorId);
    if (verified && verified.snapshotId !== demo.snapshotId) {
      return respond({ error: "Innholdet er oppdatert – last siden på nytt." }, { status: 409 });
    }
    const previousTurns = verified?.turns ?? [];

    // Kvoten belastes først etter alle deterministiske sjekker (tilgang, side,
    // API-nøkkel, datagrunnlag, transcript/snapshot) — en forespørsel som uansett
    // ville feilet uten modellkall skal ikke koste den besøkende en av dagens meldinger.
    const quota = await profile.consumeChatQuota(visitor.visitorId);
    if (!quota.allowed) {
      // En brukt kvote er 429; et utilgjengelig kvotelager er en tjenestefeil (503).
      const status = quota.reason === "visitor" || quota.reason === "global" ? 429 : 503;
      return respond({ error: replies.quota[quota.reason ?? "store"], links: profile.fallbackLinks() }, { status });
    }

    const conversation = demo.createConversation();
    const voiceNote = previousTurns.some((turn) => turn.via === "voice") ? `\n\n${VOICE_HISTORY_NOTE}` : "";
    const instructions = `${profile.instructions(page, demo.board.categories)}${voiceNote}`;
    const tools = textChatTools(demo.tools);
    const model = process.env[profile.env.model] || backendModel();
    const timeoutOverride = process.env[profile.env.timeoutMs];

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
        sourceRegistry: profile.sourceRegistry(),
        previousTurns,
        userText: parsed.data.message,
        // Overstyres bare i tester: produksjon bruker løkkas eget standardtak (25 s).
        ...(timeoutOverride ? { timeoutMs: Number(timeoutOverride) } : {}),
      });
    } catch (error) {
      const kind = error instanceof ChatBackendError ? error.kind : "upstream";
      console.error(`${prefix}_chat_backend_failed`, { kind, ms: Date.now() - startedAt, message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      return respond({ error: replies.backendError, links: profile.fallbackLinks() }, { status: kind === "timeout" ? 504 : 502 });
    }

    // AE5/R9: et "fact"-svar uten verktøybevis erstattes av et fast
    // kunnskapshull-svar — modellen skal ikke kunne late som den har bevis den
    // ikke har, uansett hva JSON-en sier. Det samme gjelder et svar som nevner
    // et årstall ingen verktøysvar i denne meldingen har (2008-premisset), uansett
    // svartype: da kan modellen ha bekreftet brukerens eget premiss.
    const noEvidence = result.answerType === "fact" && result.evidence.length === 0;
    const unsupportedYears = result.answerType === "refusal" ? [] : result.unsupportedYears;
    const fallbackReply = noEvidence ? replies.knowledgeGap : unsupportedYears.length ? replies.unsupportedYear(unsupportedYears) : null;
    const reply = sanitizeReply(fallbackReply ?? result.reply);
    const answerType = fallbackReply ? "gap" : result.answerType;
    const links = fallbackReply ? profile.fallbackLinks() : profile.resolveLinks(result.linkIds);
    // Kilder vises bare ved et faktasvar som slapp gjennom — aldri ved et fast svar.
    const sources = answerType === "fact" ? result.sources : [];
    const notice = fallbackReply
      ? null
      : replyNotice({ userText: parsed.data.message, reply, answerType, provisional: result.provisional }, replies.notices);

    const transcript = issueTranscript({
      visitorId: visitor.visitorId,
      snapshotId: demo.snapshotId,
      previousTurns,
      previousTrimmed: verified?.trimmed,
      newTurns: [{ role: "user", text: parsed.data.message }, { role: "assistant", text: reply }],
    });

    console.warn(`${prefix}_chat_turn`, {
      ms: Date.now() - startedAt,
      model,
      roundMs: result.roundMs,
      answerType,
      evidenceTools: result.evidence.map((e) => e.tool),
      sourceIds: sources.map((source) => source.id),
      unsupportedYears: unsupportedYears.length,
      usage: result.usage,
      pageId: page.id,
    });

    return respond({ reply, answerType, links, sources, notice, transcript, datasetVersion: demo.snapshotId, evidence: result.evidence });
  }

  return { GET, POST, OPTIONS };
}
