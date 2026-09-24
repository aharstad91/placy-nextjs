import "server-only";

import type { NextRequest } from "next/server";
import type { LiveDatasetId } from "@/lib/live/demos";
import type { DemoQuotaDecision } from "@/lib/demo/leangenbukta-site/usage";
import type { SourceRegistry } from "@/lib/demo/leangenbukta-chat/sources";
import type { ResolvedLink } from "@/lib/demo/leangenbukta-chat/links";
import type { BoardCategoryMeta, ChatCategory } from "@/lib/demo/leangenbukta-chat/categories";
import type { ReplyNoticeTexts } from "@/lib/demo/leangenbukta-chat/instructions";

/**
 * Én nettsidekopi med Placy-chat (2026-09-24).
 *
 * Leangenbukta var den første kopien med chat; Nyhavna er den andre. Begge
 * bruker SAMME endepunktlogikk (`route-handlers.ts`), samme Responses-løkke,
 * samme svarvakter, samme signerte samtaletoken og samme widget. Det som
 * skiller dem, står her: datasettet, sideregisteret, kilderegisteret,
 * tilgangen, kvotemåleren og de faste tekstene.
 *
 * En profil er ikke konfigurasjon brukeren kan påvirke: ruta velger profilen
 * i koden, og alt profilen slår opp (side, lenke, kilde) er lukkede registre.
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
  access: (request: NextRequest) => SiteChatAccess | null;
  consumeChatQuota: (visitorId: string) => Promise<DemoQuotaDecision>;
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
