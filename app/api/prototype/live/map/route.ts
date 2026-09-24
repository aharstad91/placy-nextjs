import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMapBridge, peekMapBridge } from '@/lib/live/map-bridge';
import { getLiveSupervisor } from '@/lib/live/supervisor';
import { localRequest } from '@/lib/live/local-request';
import { demoVoiceVisitor } from '@/lib/live/demo-voice-access';
import type { LiveServerMessage } from '@/lib/live/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 15000;

/**
 * Kartkanalen: serveren sender direktiver ned (SSE), nettleseren svarer med
 * kartstatus opp (POST). Bare tokenet til den aktive samtalen slipper inn —
 * enten fra loopback, eller fra en kundes egen tilgang i chatboks-registeret
 * (lib/live/demo-voice-access.ts), samme gate som hovedruta bruker for å
 * reservere sesjonen.
 */
export async function GET(request: NextRequest) {
  if (!localRequest(request) && !demoVoiceVisitor(request)) return new NextResponse(null, { status: 404 });
  const token = request.nextUrl.searchParams.get('session');
  if (!token || token.length > 100 || !getLiveSupervisor().isActive(token)) return new NextResponse(null, { status: 404 });
  const bridge = getMapBridge(token);
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (message: LiveServerMessage) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`)); } catch { /* strømmen er lukket */ }
      };
      write({ type: 'hello' });
      unsubscribe = bridge.subscribe(message => {
        write(message);
        if (message.type === 'ended') { try { controller.close(); } catch { /* alt lukket */ } }
      });
      // Kommentarlinjer holder forbindelsen åpen gjennom proxier som kutter stille strømmer.
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* strømmen er lukket */ }
      }, HEARTBEAT_MS);
      heartbeat.unref?.();
      request.signal.addEventListener('abort', () => { try { controller.close(); } catch { /* alt lukket */ } });
    },
    cancel() { unsubscribe(); clearInterval(heartbeat); },
  });
  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive' },
  });
}

const resultSchema = z.object({ id: z.string().max(120), output: z.unknown() });

export async function POST(request: NextRequest) {
  if (!localRequest(request) && !demoVoiceVisitor(request)) return new NextResponse(null, { status: 404 });
  const token = request.headers.get('x-placy-session') || request.nextUrl.searchParams.get('session');
  if (!token || token.length > 100 || !getLiveSupervisor().isActive(token)) return new NextResponse(null, { status: 404 });
  if (Number(request.headers.get('content-length')) > 20000) return new NextResponse(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 20000) return new NextResponse(null, { status: 413 });
  let parsed: z.infer<typeof resultSchema>;
  try { parsed = resultSchema.parse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Ugyldig kartsvar.' }, { status: 400 }); }
  const bridge = peekMapBridge(token);
  // false = direktivet er alt avgjort (timeout eller dobbelt svar). Ikke en feil.
  return NextResponse.json({ accepted: Boolean(bridge?.resolve(parsed.id, parsed.output)) });
}
