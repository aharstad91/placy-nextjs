import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLiveSideband } from '@/lib/live/sideband';
import { getLiveSupervisor } from '@/lib/live/supervisor';
import { localRequest } from '@/lib/live/local-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hva brukeren gjør i flaten: tema- og stedstrykk, karttilstand, og en
 * dev-hook for simulert tekst. Serveren oversetter det til kontekst stemmen og
 * backenden kan bruke – nettleseren snakker aldri til modellen selv.
 */
const contextSchema = z.union([
  z.object({ kind: z.literal('theme'), id: z.string().max(120), label: z.string().max(120).optional() }),
  z.object({ kind: z.literal('place'), id: z.string().max(120), name: z.string().max(160).optional() }),
  z.object({
    kind: z.literal('state'),
    selected_category_id: z.string().max(120).nullable(),
    selected_place_id: z.string().max(120).nullable(),
    travel_mode: z.string().max(20),
  }),
  z.object({ kind: z.literal('text'), text: z.string().max(2000) }),
]);

export async function POST(request: NextRequest) {
  if (!localRequest(request)) return new NextResponse(null, { status: 404 });
  const token = request.headers.get('x-placy-session');
  if (!token || token.length > 100 || !getLiveSupervisor().isActive(token)) return new NextResponse(null, { status: 404 });
  if (Number(request.headers.get('content-length')) > 20000) return new NextResponse(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 20000) return new NextResponse(null, { status: 413 });
  let message: z.infer<typeof contextSchema>;
  try { message = contextSchema.parse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Ugyldig kontekst.' }, { status: 400 }); }
  const sideband = getLiveSideband(token);
  if (!sideband) return NextResponse.json({ error: 'Samtalen er ikke aktiv.' }, { status: 409 });
  sideband.onContext(message);
  return NextResponse.json({ ok: true });
}
