import "server-only";

import type { RealtimeTool } from "@/lib/realtime/types";
import type { NyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { normalizeBackendUsage, type BackendTokenUsage } from "@/lib/live/usage";
import { FACT_TOOL_NAMES } from "@/lib/demo/leangenbukta-chat/text-tools";
import type { TranscriptTurn } from "@/lib/demo/leangenbukta-chat/transcript";

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

export type ChatAnswerType = "fact" | "gap" | "smalltalk" | "refusal";

export interface ChatEvidence {
  tool: string;
  ids?: string[];
}

export interface ChatBackendResult {
  reply: string;
  answerType: ChatAnswerType;
  linkIds: string[];
  evidence: ChatEvidence[];
  usage: BackendTokenUsage | null;
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
  previousTurns: readonly TranscriptTurn[];
  userText: string;
  maxRounds?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const REASONING_MODEL = /^(gpt-5|o[1-9])/;

const jsonSchemaFormat = {
  type: "json_schema" as const,
  name: "leangenbukta_chat_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string", maxLength: 1200 },
      answer_type: { type: "string", enum: ["fact", "gap", "smalltalk", "refusal"] },
      link_ids: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 4 },
    },
    required: ["reply", "answer_type", "link_ids"],
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

function parseStructuredReply(text: string): { reply: string; answerType: ChatAnswerType; linkIds: string[] } | null {
  try {
    const value = JSON.parse(text) as { reply?: unknown; answer_type?: unknown; link_ids?: unknown };
    if (typeof value.reply !== "string" || value.reply.length === 0) return null;
    const answerType = value.answer_type;
    if (answerType !== "fact" && answerType !== "gap" && answerType !== "smalltalk" && answerType !== "refusal") return null;
    const linkIds = Array.isArray(value.link_ids) ? value.link_ids.filter((id): id is string => typeof id === "string") : [];
    return { reply: value.reply, answerType, linkIds };
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

export async function runLeangenbuktaChat(input: RunInput): Promise<ChatBackendResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const reasoning = REASONING_MODEL.test(input.model);

  const conversationInput: InputItem[] = [
    ...input.previousTurns.map((turn) => (turn.role === "user" ? userMessage(turn.text) : assistantMessage(turn.text))),
    userMessage(input.userText),
  ];

  const evidence: ChatEvidence[] = [];
  const allowedTools = new Set(input.tools.map((tool) => tool.name));
  let usageTotal: BackendTokenUsage | null = null;
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
    const requestBody: Record<string, unknown> = {
      model: input.model,
      instructions: input.instructions,
      input: conversationInput,
      tools: input.tools,
      tool_choice: "auto",
      parallel_tool_calls: input.parallelToolCalls,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
      text: { format: jsonSchemaFormat },
      ...(reasoning ? { reasoning: { effort: input.effort }, include: ["reasoning.encrypted_content"] } : {}),
    };
    const response = await callResponses(fetchImpl, timeoutMs, requestBody, input.apiKey);
    addUsage(response.usage);
    if (response.status !== "completed") throw new ChatBackendError(`Modellen fullførte ikke svaret (status ${response.status}).`, "upstream");

    const calls = extractFunctionCalls(response.output);
    if (calls.length === 0) {
      const text = extractOutputText(response.output);
      const parsed = text ? parseStructuredReply(text) : null;
      if (!parsed) throw new ChatBackendError("Modellsvaret hadde ikke forventet form.", "invalid_output");
      return { reply: parsed.reply, answerType: parsed.answerType, linkIds: parsed.linkIds, evidence, usage: usageTotal };
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
        const outcome = await input.conversation.execute(call.name, args);
        output = outcome.result;
        // Kartdirektiver droppes med vilje her — se `text-tools.ts`: det finnes
        // ingen bro å sende dem til i en tekstsamtale.
        if (FACT_TOOL_NAMES.has(call.name) && isEvidence(output)) evidence.push({ tool: call.name });
      } catch {
        output = { error: "Verktøykallet kunne ikke fullføres." };
      }
      conversationInput.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(output ?? null) });
    }
  }
  throw new ChatBackendError("Modellen brukte for mange runder uten et sluttsvar.", "invalid_output");
}
