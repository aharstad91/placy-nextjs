import 'server-only';

/**
 * Oppretter Live-sesjonen (`POST /v1/live/sessions`) og bytter SDP-tilbudet mot
 * et svar. Nøkkelen blir på serveren; feil fra OpenAI oversettes til noe som kan
 * vises i grensesnittet uten å lekke hverken nøkkel eller feilmeldingstekst.
 */

/** En feil som kan vises til brukeren: HTTP-status og OpenAIs egen feilkode, ingenting annet. */
export class LiveSessionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly created = false) {
    super(message);
    this.name = 'LiveSessionError';
  }
}

export interface LiveSessionCreated {
  sessionId: string;
  sdp: string;
  /** Modellen OpenAI faktisk startet, når den returneres. Ruten bruker den som gate. */
  model: string | null;
}

export async function createLiveSession(session: unknown, sdp: string): Promise<LiveSessionCreated> {
  const response = await fetch('https://api.openai.com/v1/live/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, transport: { type: 'webrtc', sdp } }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
    const code = detail.error?.code || detail.error?.type || 'unknown';
    // En avvist forespørsel opprettet ingen sesjon – ingen opprydding å gjøre.
    throw new LiveSessionError(response.status, code, `GPT-Live-sesjon kunne ikke opprettes (HTTP ${response.status}, ${code}).`);
  }
  const body = await response.json().catch(() => null) as {
    session?: { id?: unknown; model?: unknown }; transport?: { sdp?: unknown };
  } | null;
  const sessionId = body?.session?.id;
  const answer = body?.transport?.sdp;
  if (typeof sessionId !== 'string' || typeof answer !== 'string') {
    // Sesjonen KAN være opprettet selv om svaret ikke kan leses. Ruten må sperre
    // videre oppstart til opprydding er bekreftet.
    throw new LiveSessionError(response.status, 'identity_missing', 'GPT-Live svarte uten sesjons-ID.', true);
  }
  return { sessionId, sdp: answer, model: typeof body?.session?.model === 'string' ? body.session.model : null };
}
