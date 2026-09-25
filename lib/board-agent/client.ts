import {
  BOARD_CHAT_ENDPOINT,
  BOARD_CHAT_PAGE_ID,
  BOARD_DIRECTIVE_MAX,
  isBoardDirectiveName,
  type BoardChatIntent,
  type BoardChatLink,
  type BoardChatMapState,
  type BoardChatReply,
  type BoardChatSource,
  type BoardDirective,
} from "@/lib/board-agent/types";

/**
 * Nettleserens kall mot Board-tekstbanen (2026-09-25).
 *
 * Svaret leses defensivt: alt som ikke har forventet form faller bort her,
 * så koordinatoren bare ser tekst, kilder og direktiver med kjente navn. Selve
 * direktivene valideres en gang til mot kartets data når de utføres
 * (`executeBoardTool`) — serveren er aldri eneste vakt for hva kartet gjør.
 */

export type BoardChatOutcome =
  | { ok: true; reply: BoardChatReply }
  | { ok: false; aborted: true }
  | { ok: false; aborted: false; status: number; error: string; links: BoardChatLink[] };

/** Brukes når serveren ikke sa noe forståelig selv. */
export const BOARD_CHAT_FALLBACK_ERROR = "Anja fikk ikke svart akkurat nå. Prøv igjen om litt, eller utforsk kartet i mellomtiden.";

const text = (value: unknown, max = 4000): string | null => (typeof value === "string" && value.trim() ? value.slice(0, max) : null);

function links(value: unknown): BoardChatLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const link = item as Partial<BoardChatLink> | null;
    const id = text(link?.id, 80);
    const label = text(link?.label, 120);
    const href = text(link?.href, 500);
    // Bare samme opprinnelse eller https — aldri `javascript:` eller data-URL-er fra et svar.
    return id && label && href && (href.startsWith("/") || href.startsWith("https://")) ? [{ id, label, href }] : [];
  });
}

/** Flere registerposter kan peke på samme side; brukeren skal se kilden én gang. */
function sources(value: unknown): BoardChatSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const source = item as Partial<BoardChatSource> | null;
    const id = text(source?.id, 80);
    const label = text(source?.label, 160);
    if (!id || !label) return [];
    const page = text(source?.page, 500) ?? "";
    const key = `${label}\u0000${page}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id, label, page, checkedAt: text(source?.checkedAt, 40) ?? "" }];
  });
}

export function parseDirectives(value: unknown): BoardDirective[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const directive = item as { name?: unknown; args?: unknown } | null;
      if (!directive || !isBoardDirectiveName(directive.name)) return [];
      const args = directive.args && typeof directive.args === "object" && !Array.isArray(directive.args) ? (directive.args as Record<string, unknown>) : {};
      return [{ name: directive.name, args }];
    })
    .slice(0, BOARD_DIRECTIVE_MAX);
}

export function parseBoardChatReply(body: unknown): BoardChatReply | null {
  const value = body as Partial<Record<keyof BoardChatReply, unknown>> | null;
  const reply = text(value?.reply);
  const transcript = text(value?.transcript, 30000);
  const answerType = value?.answerType;
  if (!reply || !transcript || (answerType !== "fact" && answerType !== "gap" && answerType !== "smalltalk" && answerType !== "refusal")) return null;
  return {
    reply,
    answerType,
    links: links(value?.links),
    sources: sources(value?.sources),
    notice: text(value?.notice, 400),
    transcript,
    datasetVersion: text(value?.datasetVersion, 120) ?? "",
    directives: parseDirectives(value?.directives),
  };
}

export async function askBoardChat(
  input: { message?: string; intent?: BoardChatIntent; transcript: string | null; board: BoardChatMapState },
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<BoardChatOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(BOARD_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal,
      body: JSON.stringify({
        pageId: BOARD_CHAT_PAGE_ID,
        ...(input.message ? { message: input.message } : {}),
        ...(input.intent ? { intent: input.intent } : {}),
        ...(input.transcript ? { transcript: input.transcript } : {}),
        board: input.board,
      }),
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return { ok: false, aborted: true };
    return { ok: false, aborted: false, status: 0, error: "Fikk ikke kontakt med Anja. Sjekk nettet og prøv igjen.", links: [] };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (signal.aborted) return { ok: false, aborted: true };
  }
  if (signal.aborted) return { ok: false, aborted: true };
  if (response.ok) {
    const reply = parseBoardChatReply(body);
    if (reply) return { ok: true, reply };
  }
  const error = text((body as { error?: unknown } | null)?.error, 400) ?? BOARD_CHAT_FALLBACK_ERROR;
  return { ok: false, aborted: false, status: response.status, error, links: links((body as { links?: unknown } | null)?.links) };
}
