/**
 * Kategorimaler for Lokalkunnskap (Moat 1).
 *
 * HVA EN MAL ER, OG HVA DEN IKKE ER: den bestemmer hvilke SPØRSMÅL teksten skal
 * svare på — ikke hvordan setningene skal se ut. Skillet er dyrekjøpt. Da vi
 * skrev 158 tekster på Ranheim 2026-08-15 oppsto det en felles setningsmal helt
 * av seg selv: 41 tekster åpnet med «[Kategori] i [Gate] på [Bydel]» og 52 hadde
 * samme «, med + oppramsing»-rytme. Hver tekst var grei alene; lest etter
 * hverandre så de maskinlagde ut, og de måtte språkvaskes i en egen runde. ÉN
 * felles form på tvers av kategorier er altså skadelig. Én mal PER kategori er
 * det motsatte: når en barnehagetekst og en restauranttekst svarer på ulike
 * spørsmål, får de ulik form uten at noen har bestemt formen.
 *
 * MALEN ER OGSÅ EN BESTILLING TIL HENTINGEN. I dag spør vi Gemini generisk
 * «fortell om dette stedet», og får tilbake det en fremmed lurer på. Malen sier
 * hvilke fakta vi faktisk trenger, og for skole og barnehage sier den dessuten
 * at de viktigste ikke skal søkes opp i det hele tatt — de står i et offentlig
 * register (`lib/editorial/udir-register.ts`).
 *
 * MALEN DIKTER ALDRI. Et spørsmål merket `kjerne` betyr «har vi svaret, SKAL det
 * stå» — aldri «finn på et svar». Vi gikk i den fella én gang allerede: et gulv
 * på 80 tegn tvang fram en generisk nytteklausul på nettopp de stedene vi visste
 * minst om. Mangler faktumet, utelates punktet, og teksten blir kortere.
 *
 * Malene gjelder på toppen av `TEKSTREGLER` i `scripts/curate-pois-lib.ts`, som
 * fortsatt er de generelle reglene (presens, beboer-perspektiv, ingen poesi,
 * ingen åpningstider).
 */

import { resolveThemeId } from "@/lib/themes";

/** Hvor svaret på et spørsmål kommer fra. Styrer hva vi ber Gemini om. */
export type FaktaKilde =
  /** Offentlig register. Autoritativt, gratis, oppdateres løpende. Aldri søk etter dette. */
  | "register"
  /** Data vi selv eier og kan regne ut, f.eks. skolekrets fra kommunens polygoner. */
  | "eget"
  /** Websøk via grounding. Brukes bare til det registrene ikke har. */
  | "søk";

export interface SpecQuestion {
  /** Kort id. Brukes av hygiene-sjekken til å si hvilket punkt som mangler. */
  id: string;
  /** Spørsmålet, formulert fra beboerens side — ikke fra stedets side. */
  spørsmål: string;
  kilde: FaktaKilde;
  /**
   * true = har vi svaret, skal det stå i teksten. Hygiene-jobben flagger bare
   * kjernepunkter som mangler NÅR kilden faktisk har svaret. Et manglende
   * kjernepunkt uten kilde er en korrekt kort tekst, ikke en feil.
   */
  kjerne: boolean;
  /** Registerfeltet svaret ligger i, når kilden er et register. */
  felt?: string;
  /**
   * Hvilket LAG svaret hører hjemme i. Utelatt betyr `tekst`.
   *
   * `tekst`  — inn i POI-teksten. Teksten ligger på POI-raden og DELES av alle
   *            boards, så den må være sann for enhver adresse i nærheten.
   * `board`  — kan ikke stå i teksten, fordi svaret avhenger av hvilken adresse
   *            man ser på. Skolekrets er det opplagte tilfellet: «denne adressen
   *            sogner hit» er riktig for én bolig og feil for naboen. Slike
   *            fakta må boardet regne ut og vise selv.
   *
   * Skillet ble oppdaget 2026-08-16 da Andreas spurte hvorfor et godt eksempel
   * bare svarte på noen av spørsmålene: krets sto som kjernespørsmål i
   * tekstmalen, men KAN ikke besvares der. Vi har bevis for at teksten deles —
   * 51 tekster skrevet for Grilstad dukket uendret opp på Martin Barstads veg.
   *
   * RENDER-FLATEN kom 2026-08-22: board-lag-spørsmålene vises som FAQ i
   * kategoriens drill-in, ett spørsmål per rad, med `spørsmål` gjengitt ORDRETT
   * som overskrift. Derfor er de formulert fra boligkjøperens side («Hvilken
   * skolekrets sogner boligen til?»), ikke fra stedets, og de bærer ingen
   * begrunnelse inni seg — den hører hjemme i kommentarene her. En test holder
   * dem korte nok til å stå som overskrift.
   */
  lag?: "tekst" | "board";
}

export interface CategorySpec {
  /** `category_id`-verdiene malen gjelder for. */
  kategorier: string[];
  /** Menneskelig navn, brukt i logg og i staging-fila. */
  navn: string;
  /**
   * Antall POI-er i kategorien, talt i v2 2026-08-16. Sier hvor mye malen er
   * verdt — og står her, ikke bare i oversiktssiden, så rekkefølgen på arbeidet
   * kan begrunnes fra data i stedet for fra magefølelse.
   */
  antall: number;
  /** Hva første setning skal bære. Det leseren filtrerer på først. */
  lead: string;
  spørsmål: SpecQuestion[];
  /**
   * Når er TOM tekst riktig svar?
   *
   * Obligatorisk, fordi spørsmålet ellers aldri blir stilt. De generelle
   * TEKSTREGLER sier at et sted uten data får «én kort, ærlig funksjonslinje
   * bygd på navn, kategori og adresse» — men for noen kategorier er den linja
   * ren gjentakelse av det skjermen alt viser, og da er tomt bedre enn kort.
   * Hver mal må ta stilling.
   */
  naarTom: string;
  /** Kategorispesifikke forbud, i tillegg til de generelle TEKSTREGLER. */
  aldri: string[];
  /**
   * Ett ekte eksempel som svarer på malen, og ett som ikke gjør det.
   *
   * `sted` er obligatorisk og skal navngi ÉN faktisk POI — gjerne med hvor
   * teksten kom fra. Uten navn er en tekstprøve en påstand om hvordan noe burde
   * høres ut; med navn er den etterprøvbar, og man kan slå opp stedet og se om
   * den stemmer. Regelen kom av en ekte feil: det første dagligvare-eksempelet
   * blandet parkeringskjelleren til Extra Grilstad med pakkeutleveringen til
   * Rema 1000 Charlottenlund, og ingen kunne se det fordi prøven var anonym.
   */
  eksempel: {
    /**
     * `svarer` er id-ene prøven faktisk besvarer. Den skal IKKE dekke alle
     * spørsmålene, og det er poenget: et godt eksempel viser like mye hva man
     * lar være å skrive. Andreas spurte 2026-08-16 hvorfor restaurant-prøven
     * bare svarte på noen av seks, og svaret er at de andre ikke hadde svar for
     * akkurat det stedet. Feltet gjør det synlig i stedet for å se ut som et
     * hull.
     *
     * Kravet er bare dette: alle KJERNE-spørsmål i tekstlaget skal være med.
     * Testen håndhever det.
     */
    god: { sted: string; tekst: string; svarer: string[] };
    dårlig: { sted: string; tekst: string; hvorfor: string };
  };
}

/**
 * SKOLE
 *
 * Bakgrunn: vi slo opp Ranheim skole i tre kilder samtidig 2026-08-16. Google AI
 * skrev «offentlig barneskole på østsiden av Trondheim … ligger flott til helt
 * nede ved sjøen». Vår egen Gemini-grounding skrev nesten det samme, fra samme
 * kilder. NSR hadde 486 elever og 1.–7. trinn. Ingen av de to tekstene nevnte
 * noen av delene. En forelder som vurderer å kjøpe vet allerede at skolen ligger
 * på østsiden — de står der. De vet ikke om barnet får plass.
 */
export const SKOLE_SPEC: CategorySpec = {
  kategorier: ["skole"],
  navn: "Skole",
  antall: 135,
  lead: "Trinn og eierform. Det er filteret en forelder legger på først — er dette i det hele tatt en skole barnet mitt kan gå på?",
  spørsmål: [
    {
      id: "trinn",
      spørsmål: "Hvilke trinn tar skolen imot?",
      kilde: "register",
      kjerne: true,
      felt: "SkoletrinnGSFra–SkoletrinnGSTil",
    },
    {
      id: "eierform",
      spørsmål: "Er den kommunal eller privat?",
      kilde: "register",
      kjerne: true,
      felt: "ErOffentligSkole",
    },
    {
      id: "elevtall",
      spørsmål: "Hvor stor er den?",
      kilde: "register",
      kjerne: true,
      felt: "Elevtall",
    },
    // Vårt sterkeste kort, og det eneste spørsmålet i hele malverket som en
    // megler får på hver eneste visning. Det hører hjemme på boardet og ikke i
    // teksten, siden svaret er ulikt fra bolig til bolig — se `lag`.
    {
      id: "krets",
      spørsmål: "Hvilken skolekrets sogner boligen til?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "data/geo/trondheim/barneskolekrets.json",
    },
    // Videregående har INGEN kretstilhørighet: inntaket er fylkeskommunalt og
    // karakterbasert. Spørsmålet må derfor stilles om nærhet og reisetid, aldri
    // om sogning — ellers lover boardet en plass ingen kan love.
    {
      id: "vgs-naerhet",
      spørsmål: "Hvor er nærmeste videregående, og hvor lang tid tar bussen?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "NSR ErVideregaaendeSkole + Entur journey-planner",
    },
    {
      id: "sfo",
      spørsmål: "Finnes det SFO?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "profil",
      spørsmål:
        "Har skolen en profil som skiller den fra en vanlig kommunal skole — steiner, montessori, internasjonal, idrett?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "maalform",
      spørsmål: "Er hovedmålet nynorsk?",
      kilde: "register",
      kjerne: false,
      felt: "Maalform",
    },
    {
      id: "anlegg",
      spørsmål:
        "Deler skolen konkrete anlegg med nabolaget — idrettshall, bane, svømmehall, bibliotek?",
      kilde: "søk",
      kjerne: false,
    },
  ],
  naarTom:
    "Så godt som aldri. Er skolen aktiv i registeret, har vi trinn, elevtall og eierform, og det holder til en tekst. Er den ikke aktiv, hører den ikke hjemme på boardet i det hele tatt.",
  aldri: [
    "Aldri vurder kvaliteten. «Flott beliggenhet», «godt læringsmiljø» og «populær skole» er meninger, og de sto i begge maskintekstene vi sammenlignet.",
    "Aldri karakterer, nasjonale prøver, rangeringer eller poengsummer. Vi har allerede forkastet score-primitivet som produktgrep, og på skole er det dessuten en påstand vi ikke kan stå inne for.",
    "Aldri byggeår eller skolehistorie. Registeret oppgir DatoFoedt — den skal ikke inn i teksten.",
    "Aldri målform når den er bokmål. Bokmål i Trondheim er ikke informasjon; nynorsk er.",
    "Aldri skriv kretsen inn i teksten. Ikke fordi den er uviktig — den er vårt sterkeste kort — men fordi teksten deles av alle boards, og «denne adressen sogner hit» blir feil for hver eneste andre bolig. Kretsen er boardets jobb.",
  ],
  eksempel: {
    god: {
      sted: "Ranheim skole",
      svarer: ["trinn", "eierform", "elevtall", "anlegg"],
      tekst:
        "Kommunal barneskole for 1.–7. trinn med 486 elever, i Ernst Larsens veg. Skolen deler anlegg med Ranheim idrettspark, og Ladestien går forbi.",
    },
    dårlig: {
      sted: "Ranheim skole, slik Google AI skrev den",
      tekst:
        "Ranheim skole er en offentlig barneskole på østsiden av Trondheim. Skolen ligger flott til helt nede ved sjøen og Ladestien, og den er tett knyttet til Ranheim idrettsanlegg.",
      hvorfor:
        "Samme skole som over. Teksten er velskrevet og svarer på null av de fire kjernespørsmålene: ikke trinn, ikke elevtall, ikke krets, og «offentlig» drukner i en stedsbeskrivelse. «Ligger flott til» er en vurdering. «På østsiden av Trondheim» forteller en boligkjøper som står i gata ingenting.",
    },
  },
};

/**
 * BARNEHAGE
 *
 * Bakgrunn: vi sammenlignet fem publiserte Ranheim-tekster mot NBR 2026-08-16.
 * Ingen av de fem oppga antall barn eller aldersgruppe. Registeret hadde begge
 * deler på alle fem. Det vi HADDE skrevet var «rundt 360 kvadratmeter
 * innendørs oppholdsareal» (Sjøskogbekken, som har 80 barn 0–5 år), «egen
 * grillhytte» (Grilstad FUS, 89 barn 0–5 år) og «et amfi med takoverbygg formet
 * som et sjøskjell» (Ranheimsfjæra, 98 barn 1–5 år). Alle tre er sanne. Ingen av
 * dem er det en forelder leter etter.
 *
 * KJEDE MÅ SØKES OPP — undersøkt og avklart 2026-08-16, så ingen trenger å gjøre
 * det om igjen. «Privat» er en for grov opplysning: en frittstående barnehage og
 * en FUS-barnehage er to ulike ting for en forelder som kjenner kjeden fra en
 * annen by. Men kjeden står ikke i noe register vi kan spørre. I NBR er både
 * Grilstad FUS og Sjøskogbekken FUS oppført med seg selv som eierstruktur, og i
 * Enhetsregisteret har begge orgnr uten registrert morselskap — kjeden eier dem
 * gjennom aksjer, og aksjonærforhold ligger ikke i `overordnetEnhet`. Derfor er
 * `kjede` det ene spørsmålet her som er kildet på websøk.
 */
export const BARNEHAGE_SPEC: CategorySpec = {
  kategorier: ["barnehage"],
  navn: "Barnehage",
  antall: 265,
  lead: "Aldersgruppe og eierform. En forelder med ettåring og en med fireåring leter etter to forskjellige ting.",
  spørsmål: [
    {
      id: "alder",
      spørsmål: "Hvilke aldre tar den imot?",
      kilde: "register",
      kjerne: true,
      felt: "AlderstrinnFra–AlderstrinnTil",
    },
    {
      id: "eierform",
      spørsmål: "Er den kommunal eller privat?",
      kilde: "register",
      kjerne: true,
      felt: "ErOffentligBarnehage",
    },
    {
      id: "kjede",
      spørsmål:
        "Er den del av en kjede — FUS, Læringsverkstedet, Espira, Norlandia? Står den, hører den rett etter eierformen, for «privat» alene sier en forelder nesten ingenting.",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "antall-barn",
      spørsmål: "Hvor mange barn har den?",
      kilde: "register",
      kjerne: true,
      felt: "AntallBarn",
    },
    {
      id: "profil",
      spørsmål:
        "Har den en profil som faktisk styrer hverdagen — friluft, gård, steiner, montessori, mat laget på stedet?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "uteomraade",
      spørsmål: "Hva finnes fysisk på uteområdet, og hva ligger rett utenfor porten?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "opptak",
      spørsmål: "Er det løpende opptak eller lang venteliste?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "ansatte",
      spørsmål: "Hvor mange ansatte?",
      kilde: "register",
      kjerne: false,
      felt: "AnsatteFra",
    },
    // Board-laget: den ene barnehagen kan teksten fortelle om, men «hvor mange
    // har vi å velge mellom herfra» kan bare regnes ut fra adressen. Det er
    // også spørsmålet en forelder uten plass faktisk stiller — én barnehage i
    // gangavstand er en helt annen situasjon enn fem.
    {
      id: "barnehage-dekning",
      spørsmål: "Hvor mange barnehager ligger i gangavstand?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "project_pois.travel_times.walk",
    },
  ],
  naarTom:
    "Så godt som aldri, av samme grunn som for skole: registeret har antall barn, alder og eierform på hver aktive barnehage.",
  aldri: [
    "Aldri kvadratmeter i stedet for antall barn og alder. Arealet er et ekte tall, men det fortrengte de to opplysningene som betyr noe — det skjedde på Sjøskogbekken.",
    "Aldri barnehagens egne verdiord. «Trygg og god», «vi ser hele barnet» og «anerkjennende voksne» står på alle nettsider og skiller ingen barnehager fra hverandre.",
    "Aldri bemanning presentert som kvalitet. Antall ansatte er et tall, ikke et kvalitetsstempel, og «bemanning i tråd med pedagognormen» betyr bare at loven følges.",
    "Aldri anta at aldersgruppen er 1–3 eller 3–5. Registeret oppgir den eksakt, og vi bommet allerede én gang: Stokkbekken står som 1–2 år, vi skrev «mellom ett og tre år».",
    "Aldri beskriv hva kjeden generelt står for. Å navngi kjeden er et faktum om dette huset; «FUS har fokus på glede og undring» er lånt markedsføring — samme feil som da vi skrev at Europris har «bredt utvalg av husholdningsartikler».",
  ],
  eksempel: {
    god: {
      sted: "Sjøskogbekken FUS barnehage",
      svarer: ["alder", "eierform", "kjede", "antall-barn", "uteomraade"],
      tekst:
        "FUS-barnehage for barn fra null til fem år, med 80 plasser, i Ranheimsvegen. Nærmeste nabo er sjøen og Ladestien.",
    },
    dårlig: {
      sted: "Sjøskogbekken FUS barnehage, vår egen publiserte tekst",
      tekst:
        "Privat barnehage på Ranheim med rundt 360 kvadratmeter innendørs oppholdsareal og bemanning i tråd med pedagognormen.",
      hvorfor:
        "Samme barnehage som over. Begge opplysningene er riktige og begge er ubrukelige: arealet sier ingenting uten et sammenligningsgrunnlag, og pedagognormen er lovpålagt for alle. De 80 plassene og aldersspennet 0–5 sto i registeret hele tiden — og at det er en FUS-barnehage, som er det en forelder gjenkjenner, står ikke engang i teksten selv om det står i navnet.",
    },
  },
};

/**
 * DAGLIGVARE
 *
 * INGEN REGISTER HER — undersøkt 2026-08-16. Skole og barnehage var uvanlig
 * heldige: begge har et nasjonalt register med akkurat de faktaene malen spør
 * om. Dagligvare har ingenting tilsvarende. Brings hentepunkt-API krever nøkkel
 * (401), og det finnes ingen åpen kjede- eller butikkregister. Alt her er derfor
 * websøk pluss det vi allerede eier.
 *
 * PROBLEMET MALEN LØSER: sju av våre åtte publiserte dagligvaretekster åpner med
 * ordet «Dagligvarebutikk». Modalen viser allerede navnet («Kiwi Humlehaugen»)
 * og kategorien, og boardet regner ut gangavstanden selv. Første setning gikk
 * altså med til å gjenta det skjermen sto og viste. «Rema 1000 Ranheimsfjæra»
 * fikk teksten «Dagligvarebutikk i Ranheimsfjæra på Ranheim» — null ny
 * informasjon i en hel setning.
 *
 * Det som faktisk skilte de gode tekstene fra de tomme var ÆREND: post i butikk,
 * pakkeboks, medisinutsalg, Too Good To Go, parkering i kjelleren. To Rema-er en
 * kilometer fra hverandre er like som butikker og ulike som ærend.
 */
export const DAGLIGVARE_SPEC: CategorySpec = {
  kategorier: ["supermarket"],
  navn: "Dagligvare",
  antall: 118,
  lead: "Hvilket ærend du kan gjøre her utover å handle mat. Kjeden står i navnet og gangavstanden regner boardet ut — teksten skal begynne der skjermen slutter.",
  spørsmål: [
    {
      id: "tjenester",
      spørsmål:
        "Hvilke ærend kan du gjøre her i tillegg til å handle — post i butikk, pakkeutlevering, medisinutsalg, tipping?",
      kilde: "søk",
      kjerne: true,
    },
    {
      id: "bygg",
      spørsmål:
        "Ligger butikken inne i noe større — et senter, en boligblokk, en bensinstasjon?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "parkering",
      spørsmål: "Finnes det parkering, og hvor er den — kjeller, tak, bakkeplan?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "lading",
      spørsmål: "Står det ladepunkter for elbil på parkeringen? Bare at de finnes, aldri hvor mange.",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "saerpreg",
      spørsmål:
        "Har butikken et reelt særpreg — ferskvaredisk, lokalmat, økologisk profil, Too Good To Go?",
      kilde: "søk",
      kjerne: false,
    },
    // Board-laget. `aldri`-lista under forbyr gangavstand i TEKSTEN nettopp
    // fordi den er adresseavhengig — her er den adressen, og da er tallet det
    // eneste som betyr noe. Én butikk med minutter slår fem butikknavn.
    {
      id: "hverdagshandel",
      spørsmål: "Hvor gjør jeg hverdagshandelen?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "project_pois.travel_times.walk",
    },
  ],
  naarTom:
    "Ofte, og det er riktig. Har butikken verken ærend, særpreg eller en bygning verdt å nevne, er tom tekst det ærlige svaret — navnet sier alt kategorien kan si. Dette OVERSTYRER den generelle regelen om at et sted uten data får en kort funksjonslinje: for dagligvare er den linja ren gjentakelse.",
  aldri: [
    "Aldri åpne med «Dagligvarebutikk». Modalen viser navn og kategori fra før, og sju av åtte tekster brukte hele første setning på å si det om igjen.",
    "Aldri gjenta kjedenavnet fra tittelen med mindre det bærer ny informasjon. «Kiwi Humlehaugen er en Kiwi-butikk» er ikke en setning.",
    "Aldri gangavstand eller reisetid. Boardet regner det ut per adresse, og et tall i teksten blir feil for alle andre adresser enn den ene.",
    "Aldri antall ladepunkter. Ladestasjonen er et eget POI med sitt eget tall, og de to vil sprike — vi hadde allerede Kiwi Humlehaugen stående med både seks og åtte.",
    "Aldri utvalg eller sortiment i generelle vendinger. «Variert utvalg for hverdag og helg» og «medlemskupp for Coop-medlemmer» er kjedens markedsføring, ikke fakta om dette huset.",
    "Aldri navngi transportøren bak pakkeutlevering. Skriv «pakkeutlevering», ikke «via Helthjem» — butikken tar som regel imot fra flere (Posten, Bring, PostNord, Helthjem), og avtalene skifter. Dette er ikke i strid med «navngi, aldri generaliser»: den regelen gjelder STEDER, og her er stedet butikken. Transportøren er en leverandør bak en tjeneste, og leseren skal vite at hun kan hente en pakke, ikke hvem som kjørte den.",
  ],
  eksempel: {
    god: {
      sted: "Extra Grilstad",
      svarer: ["tjenester", "parkering", "bygg"],
      tekst:
        "Post i butikk, og parkering i kjelleren under bygget. Butikken ligger i Grilstadporten.",
    },
    dårlig: {
      sted: "Extra Rosenborg, leverandørtekst vi ennå ikke har erstattet",
      tekst:
        "Extra Rosenborg er en dagligvarebutikk som ligger sentralt på Innherredsveien. Den fungerer som et viktig handelspunkt for beboere i nærområdet for daglige innkjøp av mat og husholdningsvarer. Butikken har et variert dagligvareutvalg for både hverdag og helg.",
      hvorfor:
        "Tre setninger, null opplysninger: navnet og kategorien står i tittelen, «sentralt» er en vurdering, «viktig handelspunkt for beboere i nærområdet» beskriver hva en dagligvarebutikk er, og «variert utvalg for hverdag og helg» gjelder samtlige 118 butikker i basen.",
    },
  },
};

/**
 * RESTAURANT
 *
 * SNUR ÉN AV DAGLIGVARE-REGLENE, og det er verdt å forstå hvorfor. Prinsippet er
 * det samme i begge maler: ikke gjenta det skjermen alt viser. Utslaget er
 * motsatt. «Kiwi Humlehaugen» forteller leseren hva slags butikk det er, så der
 * er kategorien i første setning bortkastet. «Chopsticks Horizont» og «Piccoli
 * Fratelli» forteller ingenting om sushi eller pizza, så der ER kjøkkenet den
 * viktigste nye opplysningen. Samme regel, ulikt svar — som er hele grunnen til
 * at malene er per kategori.
 *
 * BEBOER, IKKE ANMELDER. En turist spør om stedet er bra. En som bor i gata spør
 * om hun kan få pizza hjem på en tirsdag. Derfor er henting og levering et
 * kjernespørsmål her, mens kvalitet ikke er et spørsmål i det hele tatt.
 *
 * SMILEFJES ER BEVISST UTELATT. Mattilsynets tilsynsresultater er offentlige, men
 * de hører ikke hjemme her: de er et øyeblikksbilde som endrer seg ved neste
 * tilsyn, og et surt fjes i en boligannonse er både ferskvare og urimelig mot
 * stedet. Det er også et tall-stempel på et sted, altså samme score-tenkning vi
 * alt har forkastet. (Jeg fant heller ikke noe åpent endepunkt som svarte, men
 * det er ikke grunnen — grunnen er redaksjonell.)
 */
export const RESTAURANT_SPEC: CategorySpec = {
  kategorier: ["restaurant"],
  navn: "Restaurant",
  antall: 357,
  lead: "Hva slags mat, og om du kan få den med hjem. Kjøkkenet er nesten aldri i navnet, og det er det første en beboer vil vite.",
  spørsmål: [
    {
      id: "kjokken",
      spørsmål: "Hva slags mat serverer de, konkret? «Sushi og wokretter», ikke «asiatisk».",
      kilde: "søk",
      kjerne: true,
    },
    {
      id: "henting",
      spørsmål: "Kan maten hentes eller leveres hjem? Dette er beboerspørsmålet framfor noe.",
      kilde: "søk",
      kjerne: true,
    },
    {
      id: "barn",
      spørsmål: "Er stedet lagt til rette for barn — barnestoler, lekeområde, egen meny?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "selskap",
      spørsmål: "Kan man ha selskap her — eget lokale, catering, alle rettigheter?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "uteservering",
      spørsmål: "Finnes det uteservering?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "bygg",
      spørsmål:
        "Ligger stedet inne i noe annet — et varehus, et hotell, en gård? Det endrer hva slags besøk det er.",
      kilde: "søk",
      kjerne: false,
    },
    // Board-laget. Beboerspørsmålet er ikke «hvilken restaurant er best», men
    // om man i det hele tatt slipper å dra til byen for å spise ute. Svaret er
    // derfor en BREDDE — hvor mange og hvor spredt — ikke en anbefaling.
    {
      id: "spisesteder",
      spørsmål: "Kan jeg spise ute uten å dra til byen?",
      kilde: "eget",
      kjerne: false,
      lag: "board",
      felt: "project_pois.travel_times.walk",
    },
  ],
  naarTom:
    "Sjelden, men det finnes ett tilfelle: internasjonale kjeder der navnet bærer hele kjøkkenet. «Burger King» trenger ikke teksten «hurtigmatrestaurant med hamburgere». Har kjeden noe ved SEG dette stedet — drive-thru, uteservering, lekerom — skriv det; ellers er tomt riktig.",
  aldri: [
    "Aldri vurder maten eller stedet. «Kjent for sin grillmat», «populær», «koselig» og «god stemning» er meninger. Google-rating og antall anmeldelser vises allerede i modalen — de skal ikke gjentas i prosa.",
    "Aldri smilefjes eller tilsynsresultat. Det er ferskvare som endrer seg ved neste tilsyn, og et tall-stempel på et sted er samme tenkning vi har forkastet ellers.",
    "Aldri åpne med kategorien når navnet alt bærer den. «Burger King er en hurtigmatrestaurant» sier ingenting. Men når navnet IKKE bærer kjøkkenet — og det gjør det sjelden — skal kjøkkenet stå først.",
    "Aldri beskriv nabolokalene eller bygningens andre leietakere. Leverandørteksten om Graffi Grill brukte to setninger på et galleri i andre etasje.",
    "Aldri «serverer et bredt utvalg av retter». Skriv rettene.",
  ],
  eksempel: {
    god: {
      sted: "Chopsticks Horizont",
      svarer: ["kjokken", "henting", "selskap"],
      tekst:
        "Sushi og wokretter, til å spise i lokalet eller ta med. Stedet leverer også catering til private og bedrifter.",
    },
    dårlig: {
      sted: "Graffi Grill Midtbyen, leverandørtekst vi ennå ikke har erstattet",
      tekst:
        "Graffi Grill Midtbyen er en grillrestaurant i sentrum av Trondheim. Stedet er et møtested for servering og sosiale sammenkomster, og er kjent for sin grillmat. Restauranten ligger i Idungården, en forretningsgård som også rommer andre butikker i første etasje og et galleri i andre etasje.",
      hvorfor:
        "«Møtested for servering og sosiale sammenkomster» beskriver enhver restaurant. «Kjent for sin grillmat» er en vurdering utgitt som faktum. Og siste setning handler ikke om restauranten i det hele tatt, men om gårdens andre leietakere. Ingen steder står det hva som faktisk ligger på tallerkenen, eller om du kan hente den.",
    },
  },
};

/**
 * TRANSPORT
 *
 * DEN FØRSTE MALEN SOM ER SKREVET FOR BOARDET, IKKE FOR TEKSTEN. De fire over
 * kom av at POI-tekstene var tynne. Denne kom av det motsatte: for et
 * stoppested er den delte teksten nesten alltid feil sted å svare, og nesten
 * alt en beboer lurer på er adresseavhengig. «Hvor er nærmeste holdeplass» og
 * «hvor lang tid tar det til byen» har ett svar per bolig — de kan ikke stå på
 * POI-raden, som deles av alle boards i nærheten.
 *
 * FERSKVAREN ER GRUNNEN. Linjenumre, destinasjoner og frekvenser endres ved
 * hver ruteomlegging hos AtB. Vår egen leverandørtekst for Grilstadkleiva
 * bussholdeplass ramser opp «Ranheim, Strindheim, sentrum, Tiller, Heimdal og
 * Kattem» — seks destinasjoner som alle kan flyttes til en annen linje til
 * neste sommer, skrevet inn i en tekst ingen kommer til å friske opp.
 * `editorial-hooks-no-perishable-info-20260208` sier det samme prinsipielt:
 * ferskvare hentes ved kjøring, den skrives ikke ned. Derfor ligger linjene i
 * det deterministiske board-laget, hentet fra Entur, med hentetidspunkt.
 *
 * IGJEN TIL TEKSTEN blir da det som ikke flytter seg: hvor stoppet fysisk
 * ligger, om man kan bytte til tog eller sykkel der, og hva som finnes på
 * plattformen. Ofte er svaret ingenting, og da skal teksten være tom —
 * `realtimeAnswersIt` i kurerings-lista sier allerede at sanntidsraden i
 * modalen svarer for disse stedene.
 *
 * 810 POI-er (bus 751, train 28, tram 31) gjør dette til den STØRSTE gruppen i
 * basen. Nettopp derfor er tom tekst det viktigste svaret malen kan gi.
 */
export const TRANSPORT_SPEC: CategorySpec = {
  kategorier: ["bus", "train", "tram"],
  navn: "Transport",
  antall: 810,
  lead: "Hva stoppet er utover et skilt: hvor det ligger, og hva du kan bytte til der. Linjene og tidene regner boardet ut per adresse — de skal ikke stå i teksten.",
  spørsmål: [
    {
      id: "bytte",
      spørsmål:
        "Kan man bytte til noe annet her — tog, trikk, bysykkel, innfartsparkering?",
      kilde: "søk",
      kjerne: true,
    },
    {
      id: "plassering",
      spørsmål:
        "Hvor ligger stoppet fysisk — langs hvilken vei, ved hvilket bygg, på hvilken side?",
      kilde: "søk",
      kjerne: false,
    },
    {
      id: "fasiliteter",
      spørsmål:
        "Finnes leskur, sanntidsskjerm, sykkelparkering eller heis til plattformen?",
      kilde: "søk",
      kjerne: false,
    },
    // ── Board-laget ────────────────────────────────────────────────────────
    {
      id: "naermeste-holdeplass",
      spørsmål: "Hvor er nærmeste holdeplass?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "Entur nearest (stopPlace)",
    },
    {
      id: "linjer",
      spørsmål: "Hvilke linjer går herfra, og hvor går de?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "Entur estimatedCalls per quay",
    },
    {
      id: "til-sentrum",
      spørsmål: "Hvor lang tid tar det til sentrum?",
      kilde: "eget",
      kjerne: true,
      lag: "board",
      felt: "Entur trip",
    },
  ],
  naarTom:
    "Ofte, og oftere enn for noen annen kategori. Har stoppet verken bytte-mulighet, en plassering verdt å nevne eller fasiliteter, er tom tekst det ærlige svaret: sanntidsraden i modalen viser avgangene, og FAQ-en på boardet svarer på linjer og reisetid. En setning om at det er et stoppested for buss er ren gjentakelse av navnet og kategorien.",
  aldri: [
    "Aldri linjenumre, destinasjoner eller frekvenser i teksten. De endres ved hver ruteomlegging, og teksten deles av alle boards — Grilstadkleiva sto med seks destinasjoner ingen kommer til å friske opp. Boardet henter dem fra Entur ved kjøring.",
    "Aldri reisetid til sentrum eller andre steder. Det er ett svar per adresse, ikke ett per holdeplass.",
    "Aldri «viktig knutepunkt for offentlig transport i nærområdet». Det beskriver hvert eneste stoppested som finnes, og sto ordrett i leverandørteksten vår.",
    "Aldri beskriv nabolaget rundt stoppet. Leverandørteksten for Anders Søyseths veg brukte tre av fire kulepunkter på boligblokker, parkering og en idrettspark — alt sammen egne POI-er med egne tekster.",
    "Aldri avgangstider eller «hyppige avganger». Sanntidsraden i modalen viser de faktiske avgangene.",
  ],
  eksempel: {
    god: {
      sted: "Grilstadkleiva bussholdeplass",
      svarer: ["plassering", "bytte"],
      tekst:
        "Ligger langs Ranheimsvegen. Ranheim stasjon og Leangen stasjon er i gangavstand og gir bytte til tog.",
    },
    dårlig: {
      sted: "Grilstadkleiva bussholdeplass, leverandørteksten vi ennå ikke har erstattet",
      tekst:
        "Grilstadkleiva bussholdeplass er et viktig knutepunkt for offentlig transport i Ranheim-området. Den betjenes av mange busslinjer som gir direkte forbindelse til blant annet Ranheim, Strindheim, sentrum, Tiller, Heimdal og Kattem.",
      hvorfor:
        "Samme holdeplass som over. Første setning gjentar navn og kategori og legger til en vurdering («viktig knutepunkt») som gjelder alle 751 bussholdeplassene i basen. Andre setning er ferskvare: seks destinasjoner fordelt på linjer AtB kan legge om til sommeren, skrevet inn i en tekst som deles av alle boards i nærheten og aldri friskes opp. Det ene stabile faktumet — at Ranheim og Leangen stasjon ligger i gangavstand — sto i kildene og kom ikke med.",
    },
  },
};

export const CATEGORY_SPECS: CategorySpec[] = [
  SKOLE_SPEC,
  BARNEHAGE_SPEC,
  DAGLIGVARE_SPEC,
  RESTAURANT_SPEC,
  TRANSPORT_SPEC,
];

/**
 * Resten av topp ti, i den rekkefølgen de skal skrives.
 *
 * Rangeringen er volum × hvor mye kategorien betyr for en boligkjøper × hvor
 * mye malen redder oss fra fyllstoff. Frisør ligger høyt på det siste alene:
 * 254 steder med tynt kildegrunnlag er nettopp der vi ellers dikter.
 *
 * `antall` er talt i v2 2026-08-16 (5 606 POI-er, 150 kategorier i bruk). Står
 * her fordi det er begrunnelsen for rekkefølgen, og fordi lista ellers ser ut
 * som en smaksdom.
 *
 * `kategorier` er de EKTE `category_id`-verdiene, slått opp mot basen. Ikke gjett
 * dem: første utkast av denne lista var gjettet fra de norske navnene, og bommet
 * på seks av åtte — Dagligvare heter `supermarket`, Frisør `haircare`,
 * Treningssenter `gym`, Apotek `pharmacy`. En feil her er stille: malen finnes,
 * men treffer aldri et POI. `scripts/verify-category-ids.ts` sjekker dem.
 */
export interface PlanlagtKategori {
  navn: string;
  kategorier: string[];
  antall: number;
  hvorfor: string;
}

export const PLANLAGTE_KATEGORIER: PlanlagtKategori[] = [
  {
    navn: "Frisør",
    kategorier: ["haircare"],
    antall: 254,
    hvorfor:
      "Tynneste kildegrunnlaget vi har. Malen må her tillate å stoppe etter én setning.",
  },
  {
    navn: "Kafé og bakeri",
    kategorier: ["cafe", "bakery"],
    antall: 268,
    hvorfor: "Én felles mal — de svarer på de samme spørsmålene.",
  },
  {
    navn: "Park, lekeplass og badeplass",
    kategorier: ["park", "lekeplass", "badeplass"],
    antall: 433,
    hvorfor: "Fysiske fakta: benker, grill, toalett, aldersgruppe, underlag.",
  },
  {
    navn: "Idrettsanlegg og treningssenter",
    kategorier: ["idrett", "gym"],
    antall: 339,
    hvorfor: "Hvilken aktivitet, ute eller inne, klubb eller kommersielt, åpent for alle.",
  },
  {
    navn: "Helsetilbud",
    kategorier: ["doctor", "dentist", "pharmacy", "ra-helse", "au-helse"],
    antall: 222,
    hvorfor:
      "Klyngen er splittet på fem kategorier og trenger én felles mal. Tar de imot nye pasienter?",
  },
  {
    navn: "Butikk og kjøpesenter",
    kategorier: ["butikk", "shopping"],
    antall: 110,
    hvorfor: "Flest ferdige eksempler fra før, så den er billigst å utlede.",
  },
];

const SPEC_BY_CATEGORY = new Map<string, CategorySpec>(
  CATEGORY_SPECS.flatMap((s) => s.kategorier.map((k) => [k, s] as const)),
);

export function specForCategory(categoryId: string | null | undefined): CategorySpec | undefined {
  return categoryId ? SPEC_BY_CATEGORY.get(categoryId) : undefined;
}

/** Spørsmål som skal besvares i selve POI-teksten. Utelatt `lag` betyr tekst. */
export function textQuestions(spec: CategorySpec): SpecQuestion[] {
  return spec.spørsmål.filter((q) => (q.lag ?? "tekst") === "tekst");
}

/**
 * Spørsmål boardet må svare på, ikke teksten — fordi svaret varierer med
 * adressen. De står med i malen fordi de er en del av hva leseren skal få vite,
 * men de skal aldri skrives inn i den delte POI-teksten.
 */
export function boardQuestions(spec: CategorySpec): SpecQuestion[] {
  return spec.spørsmål.filter((q) => q.lag === "board");
}

/**
 * Kjernespørsmålene som skal hentes fra register for en kategori. Dette er
 * bestillingen registerimporten skal oppfylle — og samtidig lista
 * hygiene-jobben måler mot.
 */
export function registerQuestions(spec: CategorySpec): SpecQuestion[] {
  return spec.spørsmål.filter((q) => q.kilde === "register");
}

/**
 * Spørsmålene grounding fortsatt skal svare på. Alt registeret dekker holdes
 * utenfor — det er hele poenget: vi slutter å betale for å søke opp fakta som
 * ligger strukturert og gratis i et offentlig register.
 */
export function searchQuestions(spec: CategorySpec): SpecQuestion[] {
  return spec.spørsmål.filter((q) => q.kilde === "søk");
}

// ─── Broen tema → mal ───────────────────────────────────────────────────────

/**
 * Ett board-lag-spørsmål med konteksten FAQ-en trenger for å vise og spore det.
 *
 * `themeId` er den KANONISKE tema-id-en, ikke den kalleren sendte inn: config
 * kan bære gamle alias («barnefamilier» for «barn-oppvekst»), og kuraterte
 * overstyringer lagres per kanonisk tema. Uten normaliseringen her ville de to
 * skrivemåtene fått hver sin overstyrings-nøkkel.
 */
export interface FaqQuestion {
  themeId: string;
  /** `category_id`-en malen ble slått opp på — temaets FØRSTE treff. */
  categoryId: string;
  spec: CategorySpec;
  question: SpecQuestion;
}

/**
 * Board-lag-spørsmålene et TEMA skal svare på i drill-in-FAQ-en.
 *
 * Drill-in er per tema («Barn & Oppvekst»), mens malene er per `category_id`
 * («skole», «barnehage»). Dette er broen: gå gjennom temaets kategoriliste i
 * den rekkefølgen temaet selv oppgir — den er allerede produktets
 * prioritering, se `REPORT_THEME_DEFAULTS` der `skole` står før `barnehage` —
 * og hent board-spørsmålene fra hver mal som finnes.
 *
 * Hver mal bidrar ÉN gang selv om temaet lister flere av kategoriene dens:
 * transport-temaet har både `bus`, `train` og `tram`, og uten dedupen ville
 * «Hvor er nærmeste holdeplass?» stått tre ganger.
 *
 * Tema uten mal-dekning gir tom liste, ikke feil. Det er den normale
 * tilstanden for natur og trening i dag, og FAQ-seksjonen utelates da helt.
 */
export function faqQuestionsForTheme(
  themeId: string,
  categoryIds: readonly string[],
): FaqQuestion[] {
  const canonicalThemeId = resolveThemeId(themeId);
  const seenSpecs = new Set<CategorySpec>();
  const out: FaqQuestion[] = [];

  for (const categoryId of categoryIds) {
    const spec = specForCategory(categoryId);
    if (!spec || seenSpecs.has(spec)) continue;
    seenSpecs.add(spec);
    for (const question of boardQuestions(spec)) {
      out.push({ themeId: canonicalThemeId, categoryId, spec, question });
    }
  }

  return out;
}
