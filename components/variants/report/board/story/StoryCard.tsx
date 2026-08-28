"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowRight,
  MapPin,
  MessageCircleQuestion,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/map-icons";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import type { FaqEntry } from "@/lib/generators/faq-generator";
import type { NeighbourhoodRow } from "@/lib/board/neighbourhood-list";
import { POIRealtimeSection } from "../../blocks/POIRealtimeSection";
import type { BoardCategory, BoardPOI } from "../board-data";
import { useBoard } from "../board-state";
import { FAQSection } from "../FAQSection";
import {
  DISCLOSURE_CHEVRON_SIZE,
  DISCLOSURE_ITEM_OPEN,
  DISCLOSURE_LABEL,
  DISCLOSURE_ROW,
  DISCLOSURE_ROW_HOVER,
  DisclosureChevron,
  DisclosureList,
  DisclosurePanel,
} from "../Disclosure";
import { SIDEBAR_PROSE, SIDEBAR_SECTION_TITLE } from "../sidebar-style";
import { findBoardPOI } from "../board-data";
import { useViewportCategoryList } from "../neighbourhood/use-viewport-category-list";
import { StoryTravelCell } from "./StoryTravelCell";
import { useStoryTour, type StoryPane } from "./story-tour";
import {
  areaLabel,
  areaProse,
  areaSubline,
  storyBeat,
  storyMinutes,
  storyNarrative,
  storyPickIdentity,
  storyPickTitle,
} from "./story-model";

/**
 * Stoppet — omvisningens ENESTE innhold i flaten.
 *
 * Portert fra prototypen `04-fortelling-i-boardet` (2026-08-26), inkludert
 * desktop-runden samme dag. Ingen ny kurering: spørsmålet er `category.question`,
 * prosaen `category.lead`, stedene `editorial.highlights`.
 *
 * ## Hvorfor spørsmålet står OVER fanene
 *
 * Stoppet ER spørsmålet, og fanene er svar på det — i ord, i steder, i spørsmål
 * og svar. Med spørsmålet inne i fane 1 ville fane 2 føltes som å navigere bort
 * fra stoppet, og faneraden hadde trengt en tilbake-pil.
 *
 * ## De to flatene er ULIKE, med vilje (2026-08-27)
 *
 * `variant="sheet"` er MOBIL: tre faner, og «Spørsmål og svar» er den tredje.
 * Flaten er en dragbar sheet med begrenset høyde, og der er en fane billigere
 * enn å gjøre siden lengre.
 *
 * `variant="column"` er DESKTOP: TO faner. Svarene er flyttet INN i «Om
 * området», under meglerens utvalg. Kolonnen er 438 px bred og full skjermhøyde,
 * og sto med luft under snarveis-kortene — å gjemme det sterkeste
 * innholdselementet bak et fanetrykk i en boks som ikke er full er å skjule for
 * skjulingens skyld. Snarveis-kortet til stedslista blir da stående alene, på
 * full bredde.
 *
 * ## Hvorfor hodet er festet ulikt på de to flatene
 *
 * Desktop fester HELE toppen (transport + spørsmål + faner): du skal kunne bytte
 * stopp og fane uansett hvor langt ned i en liste på 172 rader du har kommet, og
 * ett feste er enklere enn tre som må måle seg mot hverandre. Transporten kommer
 * inn som `head` fra desktop-kolonnen — den ligger INNE i det festede hodet
 * nettopp for å slippe å måle seg mot det. Flaten er frostet og ikke opak:
 * innholdet skal renne under headeren og synes at det gjør det, ellers leser den
 * som en stripe som har spist toppen av teksten. Megler-kortet kommer inn samme
 * vei (`footer`) og ligger derfor INNE i seksjonen: lå det som en søsken etter
 * den, ville hodet sluppet festet i det man rullet ned i kortet.
 *
 * Mobil fester bare spørsmålet. Der er flaten kortere, og en festet blokk på
 * 75 px ville spist en femtedel av lesearealet. Wrapperen må derfor være
 * `display: contents` på mobil — en wrapper med egen boks blir sticky-elementets
 * containing block, og et sticky element kan ikke bli stående lenger enn den
 * boksen rekker. Med boksen på plass forsvant det festede spørsmålet opp forbi
 * flatens overkant så snart wrapperens egen høyde hadde rullet ut.
 */
export function StoryCard({
  variant = "sheet",
  head,
  footer,
}: {
  /** `column` = desktop-kolonnen (to faner, festet hode), `sheet` = mobil. */
  variant?: "sheet" | "column";
  /** Transporten, festet sammen med spørsmålet. Kun desktop. */
  head?: ReactNode;
  /** Sist i seksjonen, inne i samme sticky-kontekst. Kun desktop. */
  footer?: ReactNode;
}) {
  const { data } = useBoard();
  const { stop, onArea, pane, showPane, end, picks, stops } = useStoryTour();
  // Kategoriens steder slik KARTUTSNITTET avgrenser dem. Hentes her, ikke i
  // fanen: tallet i faneetiketten og lista i fanen må være samme sannhet.
  const list = useViewportCategoryList(stop);

  if (!stop && !onArea) return null;

  const column = variant === "column";
  const faqs = stop?.editorial?.faq ?? [];
  // Desktop har ingen svar-FANE: svarene står i «Om området». Står `pane` på
  // "faq" (satt på mobil, eller ved en bredde-endring), leses den som "about"
  // her framfor å vise en tom flate.
  const faqTab = !column && faqs.length > 0;
  const activePane: StoryPane = pane === "faq" && !faqTab ? "about" : pane;
  const visibleRows = placesInView(list);

  const tab = (id: StoryPane, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={activePane === id}
      data-story-pane={id}
      onClick={() => showPane(id)}
      className={cn(
        "min-w-0 flex-1 overflow-hidden truncate rounded-full px-1.5 py-[9px]",
        "text-[13px] font-semibold transition-colors duration-200",
        activePane === id
          ? "bg-white text-stone-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
          : "text-stone-500",
      )}
    >
      {label}
    </button>
  );

  return (
    <section
      data-testid="story-card"
      className={cn("shrink-0", column ? "pb-4" : "pb-[84px]")}
    >
      {/* `contents` på mobil — se doccen over. */}
      <div className="contents lg:sticky lg:top-0 lg:z-[4] lg:-mx-6 lg:block lg:bg-white/85 lg:px-6 lg:pb-2 lg:pt-3 lg:backdrop-blur-xl">
        {/* Utgangen finnes bare på MOBIL. Der ligger indeksen (nabolagslista,
            boardets FAQ, inngangen) bak omvisningen, og krysset er veien
            tilbake til den — øverst til høyre, der en lukkeknapp alltid har
            ligget, i en beholder som er null piksler høy og festet, så det blir
            stående mens innholdet scroller under det.

            DESKTOP har ingen utgang, fordi det ikke finnes noe å gå tilbake til:
            kolonnen ER omvisningen (2026-08-27). Den gamle indeksen med
            temakortene er borte, og stedet den representerte — nabolaget selv —
            ligger nå som første brikke i transporten. */}
        {head ? (
          <div className="mb-2.5">{head}</div>
        ) : (
          <div className="sticky top-0 z-[3] flex h-0 justify-end">
            <button
              type="button"
              data-testid="story-exit"
              onClick={end}
              aria-label="Avslutt omvisningen"
              className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-stone-900/[0.05] text-stone-500 transition-colors duration-150 hover:bg-stone-900/10 hover:text-stone-900"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Fossefallet: en tone som fortsetter under den frostede flaten, så
            teksten LØSER SEG OPP i headeren i stedet for å bli kuttet av en
            kant. `hidden lg:block` — på mobil er wrapperen `display: contents`
            og har ingen boks å ligge absolutt i. */}
        {head && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-full hidden h-6 bg-gradient-to-b from-white/95 to-transparent lg:block"
          />
        )}

        {/* Det er kjøperens spørsmål — vår kategorilabel («Barn & oppvekst») er
            arkivarens ord, ikke hennes. På områdestoppet er det ikke et
            spørsmål, men stedet: navnet på strøket, med dekningen i tall under.
            Den hvite bakgrunnen hører til sticky-trikset og BARE til det: den er
            masken som skjuler innholdet som passerer under spørsmålet på mobil.
            På desktop passerer ingenting, og en hvit stripe i full tekstbredde
            leste som et utfylt skrivefelt i stedet for som en overskrift. */}
        <h3 className="sticky top-0 z-[2] -mx-4 bg-white px-4 pb-2.5 pr-14 pt-1 text-[20px] font-bold leading-[1.2] tracking-[-0.02em] text-stone-900 lg:static lg:m-0 lg:bg-transparent lg:p-0 lg:pt-1">
          {onArea ? areaLabel(data.home) : stop!.question || stop!.label}
        </h3>

        {onArea ? (
          <p
            data-testid="story-area-subline"
            className="text-[13px] font-medium tabular-nums text-stone-500"
          >
            {areaSubline(stops)}
          </p>
        ) : (
          /* Segmentert kontroll: svar på samme spørsmål. Den valgte brikken
             løftes med hvitt og skygge; det er den bevegelsen som viser at et
             trykk på et av snarveis-kortene i «Om området» gjorde noe. */
          <div
            role="tablist"
            aria-label="Svarform"
            className="flex gap-0.5 rounded-full bg-black/[0.045] p-[3px] lg:mt-4"
          >
            {tab("about", "Om området")}
            {tab("places", `Steder (${visibleRows.length})`)}
            {faqTab && tab("faq", `Spørsmål (${faqs.length})`)}
          </div>
        )}
      </div>

      {/* Fanene bytter enkelt: den inaktive tas ut av layouten. Flaten står
          stille gjennom hele omvisningen, så en fane som er høyere enn en annen
          gir bare mer å scrolle — ikke en flate som flytter seg. */}
      <div className="pt-3">
        {onArea ? (
          <AreaPane />
        ) : (
          <>
            {activePane === "about" && (
              <AboutPane
                category={stop!}
                picks={picks}
                /* Desktop: svarene står her, ikke bak en fane. */
                withFaq={column}
              />
            )}
            {activePane === "places" && (
              <PlacesPane
                category={stop!}
                rows={visibleRows}
                hidden={list.hiddenCount}
              />
            )}
            {activePane === "faq" && faqTab && (
              <div data-testid="story-faq">
                {/* Faneetiketten ER overskriften her. */}
                <StoryFaq entries={faqs} />
              </div>
            )}
          </>
        )}
      </div>

      {footer}
    </section>
  );
}

/**
 * Områdestoppet — rekkefølgens første brikke, og inngangen indeksen var.
 *
 * Den erstattet temakort-indeksen på desktop (2026-08-27), og bærer det samme
 * som den gjorde: hele nabolaget på kartet, strøkets intro, og strøkets egne
 * spørsmål og svar.
 * Ingen stedsliste her: kartet ER lista på dette stoppet, og temaene under
 * bærer sine egne.
 */
function AreaPane() {
  const { data } = useBoard();
  return (
    <>
      {/* Strøkets egne ord, i avsnitt — samme form som temaenes prosa. Uten
          kuratert tekst står den navigerende setningen alene (`areaProse`). */}
      {areaProse(data.areaIntro).map((p, i) => (
        <p key={i} className={cn(SIDEBAR_PROSE, i > 0 && "mt-3")}>
          {p}
        </p>
      ))}
      <div data-testid="story-area-faq">
        <StoryFaq
          entries={data.globalFaq ?? []}
          title="Spørsmål og svar"
          className="mt-5"
        />
      </div>
    </>
  );
}

/**
 * Boardets/stoppets svar, koblet til omvisningen: et stedsnavn i et svar åpner
 * stedet der det står (og flytter kartet), en kategorilenke bytter stopp.
 *
 * Egen komponent fordi tre kallsteder trenger samme kobling: svar-fanen på
 * mobil, «Om området» på desktop, og områdestoppet.
 */
function StoryFaq({
  entries,
  title = "",
  className = "",
}: {
  entries: readonly FaqEntry[];
  title?: string;
  className?: string;
}) {
  const { data } = useBoard();
  const { stops, goto, showPlace } = useStoryTour();
  return (
    <FAQSection
      entries={entries}
      title={title}
      className={className}
      poisById={data.poisById}
      categoryIds={stops.map((c) => c.id)}
      onOpenPoi={(poiId) => {
        // Kartet flyr til stedet, men ingen modal tar over flaten — se
        // `OpenPOISource`. Finnes ikke punktet på boardet, gjør vi ingenting
        // (lenken er da ren tekst i praksis).
        const poi = findBoardPOI(stops, poiId);
        if (poi) showPlace(poi);
      }}
      onSelectCategory={(categoryId) => {
        const idx = stops.findIndex((c) => c.id === categoryId);
        if (idx >= 0) goto(idx);
      }}
    />
  );
}

/**
 * Steds-fanens rader: kategoriens punkter i utsnittet, nærmest først.
 *
 * `useViewportCategoryList` trekker det åpne punktet UT av radene for å kunne
 * feste det øverst (fiksen fra `active-poi-card-pinned-sidebar-20260208`). Her
 * skal rekkefølgen være ren avstand, så det legges tilbake.
 *
 * ALLTID, ikke bare når punktet er i utsnittet (2026-08-28). Et trykk på en
 * kartpinne åpner raden i denne lista, og betingelsen «bare hvis i utsnittet»
 * kunne da la handlingen ende i ingenting: utsnittet er kartet MINUS flatene som
 * dekker det, så en pinne som står så vidt utenfor det målte rektangelet er
 * fortsatt en pinne du kan se og trykke på. Prisen er at faneetiketten kan si én
 * mer enn utsnittet inneholder. Det er den riktige avveiingen — en rad som
 * mangler er en ødelagt handling, et tall som er én av er en unøyaktighet.
 */
function placesInView(
  list: ReturnType<typeof useViewportCategoryList>,
): NeighbourhoodRow<BoardPOI>[] {
  const { rows, activeRow } = list;
  const all = activeRow ? [activeRow, ...rows] : rows;
  return all.slice().sort((a, b) => {
    const ma = a.minutes ?? Number.POSITIVE_INFINITY;
    const mb = b.minutes ?? Number.POSITIVE_INFINITY;
    if (ma !== mb) return ma - mb;
    return a.poi.name.localeCompare(b.poi.name, "nb");
  });
}

/**
 * Fane 1: svaret i ord — OG meglerens anbefaling, som punkter.
 *
 * Anbefalingen lå først som en overskrift øverst i steds-fanen. To ting gjorde
 * det feil. Den ene: steds-lista er utsnitts-styrt og skifter når du drar
 * kartet, så anbefalingen lå i den flaten som endrer seg mest — og de tre
 * stedene noen har valgt ut er nettopp det som IKKE skal flytte seg. Den andre:
 * utvalget er innsalget (Moat 1), og det sto bak et trykk på en fane.
 *
 * Snarveis-kortet til steds-fanen står, men sier noe annet enn før: det peker
 * på DEKNINGEN — hele kategorien, med tallet utenpå. Det er den veien inn
 * megleren betaler for, og den skal være synlig uten at noen først trykker på en
 * fane.
 */
function AboutPane({
  category,
  picks,
  withFaq,
}: {
  category: BoardCategory;
  picks: BoardPOI[];
  /** Desktop: svarene rendres HER (under utvalget) i stedet for i en tredje
   *  fane, og snarveis-kortet til dem forsvinner. */
  withFaq: boolean;
}) {
  const { showPane } = useStoryTour();
  const faqs = category.editorial?.faq ?? [];
  // Kortet er veien til svarene når de ligger bak en fane. Ligger de rett under,
  // ville kortet pekt på noe leseren allerede ser.
  const faqCard = !withFaq && faqs.length > 0;
  const paragraphs = storyProse(category, withFaq);

  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={cn(SIDEBAR_PROSE, i > 0 && "mt-3")}>
          {p}
        </p>
      ))}

      <div className="mb-2 mt-5 flex items-center justify-between gap-2.5">
        <p className={cn("min-w-0", SIDEBAR_SECTION_TITLE)}>
          {storyPickTitle(category)}
        </p>
        <StoryTravelCell />
      </div>

      <DisclosureList as="ul">
        {picks.map((poi) => (
          <PlaceRow key={poi.id} poi={poi} category={category} mark="chip" />
        ))}
      </DisclosureList>

      {/* Dekningen ligger RETT UNDER utvalget, ikke nederst.
          To grunner: utvalget er tre steder og lista er alt det andre — det er
          samme tanke, fortsatt — og på desktop står svarene under her, så et kort
          etter dem ville ligget en halv skjerm fra det det handler om.

          Formen skifter med hvor mange kort det er. Ett kort er en LINJE i full
          bredde: en bred flate med ett navn i leser som «trykk her», og et høyt
          kort på full bredde leste som «det finnes ÉN ting mer her». To kort står
          som et par og sier at svaret har flere former og at du velger. */}
      <div
        className={cn(
          "grid gap-2 pb-1 pt-3",
          faqCard ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <MiniCard
          color={category.color}
          Icon={MapPin}
          title="Steder i nærheten"
          sub={`${category.pois.length} i alt`}
          row={!faqCard}
          onClick={() => showPane("places")}
        />
        {faqCard && (
          <MiniCard
            color={category.color}
            Icon={MessageCircleQuestion}
            title="Spørsmål og svar"
            sub={`${faqs.length} svar`}
            onClick={() => showPane("faq")}
          />
        )}
      </div>

      {withFaq && faqs.length > 0 && (
        <div data-testid="story-faq">
          <StoryFaq entries={faqs} title="Spørsmål og svar" className="mt-5" />
        </div>
      )}
    </>
  );
}

/**
 * Stoppets prosa, i den mengden flaten har plass til.
 *
 * MOBIL får beatet: to setninger av første avsnitt. Sheeten er kort, og den
 * fulle teksten ligger én skjerm unna — kategorisiden bak «Avslutt» rendrer
 * hvert avsnitt av `intro || body`.
 *
 * DESKTOP får ALT. Kolonnen har ingen drill-in å sende leseren til lenger
 * (indeksen ble slettet 2026-08-27), så et kutt her ville gjort resten av den
 * kuraterte teksten uleselig på flaten — målt på Ranheim-demoen falt en hel
 * avsluttende setning bort i fire av seks temaer, og et helt avsnitt på
 * prosjekter med to. Det er Moat-1-innholdet vi selger; det skal ikke ligge
 * bak en flate som ikke finnes.
 *
 * `intro` vinner når den finnes: da bærer FAQ-en under substansen, og prosaen
 * skal bare sette scenen (degradasjonsregelen ligger i board-data).
 */
function storyProse(category: BoardCategory, full: boolean): string[] {
  if (!full) {
    const beat = storyBeat(category.lead);
    return beat ? [beat] : [];
  }
  const body = category.editorial?.intro || category.editorial?.body || "";
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Uten editorial er `lead` alt som finnes (nivå-1 uten generert minimum).
  if (paragraphs.length > 0) return paragraphs;
  const fallback = category.lead?.trim();
  return fallback ? [fallback] : [];
}

/**
 * Fane 2: kategoriens steder i utsnittet, nærmest først. Én liste, ingen
 * grupper — de utvalgte ligger inne i den, med stjerne, på plassen avstanden
 * gir dem. Linja nederst sier hvor mange som ligger utenfor: det er den som
 * forklarer at lista er et utsnitt og ikke en fasit, og som gjør det tydelig at
 * kartet er filteret.
 */
function PlacesPane({
  category,
  rows,
  hidden,
}: {
  category: BoardCategory;
  rows: NeighbourhoodRow<BoardPOI>[];
  hidden: number;
}) {
  const { pickedIds } = useStoryTour();

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2.5">
        <p className={cn("min-w-0", SIDEBAR_SECTION_TITLE)}>I kartutsnittet</p>
        <StoryTravelCell />
      </div>

      {rows.length > 0 ? (
        <DisclosureList as="ul">
          {rows.map(({ poi }) => (
            <PlaceRow
              key={poi.id}
              poi={poi}
              category={category}
              mark={pickedIds.has(String(poi.id)) ? "star" : "dot"}
            />
          ))}
        </DisclosureList>
      ) : (
        <p className="px-0.5 pb-0.5 pt-1.5 text-[14px] leading-[1.5] text-stone-500">
          Ingen av kategoriens steder er i utsnittet.
        </p>
      )}

      {hidden > 0 && (
        <p
          data-testid="story-outside"
          className="px-0.5 pb-0.5 pt-2.5 text-[14px] leading-[1.5] text-stone-500"
        >
          {hidden} {hidden === 1 ? "sted" : "steder"} utenfor utsnittet — zoom
          ut for å se dem
        </p>
      )}
    </>
  );
}

/** Markør-kolonnens bredde per form. Prikk og stjerne deler kolonne — 14 px
 *  rommer den bredeste av dem — så navnene står i samme loddrette linje enten
 *  stedet er plukket eller ikke. Brikken i Om området får sin egen bredde: det
 *  er en annen fane og et annet blikk, og der setter brikkene linja. */
const MARK_WIDTH = { chip: 24, star: 14, dot: 14 } as const;

/**
 * Én stedsrad. Venstre kolonne sier hva raden ER, og har tre former:
 *
 *   chip  = meglerens anbefaling i Om området, med kuratorens eget ikon og farge
 *   star  = samme sted igjen, nede i steds-lista: plukket, men fortsatt bare et
 *           sted blant stedene
 *   dot   = alle de andre, i kategoriens farge som kartpinnen
 *
 * Stjernen ERSTATTER prikken og beholder kategorifargen: da kan du lese hvilke
 * som er plukket loddrett nedover venstrekanten, uten at raden endrer bredde
 * eller at teksten flytter seg. Sto stjernen etter navnet, ville den havnet
 * inntil «3 min» — navnet er `flex-1` og skyver alt etter seg helt til høyre —
 * og da ville den merket minuttet, ikke stedet.
 *
 * ## Sanntid, men bare på utvalget
 *
 * Er et av de tre navngitte stedene en holdeplass, en bysykkelstasjon eller en
 * bildelings-plass, står de neste avgangene inne i utfoldingen — samme data og
 * samme komponent kart-popupene bruker (PRD 11 Unit 7). For næringseiendom er
 * jobbreisen et kjøpsargument, og for en boligkjøper er «går bussen ofte nok»
 * spørsmålet ingen tekst kan svare på.
 *
 * Gaten er `mark === "chip"` OG at raden står åpen. Uten den ville en stedsliste
 * på 172 rader startet ett 60-sekunders poll per transport-rad.
 */
function PlaceRow({
  poi,
  category,
  mark,
}: {
  poi: BoardPOI;
  category: BoardCategory;
  mark: "chip" | "star" | "dot";
}) {
  const { state } = useBoard();
  const { isPlaceOpen, togglePlace, focusPoiId } = useStoryTour();
  const minutes = storyMinutes(poi, state.travelMode);
  const narrative = storyNarrative(poi);
  const open = isPlaceOpen(String(poi.id));
  const identity = mark === "chip" ? storyPickIdentity(poi, category) : null;
  const ChipIcon = identity ? getIcon(identity.icon) : null;
  const isTransport = !!(
    poi.raw.enturStopplaceId ||
    poi.raw.bysykkelStationId ||
    poi.raw.hyreStationId
  );
  const live = mark === "chip" && isTransport;
  // Hooket er null-trygt: uten POI pollens ingenting.
  const realtimeData = useRealtimeData(live && open ? poi.raw : null);
  // Sanntid er også noe å utfolde: en holdeplass uten redaksjonell tekst skal
  // ha chevron, ellers finnes det ingen affordans for avgangene.
  const expandable = !!narrative || live;

  // Raden KARTET peker på. Se `focusPoiId` i story-tour: den settes bare av et
  // pinnetrykk, og bare på én rad.
  const focused = focusPoiId === String(poi.id);
  const rowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!focused) return;
    // Raden skal være synlig uten at leseren må leite etter den. `center` og
    // ikke `nearest`: hodet i kolonnen er festet og over hundre piksler høyt, så
    // «så vidt innenfor» kan bety «gjemt under headeren». Rolig, fordi det er en
    // bevegelse leseren ikke ba om direkte — hun trykket i kartet, og flaten
    // svarer.
    rowRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }, [focused]);

  return (
    <li
      ref={rowRef}
      data-focused={focused || undefined}
      className={cn("relative", open && DISCLOSURE_ITEM_OPEN)}
    >
      {/* Merket for «kartet pekte hit»: en strek i kategoriens farge langs
          venstrekanten — samme farge som pinnen som ble trykket. Den åpne
          tonen sier at raden er utfoldet; streken sier hvorfor. En ramme rundt
          raden kunne ikke gjort samme jobb: radene ligger i ÉN ramme med
          hårstreker mellom seg (se Disclosure), og en ekstra kant inni den
          leser som at lista har gått i stykker. */}
      {focused && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: category.color }}
        />
      )}
      <button
        type="button"
        data-testid="story-row"
        data-poi={String(poi.id)}
        onClick={() => togglePlace(poi)}
        aria-current={open}
        aria-expanded={expandable ? open : undefined}
        className={cn(DISCLOSURE_ROW, "items-center", DISCLOSURE_ROW_HOVER)}
      >
        {/* Markøren ligger i en kolonne med FAST bredde, ikke inntil navnet: en
            stjerne er 13 px og en prikk 8, så uten kolonnen rykket navnet fram
            og tilbake nedover lista alt etter hvilke steder som var plukket. */}
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center"
          style={{ width: MARK_WIDTH[mark] }}
        >
          {ChipIcon && identity ? (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: identity.color }}
            >
              <ChipIcon size={14} />
            </span>
          ) : mark === "star" ? (
            // Stjernen sier «plukket», ikke «plukket av». Utvalget er navnløst
            // — Placy eier stedet — så den bærer ingen byline. Fylt, fordi en
            // grå kontur forsvinner i en liste som kan være 40 rader lang.
            <Star
              size={13}
              className="shrink-0 fill-current"
              style={{ color: category.color }}
            />
          ) : (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
          )}
        </span>

        <span className={cn(DISCLOSURE_LABEL, "truncate")}>{poi.name}</span>
        {minutes !== undefined && (
          <span className="shrink-0 text-[14px] tabular-nums text-stone-600">
            {minutes} min
          </span>
        )}
        {/* Chevron-plassen holdes av også når stedet mangler tekst, ellers står
            «17 min» lenger til høyre enn «4 min» rett over. */}
        {expandable ? (
          <DisclosureChevron open={open} />
        ) : (
          <span
            aria-hidden
            className="shrink-0"
            style={{ width: DISCLOSURE_CHEVRON_SIZE }}
          />
        )}
      </button>

      {/* Stedets tekst åpner seg der raden står. Ingen modal, ingen ny flate —
          det er hele poenget med modusen. Innrykket flukter med NAVNET:
          26 = radens padding (14) + radens gap (12). */}
      {expandable && (
        <DisclosurePanel open={open} testId="story-narrative">
          <div
            className="pb-3 pr-3.5"
            style={{ paddingLeft: MARK_WIDTH[mark] + 26 }}
          >
            {narrative && (
              <p className="text-[15px] leading-[1.6] text-stone-600">
                {narrative}
              </p>
            )}
            {live && (
              <div className={cn(narrative && "mt-2")}>
                <POIRealtimeSection realtimeData={realtimeData} />
              </div>
            )}
          </div>
        </DisclosurePanel>
      )}
    </li>
  );
}

/** Snarveien ut av prosaen. Disse ER kort, på hvit flate: en svak grå bunn i
 *  stedet for hvitt-på-hvitt. */
function MiniCard({
  color,
  Icon,
  title,
  sub,
  row = false,
  onClick,
}: {
  color: string;
  Icon: LucideIcon;
  title: string;
  sub: string;
  /** Én linje i full bredde i stedet for et stablet kort. Se AboutPane. */
  row?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={row ? "story-places-row" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-stone-300/80 bg-stone-50 text-left transition-colors duration-150 hover:bg-stone-100",
        row
          ? "flex items-center gap-3 px-3.5 py-2.5"
          : "flex flex-col items-start gap-2 p-3",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full text-white",
          row ? "h-7 w-7 shrink-0" : "h-6 w-6 shadow-[0_0_0_2px_#fff]",
        )}
        style={{ backgroundColor: color }}
      >
        <Icon size={14} />
      </span>
      <span
        className={cn(
          "block text-[14px] font-semibold leading-[1.3] text-stone-900",
          row && "min-w-0 flex-1 truncate",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5",
          row ? "shrink-0" : "w-full",
        )}
      >
        <span
          className={cn(
            "min-w-0 text-[12.5px] text-stone-600",
            row ? "tabular-nums" : "flex-1",
          )}
        >
          {sub}
        </span>
        <ArrowRight size={14} aria-hidden className="shrink-0 text-stone-400" />
      </span>
    </button>
  );
}
