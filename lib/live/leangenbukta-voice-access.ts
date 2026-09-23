import 'server-only';
import type { NextRequest } from 'next/server';
import { lbDemoAccess, type LbDemoVisitor } from '@/lib/demo/leangenbukta-site/access';

/**
 * Leangenbukta-kundedemoen kan dele stemmen utenfor localhost (2026-09-23).
 *
 * Samme tilgang som nettsidekopien og boardet (lib/demo/leangenbukta-site/
 * access.ts), men BARE for datasettet `leangenbukta-lokal` og bare fra samme
 * origin. Nyhavna og snapshotet beholder loopback-gaten uendret: en
 * Leangenbukta-cookie gir ingen annen demo.
 *
 * Delt mellom hovedruta (som kjenner det forespurte datasettet) og
 * kart-/kontekstkanalene (som bare kjenner sesjonstokenet). Kanalene kaller
 * uten `dataset`-argument og stoler på at et aktivt tokens
 * `supervisor.isActive(token)`-sjekk allerede har bundet sesjonen til riktig
 * datasett ved reservasjon i hovedruta — én global sesjon om gangen, så et
 * aktivt token kan aldri tilhøre en annen demo enn den som ble startet.
 */
export const LB_VOICE_DATASET = 'leangenbukta-lokal';

export function leangenbuktaVoiceVisitor(
  request: NextRequest,
  dataset: string | null | undefined = LB_VOICE_DATASET,
): LbDemoVisitor | null {
  if (dataset !== LB_VOICE_DATASET) return null;
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return null;
  return lbDemoAccess(request);
}
