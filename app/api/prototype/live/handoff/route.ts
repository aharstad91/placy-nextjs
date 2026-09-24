import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { localRequest } from '@/lib/live/local-request';
import { demoVoiceVisitor } from '@/lib/live/demo-voice-access';
import { siteChatCustomer } from '@/lib/demo/site-chat/customers';
import { issueVoiceHandoff, voiceHandoffCustomer } from '@/lib/demo/site-chat/voice-handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tale → tekst i chatboksen (2026-09-24), for alle kunder i chatboks-registeret.
 *
 * Bytter sesjonstokenet fra en avsluttet (eller avsluttende) talesamtale mot et
 * nytt signert historikktoken for tekstchatten: tekstturene talen startet med,
 * pluss det serverens sideband faktisk hørte. Kontrakten og livstiden står i
 * `lib/demo/site-chat/voice-handoff.ts`.
 *
 * Samme gate som kontekstkanalen (loopback eller kundens egen tilgang), og
 * tokenet må i tillegg tilhøre akkurat denne besøkende. Alt annet er 404 uten
 * detaljer; klienten sier da ærlig at overføringen feilet.
 */
const bodySchema = z.object({ session: z.string().min(1).max(100) }).strict();

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!localRequest(request) && !demoVoiceVisitor(request)) return new NextResponse(null, { status: 404, headers });
  if (Number(request.headers.get('content-length')) > 1000) return new NextResponse(null, { status: 413, headers });
  const raw = await request.text();
  if (raw.length > 1000) return new NextResponse(null, { status: 413, headers });
  let parsed: z.infer<typeof bodySchema>;
  try { parsed = bodySchema.parse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Ugyldig forespørsel.' }, { status: 400, headers }); }
  // Opptaket vet hvilken kunde talen gjaldt. Bare den kundens besøkende, med
  // den kundens egen tilgang, kan få det nye tokenet.
  const customer = siteChatCustomer(voiceHandoffCustomer(parsed.session));
  if (!customer) return new NextResponse(null, { status: 404, headers });
  if (!localRequest(request) && !customer.voice.remoteVisitor(request, 'channel')) return new NextResponse(null, { status: 404, headers });
  const visitor = customer.visitor(request);
  if (!visitor) return new NextResponse(null, { status: 404, headers });
  const result = issueVoiceHandoff(parsed.session, visitor.visitorId);
  if (!result.ok) return new NextResponse(null, { status: 404, headers });
  return NextResponse.json({ transcript: result.transcript, voiceTurns: result.voiceTurns, trimmed: result.trimmed }, { headers });
}
