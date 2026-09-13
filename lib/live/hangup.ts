import 'server-only';

/**
 * Nødstopp for en Live-sesjon. Den normale veien er `session.close` på sideband
 * (som gir sluttårsak og forbruk); dette er oppryddingen etter en omstart eller
 * en sideband som aldri kom opp. 404 betyr at sesjonen alt er borte – da er
 * jobben gjort, ikke feilet.
 */
export const LIVE_SESSION_ID = /^live_[A-Za-z0-9_-]+$/;

export async function liveHangup(sessionId: string) {
  if (!LIVE_SESSION_ID.test(sessionId)) throw new Error('Invalid live session identity');
  const response = await fetch(`https://api.openai.com/v1/live/sessions/${sessionId}/hangup`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok && response.status !== 404) throw new Error('Samtalen kunne ikke avsluttes. Prøv igjen.');
}
