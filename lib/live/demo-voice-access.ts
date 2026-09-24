import 'server-only';
import type { NextRequest } from 'next/server';
import type { DemoMeterConfig } from '@/lib/demo/site-chat/usage';
import type { SiteChatProfile } from '@/lib/demo/site-chat/profile';
import { siteChatCustomerForDataset, siteChatCustomers } from '@/lib/demo/site-chat/customers';

/**
 * Hvem som kan bruke den lokale Live-ruta utenfor loopback (2026-09-24).
 *
 * Kundene med chatboks står i det lukkede registeret
 * (`lib/demo/site-chat/customers.ts`); hver kunde bestemmer selv, i profilens
 * `voice.remoteVisitor`, hvilke flater den åpner og for hvem. Denne fila har
 * ingen kundenavn: en cookie fra én kunde gir ingenting hos en annen, fordi
 * kunden velges av datasettet og bare den kundens tilgang spørres.
 */

export interface DemoVoiceVisitor {
  visitorId: string;
  /** Døgnkvoten en ny stemmesesjon trekkes fra. */
  meter: DemoMeterConfig;
  customer: SiteChatProfile;
}

/**
 * Besøkende som kan bruke talen utenfor loopback. `dataset` utelatt = kanalene
 * som bare kjenner sesjonstokenet (kart, kontekst, avslutning, overføring); de
 * binder seg i tillegg til et aktivt token som hovedruta allerede har knyttet
 * til riktig datasett.
 */
export function demoVoiceVisitor(
  request: NextRequest,
  input: { dataset?: string | null; surface?: string | null } = {},
): DemoVoiceVisitor | null {
  if (input.dataset === undefined) {
    for (const customer of siteChatCustomers()) {
      const visitor = customer.voice.remoteVisitor(request, 'channel');
      if (visitor) return { visitorId: visitor.visitorId, meter: customer.voice.meter, customer };
    }
    return null;
  }
  const customer = siteChatCustomerForDataset(input.dataset);
  if (!customer) return null;
  const visitor = customer.voice.remoteVisitor(request, input.surface === 'chat' ? 'chat' : 'board');
  return visitor ? { visitorId: visitor.visitorId, meter: customer.voice.meter, customer } : null;
}
