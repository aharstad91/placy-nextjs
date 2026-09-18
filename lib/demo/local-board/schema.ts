/**
 * Dataformatet for lokale demo-datasett (2026-09-13, delt kjerne 2026-09-18).
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
 * ## Filene og rollene deres
 *
 * - `board.json`        — identitet, kartutsnitt og KATEGORIENE. Ingen fakta.
 * - `sources.json`      — kilderegisteret. Stabile ID-er alt annet peker på.
 * - `places.json`       — stedene: det som får en markør i kartet.
 * - `topics.json`       — temakunnskap: fakta og sammenhenger uten ett sted.
 * - `faq.json`          — spørsmål og svar, per tema eller for hele området.
 * - `conversations.json`— samtaleeksempler. TESTGRUNNLAG, ikke faktakilde.
 *
 * Samtaleeksemplene er skilt ut i egen fil og egen laster (`loadConversations`)
 * nettopp fordi de ALDRI skal inn i modellens kunnskapsgrunnlag: en
 * transkripsjon er hva noen sa, ikke hva som er sant. `loadDataset` laster dem
 * ikke, og `lib/demo/local-board/voice.ts` importerer dem ikke.
 *
 * `board.json` bærer i tillegg setningene guiden sier om DETTE stedet
 * (`voice`) og hvilke kategorier som kan utvides med radius
 * (`discoveryCategoryIds`). De lå før i koden, med ett steds navn midt i en
 * ellers generell motor.
 *
 * ## Kildehenvisning, kontrolldato og forbehold
 *
 * Hvert sted og hvert tema bærer `sourceIds` (mot `sources.json`), `checkedAt`
 * (ISO-dato for NÅR noen sist kontrollerte påstanden) og `caveats` (forbehold i
 * klartekst). Det er ikke pynt: demoens hele poeng er at stemmen bare sier ting
 * som har dekning, og at den sier fra når noe er usikkert eller planlagt.
 */

import { z } from "zod";

import { BOARD_PROFILE_IDS } from "@/lib/demo/local-board/profiles";

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
    /**
     * Invitasjonen manusdelen avsluttes med i denne kategorien.
     *
     * Utelatt = den vanlige invitasjonen, som tilbyr flere steder når utvalget
     * har flere igjen. Satt = kategorien spør om noe annet, slik et delområde
     * gjør: der er «flere lignende steder» feil spørsmål.
     */
    invitation: z.string().min(1).max(400).optional(),
    /** Oppfølgingen etter et klikk på et sted i kategorien. Utelatt = lignende steder. */
    placeInvitation: z.string().min(1).max(400).optional(),
    /** Ordet «flere lignende …» bruker, f.eks. «treningssteder». Utelatt = «steder». */
    moreNoun: z.string().min(1).max(60).optional(),
  })
  .strict();
export type LocalCategory = z.infer<typeof localCategorySchema>;

export const presentationSegmentSchema = z.object({
  id: stableId,
  categoryId: stableId,
  text: z.string().min(1).max(1200),
  placeIds: z.array(stableId).max(6),
  sourceIds: z.array(stableId).min(1),
  checkedAt: isoDate,
}).strict();
export type PresentationSegment = z.infer<typeof presentationSegmentSchema>;


/**
 * Setningene stemmen sier som handler om DETTE stedet.
 *
 * Alt her lå tidligere i koden, med Nyhavnas navn og Nyhavnas delområder midt i
 * en ellers generell instruks. Da kunne ikke et annet datasett bruke samme
 * motor uten å arve et annet steds fakta. Feltene er derfor eksakte setninger,
 * ikke maler med plassholdere: den som skriver innholdet ser nøyaktig hva
 * guiden får vite, og en utelatt setning blir borte i stedet for å bli en tom
 * plassholder.
 */
export const localVoiceSchema = z
  .object({
    /** Hva samtalen handler om, f.eks. «hverdagen på Nyhavna». */
    subject: z.string().min(1).max(160).optional(),
    /** Hva guiden presenterer, f.eks. «Nyhavna og nærområdet». */
    presents: z.string().min(1).max(160).optional(),
    /** Den guiden IKKE er ansatt hos. Utelatt = boardets navn. */
    employer: z.string().min(1).max(120).optional(),
    /** Ordene guiden skal bruke, f.eks. «fra Nyhavna». Tom = ingen slik føring. */
    phrases: z.array(z.string().min(1).max(80)).max(10).default([]),
    /** OMFANG-linja: hva rammen er, og hva som må holdes adskilt. */
    scope: z.string().min(1).max(800).optional(),
    /**
     * Valget guiden tilbyr rett etter hilsenen, i datasettets egne ord.
     *
     * Sto som «bydelen» i koden. En bydel er Nyhavnas ord; et boligprosjekt har
     * ikke en bydel som kommer, det har et prosjekt. Utelatt = en stedsnøytral
     * formulering uten «bydel».
     */
    afterGreeting: z.string().min(1).max(400).optional(),
    /**
     * Setningen som skiller planene fra dagens tilbud, i datasettets egne ord.
     * Samme grunn som `afterGreeting`. Utelatt = stedsnøytral formulering.
     */
    planScope: z.string().min(1).max(400).optional(),
    /** INNGANG: hvilke ord som betyr hvilken kategori i hilsenens to retninger. */
    entry: z.string().min(1).max(800).optional(),
    /** Hva det faste referansepunktet er, sagt i klartekst. */
    referencePoint: z.string().min(1).max(400).optional(),
    /** STEDSFOKUS: hvordan et delområde skal følges opp (backend-instruksen). */
    subAreaFocus: z.string().min(1).max(600).optional(),
    /** Samme regel, sagt til stemmen selv. */
    subAreaRole: z.string().min(1).max(600).optional(),
    /** Egne avsnitt i backend-instruksen, f.eks. om bydelens delområder. */
    backendSections: z.array(z.string().min(1).max(2000)).max(10).default([]),
    /** Egne setninger i stemmens rolleinstruks. */
    roleSentences: z.array(z.string().min(1).max(600)).max(10).default([]),
  })
  .strict();
export type LocalVoice = z.infer<typeof localVoiceSchema>;

/** Datasettets domeneprofil. Se `profiles.ts` for hvorfor den er sitt eget felt. */
export const boardProfileSchema = z.enum(BOARD_PROFILE_IDS);

export const localBoardSchema = z
  .object({
    schemaVersion: z.literal(1),
    /**
     * Hvilken slags kunnskap datasettet bærer — IKKE hvilken flate som vises.
     * Påkrevd, uten standardverdi: et datasett som ikke har tatt stilling ville
     * arvet boligprosjektets begreper uten å ha innholdet som gir dem mening.
     */
    profile: boardProfileSchema,
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
    /** Kvadratisk bilde i prosjektmarkørens skive (sti under `public/`), f.eks. logoen. */
    pinImage: z.string().regex(/^\/[^\s]+$/).max(200).optional(),
    /**
     * Aksentfargen prosjektmarkøren tegnes i — ring, glød og undertittel.
     * Utbyggerens egen farge der logoen står i skiva; utelatt = Placys
     * terrakotta.
     */
    pinAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    /** Førstesetningen stemmen sier. Eies av datasettet, ikke av koden. */
    greeting: z.string().min(1).max(400),
    /**
     * Hva temakunnskapen heter når stemmen omtaler den («nyhavna.no»).
     * Står i instruksjonen, så guiden kan si hvor den har det fra.
     */
    projectInfoLabel: z.string().min(1).max(80),
    categories: z.array(localCategorySchema).min(1).max(30),
    /**
     * Kategoriene som starter med et lite utvalg og kan utvides med radius.
     *
     * Hvilke temaer som tåler det er en egenskap ved INNHOLDET: trening og
     * natur har mange likeverdige alternativer der «litt lenger unna» fortsatt
     * er relevant, mens en skolekrets ikke har det. Tom liste = ingen utvidelse,
     * som er riktig for et datasett som ikke har tatt stilling ennå.
     */
    discoveryCategoryIds: z.array(stableId).max(20).default([]),
    voice: localVoiceSchema.optional(),
    /** Kuratert fortelling, adskilt fra transkripter og spørsmål/svar. */
    presentation: z.array(presentationSegmentSchema).max(30).optional(),
  })
  .strict();
export type LocalBoard = z.infer<typeof localBoardSchema>;

export const localPlaceSchema = z
  .object({
    provenance: z.object({ provider: z.literal("supabase"), recordId: z.string(), importedAt: isoDate }).strict().optional(),
    id: stableId,
    name: z.string().min(1).max(120),
    /** Dokumentert butikk inne i et kjøpesenter; kartet viser forelderen. */
    parentPlaceId: stableId.optional(),
    /** Kilde-ID-er for boardets eksisterende transportinformasjon. */
    bysykkelStationId: z.string().min(1).max(80).optional(),
    enturStopplaceId: z.string().regex(/^NSR:StopPlace:[0-9]+$/).optional(),
    /** Stedets underkategori (f.eks. supermarket); categoryId er boardets tema. */
    poiCategoryId: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/).optional(),
    /** Aktiverer boardets eksisterende sentermerke og butikkregister. */
    anchorSummary: z.string().min(1).max(400).optional(),
    /** Peker på en kategori i `board.json`. Validert i `dataset.ts`. */
    categoryId: stableId,
    coordinates,
    address: z.string().max(200).optional(),
    /** Undertype vist i raden, f.eks. «Kafé». Faller tilbake til kategorinavnet. */
    placeType: z.string().max(60).optional(),
    /** Lucide-ikonnavn for markøren. Utelatt = kategoriens ikon. */
    icon: z.string().max(60).optional(),
    /**
     * Kvadratisk bilde som FYLLER markørskiva i stedet for ikonet (sti under
     * `public/`). Brukes for delområdene under utvikling: Nyhavnas egne
     * illustrasjoner skiller nybyggene fra stedene som finnes i dag.
     */
    image: z.string().regex(/^\/[^\s]+$/).max(200).optional(),
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
 * Strukturert prosjektkunnskap for ETT objekt (2026-09-18).
 *
 * ## Hvorfor byggestatus, åpning, tidspunkt og adgang er fire felt
 *
 * Fordi de er fire forskjellige påstander, og sammenblandingen er den dyre
 * feilen på et halvferdig boligprosjekt: at bygget står ferdig sier ingenting
 * om treningsrommet er åpent, at en åpning er ventet i 2027 sier ingenting om
 * hvem som får bruke det, og en oppgitt innflyttingsdato er ikke en bekreftelse
 * på at fasiliteten finnes da. Ett samlefelt ville tvunget den som skriver
 * innhold til å velge hvilken av dem som «vinner» — og stemmen ville sagt
 * valget som om det var kilden.
 *
 * ## Datoer endrer ingenting av seg selv
 *
 * `timing` er hva kilden sier, i kildens egen presisjon («Q2 2027», «høsten
 * 2027»). Ingen kode her sammenligner den med dagens dato: en passert
 * forventning gjør ikke et tilbud åpent, den gjør forventningen gammel.
 * `checkedAt` på en påstand er da NOEN KONTROLLERTE den, aldri en åpningsdato.
 *
 * ## Innflyttingskoblingen gjelder ett navngitt bygg
 *
 * `moveInLinks` er den eneste måten å si «tilgjengelig ved innflytting», og den
 * peker på ett bygg og én kilde. Bygg B arver ikke bygg As bekreftelse — det er
 * hele grunnen til at koblingen er en liste med bygg-ID og kilde, og ikke et
 * ja/nei-flagg på objektet.
 */
export const developmentObjectType = z.enum(["project", "building", "facility", "outdoor-area"]);
export type DevelopmentObjectType = z.infer<typeof developmentObjectType>;

/** Byggets egen status. Sier ingenting om åpning eller adgang. */
export const developmentBuildStatus = z.enum([
  "existing",
  "under-construction",
  "planned",
  "adopted-plan",
  "vision",
  "unresolved",
]);
export type DevelopmentBuildStatus = z.infer<typeof developmentBuildStatus>;

/** Er tilbudet åpnet? Knyttet til den konkrete fasiliteten, ikke til bygget. */
export const developmentAvailability = z.enum(["open", "not-open", "expected", "unknown"]);
export type DevelopmentAvailability = z.infer<typeof developmentAvailability>;

const developmentTimingSchema = z
  .object({
    /** Kildens egen presisjon: «Q2 2027», «høsten 2027», «2027». Aldri normalisert. */
    text: z.string().min(1).max(80),
    qualifier: z.enum(["expected", "confirmed"]),
    /** Påstanden tidspunktet står i, så et sammendrag kan spores. */
    claimId: stableId.optional(),
  })
  .strict();

const developmentAccessSchema = z
  .object({
    scope: z.enum(["all-residents", "named-buildings", "public", "unresolved"]),
    /** Byggene adgangen gjelder. Bare med `scope: "named-buildings"`. */
    buildingIds: z.array(stableId).max(40).default([]),
    /** Dokumenterte vilkår i klartekst, f.eks. «mot tillegg i felleskostnadene». */
    conditions: z.string().min(1).max(400).optional(),
    claimId: stableId.optional(),
  })
  .strict();

const developmentMoveInLinkSchema = z
  .object({
    /** Temaet med `objectType: "building"` bekreftelsen gjelder. */
    buildingId: stableId,
    /** Kilden som uttrykkelig sier det. Ingen kilde = ingen kobling. */
    confirmedBy: stableId,
    claimId: stableId.optional(),
  })
  .strict();

const developmentConflictSchema = z
  .object({
    /** De motstridende påstandene. Minst to — én påstand kan ikke være uenig med seg selv. */
    claimIds: z.array(stableId).min(2).max(10),
    /** Hva uenigheten går ut på. Ingen rangering: begge sider blir stående. */
    note: z.string().min(1).max(600),
  })
  .strict();

const developmentMapAnchorSchema = z
  .object({
    /** Kontrollert koordinat: stedet i `places.json` objektet hører til. */
    placeId: stableId.optional(),
    /** Eksplisitt omtrentlig anker i klartekst når koordinaten ikke er belagt. */
    approximateArea: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((anchor) => Boolean(anchor.placeId || anchor.approximateArea), {
    message: "mapAnchor må ha placeId eller approximateArea — utelat feltet hvis objektet ikke kan plasseres",
  });

export const localDevelopmentSchema = z
  .object({
    objectType: developmentObjectType,
    buildStatus: developmentBuildStatus,
    /** Påstanden byggestatusen hviler på. */
    buildStatusClaimId: stableId.optional(),
    availability: developmentAvailability,
    /** Påkrevd når `availability` er `open` — se `assertReferences`. */
    availabilityClaimId: stableId.optional(),
    timing: developmentTimingSchema.optional(),
    /** Uttrykkelige bekreftelser per navngitt bygg. Tom = ingen slik bekreftelse. */
    moveInLinks: z.array(developmentMoveInLinkSchema).max(20).default([]),
    access: developmentAccessSchema,
    conflicts: z.array(developmentConflictSchema).max(10).default([]),
    /** Kartreferansen. Utelatt = kunnskap uten plassering, som er lovlig. */
    mapAnchor: developmentMapAnchorSchema.optional(),
    /** Objektets egne påstander. Feltene over peker hit med `claimId`. */
    claims: z.array(localFactSchema).max(40).default([]),
  })
  .strict();
export type LocalDevelopment = z.infer<typeof localDevelopmentSchema>;

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
    /**
     * Strukturert prosjektkunnskap når temaet ER et objekt i utbyggingen.
     *
     * Ligger på temaet og ikke i en sjette runtime-fil fordi et bygg eller en
     * fasilitet allerede ER temakunnskap: en tittel, en tekst, kilder og en
     * kontrolldato. Det som mangler for et boligprosjekt er skillet mellom
     * byggestatus, åpning, tidspunkt og adgang — og det er nettopp det dette
     * objektet bærer. Utelatt = et vanlig tema.
     */
    development: localDevelopmentSchema.optional(),
  })
  .strict();
export type LocalTopic = z.infer<typeof localTopicSchema>;

/**
 * Ett spørsmål med svar, slik venstre sidebar viser det og stemmen siterer det.
 *
 * ## Hvorfor FAQ er sitt eget format og ikke en `topic`
 *
 * Temakunnskap er en påstand om stedet; en FAQ er en påstand PLUS spørsmålet
 * den svarer på, og boardet har allerede en flate som rendrer akkurat det
 * paret (`FAQSection`). Å presse spørsmålet inn i en `title` ville gjort
 * gjenbruken tilfeldig — her er koblingen eksplisitt: `faq.json` blir
 * `BoardCategory.editorial.faq` og `BoardData.globalFaq`, og de to er også det
 * stemmens spørsmålskatalog bygges av (`nyhavnaFaqCatalog`). Ett innhold, to
 * flater.
 *
 * ## `origin` er provenienshullet, ikke pynt
 *
 * `"imported"` betyr at svaret er hentet ferdig fra et annet board og gjengitt
 * som det sto. Det er IKKE etterkontrollert her, og det er derfor et importert
 * svar må ha minst én `sourceId` (håndhevet i `dataset.ts`): kilden skal si
 * hvor teksten kommer fra, ikke at noen har verifisert den på nytt.
 *
 * ## Rekkefølge og plassering
 *
 * Rekkefølgen i fila ER rekkefølgen på flaten. `categoryId` utelatt betyr at
 * spørsmålet gjelder hele området og havner i den generelle seksjonen på
 * områdestoppet, ikke under et tema.
 */
export const localFaqSchema = z
  .object({
    id: stableId,
    /** Temaet spørsmålet står under. Utelatt = generell seksjon for hele området. */
    categoryId: stableId.optional(),
    question: z.string().min(1).max(300),
    /**
     * Svaret. Kan bære `[tekst](category:id)` — kategorien blir klikkbar i
     * sidebaren og oppgis til stemmen. Peker lenken på en kategori som ikke
     * finnes, stopper lasteren.
     */
    answer: z.string().min(1).max(4000),
    /** `imported` = gjengitt fra et annet board, ikke etterkontrollert her. */
    origin: z.enum(["imported", "local"]).default("local"),
    sourceIds: z.array(stableId).max(20).default([]),
    caveats: z.array(z.string().min(1).max(400)).max(20).default([]),
  })
  .strict();
export type LocalFaq = z.infer<typeof localFaqSchema>;

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
export const localFaqsSchema = z.array(localFaqSchema).max(500);
export const localConversationsSchema = z.array(localConversationSchema).max(100);

/** Datasettet slik resten av koden ser det. Samtaleeksemplene er IKKE med. */
export interface LocalDataset {
  board: LocalBoard;
  sources: LocalSource[];
  places: LocalPlace[];
  topics: LocalTopic[];
  faqs: LocalFaq[];
}
