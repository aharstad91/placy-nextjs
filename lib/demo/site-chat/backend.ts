import "server-only";

import type { RealtimeTool } from "@/lib/realtime/types";
import type { NyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { normalizeBackendUsage, type BackendTokenUsage } from "@/lib/live/usage";
import { FACT_TOOL_NAMES } from "@/lib/demo/site-chat/text-tools";
import type { BoardMapPort } from "@/lib/demo/site-chat/board-map";
import type { TranscriptTurn } from "@/lib/demo/site-chat/transcript";
import { BOARD_DIRECTIVE_MAX, isBoardDirectiveName, type BoardDirective } from "@/lib/board-agent/types";
import {
  annotateSourceIds, resolveCitedSources, sourceIdsInOutput,
  type ChatSource, type SourceRegistry,
} from "@/lib/demo/site-chat/sources";

/**
 * Tekstchattens egen Responses-løkke (2026-09-23, KTD4).
 *
 * `/api/prototype/live` snakker med Responses gjennom GPT-Live sin
 * "delegation"-WebSocket (`lib/live/sideband.ts`) — stemmens modell eier den
 * sesjonen, og Responses-kallet er en side-kanal INN i den. Tekstchatten har
 * ingen stemmesesjon å henge på, så den kaller Responses API direkte med
 * vanlig HTTP, og gjør selv det sideband ellers gjør: kjør verktøykall,
 * legg svarene tilbake i samtalen, gjenta til modellen leverer et
 * sluttsvar eller rundetaket er nådd.
 *
 * `store: false` (KTD6) betyr at hver forespørsel må bære HELE historikken
 * selv — inkludert eventuelle resonnement-elementer fra forrige runde, som
 * sendes tilbake uåpnet slik OpenAI krever for resonnerende modeller uten
 * lagring. Denne fila vet ikke hva som er inni dem; den bare tar vare på dem.
 */

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_TIMEOUT_MS = 25000;
const MAX_OUTPUT_TOKENS = 900;
// Omvisningsverktøyene kan ekko brukerens egne interesser eller plan. Årstall
// derfra er derfor aldri selvstendig støtte for et årstall i svaret.
const YEAR_EVIDENCE_TOOLS = new Set(["find_places", "get_place_facts", "get_place_address", "get_board_facts", "find_project_info"]);

export type ChatAnswerType = "fact" | "gap" | "smalltalk" | "refusal";

export interface ChatEvidence {
  tool: string;
  /** Registerkildene verktøysvaret bar (`sources.ts`), utledet av serveren. */
  ids: string[];
}

export interface ChatBackendResult {
  reply: string;
  answerType: ChatAnswerType;
  linkIds: string[];
  evidence: ChatEvidence[];
  /** Kildene modellen siterte OG verktøyene returnerte i denne meldingen. */
  sources: ChatSource[];
  /**
   * Årstall i svaret som ingen av verktøysvarene i denne meldingen inneholder.
   * Et årstall brukeren selv nevnte er ikke bevis (2008-premisset).
   */
  unsupportedYears: string[];
  /** Minst ett verktøysvar merket noe som planlagt, forventet eller uavklart. */
  provisional: boolean;
  usage: BackendTokenUsage | null;
  /** Varigheten av hvert Responses-kall, i rekkefølge — til logg, ikke til klienten. */
  roundMs: number[];
  /**
   * Boardets kartdirektiver, validert og avduplisert, høyst `BOARD_DIRECTIVE_MAX`.
   * Alltid tom uten `RunInput.boardMap` — se `board-map.ts`.
   */
  directives: BoardDirective[];
}

export class ChatBackendError extends Error {
  constructor(
    message: string,
    public readonly kind: "upstream" | "timeout" | "invalid_output",
  ) {
    super(message);
    this.name = "ChatBackendError";
  }
}

interface RunInput {
  apiKey: string;
  model: string;
  effort: string;
  instructions: string;
  tools: RealtimeTool[];
  parallelToolCalls: boolean;
  conversation: NyhavnaConversation;
  sourceRegistry: SourceRegistry;
  previousTurns: readonly TranscriptTurn[];
  userText: string;
  maxRounds?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Boardets agentmodus (KTD3): når satt, valideres et allowlistet
   * kartverktøykall (navn i `BOARD_DIRECTIVE_NAMES`) mot Boardets egne data
   * HER i stedet for å kjøres av `conversation`, og samtalens egne
   * kartdirektiver (`ToolOutcome.directives`, f.eks. fra `open_theme`)
   * valideres gjennom samme port før de blir et direktiv til klienten.
   * Utelatt = dagens atferd, uendret.
   */
  boardMap?: BoardMapPort;
}

/**
 * Resonnerende modeller: GPT-5 og nyere (også gpt-6-sol/-luna, som
 * kundens modellvariabel, f.eks. `PLACY_LB_CHAT_MODEL`, kan peke på) og o-serien. De får `reasoning.effort`,
 * og med `store: false` må de be om kryptert resonnement for å kunne sende
 * det tilbake i neste verktøyrunde. Eldre modeller avviser feltet.
 */
function isReasoningModel(model: string): boolean {
  const gpt = /^gpt-(\d+)/.exec(model);
  return gpt ? Number(gpt[1]) >= 5 : /^o[1-9]/.test(model);
}

const jsonSchemaFormat = {
  type: "json_schema" as const,
  name: "site_chat_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string", maxLength: 1200 },
      answer_type: { type: "string", enum: ["fact", "gap", "smalltalk", "refusal"] },
      link_ids: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 4 },
      source_ids: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 4 },
    },
    required: ["reply", "answer_type", "link_ids", "source_ids"],
  },
};

type InputItem = Record<string, unknown>;

function userMessage(text: string): InputItem {
  return { role: "user", content: [{ type: "input_text", text }] };
}

function assistantMessage(text: string): InputItem {
  return { role: "assistant", content: [{ type: "output_text", text }] };
}

/** Henter siste `output_text` fra en avsluttet respons, uansett hvor i output-lista meldingselementet ligger. */
function extractOutputText(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const value = item as { type?: unknown; content?: unknown };
    if (value.type !== "message" || !Array.isArray(value.content)) continue;
    for (const part of value.content) {
      if (part && typeof part === "object" && (part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

interface PendingCall {
  callId: string;
  name: string;
  args: string;
}

function extractFunctionCalls(output: unknown): PendingCall[] {
  if (!Array.isArray(output)) return [];
  const calls: PendingCall[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const value = item as { type?: unknown; call_id?: unknown; name?: unknown; arguments?: unknown };
    if (value.type === "function_call" && typeof value.call_id === "string" && typeof value.name === "string") {
      calls.push({ callId: value.call_id, name: value.name, args: typeof value.arguments === "string" ? value.arguments : "{}" });
    }
  }
  return calls;
}

function parseStructuredReply(text: string): { reply: string; answerType: ChatAnswerType; linkIds: string[]; sourceIds: string[] } | null {
  try {
    const value = JSON.parse(text) as { reply?: unknown; answer_type?: unknown; link_ids?: unknown; source_ids?: unknown };
    if (typeof value.reply !== "string" || value.reply.length === 0) return null;
    const answerType = value.answer_type;
    if (answerType !== "fact" && answerType !== "gap" && answerType !== "smalltalk" && answerType !== "refusal") return null;
    const linkIds = Array.isArray(value.link_ids) ? value.link_ids.filter((id): id is string => typeof id === "string") : [];
    const sourceIds = Array.isArray(value.source_ids) ? value.source_ids.filter((id): id is string => typeof id === "string") : [];
    return { reply: value.reply, answerType, linkIds, sourceIds };
  } catch {
    return null;
  }
}

async function callResponses(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{ status: string; output: unknown; usage: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new ChatBackendError("Tidsavbrudd mot modellen.", "timeout");
    throw new ChatBackendError("Kunne ikke nå modellen.", "upstream");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = `Modellkallet feilet (${res.status}).`;
    try {
      const errorBody = (await res.json()) as { error?: { message?: string } };
      if (errorBody.error?.message) message = errorBody.error.message;
    } catch {
      // Ukjent feilform fra leverandøren; standardmeldingen over holder.
    }
    throw new ChatBackendError(message, "upstream");
  }
  const data = (await res.json()) as { status?: unknown; output?: unknown; usage?: unknown };
  return { status: typeof data.status === "string" ? data.status : "unknown", output: data.output, usage: data.usage };
}

/**
 * Kjører hele tur-og-verktøy-løkka for ÉN brukermelding og returnerer et
 * FERDIG strukturert svar. Kaster `ChatBackendError` ved leverandørfeil,
 * tidsavbrudd eller et sluttsvar som aldri kom i gyldig form — kallstedet
 * (ruta) oversetter det til 502/503 uten å lekke leverandørens egen tekst.
 */
/**
 * Om et verktøysvar faktisk bærer kunnskap (AE5/R9).
 *
 * En feil, `ok: false`, `matches: 0`, en tom resultatliste eller et tema uten
 * kapittel er fravær av bevis — verktøyet har selv sagt at grunnlaget mangler.
 * Bare et svar med innhold kan slippe et faktasvar gjennom tekstserveren.
 */
function isEvidence(output: unknown): boolean {
  if (!output || typeof output !== "object") return false;
  const value = output as Record<string, unknown>;
  if ("error" in value || value.ok === false || value.matches === 0) return false;
  if (Array.isArray(value.results) && value.results.length === 0) return false;
  if ("chapter" in value && !value.chapter) return false;
  return true;
}

/** Identiske duplikater fjernet (navn + argumenter), høyst `BOARD_DIRECTIVE_MAX`. */
function dedupeDirectives(list: readonly BoardDirective[]): BoardDirective[] {
  const seen = new Set<string>();
  const result: BoardDirective[] = [];
  for (const directive of list) {
    const key = JSON.stringify([directive.name, directive.args]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(directive);
    if (result.length >= BOARD_DIRECTIVE_MAX) break;
  }
  return result;
}

const YEAR = /\b(?:19|20)\d{2}\b/g;

/** Årstallene i svaret som ikke står i noe verktøysvar fra denne meldingen. */
function yearsMissingFrom(reply: string, toolText: string): string[] {
  const supported = new Set(toolText.match(YEAR) ?? []);
  return [...new Set(reply.match(YEAR) ?? [])].filter((year) => !supported.has(year));
}

/**
 * Om verktøysvaret merker noe som ikke er ferdig bekreftet. Leser bare
 * strukturerte felt verktøyene selv setter (status, status_note,
 * uncertainties), aldri modellens tekst.
 */
const PROVISIONAL_STATUS = /planlagt|planned|forventet|uavklart|unresolved|visjon|vedtatt plan/i;
function isProvisional(output: unknown): boolean {
  if (Array.isArray(output)) return output.some(isProvisional);
  if (!output || typeof output !== "object") return false;
  const value = output as Record<string, unknown>;
  if (typeof value.status === "string" && PROVISIONAL_STATUS.test(value.status)) return true;
  if (typeof value.status_note === "string" && value.status_note) return true;
  if (Array.isArray(value.uncertainties) && value.uncertainties.length > 0) return true;
  return Object.values(value).some((child) => child && typeof child === "object" && isProvisional(child));
}

export async function runSiteChat(input: RunInput): Promise<ChatBackendResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const reasoning = isReasoningModel(input.model);

  const conversationInput: InputItem[] = [
    ...input.previousTurns.map((turn) => (turn.role === "user" ? userMessage(turn.text) : assistantMessage(turn.text))),
    userMessage(input.userText),
  ];

  const evidence: ChatEvidence[] = [];
  // Teksten i verktøysvarene som telte som bevis — grunnlaget årstallsvakten sjekker mot.
  const evidenceText: string[] = [];
  // Boardets kartdirektiver, uavduplisert og ubegrenset til de samles og klippes ved sluttsvaret.
  const collectedDirectives: BoardDirective[] = [];
  let provisional = false;
  const allowedTools = new Set(input.tools.map((tool) => tool.name));
  let usageTotal: BackendTokenUsage | null = null;
  const roundMs: number[] = [];
  const toolCallsByRound: string[][] = [];
  const addUsage = (raw: unknown) => {
    const normalized = normalizeBackendUsage(raw);
    if (!normalized) return;
    usageTotal = usageTotal
      ? {
          input_tokens: usageTotal.input_tokens + normalized.input_tokens,
          output_tokens: usageTotal.output_tokens + normalized.output_tokens,
          input_tokens_details: { cached_tokens: (usageTotal.input_tokens_details?.cached_tokens ?? 0) + (normalized.input_tokens_details?.cached_tokens ?? 0) },
        }
      : normalized;
  };

  for (let round = 0; round < maxRounds; round += 1) {
    // Enkle spørsmål skal ikke bli en lang verktøyjakt. Etter to runder med
    // faktisk kunnskap må modellen svare fra materialet den har, eller si at
    // grunnlaget ikke strekker til. Siste runde er alltid et sluttsvar.
    const finalRound = (round >= 2 && evidence.length > 0) || round === maxRounds - 1;
    const requestBody: Record<string, unknown> = {
      model: input.model,
      instructions: input.instructions,
      input: conversationInput,
      tools: input.tools,
      tool_choice: finalRound ? "none" : "auto",
      parallel_tool_calls: input.parallelToolCalls,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
      text: { format: jsonSchemaFormat },
      ...(reasoning ? { reasoning: { effort: input.effort }, include: ["reasoning.encrypted_content"] } : {}),
    };
    const roundStartedAt = Date.now();
    const response = await callResponses(fetchImpl, timeoutMs, requestBody, input.apiKey);
    roundMs.push(Date.now() - roundStartedAt);
    addUsage(response.usage);
    if (response.status !== "completed") throw new ChatBackendError(`Modellen fullførte ikke svaret (status ${response.status}).`, "upstream");

    const calls = extractFunctionCalls(response.output);
    toolCallsByRound.push(calls.map((call) => call.name));
    if (calls.length === 0) {
      const text = extractOutputText(response.output);
      const parsed = text ? parseStructuredReply(text) : null;
      if (!parsed) throw new ChatBackendError("Modellsvaret hadde ikke forventet form.", "invalid_output");
      const verified = new Set(evidence.flatMap((item) => item.ids));
      return {
        reply: parsed.reply,
        answerType: parsed.answerType,
        linkIds: parsed.linkIds,
        evidence,
        sources: resolveCitedSources(parsed.sourceIds, verified, input.sourceRegistry),
        unsupportedYears: yearsMissingFrom(parsed.reply, evidenceText.join("\n")),
        provisional,
        usage: usageTotal,
        roundMs,
        directives: dedupeDirectives(collectedDirectives),
      };
    }

    // Hele forrige output (inkl. ev. resonnement-elementer) legges tilbake
    // uåpnet FØR verktøysvarene, slik `store: false` krever.
    if (Array.isArray(response.output)) conversationInput.push(...(response.output as InputItem[]));

    for (const call of calls) {
      // Bare verktøyene tekstchatten tilbyr kan kjøres. Et navn modellen har
      // plukket fra instruksen (f.eks. et kartverktøy) får en feil tilbake.
      if (!allowedTools.has(call.name)) {
        conversationInput.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify({ error: `Verktøyet «${call.name}» finnes ikke i tekstchatten.` }) });
        continue;
      }
      let args: Record<string, unknown> = {};
      try {
        const parsedArgs = JSON.parse(call.args || "{}");
        if (parsedArgs && typeof parsedArgs === "object" && !Array.isArray(parsedArgs)) args = parsedArgs;
      } catch {
        // Ugyldige argumenter behandles som tomme; verktøyet svarer selv med feil ved manglende felt.
      }
      let output: unknown;
      try {
        if (input.boardMap && isBoardDirectiveName(call.name)) {
          // Boardets agentmodus: et allowlistet kartverktøy modellen selv kalte
          // (bare tilbudt når Boardet er åpent) valideres mot Boardets EGNE data —
          // aldri kjørt av `conversation`, som ikke har noe kart å style.
          const validated = input.boardMap.execute(call.name, args);
          output = validated.result;
          if (validated.directive) collectedDirectives.push(validated.directive);
        } else {
          const outcome = await input.conversation.execute(call.name, args);
          output = annotateSourceIds(outcome.result, input.sourceRegistry);
          if (FACT_TOOL_NAMES.has(call.name) && isEvidence(output)) {
            evidence.push({ tool: call.name, ids: sourceIdsInOutput(output, input.sourceRegistry) });
            // Kontrolldatoen (`checked_at`) sier når kilden ble lest, ikke noe om
            // prosjektet; ellers ville årets tall alltid sett kildebelagt ut.
            if (YEAR_EVIDENCE_TOOLS.has(call.name)) {
              evidenceText.push(JSON.stringify(output, (key, value) => (key === "checked_at" || key === "checkedAt" ? undefined : value)));
            }
            provisional ||= isProvisional(output);
          }
          // Samtalens EGNE kartdirektiver (f.eks. `open_theme`/`set_interests`
          // sin `openMapFor`) valideres gjennom samme port som modellens egne
          // kall — uten `boardMap` droppes de her, som før (ingen bro å sende
          // dem til i en tekstsamtale, se `text-tools.ts`).
          if (input.boardMap && Array.isArray(outcome.directives)) {
            for (const raw of outcome.directives) {
              if (!raw || typeof raw.name !== "string") continue;
              const validated = input.boardMap.execute(raw.name, raw.args ?? {});
              if (validated.directive) collectedDirectives.push(validated.directive);
            }
          }
        }
      } catch {
        output = { error: "Verktøykallet kunne ikke fullføres." };
      }
      conversationInput.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(output ?? null) });
    }
  }
  throw new ChatBackendError(`Modellen brukte for mange runder uten et sluttsvar. Verktøy per runde: ${JSON.stringify(toolCallsByRound)}.`, "invalid_output");
}
