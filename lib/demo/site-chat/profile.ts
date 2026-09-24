import "server-only";

import type { NextRequest } from "next/server";
import type { LiveDatasetId } from "@/lib/live/demos";
import type { DemoMeterConfig } from "@/lib/demo/site-chat/usage";
import type { SourceRegistry } from "@/lib/demo/site-chat/sources";
import type { BoardCategoryMeta, ChatCategory } from "@/lib/demo/site-chat/categories";
import type { ReplyNoticeTexts } from "@/lib/demo/site-chat/notices";
import type { TranscriptScope } from "@/lib/demo/site-chat/transcript";

/**
 * Én kunde med Placy-chatboks (2026-09-24).
 *
 * Chatboksen er et gjenbrukbart produkt: Leangenbukta var første kunde,
 * Nyhavna den andre. Alle kunder bruker SAMME endepunktlogikk
 * (`route-handlers.ts`), samme Responses-løkke, samme svarvakter, samme
 * signerte samtaletoken, samme stemmerute og samme widget. Det som skiller
 * dem, står i kundens profil: datasettet, sideregisteret, kilderegisteret,
 * tilgangen, nøkkelen, kvotemålerne, stemmens kontaktperson og hilsen, og de
 * faste tekstene.
 *
 * Profilene står i et lukket register i koden (`customers.ts`), ikke i en
 * database: en kunde aktiveres først når datagrunnlaget er kontrollert og
 * deploy-konfigurasjonen er satt eksplisitt. Brukeren kan ikke påvirke hvilken
 * profil som gjelder, og alt profilen slår opp (side, lenke, kilde) er lukkede
 * registre. Sjekklisten for en ny kunde står i `docs/demos/site-chat.md`.
 */

/** Det chatten trenger å vite om én side i kopien. */
export interface SiteChatPage {
  id: string;
  title: string;
  kind: string;
  shortName?: string;
  /** Prosjekttemaet i boardet siden handler om (bare byggsider hos Leangenbukta). */
  boardTopicId?: string;
  chatStarters: readonly string[];
}

export interface SiteChatVisitor {
  /** Stabil per besøkende; kvoter og historikk bindes hit, aldri innhold. */
  visitorId: string;
}

export interface SiteChatAccess {
  visitor: SiteChatVisitor;
  /** Ny besøkscookie som skal settes på svaret (anonyme besøkende uten cookie). */
  setCookie?: string;
}

/** En lenke modellen kan velge: bare ID-er fra kundens lukkede alfabet blir til dette. */
export interface ResolvedLink {
  id: string;
  label: string;
  href: string;
}

/**
 * Hvor stemmen brukes fra: chatboksen, boardets kartstemme, eller kanalene som
 * bare kjenner sesjonstokenet (kart, kontekst, avslutning, overføring).
 */
export type VoiceSurface = "chat" | "board" | "channel";

export interface SiteChatVoiceProfile {
  /** Stedsnavnet stemmen presenterer seg for («… om Nyhavna og nabolaget rundt»). */
  placeName: string;
  /** Hvem stemmen henviser til for pris, ledighet og innflytting. */
  salesContact: string;
  /** Hilsenen er en instruksjon til stemmen, ikke en ferdig replikk (se `useLive`). */
  greeting: string;
  /** Hilsenen når tekstchattens historikk ligger i sesjonen. */
  continuedGreeting: string;
  meter: DemoMeterConfig;
  /**
   * Besøkende som kan bruke stemmen utenfor loopback, eller null. Kunden
   * bestemmer selv hvilke flater som er åpne (Nyhavna: bare chatboksen).
   */
  remoteVisitor: (request: NextRequest, surface: VoiceSurface) => SiteChatVisitor | null;
}

export interface SiteChatReplies {
  /** Fast svar når et faktasvar mangler verktøybevis. */
  knowledgeGap: string;
  /** Fast svar ved teknisk feil mot modellen. */
  backendError: string;
  /** Fast svar når svaret nevner årstall verktøyene ikke har. */
  unsupportedYear: (years: readonly string[]) => string;
  notices: ReplyNoticeTexts;
  /** Brukes når tilgangen mangler (401). */
  noAccess: string;
  unknownPage: string;
  notConnected: string;
  quota: Record<"visitor" | "global" | "store", string>;
}

export interface SiteChatProfile {
  /** Stabil kunde-ID. Bindes inn i hvert samtaletoken. */
  id: string;
  /** Kort prefiks til logglinjer: `lb_chat_turn`, `nh_chat_turn`. */
  logPrefix: string;
  dataset: LiveDatasetId;
  /** Miljøvariabler som styrer ruta; hver kopi har sine egne. */
  env: { allowedOrigins: string; model: string; timeoutMs: string };
  /**
   * Om chatten finnes i dette miljøet. `false` gir 404 uten detaljer — et
   * produksjonsbygg der noen har glemt konfigurasjonen skal ikke vise en chat.
   */
  enabled: () => boolean;
  /** Tekstchattens tilgang; kan utstede en ny anonym besøkende med cookie. */
  access: (request: NextRequest) => SiteChatAccess | null;
  /** Den kjente besøkende, uten å utstede noe. Eier historikken i tekst og tale. */
  visitor: (request: NextRequest) => SiteChatVisitor | null;
  /** Miljøvariabelen med kundens nøkkel for samtaletokenet (≥ 32 tegn). */
  transcriptSecretEnv: string;
  chatMeter: DemoMeterConfig;
  voice: SiteChatVoiceProfile;
  getPage: (id: string) => SiteChatPage | null;
  snapshotDate: string;
  instructions: (page: SiteChatPage, themes: readonly { id: string; label: string }[]) => string;
  opening: (page: SiteChatPage) => string;
  categories: (categories: readonly BoardCategoryMeta[], pageStarters: readonly string[]) => ChatCategory[];
  sourceRegistry: () => SourceRegistry;
  resolveLinks: (linkIds: readonly unknown[]) => ResolvedLink[];
  fallbackLinks: () => ResolvedLink[];
  replies: SiteChatReplies;
}

/** Kundens samtaletoken-omfang: kunde, datasett og kundens egen nøkkel. */
export function transcriptScope(profile: Pick<SiteChatProfile, "id" | "dataset" | "transcriptSecretEnv">): TranscriptScope {
  return { customerId: profile.id, dataset: profile.dataset, secretEnv: profile.transcriptSecretEnv };
}
