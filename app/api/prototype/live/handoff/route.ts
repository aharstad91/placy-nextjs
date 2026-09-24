import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { localRequest } from '@/lib/live/local-request';
import { chatSurfaceVisitorIds, demoVoiceVisitor } from '@/lib/live/demo-voice-access';
import { issueVoiceHandoff } from '@/lib/demo/leangenbukta-chat/voice-handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tale → tekst i nettsidekopienes chatboks (Leangenbukta og Nyhavna, 2026-09-24).
 *
 * Bytter sesjonstokenet fra en avsluttet (eller avsluttende) talesamtale mot et
 * nytt signert historikktoken for tekstchatten: tekstturene talen startet med,
 * pluss det serverens sideband faktisk hørte. Kontrakten og livstiden står i
 * `lib/demo/leangenbukta-chat/voice-handoff.ts`.
 *
 * Samme gate som kontekstkanalen (loopback eller en kopis besøkende), og
 * tokenet må i tillegg tilhøre akkurat denne besøkende. Alt annet er 404 uten
 * detaljer; klienten sier da ærlig at overføringen feilet.
 */
const bodySchema = z.object({ session: z.string().min(1).max(100) }).strict();

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!localRequest(request) && !demoVoiceVisitor(request)) return new NextResponse(null, { status: 404, headers });
  const visitorIds = chatSurfaceVisitorIds(request);
  if (!visitorIds.length) return new NextResponse(null, { status: 404, headers });
  if (Number(request.headers.get('content-length')) > 1000) return new NextResponse(null, { status: 413, headers });
  const raw = await request.text();
  if (raw.length > 1000) return new NextResponse(null, { status: 413, headers });
  let parsed: z.infer<typeof bodySchema>;
  try { parsed = bodySchema.parse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Ugyldig forespørsel.' }, { status: 400, headers }); }
  // Opptaket er bundet til én besøkende; en forespørsel med cookies fra begge
  // kopiene får bare det som tilhører en av dem.
  const result = visitorIds.map((id) => issueVoiceHandoff(parsed.session, id)).find((candidate) => candidate.ok) ?? { ok: false as const };
  if (!result.ok) return new NextResponse(null, { status: 404, headers });
  return NextResponse.json({ transcript: result.transcript, voiceTurns: result.voiceTurns, trimmed: result.trimmed }, { headers });
}
