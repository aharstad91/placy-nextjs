/**
 * Prosjektavgrenset kunnskapspakke fra Nyhavna Utviklings eget nettsted.
 *
 * HVORFOR: knowledge.ts dekker de fire «Leve»-sidene. Denne fila dekker resten
 * av nyhavna.no — prosjektintroduksjon, visjon, delområder, utviklingsplaner,
 * hverdagsliv, historie og vanlige spørsmål — slik at den talestyrte omvisningen
 * kan svare med kundens eget innhold uten å finne på noe.
 *
 * DISIPLIN (samme som knowledge.ts):
 * - én påstand per setning;
 * - presens for det som finnes, eksplisitt «planlagt», «vedtatt» eller «visjon»
 *   for alt annet;
 * - hver post peker på ÉN side; kilder blandes aldri i samme post;
 * - tall og datoer gjengis kun slik de står i kilden;
 * - motstrid mellom sider registreres i `conflicts` uten at én velges som fasit;
 * - `mapPoiIds` kan bare peke på markører som allerede finnes i demoen.
 *
 * Ren datamodul. Ingen fetch, ingen vektorsøk, ingen runtime-LLM.
 * Dekningsoversikt: docs/research/nyhavna-leve-demo/site-coverage.md
 */

export type SiteKnowledgeKind =
  | "intro"
  | "vision"
  | "plan"
  | "status"
  | "everyday"
  | "culture"
  | "food"
  | "green"
  | "mobility"
  | "history"
  | "faq"
  | "organisation";

export type SiteKnowledgeStatus =
  | "existing"
  | "planned"
  | "adopted-plan"
  | "vision"
  | "unresolved";

export interface SiteKnowledgeSource {
  id: string;
  label: "nyhavna.no";
  page: string;
  url: string;
  checkedAt: string;
}

export interface SiteKnowledgeEntry {
  id: string;
  title: string;
  kind: SiteKnowledgeKind;
  status: SiteKnowledgeStatus;
  themes: string[];
  text: string;
  keywords: string[];
  sourceId: string;
  relatedEntityIds?: string[];
  mapPoiIds?: string[];
  conflicts?: string[];
}

const CHECKED_AT = "2026-09-13";

const source = (id: string, page: string, path: string): SiteKnowledgeSource => ({
  id,
  label: "nyhavna.no",
  page,
  url: `https://nyhavna.no${path}`,
  checkedAt: CHECKED_AT,
});

const sources: SiteKnowledgeSource[] = [
  source("src-forsiden", "Nyhavna - Nå flytter byen nærmere fjorden", "/"),
  source("src-leve-promenaden", "Promenaden", "/leve/promenaden/"),
  source("src-bo", "Velkommen som beboer på Nyhavna", "/bo/"),
  source("src-bo-transittkaia", "Transittkaia", "/bo/transittkaia/"),
  source("src-bo-ladehammerkaia", "Ladehammerkaia", "/bo/ladehammerkaia/"),
  source("src-bo-kullkranpiren", "Kullkranpiren", "/bo/kullkranpiren/"),
  source("src-bo-strandveikaia", "Strandveikaia", "/bo/strandveikaia/"),
  source("src-bo-bunkerkvartalet", "Bunkerkvartalet", "/bo/bunkerkvartalet/"),
  source("src-hva-skjer", "Hva skjer i Trondheim", "/hva-skjer/"),
  source("src-hva-skjer-aktiviteter", "Aktiviteter", "/hva-skjer/aktiviteter/"),
  source("src-hva-skjer-for-barna", "For barna", "/hva-skjer/for-barna/"),
  source("src-jobbe", "Næring", "/jobbe/"),
  source("src-om-selskapet", "Om selskapet", "/om-selskapet/"),
  source("src-baerekraft", "Bærekraft på Nyhavna", "/om-selskapet/baerekraft/"),
  source(
    "src-dokumenter",
    "Strategiske dokumenter og planer",
    "/om-selskapet/strategiske-dokumenter-og-planer-for-utviklingen-av-nyhavna/",
  ),
  source("src-historien", "Historien om Nyhavna er historien om Trondheim", "/historien/"),
  source("src-nyhetsbrev", "Følg utviklingen på Nyhavna", "/nyhetsbrev/"),
  source("src-aktuelt-hoering", "Hva er en høring?", "/aktuelt/hva-er-en-hoering/"),
  source(
    "src-aktuelt-transittkaia-hoering",
    "Nå kan du si din mening om Transittkaia",
    "/aktuelt/naa-kan-du-si-din-mening-om-transittkaia/",
  ),
  source(
    "src-aktuelt-strandveien-100",
    "Klart for renovering av første kulturminne",
    "/aktuelt/klart-for-renovering-av-foerste-kulturminne/",
  ),
  source(
    "src-aktuelt-naerom",
    "NærOm - Gjenvinningsstasjon for gående og syklende ved Nyhavna",
    "/aktuelt/naerom-gjenvinningsstasjon-for-gaaende-og-syklende-ved-nyhavna/",
  ),
  source(
    "src-aktuelt-studenthus",
    "Nå blir det studenthus på Nyhavna!",
    "/aktuelt/naa-blir-det-studenthus-paa-nyhavna/",
  ),
  source(
    "src-aktuelt-bunkerkvartalet-nybygg",
    "Bunkerkvartalet kan gi 35 000 m2 nybygg til havteknologimiljøet",
    "/aktuelt/bunkerkvartalet-kan-gi-35-000-m2-nybygg-til-havteknologimiljoeet/",
  ),
  source(
    "src-aktuelt-bunkerkvartalet-kultur",
    "Bunkerkvartalet - fra krigshistorie til kreativt kraftsenter",
    "/aktuelt/bunkerkvartalet-fra-krigshistorie-til-kreativt-kraftsenter/",
  ),
  source(
    "src-aktuelt-energi",
    "Sjøvann og overskuddsenergi skal varme opp Nyhavna",
    "/aktuelt/sjoevann-og-overskuddsenergi-skal-varme-opp-nyhavna/",
  ),
  source(
    "src-aktuelt-miljoforum",
    "Samler kreftene for å utvikle Nyhavna som nullutslippsbydel",
    "/aktuelt/samler-kreftene-for-aa-utvikle-nyhavna-som-nullutslippsbydel/",
  ),
  source(
    "src-aktuelt-tssk",
    "En stor nyhet for alle som er glade i kunst!",
    "/aktuelt/en-stor-nyhet-for-alle-som-er-glade-i-kunst/",
  ),
  source(
    "src-aktuelt-fotogalleri",
    "Galleri for fotokunst i Strandveien 100",
    "/aktuelt/galleri-for-fotokunst-i-strandveien-100/",
  ),
  source(
    "src-aktuelt-arrangementsstotte",
    "Søk støtte til arrangement på Nyhavna",
    "/aktuelt/soek-stoette-til-arrangement-paa-nyhavna/",
  ),
  source(
    "src-aktuelt-rodeo",
    "Rodeo Arkitekter skal utvikle Bunkerkvartalet på Nyhavna",
    "/aktuelt/rodeo-arkitekter-skal-utvikle-bunkerkvartalet-paa-nyhavna/",
  ),
  source(
    "src-aktuelt-futurebuilt",
    "Nyhavna Utvikling AS inngår intensjonsavtale med FutureBuilt",
    "/aktuelt/intensjonsavtale-med-futurebuilt/",
  ),
  source(
    "src-aktuelt-enova",
    "1 million i Enova-støtte til ombruksprosjekt",
    "/aktuelt/1-million-i-enova-stoette-til-ombruksprosjekt/",
  ),
  source(
    "src-aktuelt-kvarteret",
    "Kvarteret vil bygge noe nytt i Kultur-Trondheim",
    "/aktuelt/kvarteret-vil-bygge-noe-nytt-i-kultur-trondheim/",
  ),
  source(
    "src-aktuelt-galleri-ihundre",
    "Minneutstilling med Roar Øhlander på Galleri iHUNDRE",
    "/aktuelt/minneutstilling-med-roar-oehlander-paa-galleri-ihundre/",
  ),
];

const entries: SiteKnowledgeEntry[] = [
  {
    id: "site-hva-er-nyhavna",
    title: "Hva Nyhavna er",
    kind: "intro",
    status: "existing",
    themes: ["nyhavna"],
    text: "Nyhavna ligger der Nidelva renner ut i Trondheimsfjorden, en spasertur fra Midtbyen. Nyhavna Utvikling omformer området fra industri og havnedrift til en levende sentrumsbydel.",
    keywords: ["hva er nyhavna", "nyhavna", "bydel", "sentrumsbydel", "beliggenhet", "fjorden", "nidelva", "midtbyen", "omforming", "transformasjon"],
    sourceId: "src-forsiden",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-eierskap",
    title: "Hvem står bak Nyhavna",
    kind: "organisation",
    status: "existing",
    themes: ["nyhavna"],
    text: "Nyhavna Utvikling AS har ansvaret for utviklingen av den nye sentrumsbydelen på Nyhavna. Selskapet ble stiftet i 2021. Trondheim kommune eier 67 prosent og Trondheim havn IKS eier 33 prosent. Selskapet forvalter i tillegg eiendommer på vestre kanalhavn.",
    keywords: ["hvem står bak", "hvem eier", "eier", "eierskap", "utbygger", "nyhavna utvikling", "kommunen", "trondheim havn", "selskap", "stiftet"],
    sourceId: "src-om-selskapet",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-visjon",
    title: "Visjonen for bydelen",
    kind: "vision",
    status: "vision",
    themes: ["nyhavna"],
    text: "Nyhavna Utvikling formulerer visjonen som at by møter fjord og historie møter framtid, og sier selskapet skal skape en bydel hele Trondheim blir glad i. Målet er et variert næringsliv som på sikt kan gi opptil 5 000 arbeidsplasser. Et annet mål er at kulturminnene og vannet gjøres mer tilgjengelige for allmennheten.",
    keywords: ["visjon", "ambisjon", "mål", "by møter fjord", "historie møter framtid", "arbeidsplasser", "5000", "næringsliv", "hva vil de"],
    sourceId: "src-om-selskapet",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-vedtatte-planer",
    title: "De vedtatte planene for Nyhavna",
    kind: "plan",
    status: "adopted-plan",
    themes: ["nyhavna", "leve-kultur"],
    text: "Kommunedelplan for Nyhavna ble vedtatt av Bystyret 28. april 2016 og er juridisk bindende for arealbruk og utvikling. Kvalitetsprogrammet fra 19. mai 2022 er veiledende og beskriver ti strategiske virkemidler. Fire veiledende program utdyper det: Næringsprogram, Miljøprogram, Kulturminneplan og Kunst- og kulturnæringsprogram.",
    keywords: ["kommunedelplan", "kvalitetsprogram", "vedtatt", "bystyret", "juridisk bindende", "reguleringsplan", "kulturminneplan", "miljøprogram", "næringsprogram", "styringsdokumenter"],
    sourceId: "src-dokumenter",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-eierstrategi",
    title: "Eierstrategien og overskuddet",
    kind: "organisation",
    status: "adopted-plan",
    themes: ["nyhavna"],
    text: "Eierstrategien for Nyhavna Utvikling AS ble vedtatt av Bystyret 27. april 2023. Den slår fast at selskapet skal gi overskudd til eierne som kan reinvesteres i samfunnsnyttige tiltak, og samtidig utvikle en attraktiv og bærekraftig bydel.",
    keywords: ["eierstrategi", "overskudd", "vedtatt", "bystyret", "samfunnsnytte", "hvem eier", "økonomi", "hvem tjener"],
    sourceId: "src-dokumenter",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-utbyggingsperiode",
    title: "Hvor lenge utbyggingen varer",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna"],
    text: "Daglig leder Erik Erlien i Nyhavna Utvikling oppgir at utbyggingen av Nyhavna vil strekke seg over rundt 20 år. I løpet av perioden regner selskapet med at teknologien for energiproduksjon utvikler seg videre.",
    keywords: ["når er det ferdig", "hvor lang tid", "20 år", "utbyggingsperiode", "tidslinje", "framdrift", "ferdig"],
    sourceId: "src-aktuelt-energi",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-transittkaia-forste-trinn",
    title: "Transittkaia er første byggetrinn",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna"],
    text: "Transittkaia er første trinn i omformingen av Nyhavna fra havn og industriområde til sentrumsbydel. Planlagt byggestart er 2027, forutsatt at planforslaget godkjennes høsten 2026. Byggingen er planlagt å starte lengst sør ved brannstasjonen, og de første boligkjøperne kan etter planen flytte inn en gang i 2029.",
    keywords: ["transittkaia", "byggetrinn", "byggestart", "første trinn", "2027", "2029", "innflytting", "når starter de", "når er det ferdig"],
    sourceId: "src-bo-transittkaia",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-transittkaia-innhold",
    title: "Hva Transittkaia skal inneholde",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna", "hverdagsliv", "mat-drikke"],
    text: "Planforslaget for Transittkaia viser totalt ca. 102 000 kvadratmeter nytt areal, som Nyhavna sammenligner med 14 fotballgressmatter på størrelse med Lerkendal. Innholdet er boliger i tre kvartal langs Nidelva, handel og næring, barnehage, offentlige byrom og parker. Bakkeplanet er planlagt forbeholdt servering, frisør, butikker og andre servicefunksjoner.",
    keywords: ["hvor mange boliger", "antall", "kvadratmeter", "102000", "areal", "lerkendal", "leiligheter", "butikker", "servering", "innhold"],
    sourceId: "src-bo-transittkaia",
    relatedEntityIds: ["nyhavna"],
    conflicts: [
      "Nettstedet oppgir bruksareal i kvadratmeter, men ingen steder antall boliger eller leiligheter.",
    ],
  },
  {
    id: "site-transittkaia-parker",
    title: "Parkene og elvepromenaden på Transittkaia",
    kind: "green",
    status: "planned",
    themes: ["leve-park", "natur-friluftsliv", "barn-oppvekst"],
    text: "I reguleringsplanen foreslås Elvepromenaden langs Nidelva opparbeidet som en offentlig elvepark med lekeapparat, benker og kunst. Transittkaia er planlagt med rundt 550 trær. Mellom boligkvartal tre og beredskapshavnen er det tegnet inn en blågrønn park med et lite tidevannsbasseng og en egen opplevelsessti for barn.",
    keywords: ["elvepromenaden", "elvepark", "park", "550 trær", "tidevannsbasseng", "lek", "benker", "kunst", "grønt", "natur"],
    sourceId: "src-bo-transittkaia",
    relatedEntityIds: ["elvepromenaden", "elveparken-transittkaia"],
    mapPoiIds: ["leve-elvepromenaden"],
  },
  {
    id: "site-transittparken-ytterst",
    title: "Transittparken ytterst mot fjorden",
    kind: "green",
    status: "planned",
    themes: ["leve-park", "natur-friluftsliv"],
    text: "Transittparken er planlagt ytterst på Transittkaia, der Nidelva renner ut i fjorden. Arkitektene beskriver en instagramvennlig destinasjon med flott utsikt, eget utsiktspunkt og en paviljong som beskytter mot vær og vind.",
    keywords: ["transittparken", "utsiktspunkt", "paviljong", "fjorden", "park", "utsikt", "ytterst"],
    sourceId: "src-bo-transittkaia",
    relatedEntityIds: ["transittparken"],
  },
  {
    id: "site-doratorget-plassering",
    title: "Doratorget i planforslaget",
    kind: "plan",
    status: "planned",
    themes: ["leve-kultur", "mat-drikke", "nyhavna"],
    text: "Doratorget er foreslått i enden av kulturaksen som strekker seg fra Dora 1 i øst til Doratorget i vest. Torget er det største byrommet i planforslaget for Transittkaia, og det legges til rette for matmarked og mindre konserter.",
    keywords: ["doratorget", "torg", "kulturaksen", "byrom", "matmarked", "konserter", "samlingssted"],
    sourceId: "src-bo-transittkaia",
    relatedEntityIds: ["doratorget", "kulturaksen-skippergata"],
    mapPoiIds: ["leve-kulturaksen"],
    conflicts: [
      "Siden om Transittkaia plasserer Doratorget midt på Transittkaia, mens Kunst og kultur-siden omtaler Doratorget som en del av Kulturaksen i Skippergata. Ingen av plasseringene er valgt som fasit.",
    ],
  },
  {
    id: "site-mobilitetshus",
    title: "Mobilitetshuset med dagligvarebutikk",
    kind: "mobility",
    status: "planned",
    themes: ["hverdagsliv", "transport"],
    text: "Mobilitetshuset på Transittkaia er planlagt i seks etasjer, med dagligvarebutikk, servering og annet serviceareal på bakkeplan. Andre til fjerde etasje er satt av til felles parkeringsanlegg, mens de to øverste etasjene er foreslått til kontorer eller leilighetshotell.",
    keywords: ["mobilitetshus", "parkering", "dagligvare", "butikk", "bil", "hotell", "hvor parkerer jeg", "matbutikk"],
    sourceId: "src-bo-transittkaia",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-transittkaia-hoering",
    title: "Fire alternativ på offentlig høring",
    kind: "status",
    status: "existing",
    themes: ["nyhavna", "transport"],
    text: "Planene for Transittkaia er lagt ut på offentlig høring hos Trondheim kommune, med fire alternativ. Alternativ 1 og 2 kommer fra Nyhavna Utvikling, alternativ 3 fra Byplankontoret og alternativ 4 fra Byutviklingsutvalget. I alternativ 4 går hovedsykkelveien i bro, næringsbygget har 11 etasjer og barnehagen er flyttet til siste byggetrinn.",
    keywords: ["høring", "alternativ", "byplankontoret", "byutviklingsutvalget", "kommunen", "medvirkning", "status", "sykkelvei", "barnehage"],
    sourceId: "src-aktuelt-transittkaia-hoering",
    relatedEntityIds: ["nyhavna"],
    conflicts: [
      "Saken er datert 18. februar 2026 og oppgir ingen høringsfrist. Om høringen fortsatt er åpen per 13. september 2026, står ikke på nettstedet.",
      "Alternativ 4 flytter barnehagen til siste byggetrinn, mens siden For barna oppgir at den kommer i byggetrinn én. Nettstedet avgjør ikke hvilket alternativ som gjelder.",
    ],
  },
  {
    id: "site-hva-er-hoering",
    title: "Hva en høring og en reguleringsplan er",
    kind: "faq",
    status: "existing",
    themes: ["nyhavna"],
    text: "En høring er en mulighet for alle til å påvirke reguleringsplaner, og innspillene er offentlig tilgjengelige. Trondheim kommune har ansvaret for høringsrunden. En detaljreguleringsplan angir konkret hvordan et område kan bygges ut og brukes, og tar for seg byggehøyder, utearealer, trafikk, infrastruktur, miljø og kulturminner.",
    keywords: ["høring", "innspill", "medvirkning", "si min mening", "påvirke", "detaljregulering", "reguleringsplan", "byggehøyder", "prosess"],
    sourceId: "src-aktuelt-hoering",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-bo-forste-boliger",
    title: "De første boligene og salgsstart",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna", "hverdagsliv", "transport"],
    text: "De første boligene på Nyhavna kommer på Transittkaia, med planlagt salgsstart i 2026. Nyhavna Utvikling opplyser at det blir leiligheter både for kjøp og leie, tilpasset ulike behov, livssituasjoner og økonomi. Midtbyen er 15 minutters gange unna, og en ny bro over til Solsiden er planlagt.",
    keywords: ["salgsstart", "kjøpe", "leie", "leiligheter", "boliger", "2026", "når kommer boligene", "midtbyen", "15 minutter", "bro"],
    sourceId: "src-bo",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-nyhetsbrev",
    title: "Nyhetsbrev og forhåndssalg",
    kind: "faq",
    status: "existing",
    themes: ["nyhavna", "hverdagsliv"],
    text: "Nyhavna Utvikling driver et nyhetsbrev. Abonnenter blir invitert til forhåndssalg av nye leiligheter før de kommer på markedet, og får oppdateringer om næringslokaler til leie og arrangementer.",
    keywords: ["nyhetsbrev", "forhåndssalg", "melde meg på", "abonnere", "leiligheter", "næringslokaler", "følge utviklingen"],
    sourceId: "src-nyhetsbrev",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-ladehammerkaia-sol",
    title: "Ladehammerkaia og solforholdene",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna", "barn-oppvekst", "leve-park"],
    text: "Ladehammerkaia ligger sørvendt mot vannet, noe Nyhavna omtaler som byens beste solforhold. Området er planlagt med høy andel boliger, barnehage og ulike servicetilbud. To mindre parker eller én større park er planlagt i tilknytning til spissbunkerne.",
    keywords: ["ladehammerkaia", "sol", "sørvendt", "boliger", "barnehage", "servicetilbud", "park", "delområde"],
    sourceId: "src-bo-ladehammerkaia",
    relatedEntityIds: ["ladehammerkaia-allmenninger", "nyhavna"],
  },
  {
    id: "site-ladehammerkaia-spissbunkere",
    title: "Spissbunkerne på Ladehammerkaia",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "På Ladehammerkaia står to spissbunkere, trolig de eneste av sitt slag utenfor Tyskland. Her ligger også artilleriverkstedet fra andre verdenskrig. Alle tre er vernede kulturminner, og Nyhavna nevner galleri eller klatrevegg som mulige bruksområder.",
    keywords: ["spissbunker", "ladehammerkaia", "artilleriverkstedet", "kulturminne", "krigen", "vernet", "bunker", "galleri", "klatrevegg"],
    sourceId: "src-bo-ladehammerkaia",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-kullkranpiren-park",
    title: "Parken og broen på Kullkranpiren",
    kind: "green",
    status: "planned",
    themes: ["leve-park", "natur-friluftsliv", "transport"],
    text: "Kullkranpiren er omgitt av vann på tre sider. Ytterst på piren er en stor park planlagt for lek og rekreasjon, og parken skal også tilrettelegges for mindre arrangement. I området kommer både boliger, barnehage og næringsbygg, og en ny gang- og sykkelbro skal knytte Kullkranpiren sammen med Strandveikaia.",
    keywords: ["kullkranpiren", "kullkranparken", "park", "grønn lunge", "lek", "bro", "sykkelbro", "barnehage", "boliger"],
    sourceId: "src-bo-kullkranpiren",
    relatedEntityIds: ["kullkranpiren", "kullkranparken", "strandveikaia-cultural-area"],
  },
  {
    id: "site-kullkranpiren-konserthus",
    title: "Nybygg for akustisk musikk",
    kind: "plan",
    status: "planned",
    themes: ["leve-kultur", "opplevelser"],
    text: "Kullkranpiren er en av tre kulturhuber på Nyhavna. Det arbeides med planer om et helt nytt bygg for akustisk musikk på området, noe kulturlivet har etterspurt i mange år.",
    keywords: ["konserthus", "akustisk musikk", "kulturhub", "kullkranpiren", "scene", "musikk", "nybygg"],
    sourceId: "src-bo-kullkranpiren",
    relatedEntityIds: ["kullkranpiren", "kullkranparken"],
  },
  {
    id: "site-strandveikaia-idag",
    title: "Strandveikaia i dag",
    kind: "culture",
    status: "existing",
    themes: ["leve-kultur", "opplevelser", "natur-friluftsliv"],
    text: "Strandveikaia ligger vestvendt ved vannet, og her finner du i dag blant annet Havet arena. Mange av kulturminnene ligger her, og en rekke kunst- og kulturaktører har atelier, studio og verksted i området.",
    keywords: ["strandveikaia", "havet", "atelier", "verksted", "kunstnere", "kulturminner", "bydelssentrum"],
    sourceId: "src-bo-strandveikaia",
    relatedEntityIds: ["strandveikaia-cultural-area"],
  },
  {
    id: "site-strandveikaia-kulturklynge",
    title: "Strandveikaia som kulturklynge",
    kind: "plan",
    status: "planned",
    themes: ["leve-kultur"],
    text: "Strandveikaia er pekt ut som en av tre framtidige kulturklynger på Nyhavna, og Nyhavna omtaler området som bydelssentrum. Kulturminnene skal renoveres og fylles med aktiviteter, i hovedsak innenfor kunst og kultur.",
    keywords: ["kulturklynge", "kulturkvartal", "strandveikaia", "renovering", "kunst", "kultur", "bydelssentrum"],
    sourceId: "src-bo-strandveikaia",
    relatedEntityIds: ["strandveikaia-cultural-area"],
  },
  {
    id: "site-strandveikaia-sjobad-og-buss",
    title: "Sjøbad og metrobuss på Strandveikaia",
    kind: "plan",
    status: "planned",
    themes: ["natur-friluftsliv", "transport", "barn-oppvekst"],
    text: "Ved det indre havnebassenget er det planlagt et permanent, offentlig sjøbad med vannaktiviteter for store og små. Metrobussen får holdeplass på Strandveikaia, og med den nye gang- og sykkelbroen over til Kullkranpiren er området planlagt som et viktig knutepunkt.",
    keywords: ["sjøbad", "bading", "bade", "havnebasseng", "metrobuss", "buss", "holdeplass", "knutepunkt", "kollektiv"],
    sourceId: "src-bo-strandveikaia",
    relatedEntityIds: ["strandveikaia-cultural-area", "kullkranpiren"],
  },
  {
    id: "site-strandveien-100-paa-vent",
    title: "Strandveien 100 og framdriften",
    kind: "status",
    status: "unresolved",
    themes: ["leve-kultur", "mat-drikke"],
    text: "Strandveien 100 er et pilotprosjekt der planen er å tilbakeføre bygget, åpne gjenmurte vinduer og rehabilitere fasaden, og supplere med et moderne nybygg omtalt som en tøff lillebror. Nyhavna opplyser at det videre arbeidet er satt på vent fram til finansiering av prosjektet er sikret.",
    keywords: ["strandveien 100", "pilotprosjekt", "på vent", "finansiering", "rehabilitering", "kulturminne", "nybygg", "status"],
    sourceId: "src-bo-strandveikaia",
    relatedEntityIds: ["strandveikaia-cultural-area"],
    conflicts: [
      "Nyhetssaken om renoveringen oppgir at HENT er valgt som totalentreprenør og at bygget skal stå ferdig i 2027. Siden om Strandveikaia sier arbeidet er satt på vent. Nettstedet daterer ikke hvilken opplysning som er nyest.",
    ],
  },
  {
    id: "site-strandveien-100-hent",
    title: "HENT som totalentreprenør",
    kind: "status",
    status: "planned",
    themes: ["leve-kultur", "mat-drikke"],
    text: "HENT er valgt som totalentreprenør for renoveringen av det vernede bygget i Strandveien 100, som skal stå ferdig i 2027. Første etasje blir restaurant og andre etasje kontor. Tredje etasje har et unikt rom med buet tak, der Nyhavna Utvikling ønsker en kulturaktør, men oppgir at det er usikkert om en slik aktør er på plass i 2027.",
    keywords: ["hent", "entreprenør", "strandveien 100", "2027", "restaurant", "kontor", "renovering", "buet tak", "kulturaktør"],
    sourceId: "src-aktuelt-strandveien-100",
    relatedEntityIds: ["strandveikaia-cultural-area"],
    conflicts: [
      "Siden om Strandveikaia oppgir at arbeidet med Strandveien 100 er satt på vent til finansieringen er sikret. Nettstedet avklarer ikke hvilken opplysning som gjelder.",
    ],
  },
  {
    id: "site-enova-ombruk",
    title: "Enova-støtte til ombruk",
    kind: "status",
    status: "existing",
    themes: ["nyhavna"],
    text: "Nyhavna Utvikling har mottatt 1 million kroner i støtte fra Enova. Midlene finansierer merkostnader knyttet til ombruk når det vernede bygget i Strandveien 100 rehabiliteres. Prosjektet er tegnet av Skibnes Arkitekter og utvikles i samspill med HENT AS.",
    keywords: ["enova", "støtte", "ombruk", "gjenbruk", "bærekraft", "strandveien 100", "million", "forbildeprosjekt"],
    sourceId: "src-aktuelt-enova",
    relatedEntityIds: ["strandveikaia-cultural-area"],
  },
  {
    id: "site-strandveien-100-fotogalleri",
    title: "Fotogalleriet i Strandveien 100",
    kind: "culture",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Tre initiativtakere åpnet i starten av 2026 et galleri for fotografi i Strandveien 100, da arbeidet med å renovere bygget fikk en midlertidig stans. Nyhavna omtaler det som Trondheims eneste galleri utelukkende for fotografi.",
    keywords: ["galleri", "fotografi", "fotokunst", "strandveien 100", "utstilling", "kunst", "2026"],
    sourceId: "src-aktuelt-fotogalleri",
    relatedEntityIds: ["strandveikaia-cultural-area"],
  },
  {
    id: "site-tssk-kullbingen",
    title: "Ny kunstinstitusjon i Kullbingen",
    kind: "culture",
    status: "planned",
    themes: ["leve-kultur", "opplevelser"],
    text: "Trøndelag senter for samtidskunst og Nyhavna Utvikling samarbeider om en ny kunstinstitusjon på Strandveikaia, i det vernede bygget Kullbingen like ved Havet Arena. Samarbeidet starter med et forprosjekt som skal danne grunnlag for et pilotprosjekt i perioden 2027 til 2030.",
    keywords: ["tssk", "samtidskunst", "kullbingen", "kunstinstitusjon", "strandveikaia", "pilot", "kunst", "2027"],
    sourceId: "src-aktuelt-tssk",
    relatedEntityIds: ["strandveikaia-cultural-area"],
  },
  {
    id: "site-kvarteret",
    title: "Kvarteret kulturstue og prosjektrom",
    kind: "culture",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Kvarteret kulturstue og prosjektrom i Strandveikaia 98 A leier ut øvingsrom og produksjonslokaler til band, kunstnere og andre kreative. Stedet ble startet i 2011 og er en del av kunst- og kulturfellesskapet på Strandveikaia, der også malere, trekunstnere og tekstilkunstnere holder til.",
    keywords: ["kvarteret", "øvingsrom", "band", "musikk", "produksjonslokaler", "strandveikaia", "kunstnere", "studio"],
    sourceId: "src-aktuelt-kvarteret",
    relatedEntityIds: ["strandveikaia-cultural-area"],
  },
  {
    id: "site-galleri-ihundre",
    title: "Galleri iHUNDRE",
    kind: "culture",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Galleri iHUNDRE på Nyhavna viser fotoutstillinger. Galleriet har blant annet vist en minneutstilling med fotografier av Roar Øhlander, laget i samarbeid med familien hans og Norsk Fotofagskole.",
    keywords: ["galleri ihundre", "galleri", "fotoutstilling", "fotografi", "utstilling", "kunst"],
    sourceId: "src-aktuelt-galleri-ihundre",
    relatedEntityIds: ["nyhavna"],
    conflicts: [
      "Nettstedet skriver navnet både som Galleri iHUNDRE og GalleriHundre. Kanonisk skrivemåte er ikke avklart.",
    ],
  },
  {
    id: "site-bunkerkvartalet-planinitiativ",
    title: "Bunkerkvartalet og planinitiativet",
    kind: "status",
    status: "existing",
    themes: ["leve-kultur", "nyhavna"],
    text: "Bunkerkvartalet grenser mot Dora 1, og kulturminnene Dora 2 og Fyringsbunkeren ligger i området. Arbeidet med å videreutvikle området er i gang, og planinitiativet ble levert i januar 2026.",
    keywords: ["bunkerkvartalet", "planinitiativ", "dora 2", "fyringsbunkeren", "dora 1", "status", "2026"],
    sourceId: "src-bo-bunkerkvartalet",
    relatedEntityIds: ["dora-2", "fyringsbunkeren"],
    mapPoiIds: ["leve-dora2", "leve-fyringsbunkeren"],
  },
  {
    id: "site-dora2-vitensenteret",
    title: "Dora 2 og Vitensenteret",
    kind: "plan",
    status: "planned",
    themes: ["leve-kultur", "opplevelser", "barn-oppvekst"],
    text: "Dora 2 er planlagt som et flerbruksbygg for både kultur og næring, der deler av bunkeren kan egne seg som øvingsrom eller galleri. Vitensenteret ønsker å etablere seg i et nybygg på taket av Dora 2 i 2030, med mål om 200 000 besøkende årlig.",
    keywords: ["dora 2", "vitensenteret", "taket", "2030", "opplevelsessenter", "besøkende", "barn", "galleri", "øvingsrom"],
    sourceId: "src-bo-bunkerkvartalet",
    relatedEntityIds: ["dora-2"],
    mapPoiIds: ["leve-dora2"],
  },
  {
    id: "site-fyringsbunkeren-bruk",
    title: "Fyringsbunkeren og Bunkerparken",
    kind: "plan",
    status: "planned",
    themes: ["leve-kultur", "leve-park"],
    text: "Fyringsbunkeren er vernet og skal først og fremst brukes til kunst og kultur. Foran Fyringsbunkeren kommer et offentlig byrom som i planleggingsfasen omtales som Bunkerparken. Illustrasjonen av området er et visjonsbilde fra Cobe og Topic som viser muligheter, ikke vedtatte planer.",
    keywords: ["fyringsbunkeren", "bunkerparken", "byrom", "kunst", "kultur", "vernet", "park", "visjonsbilde", "forbehold"],
    sourceId: "src-bo-bunkerkvartalet",
    relatedEntityIds: ["fyringsbunkeren", "bunkerparken"],
    mapPoiIds: ["leve-fyringsbunkeren", "leve-bunkerparken"],
  },
  {
    id: "site-bunkerkvartalet-areal",
    title: "Tomtearealet i Bunkerkvartalet",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna"],
    text: "Bunkerkvartalet har et tomteareal på til sammen 45 dekar. Rodeo Arkitekter AS er engasjert som rådgivere i første fase av planarbeidet, og Nyhavna Utvikling utvikler området sammen med eiendomsselskapet Dora AS og Trondheim Havn.",
    keywords: ["bunkerkvartalet", "45 dekar", "tomteareal", "rodeo arkitekter", "dora as", "trondheim havn", "planarbeid"],
    sourceId: "src-aktuelt-rodeo",
    relatedEntityIds: ["dora-2", "fyringsbunkeren"],
  },
  {
    id: "site-bunkerkvartalet-nybygg",
    title: "Nybygg til havteknologimiljøet",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna"],
    text: "Nyhavna oppgir at Bunkerkvartalet har potensial for mellom 25 000 og 35 000 kvadratmeter nybygg til havteknologimiljøet. Ambisjonen er at de første nybyggene er innflyttingsklare i 2030.",
    keywords: ["bunkerkvartalet", "nybygg", "havteknologi", "35000", "2030", "kvadratmeter", "arbeidsplasser"],
    sourceId: "src-aktuelt-bunkerkvartalet-nybygg",
    relatedEntityIds: ["dora-2"],
    conflicts: [
      "Overskriften på saken oppgir 35 000 kvadratmeter, mens brødteksten oppgir et spenn mellom 25 000 og 35 000. Ett av tallene er ikke valgt som fasit.",
    ],
  },
  {
    id: "site-bunkerkvartalet-kulturworkshop",
    title: "Kulturlivets ønsker for Bunkerkvartalet",
    kind: "vision",
    status: "vision",
    themes: ["leve-kultur", "trening-aktivitet"],
    text: "Representanter fra idrett, kunst og kulturliv har deltatt i workshop om framtidens Bunkerkvartal. Ideene spente fra festivaler og filmstudio til utendørs danseplatt og turnhall med klatrevegg. Det var bred enighet om å bevare det industrielle og røffe uttrykket i området.",
    keywords: ["workshop", "medvirkning", "festival", "filmstudio", "turnhall", "klatrevegg", "industrielt", "visjon", "idrett"],
    sourceId: "src-aktuelt-bunkerkvartalet-kultur",
    relatedEntityIds: ["fyringsbunkeren", "dora-2"],
  },
  {
    id: "site-futurebuilt",
    title: "Intensjonsavtale med FutureBuilt",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna"],
    text: "Nyhavna Utvikling har inngått intensjonsavtale med innovasjonsprogrammet FutureBuilt om at Bunkerkvartalet skal utvikles etter programmets kriterier. Bunkerkvartalet blir det første områdeprosjektet i Trondheim som planlegges i tråd med disse kriteriene.",
    keywords: ["futurebuilt", "intensjonsavtale", "klimanøytral", "forbildeprosjekt", "bunkerkvartalet", "bærekraft", "kriterier"],
    sourceId: "src-aktuelt-futurebuilt",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-nullutslippsomraade",
    title: "Nyhavna som nullutslippsområde",
    kind: "vision",
    status: "vision",
    themes: ["nyhavna"],
    text: "Nyhavna skal være et nullutslippsområde. Nyhavna Utvikling forklarer det som at målinger, når området står ferdig, skal vise at utbyggingen totalt sett ikke har økt belastningen på byens eksisterende energiforsyning. Selskapet tar beslutninger ut fra et livsløpsperspektiv på 50 år, fram til 2075.",
    keywords: ["nullutslipp", "nullutslippsbydel", "energi", "klima", "bærekraft", "utslipp", "miljø", "50 år", "2075"],
    sourceId: "src-baerekraft",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-mobilitet-tiltak",
    title: "Mobilitetstiltakene i bydelen",
    kind: "mobility",
    status: "planned",
    themes: ["transport"],
    text: "Nyhavna skal tilrettelegges for mennesker og ikke personbiltrafikk, og området ligger i kort sykkel- og gåavstand fra Solsiden og Midtbyen. Blant tiltakene er gang- og sykkelbru fra Solsiden, utbedring av undergangen ved Pirbrua, en sykkelekspressvei og en ordning for bildeling.",
    keywords: ["sykkel", "gange", "bildeling", "sykkelekspressvei", "pirbrua", "solsiden", "bil", "bilfri", "kollektiv"],
    sourceId: "src-baerekraft",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-energisentral",
    title: "Energisentral med sjøvarme og geoterm",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna"],
    text: "Nyhavna Utvikling, Bane NOR og Trondheim havn har inngått intensjonsavtale med Statkraft Varme om en energisentral på Nyhavna. Sjøvannsvarmepumper henter vann fra 100 meters dyp. Overskuddsvarme er planlagt lagret i opp mot 500 brønner som er 200 til 300 meter dype, der fjellet fungerer som et varmebatteri.",
    keywords: ["energi", "fjernvarme", "sjøvann", "varmepumpe", "statkraft", "geoterm", "oppvarming", "brønner", "varmebatteri"],
    sourceId: "src-aktuelt-energi",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-miljoforum",
    title: "Nyhavna Miljøforum",
    kind: "organisation",
    status: "existing",
    themes: ["nyhavna"],
    text: "Nyhavna Utvikling, Dora Eiendom, Bane NOR Eiendom, Trondheim Havn og Lunera Energi har signert en samarbeidsavtale som etablerer Nyhavna Miljøforum. Forumet er en felles arena for samarbeid, kunnskapsdeling og utvikling innen miljø og klima.",
    keywords: ["miljøforum", "samarbeid", "grunneiere", "klima", "miljø", "dora eiendom", "bane nor", "lunera"],
    sourceId: "src-aktuelt-miljoforum",
    relatedEntityIds: ["nyhavna"],
    conflicts: [
      "Saken oppgir signeringsdatoen som torsdag 4. juni uten årstall. Året er derfor ikke gjengitt her.",
    ],
  },
  {
    id: "site-jobbe-havteknologi",
    title: "Havteknologi og næringslokaler",
    kind: "status",
    status: "existing",
    themes: ["nyhavna", "hverdagsliv", "mat-drikke"],
    text: "Havteknologi er et viktig satsingsområde på Nyhavna. I det ytre havnebassenget og dokken i Dora 2 testes løsninger både på og under vann, og teknologien herfra brukes verden over. I områdene med mye folk ønsker Nyhavna Utvikling næringslokaler på bakkeplan med servering, små butikker, frisører og gallerier.",
    keywords: ["havteknologi", "jobb", "næring", "teknologi", "dora 2", "dokk", "arbeidsplasser", "butikker", "servering", "bakkeplan"],
    sourceId: "src-jobbe",
    relatedEntityIds: ["dora-2", "nyhavna"],
    mapPoiIds: ["leve-dora2"],
  },
  {
    id: "site-studenthus",
    title: "Studentsenter i Skippergata 13",
    kind: "plan",
    status: "planned",
    themes: ["nyhavna", "trening-aktivitet"],
    text: "Studentorganisasjonene Njord, Vortex og NTNUI etablerer et studentsenter i Skippergata 13, der Nyhavna Utvikling stiller lagerbygget gratis til disposisjon. Målet er et døgnåpent senter med verksted, sosiale soner og kontorplasser, og NTNUI skal ha lager for vannsportutstyr.",
    keywords: ["studenthus", "studentsenter", "njord", "vortex", "ntnui", "skippergata", "verksted", "studenter"],
    sourceId: "src-aktuelt-studenthus",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-arrangementskalender",
    title: "Arrangementskalenderen",
    kind: "faq",
    status: "existing",
    themes: ["opplevelser", "leve-kultur"],
    text: "Nyhavna publiserer en kalender over arrangementer i bydelen under Hva skjer. Kalenderen viser konserter, festivaler, teater og galleriåpninger, og mange av arrangementene holdes i Strandveien 104.",
    keywords: ["hva skjer", "arrangementer", "kalender", "konsert", "festival", "teater", "program", "strandveien 104"],
    sourceId: "src-hva-skjer",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-arrangementsstotte",
    title: "Støtte til arrangement",
    kind: "faq",
    status: "existing",
    themes: ["opplevelser", "nyhavna"],
    text: "Nyhavna Utvikling tilbyr støtte til arrangement som skaper aktivitet, fellesskap og engasjement på Nyhavna i 2026. Det kan søkes om inntil 10 000 kroner, men maks 50 prosent av arrangementkostnadene. Søknader behandles fortløpende med 1 til 2 ukers behandlingstid.",
    keywords: ["støtte", "søknad", "arrangement", "tilskudd", "10000", "kriterier", "arrangere"],
    sourceId: "src-aktuelt-arrangementsstotte",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-havet-arena",
    title: "Havet Arena og kajakkutleien",
    kind: "culture",
    status: "existing",
    themes: ["trening-aktivitet", "opplevelser", "natur-friluftsliv", "mat-drikke"],
    text: "Havet Arena i Strandveien 104 har sju badstuer på vannet og en av verdens største badstuer på land, i tillegg til bar og konsertlokale. Nyhavna omtaler stedet som bydelens eget kulturhus. Like ved har Trondheim Kajakk selvbetjent utleie av SUP-brett, singlekajakk, dobbelkajakk og havkajakk.",
    keywords: ["havet", "badstu", "bading", "sauna", "konsert", "bar", "kulturhus", "strandveien 104", "kajakk", "sup"],
    sourceId: "src-hva-skjer-aktiviteter",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-trening-paa-nyhavna",
    title: "Trening og kampsport på Nyhavna",
    kind: "everyday",
    status: "existing",
    themes: ["trening-aktivitet"],
    text: "CrossFit Trondheim i Kobbes gate 10 på Dora er Norges eldste CrossFit-senter. Evolve Academy i Båtmannsgata 4 tilbyr MMA, brasiliansk jiu-jitsu, boksing, kickboksing og Muay Thai, i tillegg til yoga og gym. Trondheim Kickboksingklubb holder til i tredje etasje i samme bygg, og Flamenco Trondheim har dansestudio der.",
    keywords: ["crossfit", "trening", "gym", "kampsport", "mma", "boksing", "kickboksing", "yoga", "flamenco", "dans", "båtmannsgata"],
    sourceId: "src-hva-skjer-aktiviteter",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-verksted-og-gjenbruk",
    title: "Verksted, galleri og gjenbruk",
    kind: "everyday",
    status: "existing",
    themes: ["hverdagsliv", "opplevelser", "leve-kultur"],
    text: "BuildHer er et ikke-kommersielt snekkerverksted med kurs og åpen kveld på onsdager, ledet av kvinner. Atelier Dora i Skippergata 11 viser billedkunst fra åtte lokale kunstnere, med åpent hverdager 10 til 14. Gjenbruksbutikken BrukOm i Styrmannsgata 6 drives av Trondheim Renholdsverk og tar inn alt bortsett fra klær.",
    keywords: ["buildher", "snekkerverksted", "atelier dora", "galleri", "brukom", "gjenbruk", "bruktbutikk", "kurs", "handle", "styrmannsgata"],
    sourceId: "src-hva-skjer-aktiviteter",
    relatedEntityIds: ["kulturaksen-skippergata", "nyhavna"],
  },
  {
    id: "site-barnetilbud",
    title: "Barnetilbudet på Nyhavna i dag",
    kind: "everyday",
    status: "existing",
    themes: ["barn-oppvekst", "trening-aktivitet"],
    text: "Aktiv barnehage i Båtmannsgata 4 er en gratis åpen barnehage for barn mellom 0 og 6 år i følge med en voksen, åpen alle ukedager unntatt onsdag. I samme bygg har Nidaros Turn Trondheims største turnhall på 2 000 kvadratmeter med rundt 800 medlemmer, og Nidaros Bokseklubb holder til i tredje etasje.",
    keywords: ["åpen barnehage", "barnehage", "barn", "gratis", "turn", "turnhall", "nidaros turn", "boksing", "båtmannsgata", "familie"],
    sourceId: "src-hva-skjer-for-barna",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-fire-barnehager",
    title: "Fire nye barnehager",
    kind: "plan",
    status: "planned",
    themes: ["barn-oppvekst"],
    text: "Fire nye barnehager er planlagt på Nyhavna. Den første kommer i byggetrinn én av Transittkaia med fem avdelinger og store uteområder, og tre andre er planlagt på Kullkranpiren, Strandveikaia og Ladehammerkaia.",
    keywords: ["barnehage", "fire barnehager", "barn", "byggetrinn", "transittkaia", "oppvekst", "skole", "avdelinger"],
    sourceId: "src-hva-skjer-for-barna",
    relatedEntityIds: ["kullkranpiren", "strandveikaia-cultural-area", "ladehammerkaia-allmenninger"],
    conflicts: [
      "I alternativ 4 for Transittkaia er barnehagen flyttet fra første til siste byggetrinn. Nettstedet avklarer ikke hvilket alternativ som gjelder.",
    ],
  },
  {
    id: "site-bussholdeplasser",
    title: "Slik kommer du til Nyhavna",
    kind: "mobility",
    status: "existing",
    themes: ["transport", "barn-oppvekst"],
    text: "Du kan komme til Nyhavna via gangveiene fra Lade, Solsiden eller Brattøra. Det går busser hit, og du kan gå av på stoppene Losgata eller Dora, eller litt lenger unna i Innherredsveien.",
    keywords: ["buss", "holdeplass", "losgata", "dora", "innherredsveien", "gangvei", "lade", "brattøra", "komme seg dit"],
    sourceId: "src-hva-skjer-for-barna",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-naerom",
    title: "Gjenvinningsstasjonen NærOm",
    kind: "everyday",
    status: "existing",
    themes: ["hverdagsliv", "transport"],
    text: "NærOm Lademoen rett ved Havet Arena er en gjenvinningsstasjon for gående og syklende, drevet av Trondheim kommune og Trondheim Renholdsverk. Mindre mengder husholdningsavfall leveres gratis, sortert og i gjennomsiktige sekker. Åpent mandag 12 til 17, onsdag 12 til 19 og fredag 07 til 12. Pilotprosjektet varer til desember 2026.",
    keywords: ["nærom", "gjenvinning", "avfall", "søppel", "resirkulering", "lademoen", "gratis", "åpningstider", "pilot"],
    sourceId: "src-aktuelt-naerom",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-floridakysten",
    title: "Fra strandliv til industri",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser", "natur-friluftsliv"],
    text: "Der Strandveien går i dag, lå det for rundt 150 år siden en lang, hvit sandstrand kalt Floridakysten, der trondhjemmere badet i Lademofjæra. Byggingen av Strandveien kai startet i 1906 og regnes som startskuddet for Nyhavna. I 1924 åpnet et moderne anlegg for kull og koks på det vi i dag kjenner som Kullkranpiren.",
    keywords: ["floridakysten", "lademofjæra", "sandstrand", "historie", "bading", "1906", "1924", "kullkranpiren", "krane", "industri"],
    sourceId: "src-historien",
    relatedEntityIds: ["kullkranpiren", "nyhavna"],
  },
  {
    id: "site-marinewerft",
    title: "Marinewerft Drontheim",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Okkupasjonsmakten begynte å bygge ubåtbunkeren Dora 1 i 1941, og bunkeren sto ferdig i 1943. Målet var Nord-Europas største ubåtverft, Marinewerft Drontheim. Navnet Dora er tatt fra det tyske navnet på Trondheim, Drontheim.",
    keywords: ["dora", "marinewerft", "ubåt", "krigen", "1941", "drontheim", "okkupasjon", "hvorfor heter det dora"],
    sourceId: "src-historien",
    relatedEntityIds: ["nyhavna"],
    conflicts: [
      "Historien-siden omtaler krigsårene både som 1941 til 1945 i punktlisten og 1940 til 1945 i avsnittsoverskriften.",
    ],
  },
  {
    id: "site-bombeangrepet-1943",
    title: "Bombeangrepet i 1943",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "41 amerikanske bombefly angrep Nyhavna 24. juli 1943 for å utslette ubåthavnen. Dora 1 kom fra angrepet omtrent uten en skramme, mens flere bygg og nabolag der vanlige folk bodde ble hardt rammet. Åtte sivile nordmenn mistet livet.",
    keywords: ["bombing", "1943", "bombefly", "angrep", "krigen", "dora 1", "historie", "sivile"],
    sourceId: "src-historien",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-dora-bunkerne",
    title: "De to ubåtbunkerne",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Dora 1 i Kobbes gate 6 har 3,5 meter tykke betongvegger og 4 meter tykt tak, er 153 meter lang og har vært i privat eie siden 1962. Bunkeren rommer i dag arkiver, bibliotek og private leietakere. Dora 2 i Transittgata 15 ble påbegynt i 1942, aldri ferdigstilt, og eies i dag av Trondheim Havn.",
    keywords: ["dora 1", "dora 2", "ubåtbunker", "kobbes gate", "transittgata", "arkiv", "bibliotek", "betong", "1942", "trondheim havn"],
    sourceId: "src-historien",
    relatedEntityIds: ["dora-2", "nyhavna"],
    mapPoiIds: ["leve-dora2"],
    conflicts: [
      "Samme side oppgir byggestart for Dora 2 både som 1943 i brødteksten og 1942 i bygningsoversikten.",
    ],
  },
  {
    id: "site-fyringsbunkeren-historie",
    title: "Fyringsbunkeren ble aldri tatt i bruk",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Fyringsbunkeren i Skippergata 10 skulle levere varme og strøm til de to ubåtbunkerne. Den sto ferdig i mai 1945 og ble aldri tatt i bruk fordi krigen sluttet først. Bygget brukes i dag til utleie samt kultur- og idrettsformål.",
    keywords: ["fyringsbunkeren", "skippergata", "1945", "aldri i bruk", "varme", "kultur", "idrett", "historie"],
    sourceId: "src-historien",
    relatedEntityIds: ["fyringsbunkeren"],
    mapPoiIds: ["leve-fyringsbunkeren"],
  },
  {
    id: "site-strandveikaia-bygningsrekka",
    title: "Bygningsrekka på Strandveikaia",
    kind: "history",
    status: "existing",
    themes: ["leve-kultur", "opplevelser"],
    text: "Langs Strandveikaia står en rekke bygg fra krigen: Kullbingen i Strandveien 94, Fyrhuset i Strandveien 96, Verftskjøkkenet og Kjelhuset i Strandveien 98 A, Snekkerverkstedet i Strandveien 100 og driftsavdelingen i Strandveien 102. Nyhavna Utvikling eier flere av dem og leier ut til næring, idrett og kulturbedrifter.",
    keywords: ["kullbingen", "fyrhuset", "verftskjøkkenet", "kjelhuset", "snekkerverkstedet", "strandveien", "kulturminner", "bygg"],
    sourceId: "src-historien",
    relatedEntityIds: ["strandveikaia-cultural-area"],
    conflicts: [
      "Historien-siden oppgir adressen Strandveien 98 A for både Verftskjøkkenet og Kjelhuset. Hvilket bygg som har hvilken inngang, framgår ikke.",
    ],
  },
  {
    id: "site-svartlamoen",
    title: "Svartlamoen",
    kind: "history",
    status: "existing",
    themes: ["nyhavna", "opplevelser"],
    text: "Boligområdet Svartlamoen fikk navnet sitt av den svarte røyken fra industrien ved siden av. Kommunen vedtok å beskytte området etter kamp fra lokale patrioter og Riksantikvaren. I 2001 fikk Svartlamoen status som Norges første byøkologiske forsøksområde.",
    keywords: ["svartlamoen", "byøkologisk", "2001", "nabolag", "riksantikvaren", "vernet", "naboer"],
    sourceId: "src-historien",
    relatedEntityIds: ["nyhavna"],
  },
  {
    id: "site-elvepromenaden-doraparken",
    title: "Elvepromenaden som sammenhengende park",
    kind: "green",
    status: "planned",
    themes: ["leve-park", "natur-friluftsliv", "barn-oppvekst"],
    text: "Elvepromenaden skal knytte seg sømløst til Doraparken med sine serveringssteder og aktiviteter, og til parken ytterst på Transittkaia hvor barn inviteres til utforsking og lek. Nyhavna beskriver lune soner som gir liv til planter, fugler og fisk.",
    keywords: ["elvepromenaden", "doraparken", "park", "lek", "natur", "fugler", "fisk", "promenade"],
    sourceId: "src-leve-promenaden",
    relatedEntityIds: ["elvepromenaden", "transittparken"],
    mapPoiIds: ["leve-elvepromenaden"],
    conflicts: [
      "Doraparken er bare navngitt på denne siden. Nettstedet oppgir ikke hvor Doraparken ligger eller hvordan den forholder seg til Doratorget.",
    ],
  },
];

const THEME_BONUS = 2;

/**
 * æ, ø og å overlever normaliseringen. De byttes til midlertidige tegn før
 * NFKD, fordi NFKD ellers dekomponerer å til a pluss ring, og ringen ville
 * blitt strippet sammen med de andre diakritiske tegnene.
 */
const GUARD: ReadonlyArray<readonly [string, string]> = [
  ["æ", "\u0001"],
  ["ø", "\u0002"],
  ["å", "\u0003"],
];

function normalize(value: string): string {
  let guarded = value.normalize("NFC").toLocaleLowerCase("nb");
  for (const [letter, token] of GUARD) {
    guarded = guarded.split(letter).join(token);
  }
  let restored = guarded.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  for (const [letter, token] of GUARD) {
    restored = restored.split(token).join(letter);
  }
  return restored
    .replace(/[^a-z0-9æøå]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

interface IndexedEntry {
  entry: SiteKnowledgeEntry;
  order: number;
  title: string;
  text: string;
  keywords: string[];
}

const searchIndex: IndexedEntry[] = entries.map((entry, order) => ({
  entry,
  order,
  title: normalize(entry.title),
  text: normalize(entry.text),
  keywords: entry.keywords.map(normalize),
}));

function scoreToken(candidate: IndexedEntry, token: string): number {
  let score = 0;
  if (candidate.title.includes(token)) score += 3;
  if (candidate.keywords.some((keyword) => keyword === token)) score += 3;
  else if (candidate.keywords.some((keyword) => keyword.includes(token))) score += 2;
  if (candidate.text.includes(token)) score += 1;
  return score;
}

/**
 * Deterministisk nøkkelordsøk. Ingen vektordatabase og ingen nettverkskall.
 * Treff i tittel og nøkkelord veier tyngre enn treff i brødteksten.
 * `themes` filtrerer ikke bort noe, men poster uten tematreff havner under.
 * Returnerer aldri mer enn seks poster.
 */
export function searchSiteKnowledge(
  query: string,
  opts?: { themes?: readonly string[]; limit?: number },
): SiteKnowledgeEntry[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const wantedThemes = opts?.themes ?? [];
  const limit = Math.max(0, Math.min(6, opts?.limit ?? 4));
  if (limit === 0) return [];

  const scored = searchIndex
    .map((candidate) => {
      const base = tokens.reduce((sum, token) => sum + scoreToken(candidate, token), 0);
      const themeHit =
        wantedThemes.length > 0 &&
        candidate.entry.themes.some((theme) => wantedThemes.includes(theme));
      return { candidate, score: base + (themeHit ? THEME_BONUS : 0), themeHit };
    })
    .filter((row) => row.score > 0);

  scored.sort((a, b) => {
    if (a.themeHit !== b.themeHit) return a.themeHit ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.candidate.order - b.candidate.order;
  });

  return scored.slice(0, limit).map((row) => row.candidate.entry);
}

/** Postene for én board-kategori, i deklarasjonsrekkefølge. */
export function siteKnowledgeForTheme(themeId: string, limit = 4): SiteKnowledgeEntry[] {
  if (limit <= 0) return [];
  return entries.filter((entry) => entry.themes.includes(themeId)).slice(0, limit);
}

export const nyhavnaSiteKnowledge: {
  schemaVersion: 1;
  checkedAt: string;
  sources: SiteKnowledgeSource[];
  entries: SiteKnowledgeEntry[];
  coverage: {
    discovered: number;
    reviewed: number;
    incorporated: number;
    excluded: number;
    openGaps: string[];
  };
} = {
  schemaVersion: 1,
  checkedAt: CHECKED_AT,
  sources,
  entries,
  coverage: {
    discovered: 61,
    reviewed: 61,
    incorporated: 34,
    excluded: 23,
    openGaps: [
      "Nettstedet oppgir aldri antall boliger eller leiligheter, bare bruksareal i kvadratmeter for Transittkaia.",
      "PDF-ene under Strategiske dokumenter er ikke lest. Bare sidens egne sammendrag av kommunedelplan, kvalitetsprogram, de fire veiledende programmene, eierstrategi, handlingsplan og etiske retningslinjer er brukt.",
      "Arrangementskalenderen under Hva skjer er tidsavhengig og er ikke tatt inn som enkeltarrangement.",
      "Nettstedet oppgir ingen koordinater eller presis avgrensning for Doratorget, Doraparken, Transittparken, Kullkranparken, Bunkerparken eller det planlagte sjøbadet.",
      "Fire Leve-sider dekkes av lib/demo/nyhavna-leve/knowledge.ts og er bevisst ikke gjentatt her.",
      "Siden /innspill/ har ingen brødtekst i den serverrendrede HTML-en, så et eventuelt skjema der er ikke lest.",
    ],
  },
};
