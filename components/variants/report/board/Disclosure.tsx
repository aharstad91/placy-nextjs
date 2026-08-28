"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Utfoldingslista — ÉN form for hver klikkbar rad i rapport-sidebaren
 * (2026-08-28).
 *
 * ## Hvorfor den finnes
 *
 * Sidebaren hadde to former for samme interaksjon. Svarene lå som løse kort med
 * 6 px gap mellom seg og en kant på `rgba(0,0,0,0.05)`; stedene lå som nakne
 * rader uten kant i det hele tatt. Samme handling — trykk, chevron, utfolding
 * på stedet — i to uttrykk, og begge så svake at ingen av dem leste som
 * klikkbare (Andreas, 2026-08-28: «verdt å merke seg har jo også accordions som
 * ikke har den samme looken som FAQ, som er akkurat det samme elementet ... vi
 * må være konsekvent her»).
 *
 * ## Hvorfor én liste og ikke n kort
 *
 * Gapet var det som gjorde fem svar til fem ting. Med én ramme rundt hele settet
 * og hårstreker mellom radene blir det ett sted med fem rader — og da trenger
 * hver rad bare en strek, ikke sin egen kant. Det var også Andreas' egen
 * formulering: «de bør være samlet som en liste ... sånn at ikke det blir det
 * her gapet mellom, men at de føles ut som ... de får en slags tilhørighet da».
 *
 * ## Hva som deles, og hva som ikke gjør det
 *
 * Radens INNMAT eies fortsatt av kallstedet: et svar er et spørsmål med en
 * chevron, en stedsrad har markørkolonne, navn og minutter. Det som deles er
 * alt som ellers ville driftet — rammen ({@link DisclosureList}), radens
 * geometri og typografi ({@link DISCLOSURE_ROW} / {@link DISCLOSURE_LABEL}),
 * chevronen ({@link DisclosureChevron}) og utfoldingen
 * ({@link DisclosurePanel}).
 *
 * Loddrett justering ligger BEVISST utenfor {@link DISCLOSURE_ROW}: et svar kan
 * bre seg over to linjer og skal toppstilles, en stedsrad er én linje og skal
 * midtstilles. Tailwind løser klassekonflikter på CSS-rekkefølge og ikke på
 * rekkefølgen i strengen, så en default her hadde ikke vært trygg å overstyre.
 */

/**
 * Rammen rundt settet. `as="ul"` når radene er `<li>` (stedslistene), `div`
 * ellers.
 *
 * Kanten er `stone-300` og ikke `black/5`: den forrige var 5 % svart på hvitt og
 * forsvant i flaten. Hårstrekene inni er et hakk lysere enn rammen, så settet
 * leser som én boks med inndeling og ikke som en stabel bokser.
 */
export function DisclosureList({
  as: Tag = "div",
  className,
  testId,
  children,
}: {
  as?: "ul" | "div";
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      data-testid={testId}
      className={cn(
        "overflow-hidden rounded-2xl border border-stone-300/80 bg-white",
        "divide-y divide-stone-200",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Radens geometri. Kallstedet legger til loddrett justering (`items-center` for
 * én linje, `items-start` for tekst som kan brytes) og {@link DISCLOSURE_ROW_HOVER}.
 */
export const DISCLOSURE_ROW =
  "flex w-full cursor-pointer gap-3 px-3.5 py-3 text-left transition-colors duration-150";

/** Radens hviletilstand: bunnen svarer på pekeren, men ligger flatt. */
export const DISCLOSURE_ROW_HOVER = "hover:bg-stone-900/[0.03]";

/**
 * Åpen rad. Ligger på HELE raden — knappen og utfoldingen under den — og ikke
 * bare på knappen: en tone som stoppet ved knappens underkant delte den åpne
 * raden i to, en grå stripe med en hvit tekstblokk under. Med tonen rundt begge
 * leser den som ett utfoldet felt.
 */
export const DISCLOSURE_ITEM_OPEN = "bg-stone-900/[0.03]";

/**
 * Radens tekst. Bryter som default (et spørsmål på to linjer skal ikke kuttes);
 * stedslistene legger til `truncate`, fordi et navn som bryter der ville
 * rykket minutt-kolonnen ut av linje nedover lista.
 */
export const DISCLOSURE_LABEL =
  "min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-stone-900";

/**
 * Bredden chevronen tar. Eksportert fordi to ting må regne på den: rader som
 * IKKE kan utfoldes må holde plassen av (ellers står «17 min» lenger til høyre
 * enn «4 min» rett over), og reisemåte-velgeren står rett over minutt-kolonnen
 * og må måle seg inn forbi den.
 */
export const DISCLOSURE_CHEVRON_SIZE = 18;

/** Chevronen. Snur ved åpning; 300 ms er kortere enn panelet, med vilje — den
 *  skal bekrefte trykket, ikke følge utfoldingen. */
export function DisclosureChevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <ChevronDown
      size={DISCLOSURE_CHEVRON_SIZE}
      strokeWidth={2}
      aria-hidden
      className={cn(
        "shrink-0 text-stone-500 transition-transform duration-300",
        open && "rotate-180",
        className,
      )}
    />
  );
}

/**
 * Utfoldingen. Begge tilstander står i DOM og veksles med CSS — husets
 * expand/collapse-oppskrift (`trip-desktop-accordion-sidebar-20260209`) — og det
 * er INGEN auto-scroll ved åpning: høyde-animasjonen er signal nok, og et
 * scroll-hopp river leseren vekk fra raden hun nettopp trykket på.
 *
 * Taket på 1200 px er en øvre grense og ikke en høyde: innholdet er kortere, og
 * det er innholdet som setter den faktiske høyden.
 */
export function DisclosurePanel({
  id,
  open,
  testId,
  children,
}: {
  id?: string;
  open: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      data-testid={testId}
      data-expanded={open}
      aria-hidden={!open}
      className={cn(
        // `[transition-duration:...]` og ikke `duration-[...]`: den siste er
        // tvetydig i Tailwind (transition vs. animasjon) og genereres ikke.
        "overflow-hidden transition-all [transition-duration:420ms]",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        open ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0",
      )}
    >
      {children}
    </div>
  );
}
