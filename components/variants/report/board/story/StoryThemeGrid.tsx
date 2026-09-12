"use client";

import { getIcon } from "@/lib/utils/map-icons";
import { cn } from "@/lib/utils";
import { SIDEBAR_SECTION_TITLE } from "../sidebar-style";
import { DISCLOSURE_ROW_HOVER } from "../Disclosure";
import { useStoryTour } from "./story-tour";

/**
 * Temaene som et rutenett på områdestoppet — inngangen til omvisningen.
 *
 * Raden i toppen (`StoryRail`) er transporten: den sier hvor du ER i
 * rekkefølgen, og forutsetter at du alt er inne i den. På områdestoppet er du
 * ikke det. Der sto seks små brikker i en rad ingen hadde introdusert, og
 * setningen «Velg et tema» pekte på noe som ikke så ut som et valg (Andreas,
 * 2026-09-05: «da er det ikke så gitt at de kan velge blant kategorier»).
 *
 * Rutenettet er det samme valget i en form som LESER som et valg: to kolonner,
 * store flater, ikon, navn og dekningen i tall. Det ligger over strøkets
 * spørsmål og svar, fordi det er veien videre og svarene er bakgrunnen. Raden
 * skjules så lenge området er aktivt (se `StoryRail`/`StoryCard`), og kommer
 * inn som transport først når et tema er valgt — da har den noe å transportere.
 *
 * Samme form på mobil og desktop: to kolonner er nok til å fylle en sheet og
 * en sidekolonne uten å bli enten en liste eller en frimerkevegg.
 *
 * ## Kortet er én horisontal linje (2026-09-06)
 *
 * Ikonet sto først OVER teksten, fordi kategorinavnene var lange nok til å
 * bryte ved siden av en sirkel («Transport & Mobilitet» i en halv kolonnebredde
 * er to linjer). Da navnene ble kortet ned til ett ord hver, forsvant den
 * grunnen: ikon og de to tekstlinjene får plass på samme linje, og kortet blir
 * en tredjedel lavere. Det er hele rutenettet som vinner på det — seks kort
 * over strøkets spørsmål og svar skal ikke skyve svarene ut av skjermen.
 *
 * Navnet står på ÉN linje og klippes heller enn å brytes: et kort som er én
 * linje høyere enn nabokortet gjør raden skjev, og et rutenett med ujevne rader
 * slutter å lese som et sett med likeverdige valg.
 *
 * ## Hover er en TONE, ikke et løft (2026-09-07)
 *
 * Kortene løftet seg først på hover — sterkere kantlinje, større slippskygge og
 * en liten skalering ved trykk. Det var en annen hover-tilstand enn spørsmålene
 * rett under, som bare toner bunnen (`DISCLOSURE_ROW_HOVER`). To ulike svar på
 * samme gest, i samme kolonne, leser som to ulike slags element — og de er det
 * ikke: både et temakort og et spørsmål er en rad du trykker for å komme videre.
 *
 * Kortet beholder sin egen kantlinje og hvilende skygge i ro. Det er bare
 * SVARET på pekeren som er delt med spørsmålene.
 *
 * ## Temaer med en kilde står i egen gruppe (2026-09-11)
 *
 * Et board kan bære temaer som ikke er våre: en utbyggers egne områdesider, en
 * kommunes plandokument. De kjennes på `editorial.source`, og de får sin egen
 * overskrift med kildens navn over rutenettet sitt — resten samles under
 * «Nabolaget rundt».
 *
 * Uten delingen ser kundens innhold ut som enda et par av boardets egne temaer,
 * og da er hele poenget borte: leseren skal kjenne igjen teksten hun selv har
 * skrevet. To temaer kan dessuten hete det samme (kundens «Servering» og
 * boardets), og gruppa er det eneste som skiller dem fra hverandre.
 *
 * Boards uten kilde faller til nøyaktig den gamle formen — én «Temaer»-
 * overskrift, ett rutenett.
 */
export function StoryThemeGrid({ className = "" }: { className?: string }) {
  const { stops, goto } = useStoryTour();
  if (stops.length === 0) return null;

  // Temaer som bærer noen ANDRES tekst og utvalg står for seg, med kilden som
  // overskrift.
  //
  // Grunnen er gjenkjennelse. Legges kundens egne temaer inn i den samme lista
  // som boardets sju, ser de ut som sju til — og da er hele poenget borte:
  // leseren skal se at dette er innholdet HUN har skrevet, plassert i kartet.
  // Overskriften gjør avsenderen synlig før hun trykker, ikke etter.
  //
  // Kollisjonen er også et navneproblem: et kundetema kan hete det samme som et
  // av boardets («Servering»), og to like brikker i samme rutenett uten noe som
  // skiller dem er en felle. Gruppa ER det som skiller dem.
  const sourced = stops
    .map((c, n) => ({ c, n }))
    .filter(({ c }) => c.editorial?.source !== undefined);
  const own = stops
    .map((c, n) => ({ c, n }))
    .filter(({ c }) => c.editorial?.source === undefined);

  // Kildeetiketten hentes fra det første temaet som har en. Flere kilder i samme
  // board er ikke et tilfelle vi har — ville det oppstått, skal gruppa deles per
  // kilde, ikke få en samlet overskrift som skjuler at de er to.
  const sourceLabel = sourced[0]?.c.editorial?.source?.label;

  const renderGrid = (items: { c: (typeof stops)[number]; n: number }[]) => (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {items.map(({ c, n }) => {
          const Icon = getIcon(c.icon);
          return (
            <button
              key={c.id}
              type="button"
              data-story-theme={c.id}
              onClick={() => goto(n)}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl bg-white p-3 text-left",
                "shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_1px_3px_rgba(28,25,23,0.06)]",
                "transition-colors duration-150",
                DISCLOSURE_ROW_HOVER,
              )}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: c.color }}
              >
                <Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-[1.3] tracking-[-0.01em] text-stone-900">
                  {c.label}
                </span>
                <span className="block text-[12px] font-medium leading-[1.3] tabular-nums text-stone-500">
                  {c.pois.length} {c.pois.length === 1 ? "sted" : "steder"}
                </span>
              </span>
            </button>
          );
        })}
    </div>
  );

  // Ingen kilde i boardet → nøyaktig samme flate som før: én overskrift, ett
  // rutenett. Alle eksisterende boards faller hit.
  if (sourced.length === 0) {
    return (
      <div data-testid="story-theme-grid" className={className}>
        <h4 className={SIDEBAR_SECTION_TITLE}>Temaer</h4>
        {renderGrid(own)}
      </div>
    );
  }

  return (
    <div data-testid="story-theme-grid" className={className}>
      <section data-testid="story-theme-group-sourced">
        <h4 className={SIDEBAR_SECTION_TITLE}>
          {sourceLabel ? `Fra ${sourceLabel}` : "Fra kilden"}
        </h4>
        <p className="mt-1 text-[13px] leading-[1.5] text-stone-500">
          Innholdet dere har publisert, plassert i kartet.
        </p>
        {renderGrid(sourced)}
      </section>
      {own.length > 0 && (
        <section className="mt-6" data-testid="story-theme-group-own">
          <h4 className={SIDEBAR_SECTION_TITLE}>Nabolaget rundt</h4>
          <p className="mt-1 text-[13px] leading-[1.5] text-stone-500">
            Alt annet som ligger her, hentet og målt av Placy.
          </p>
          {renderGrid(own)}
        </section>
      )}
    </div>
  );
}
