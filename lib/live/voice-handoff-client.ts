/**
 * Tale → tekst, nettleserens side (2026-09-24, delt fra 2026-09-25).
 *
 * Når en lokal talesesjon er slutt, byttes sesjonstokenet mot et nytt signert
 * historikktoken for tekstbanen (`/api/prototype/live/handoff`, kontrakten i
 * `lib/demo/site-chat/voice-handoff.ts`). Brukes av chatwidgetens talebro og
 * av Boardets agentmodus.
 */

const HANDOFF_ENDPOINT = "/api/prototype/live/handoff";
const HANDOFF_TIMEOUT_MS = 8000;

export interface VoiceHandoffToken {
  transcript: string;
  voiceTurns: number;
  trimmed: boolean;
}

/** Bytter sesjonstokenet mot et signert historikktoken, eller null ved enhver feil. */
export async function fetchVoiceHandoff(sessionToken: string): Promise<VoiceHandoffToken | null> {
  try {
    const response = await fetch(HANDOFF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session: sessionToken }),
      signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { transcript?: unknown; voiceTurns?: unknown; trimmed?: unknown };
    if (typeof body.transcript !== "string" || !body.transcript) return null;
    return { transcript: body.transcript, voiceTurns: typeof body.voiceTurns === "number" ? body.voiceTurns : 0, trimmed: body.trimmed === true };
  } catch {
    return null;
  }
}

/**
 * Venter på serverens opprydding (den lukker opptaket; først da er alle turene
 * med), men aldri lenger enn fristen: en hengende DELETE skal ikke holde
 * tekstbanen igjen, og opptaket kan leses også før lukking, bare uten de aller
 * siste ordene. Deretter byttes tokenet.
 */
export async function exchangeVoiceHandoff(sessionToken: string, settled: Promise<boolean>): Promise<VoiceHandoffToken | null> {
  await Promise.race([settled.catch(() => false), new Promise((resolve) => setTimeout(resolve, HANDOFF_TIMEOUT_MS))]);
  return fetchVoiceHandoff(sessionToken);
}
