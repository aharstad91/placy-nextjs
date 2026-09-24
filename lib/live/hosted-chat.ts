import 'server-only';
import { NextRequest } from 'next/server';
import { hostedVoiceEnabled } from '@/lib/live/hosted-access';
import { siteChatCustomerForDataset, siteChatCustomers } from '@/lib/demo/site-chat/customers';
import type { SiteChatProfile } from '@/lib/demo/site-chat/profile';

/**
 * Chatboksens stemme på den delte stemmetjenesten (2026-09-24).
 *
 * Den delte stemmen (`/api/live/control` + `lib/live/hosted-control.ts`) har
 * fram til nå bare hatt boardflaten. Chatflaten slippes inn her, og bare når
 * ALT dette stemmer:
 *
 * - den delte stemmen er slått på i miljøet (`PLACY_HOSTED_VOICE=true`);
 * - datasettet tilhører en kunde i det lukkede chatboks-registeret, kunden har
 *   en binding i den delte stemmens register (`voice.hosted.project`) og
 *   chatten er slått på (`enabled()`);
 * - kundens egen tilgang godtar forespørselen (`voice.hosted.visitor`: samme
 *   origin, kundens cookie, og i produksjon kundens eget stemmeflagg).
 *
 * Besøks-ID-en er kundens egen (samme som tekstchatten), ikke den tilfeldige
 * ID-en den delte tilgangen lager per forespørsel: det er den som eier
 * samtaletokenet og kundens stemmekvote. Ingen tilbakefall til en annen kunde
 * eller til boardflaten.
 */

export interface HostedChatAdmission {
  customer: SiteChatProfile;
  visitorId: string;
}

export function hostedChatAdmission(request: NextRequest, dataset: string | null | undefined): HostedChatAdmission | null {
  if (!hostedVoiceEnabled()) return null;
  const customer = siteChatCustomerForDataset(dataset);
  if (!customer?.voice.hosted || !customer.enabled()) return null;
  const visitor = customer.voice.hosted.visitor(request);
  return visitor ? { customer, visitorId: visitor.visitorId } : null;
}

/** Besøkende per kunde for én kontrollforbindelse, lest én gang ved oppgraderingen. */
export interface HostedChatVisitors {
  visitorFor(customerId: string): string | null;
}

export const NO_HOSTED_CHAT: HostedChatVisitors = { visitorFor: () => null };

/**
 * Cookiene finnes bare i oppgraderingsforespørselen, ikke i meldingene på
 * forbindelsen. Derfor avgjøres chattilgangen her, én gang, for hver kunde.
 */
export function hostedChatVisitors(request: Request): HostedChatVisitors {
  const next = request instanceof NextRequest ? request : new NextRequest(request);
  const byCustomer = new Map<string, string>();
  for (const customer of siteChatCustomers()) {
    const admitted = hostedChatAdmission(next, customer.dataset);
    if (admitted) byCustomer.set(customer.id, admitted.visitorId);
  }
  return { visitorFor: (customerId) => byCustomer.get(customerId) ?? null };
}
