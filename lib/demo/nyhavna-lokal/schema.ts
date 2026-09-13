/**
 * Dataformatet for den lokale Nyhavna-demoen (2026-09-13).
 *
 * ## Hvorfor et eget format og ikke boardets egne typer
 *
 * Boardets `Project`/`POI` er formet av provisjonerings-pipelinen: de bærer
 * Google-felter, tier-score, anker-hierarki og dusinvis av felt en person som
 * skriver innhold for hånd aldri skal måtte fylle ut. Denne demoen skal fylles
 * av Andreas og av agenter, i en teksteditor, uten database. Derfor et lite,
 * lesbart format med akkurat de feltene innholdet faktisk trenger — og en
 * adapter (`board.ts`) som oversetter til boardets typer.
 *
 * ## Fire filer, fire roller
 *
 * - `board.json`        — identitet, kartutsnitt og KATEGORIENE. Ingen fakta.
 * - `sources.json`      — kilderegisteret. Stabile ID-er alt annet peker på.
 * - `places.json`       — stedene: det som får en markør i kartet.
 * - `topics.json`       — temakunnskap: fakta og sammenhenger uten ett sted.
 * - `conversations.json`— samtaleeksempler. TESTGRUNNLAG, ikke faktakilde.
 *
 * Samtaleeksemplene er skilt ut i egen fil og egen laster (`loadConversations`)
 * nettopp fordi de ALDRI skal inn i modellens kunnskapsgrunnlag: en
 * transkripsjon er hva noen sa, ikke hva som er sant. `loadDataset` laster dem
 * ikke, og `lib/demo/nyhavna-lokal/voice.ts` importerer dem ikke.
 *
 * ## Kildehenvisning, kontrolldato og forbehold
 *
 * Hvert sted og hvert tema bærer `sourceIds` (mot `sources.json`), `checkedAt`
 * (ISO-dato for NÅR noen sist kontrollerte påstanden) og `caveats` (forbehold i
 * klartekst). Det er ikke pynt: demoens hele poeng er at stemmen bare sier ting
 * som har dekning, og at den sier fra når noe er usikkert eller planlagt.
 */

import { z } from "zod";

/** ISO-dato (YYYY-MM-DD). Kontrolldato skal være en dag, ikke et tidspunkt. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være på formen YYYY-MM-DD");

/** Stabil ID: små bokstaver, tall og bindestrek. Brukes som nøkkel overalt. */
const stableId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "ID-er er små bokstaver, tall og bindestrek");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farge må være #rrggbb");

const coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Eksisterende tilbud vs. plan. Samme skille som boardets `developmentStatus`,
 * med to ekstra ord fordi et utviklingsområde snakker i dem: en vedtatt plan er
 * noe annet enn en visjon, og «uavklart» er et ærlig svar.
 */
export const localStatus = z.enum([
  "existing",
  "planned",
  "adopted-plan",
  "vision",
  "unresolved",
]);
export type LocalStatus = z.infer<typeof localStatus>;

/** Hvor godt koordinaten er belagt — speiler `POI.locationPrecision`. */
const locationPrecision = z.enum(["sourced", "approximate"]);

export const localSourceSchema = z
  .object({
    id: stableId,
    /** Kort navn slik det vises i kortet, f.eks. «nyhavna.no». */
    label: z.string().min(1).max(80),
    /** Den SPESIFIKKE siden, ikke forsiden. */
    page: z.string().min(1).max(160),
    url: z.string().url(),
    publisher: z.string().min(1).max(120),
    checkedAt: isoDate,
  })
  .strict();
export type LocalSource = z.infer<typeof localSourceSchema>;

/**
 * Én påstand med kilde. Én setning per fakta — det er det som gjør at stemmen
 * kan si akkurat så mye den har dekning for, og ikke mer.
 *
 * `verification: "unresolved"` betyr «vi har sett dette, men det er ikke
 * bekreftet». Slike fakta sies ALDRI som fakta; de brukes som forbehold.
 */
export const localFactSchema = z
  .object({
    id: stableId,
    text: z.string().min(1).max(600),
    sourceId: stableId,
    checkedAt: isoDate,
    verification: z.enum(["confirmed", "unresolved"]).default("confirmed"),
  })
  .strict();
export type LocalFact = z.infer<typeof localFactSchema>;

export const localCategorySchema = z
  .object({
    id: stableId,
    name: z.string().min(1).max(80),
    /** Lucide-ikonnavn, f.eks. «Coffee». */
    icon: z.string().min(1).max(60),
    color: hexColor,
    /** Kort ingress i kortet. Tom streng = ingen tekst ennå. */
    lead: z.string().max(400).default(""),
    /** Brødtekst i temakortet. Tom streng = ingen tekst ennå. */
    body: z.string().max(4000).default(""),
    /** Steder kilden navngir uten at vi kan plassere dem. Får aldri markør. */
    unplaced: z.array(z.string().min(1).max(120)).max(40).default([]),
    /** Kilden temateksten er hentet fra. Utelatt = vår egen tekst. */
    sourceId: stableId.optional(),
  })
  .strict();
export type LocalCategory = z.infer<typeof localCategorySchema>;

export const localBoardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: stableId,
    name: z.string().min(1).max(120),
    /** Kan være tom: demoen er et områdekart, ikke en boligannonse. */
    address: z.string().max(200).default(""),
    district: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    /** Ingressen over kartet. Tom = boardets egen generiske tekst. */
    intro: z.string().max(4000).default(""),
    center: coordinates,
    /**
     * Satelitt- og 3D-motoren (Google) ved siden av Mapbox-vektorkartet.
     *
     * `true` gir kartveksleren Kart / Satelitt / 3D, og boardet åpner i
     * Satelitt — rett ovenfra er den letteste orienteringen på et board uten
     * innlest omvisning. `false` gir bare Mapbox.
     *
     * Ligger i datasettet og ikke i koden fordi det er en egenskap ved DETTE
     * stedet: et område uten 3D-bygningsdata skal kunne slå det av uten at noen
     * rører en kodefil.
     */
    map3d: z.boolean().default(true),
    /**
     * Undertittelen i kartets prosjektmarkør.
     *
     * Tom streng = bare navnet. Utelates den HER, ville markøren falt tilbake
     * på sin egen standard («Nybygg 2028») — en påstand om byggeår som denne
     * demoen ikke har dekning for, og som ville stått i kartet fra første
     * sekund på et board som skal starte tomt.
     */
    pinSubtitle: z.string().max(80).default(""),
    /** Førstesetningen stemmen sier. Eies av datasettet, ikke av koden. */
    greeting: z.string().min(1).max(400),
    /**
     * Hva temakunnskapen heter når stemmen omtaler den («nyhavna.no»).
     * Står i instruksjonen, så guiden kan si hvor den har det fra.
     */
    projectInfoLabel: z.string().min(1).max(80),
    categories: z.array(localCategorySchema).min(1).max(30),
  })
  .strict();
export type LocalBoard = z.infer<typeof localBoardSchema>;

export const localPlaceSchema = z
  .object({
    id: stableId,
    name: z.string().min(1).max(120),
    /** Peker på en kategori i `board.json`. Validert i `dataset.ts`. */
    categoryId: stableId,
    coordinates,
    address: z.string().max(200).optional(),
    /** Undertype vist i raden, f.eks. «Kafé». Faller tilbake til kategorinavnet. */
    placeType: z.string().max(60).optional(),
    /** Lucide-ikonnavn for markøren. Utelatt = kategoriens ikon. */
    icon: z.string().max(60).optional(),
    /** Navn folk også bruker. Brukes av stemmens stedssøk. */
    aliases: z.array(z.string().min(1).max(120)).max(20).default([]),
    status: localStatus.default("existing"),
    /** Én til to setninger som vises i kortet. */
    summary: z.string().max(1200).default(""),
    /** Målte minutter fra kartets senter. Aldri gjettet — utelat heller. */
    travelTime: z
      .object({
        walk: z.number().int().min(0).max(600).optional(),
        bike: z.number().int().min(0).max(600).optional(),
        car: z.number().int().min(0).max(600).optional(),
      })
      .strict()
      .optional(),
    locationPrecision: locationPrecision.default("sourced"),
    /** Forbeholdet som følger en omtrentlig plassering, i klartekst. */
    locationNote: z.string().max(400).optional(),
    facts: z.array(localFactSchema).max(40).default([]),
    sourceIds: z.array(stableId).max(20).default([]),
    checkedAt: isoDate,
    caveats: z.array(z.string().min(1).max(400)).max(20).default([]),
  })
  .strict();
export type LocalPlace = z.infer<typeof localPlaceSchema>;

/**
 * Temakunnskap: det som ikke naturlig hører til ETT sted — hvordan området
 * henger sammen, hva som er vedtatt, hvordan hverdagen ser ut.
 *
 * Formen speiler `ProjectInfo` i samtalen, så stemmen kan sitere den med status
 * og kilde uten oversettelsestap.
 */
export const localTopicSchema = z
  .object({
    id: stableId,
    title: z.string().min(1).max(160),
    /** Kategoriene temaet hører til. Tom = gjelder hele området. */
    categoryIds: z.array(stableId).max(20).default([]),
    status: localStatus,
    text: z.string().min(1).max(4000),
    /** Ord stemmens søk skal treffe på, i tillegg til tittel og tekst. */
    keywords: z.array(z.string().min(1).max(60)).max(40).default([]),
    sourceIds: z.array(stableId).max(20).default([]),
    /** Steder temaet omtaler. Validert mot `places.json`. */
    relatedPlaceIds: z.array(stableId).max(40).default([]),
    checkedAt: isoDate,
    caveats: z.array(z.string().min(1).max(400)).max(20).default([]),
  })
  .strict();
export type LocalTopic = z.infer<typeof localTopicSchema>;

/**
 * Et samtaleeksempel: en ekte eller planlagt samtale, brukt til å finne ut hva
 * demoen MÅ kunne svare på.
 *
 * Dette er testgrunnlag. Det lastes aldri inn i modellens kunnskap — se
 * modulens toppkommentar og `voice.test.ts`.
 */
export const localConversationSchema = z
  .object({
    id: stableId,
    /** Når samtalen ble holdt. */
    recordedAt: isoDate,
    /** Hva samtalen handlet om, f.eks. «barn og spisesteder». */
    topic: z.string().min(1).max(160),
    notes: z.string().max(4000).default(""),
    transcript: z
      .array(
        z
          .object({
            speaker: z.enum(["bruker", "guide"]),
            text: z.string().min(1).max(4000),
          })
          .strict(),
      )
      .max(400)
      .default([]),
    /** Spørsmålene samtalen avdekket — det demoen skal kunne svare på. */
    questions: z
      .array(
        z
          .object({
            id: stableId,
            text: z.string().min(1).max(400),
            /** Hva et godt svar må inneholde. */
            expectation: z.string().max(1000).default(""),
          })
          .strict(),
      )
      .max(200)
      .default([]),
  })
  .strict();
export type LocalConversation = z.infer<typeof localConversationSchema>;

export const localSourcesSchema = z.array(localSourceSchema).max(200);
export const localPlacesSchema = z.array(localPlaceSchema).max(500);
export const localTopicsSchema = z.array(localTopicSchema).max(500);
export const localConversationsSchema = z.array(localConversationSchema).max(100);

/** Datasettet slik resten av koden ser det. Samtaleeksemplene er IKKE med. */
export interface LocalDataset {
  board: LocalBoard;
  sources: LocalSource[];
  places: LocalPlace[];
  topics: LocalTopic[];
}
