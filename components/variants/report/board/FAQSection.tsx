"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  boardLinkResolvers,
  parseLinkedText,
  type LinkedTextNode,
} from "@/lib/board/poi-link-text";
import type { FaqEntry } from "@/lib/generators/faq-generator";

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
 * Default lukket, flere kan stå åpne samtidig, og begge tilstander står i DOM
 * og veksles med CSS — husets expand/collapse-oppskrift
 * (`trip-desktop-accordion-sidebar-20260209`). INGEN auto-scroll ved åpning:
 * høyde-animasjonen er signal nok, og et scroll-hopp river leseren vekk fra
 * spørsmålet hun nettopp trykket på.
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
        {title}
      </p>

      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const expanded = open.has(entry.id);
          const panelId = `${idPrefix}-${entry.id}`;
          return (
            <div
              key={entry.id}
              className="overflow-hidden rounded-xl border border-black/5 bg-white/60 transition-colors duration-150 hover:border-stone-400"
            >
              <button
                type="button"
                data-testid="faq-question"
                data-faq-id={entry.id}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(entry.id)}
                className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-stone-800">
                  {entry.question}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={`mt-0.5 shrink-0 text-stone-400 transition-transform duration-300 ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Begge tilstander i DOM, vekslet med CSS. Ingen auto-scroll. */}
              <div
                id={panelId}
                data-testid="faq-answer"
                data-expanded={expanded}
                aria-hidden={!expanded}
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  expanded ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-3 pb-3 text-[13.5px] leading-relaxed text-stone-600">
                  <AnswerText
                    answer={entry.answer}
                    resolvers={resolvers}
                    onOpenPoi={onOpenPoi}
                    onSelectCategory={onSelectCategory}
                  />
                </p>
              </div>
            </div>
          );
        })}
      </div>
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
            data-testid={node.kind === "poi" ? "faq-poi-link" : "faq-category-link"}
            data-target={node.kind === "poi" ? node.poiId : node.categoryId}
            onClick={onClick}
            // Negativ margin motvirker paddingen så treffflaten vokser uten at
            // linjehøyden i avsnittet endrer seg.
            className="-my-1 cursor-pointer rounded px-0.5 py-1 font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 transition-colors duration-150 hover:decoration-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            {node.text}
          </button>
        );
      })}
    </>
  );
}
