import "server-only";

import { leangenbuktaChatProfile } from "@/lib/demo/leangenbukta-chat/profile";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";
import type { SiteChatProfile } from "@/lib/demo/site-chat/profile";

/**
 * Det lukkede registeret over kunder med chatboks (2026-09-24).
 *
 * Tekstruta, stemmeruta (`/api/prototype/live`), overføringen tale → tekst og
 * kanalene slår opp kunden HER, på datasett-ID eller kunde-ID, og bruker bare
 * profilens data. Ingen av dem har kundenavn i koden. En ny kunde er en ny
 * profil lagt til i lista — se sjekklisten i `docs/demos/site-chat.md`.
 *
 * Registeret er kode, ikke en database eller et admin-valg: en kunde aktiveres
 * først når datagrunnlaget er kontrollert og deploy-konfigurasjonen er satt.
 * En datasett-ID som ikke står her har ingen chatboks, og faller aldri tilbake
 * på en annen kunde.
 */
const CUSTOMERS: readonly SiteChatProfile[] = [leangenbuktaChatProfile, nyhavnaChatProfile];

function assertUnique(values: readonly string[], what: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Chatboks-registeret har dobbel ${what} «${value}».`);
    seen.add(value);
  }
}

// Kunde-ID bindes inn i samtaletokenet, datasettet velger kunden i stemmeruta,
// og målerne er kundens kvote: ingen av dem kan deles mellom to kunder.
assertUnique(CUSTOMERS.map((customer) => customer.id), "kunde-ID");
assertUnique(CUSTOMERS.map((customer) => customer.dataset), "datasett");
assertUnique(CUSTOMERS.flatMap((customer) => [customer.chatMeter.meter, customer.voice.meter.meter]), "måler");

export function siteChatCustomers(): readonly SiteChatProfile[] {
  return CUSTOMERS;
}

export function siteChatCustomer(id: string | null | undefined): SiteChatProfile | null {
  return CUSTOMERS.find((customer) => customer.id === id) ?? null;
}

export function siteChatCustomerForDataset(dataset: string | null | undefined): SiteChatProfile | null {
  return CUSTOMERS.find((customer) => customer.dataset === dataset) ?? null;
}
