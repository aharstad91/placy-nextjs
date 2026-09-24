import 'server-only';
import type { NextRequest } from 'next/server';
import { lbDemoAccess } from '@/lib/demo/leangenbukta-site/access';
import { nhChatVisitor, nhChatVoiceEnabled } from '@/lib/demo/nyhavna-chat/access';
import type { DemoMeter } from '@/lib/demo/leangenbukta-site/usage';
import { LB_VOICE_DATASET, leangenbuktaVoiceVisitor } from '@/lib/live/leangenbukta-voice-access';

/**
 * Hvem som kan bruke den lokale Live-ruta utenfor loopback (2026-09-24).
 *
 * To nettsidekopier har stemme i chatboksen: Leangenbukta (demotilgangen,
 * `leangenbukta-voice-access.ts`, uendret) og Nyhavna (den anonyme
 * chatbesøkende, `lib/demo/nyhavna-chat/access.ts`). Nyhavna-besøkende får BARE
 * chatflaten for `nyhavna-lokal` — aldri boardets kartstemme, snapshotet eller
 * en annen demo — og bare når `PLACY_NH_CHAT_VOICE=true` er satt i et
 * produksjonsbygg. En cookie fra den ene kopien gir ingenting hos den andre.
 */

export const NH_VOICE_DATASET = 'nyhavna-lokal';
const CHAT_SURFACE = 'chat';

export interface DemoVoiceVisitor {
  visitorId: string;
  /** Døgnkvoten en ny stemmesesjon trekkes fra. */
  meter: DemoMeter;
}

function nyhavnaVoiceVisitor(request: NextRequest, dataset: string | null | undefined, surface: string | null | undefined): DemoVoiceVisitor | null {
  // Kjenner kallstedet datasettet, må det være Nyhavnas chatflate.
  if (dataset !== undefined && (dataset !== NH_VOICE_DATASET || surface !== CHAT_SURFACE)) return null;
  if (process.env.NODE_ENV === 'production' && !nhChatVoiceEnabled()) return null;
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return null;
  const visitor = nhChatVisitor(request);
  return visitor ? { visitorId: visitor.visitorId, meter: 'nh_voice_session' } : null;
}

/**
 * Besøkende som kan bruke talen utenfor loopback, med måleren sesjonen
 * trekkes fra. `dataset` utelatt = kanalene som bare kjenner sesjonstokenet
 * (kart, kontekst, avslutning, overføring); de binder seg i tillegg til et
 * aktivt token som hovedruta allerede har knyttet til riktig datasett.
 */
export function demoVoiceVisitor(
  request: NextRequest,
  input: { dataset?: string | null; surface?: string | null } = {},
): DemoVoiceVisitor | null {
  const lb = leangenbuktaVoiceVisitor(request, input.dataset === undefined ? LB_VOICE_DATASET : input.dataset);
  if (lb) return { visitorId: lb.visitorId, meter: 'voice_session' };
  return nyhavnaVoiceVisitor(request, input.dataset, input.surface);
}

/**
 * Hvem historikken i chatflaten tilhører: samme besøkende som tekstchatten for
 * datasettet, aldri noe klienten påstår. Uavhengig av om talen er slått på
 * utenfor loopback — det avgjør `demoVoiceVisitor`.
 */
export function chatSurfaceVisitor(request: NextRequest, dataset: string | null | undefined): { visitorId: string } | null {
  if (dataset === LB_VOICE_DATASET) return lbDemoAccess(request);
  if (dataset === NH_VOICE_DATASET) return nhChatVisitor(request);
  return null;
}

/** Alle besøks-ID-er forespørselen kan eie en taleoverføring under. */
export function chatSurfaceVisitorIds(request: NextRequest): string[] {
  const ids = [lbDemoAccess(request)?.visitorId, nhChatVisitor(request)?.visitorId].filter((id): id is string => !!id);
  return [...new Set(ids)];
}
