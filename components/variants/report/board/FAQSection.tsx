"use client";

import { useId, useState } from "react";
import {
  boardLinkResolvers,
  parseLinkedText,
  type LinkedTextNode,
} from "@/lib/board/poi-link-text";
import type { FaqEntry } from "@/lib/generators/faq-generator";
import { cn } from "@/lib/utils";
import {
  DISCLOSURE_ITEM_OPEN,
  DISCLOSURE_LABEL,
  DISCLOSURE_ROW,
  DISCLOSURE_ROW_HOVER,
  DisclosureChevron,
  DisclosureList,
  DisclosurePanel,
} from "./Disclosure";
import { SIDEBAR_SECTION_TITLE } from "./sidebar-style";

/**
 * «Spørsmål og svar» — det en megler ville svart på visning, for akkurat denne
 * adressen.
 *
 * ## Hvorfor denne seksjonen finnes
 *
 * Nivå 2-boardets verdi er at megleren forteller. Nivå 1 hadde kart og en kort
 * kategoritekst, og kunne ikke svare på spørsmålene som faktisk stilles: hvilken
 * skolekrets sogner boligen til, hvor er nærmeste holdeplass, hvor mange
 * barnehager ligger i gangavstand. Malverket har hatt de spørsmålene hele tiden
 * (`lib/editorial/category-specs.ts`, `lag: "board"`) — de manglet en flate. Det
 * er denne.
 *
 * ## Disclosure, ikke utfoldet liste
 *
 * Default lukket, og flere kan stå åpne samtidig. Selve formen — rammen rundt
 * settet, hårstreken mellom radene, chevronen og utfoldingen — er delt med
 * stedslistene i omvisningen (`Disclosure.tsx`), fordi de to satt med to ulike
 * uttrykk for nøyaktig samme handling. Se doccen der.
 *
 * ## Klikkbare steder i løpende tekst
 *
 * Svarene bærer `[tekst](poi:id)` og `[tekst](category:id)`. Lenkene er
 * `<button>` og ikke `<a>` — de navigerer ikke, de flytter kartet — og de er
 * derfor tastaturnåbare i naturlig lesrekkefølge uten videre. Treffflaten er
 * utvidet med padding som ikke skyver linjehøyden (negativ margin), fordi en
 * inline-lenke midt i en setning er et mye mindre mål enn en frittstående rad.
 *
 * Flate-agnostisk: desktop-sidebaren og mobilens kategoriside rendrer den
 * samme komponenten med de samme dataene. Bare affordansene rundt divergerer.
 */
export function FAQSection({
  entries,
  poisById,
  categoryIds,
  onOpenPoi,
  onSelectCategory,
  title = "Spørsmål og svar",
  className,
}: {
  entries: readonly FaqEntry[];
  /** Boardets POI-oppslag (lowercased nøkler) — avgjør hva som blir klikkbart. */
  poisById: ReadonlyMap<string, { id: string }>;
  /** Kategoriene som finnes på boardet — samme rolle for kategorilenker. */
  categoryIds: readonly string[];
  /** Klikk på et sted i et svar → åpne POI-et (kameraet flyr til punktet). */
  onOpenPoi?: (poiId: string) => void;
  /** Klikk på en kategorilenke i den globale FAQ-en → velg kategorien. */
  onSelectCategory?: (categoryId: string) => void;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const idPrefix = useId();

  // Ingen svar → ingen seksjon. En tom overskrift ville lovet innhold som
  // ikke finnes, og på en ukuratert adresse er tomhet den normale tilstanden
  // for flere kategorier.
  if (entries.length === 0) return null;

  const resolvers = boardLinkResolvers(poisById, categoryIds);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <section data-testid="faq-section" className={className ?? "mt-5"}>
      {/* Utelatt tittel = ingen overskrift. Omvisningens svar-fane har
          faneetiketten som overskrift, og en tom overskrift ville lagt igjen
          luft som lovet en tekst som ikke kommer. */}
      {title && <p className={cn("mb-2.5", SIDEBAR_SECTION_TITLE)}>{title}</p>}

      <DisclosureList>
        {entries.map((entry) => {
          const expanded = open.has(entry.id);
          const panelId = `${idPrefix}-${entry.id}`;
          return (
            <div
              key={entry.id}
              className={cn(expanded && DISCLOSURE_ITEM_OPEN)}
            >
              <button
                type="button"
                data-testid="faq-question"
                data-faq-id={entry.id}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(entry.id)}
                /* Toppstilt: et spørsmål kan bre seg over to linjer, og da skal
                   chevronen stå ved den første — ikke midt i blokken. */
                className={cn(
                  DISCLOSURE_ROW,
                  "items-start",
                  DISCLOSURE_ROW_HOVER,
                )}
              >
                <span className={DISCLOSURE_LABEL}>{entry.question}</span>
                <DisclosureChevron open={expanded} className="mt-[3px]" />
              </button>

              <DisclosurePanel id={panelId} open={expanded} testId="faq-answer">
                <p className="px-3.5 pb-3.5 text-[15px] leading-[1.6] text-stone-600">
                  <AnswerText
                    answer={entry.answer}
                    resolvers={resolvers}
                    onOpenPoi={onOpenPoi}
                    onSelectCategory={onSelectCategory}
                  />
                </p>
              </DisclosurePanel>
            </div>
          );
        })}
      </DisclosureList>
    </section>
  );
}

/** Svarteksten med stedene gjort klikkbare. Ukjente referanser blir ren tekst. */
function AnswerText({
  answer,
  resolvers,
  onOpenPoi,
  onSelectCategory,
}: {
  answer: string;
  resolvers: Parameters<typeof parseLinkedText>[1];
  onOpenPoi?: (poiId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
}) {
  const nodes: LinkedTextNode[] = parseLinkedText(answer, resolvers);
  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === "text") return <span key={i}>{node.text}</span>;
        const onClick =
          node.kind === "poi"
            ? () => onOpenPoi?.(node.poiId)
            : () => onSelectCategory?.(node.categoryId);
        return (
          <button
            key={i}
            type="button"
            data-testid={
              node.kind === "poi" ? "faq-poi-link" : "faq-category-link"
            }
            data-target={node.kind === "poi" ? node.poiId : node.categoryId}
            onClick={onClick}
            // Treffflaten vokser VERTIKALT (fingerhøyden er det knappe målet),
            // og den negative margin-en holder linjehøyden i avsnittet urørt.
            // Horisontal padding er bevisst utelatt: den dyttet kommaet etter
            // lenken vekk fra ordet, så «Ranheim skole, med» ble til
            // «Ranheim skole , med».
            className="-my-1 cursor-pointer rounded py-1 font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 transition-colors duration-150 hover:decoration-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            {node.text}
          </button>
        );
      })}
    </>
  );
}
