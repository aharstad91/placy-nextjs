# EM1 Grilstadporten — kontor-pilot som første betalte rung (eiendomssporet)

**Dato:** 2026-08-04
**Type:** Strategi-sparring (GTM / første betalte pilot / moat-rettigheter)
**Deltakere:** Andreas + Claude
**Utløser:** Andreas har hatt **Kristian Sundland** som megler på sine to siste boliger, og har varslet ham om at han tar kontakt etter sommeren. Kontaktet både Kristian og **Frank Robert Bae** i 2018 ved første Placy-forsøk (kom aldri inn — sommer). Målet: vise **nivå 1** i et møte og få en pilotavtale der meglere + fullmektiger limer Placy inn på `eiendomsmegler1.no`s objektsider. Skjermbilder av begge meglerprofilene + `mn-33260233` (Leistadgrenda 21, Frank Roberts salg) lagt til grunn.

**Status:** Aktiv — analyse + anbefaling levert, **premisset empirisk validert og delvis korrigert samme dag** (§2a: 150 annonser hos fire EM1-kontor; boilerplate-påstanden avvist, tomhets- og gjenbruksmønsteret kvantifisert), **dekningsgapet kvantifisert** (§3: 16 av Grilstadportens 35 boliger avvises i dag), **byline-modellen forkastet** og erstattet av megler-utvalg som Moat-1-motor (§6b, Andreas' modell). **⚠️ EMBED PÅ OBJEKTSIDEN ER TEKNISK UMULIG UTEN SPAREBANK 1** — verifisert samme dag på 153 annonsesider, se §3b. Piloten kjøper derfor **bevis + dør, ikke distribusjon**; embed-samtalen flyttes til `hem.no` (`2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md`). **Ingen av de fire beslutningene er tatt** (pris/omfang, strøk-kurering før møtet, markedseksklusivitet, møte-konstellasjon). Bygger på `2026-06-25-markus-bruktmegler-vs-utbygger.md` (bruktmegler-først), `2026-06-27-premium-single-bruktmarked-spor.md` §8–9 (grunnpakke + «vinn én kjede»), `2026-06-27-data-moatene-lokalkunnskap-innsikt.md` (begge moatene), `2026-07-09-megler-system-distribusjons-wedge.md` (EM1 har ingen nasjonal beslutningstaker).

---

## 1. Premiss-korreksjon: «Christian» er avdelingsleder, ikke «en megler Andreas kjenner»

`aktor-map.md` har ført ham som *«Christian (avdelingsleder secondhand, Drivstad/EM1) — har solgt 3 boliger for Andreas»*. Riktig identitet, verifisert mot meglerprofilen:

| Person | Rolle | Volum (siste 12 mnd) | Områder |
|---|---|---|---|
| **Kristian Sundland** | **Avdelingsleder / eiendomsmegler**, EM1 Grilstadporten | **50 solgt, 3 aktive** | Trondheim Øst, Trondheim, Klæbu, Trondheim Sentrum |
| **Frank Robert Bae** | Eiendomsmegler, EM1 Grilstadporten | **101 solgt, 16 aktive** | Trondheim Øst, Trondheim, Trondheim Sør, Trondheim Vest, **Malvik**, Trondheim Sentrum |
| **Marius Aune Olsen** | Eiendomsmegler, EM1 Grilstadporten | ukjent | — |

**Konsekvens:** de to sitter på **samme kontor**, og den varme kontakten er den som har budsjettmyndighet. 151 salg er bekreftet fra to profiler; med Marius er kontoret realistisk **200+ salg/år** (ikke verifisert). Frank Roberts dekning inkluderer Malvik, som allerede er kuratert.

**Salgsenheten er derfor kontoret, ikke boligen og ikke kjeden.** Stigen:

**megler → kontor (Kristian) → EM1 Midt-Norge → kjede / systemleverandør**

- **Rung 1 (én bolig)** er for lite: gir anekdote, ingen data, ingen ARR-logikk.
- **Rung 3+ finnes ikke som ett møte:** EM1 er en allianse av 12 selvstendige regionale SpareBank 1-/Eika-selskap — **ingen nasjonal beslutningstaker** (`2026-07-09-megler-system-distribusjons-wedge.md` §3). Å pitche «kjedeavtale» til en avdelingsleder gir «vi må sjekke oppover» = stall.
- **Rung 2 (kontoret)** er den eneste enheten som samtidig er (a) innenfor én persons myndighet, (b) stor nok til å produsere data, (c) geografisk konsentrert.

**Revenue-stigen (mot grunnpakke-pris 500–800/listing, 06-27):** kontoret ~200 listings = **100–160k/år**; EM1 Midt-Norge ~60 % av Trondheim ≈ 4 500 listings = **2,25–3,6M/år**. Kontoret er proof, ikke forretning — men det er *riktig* proof.

**Moat-2-synergi:** kontorets salg ligger nesten utelukkende i Trondheim Øst = de kuraterte strøkene. 200 boards i 5–6 strøk = **5–6 validerte strøk-profiler**, ikke 200 anekdoter. Konsentrert-volum-prinsippet (06-28) gjelder i miniatyr for dette ene kontoret — kontor-piloten *er* datavaliderings-strategien.

---

## 2. Pitchen er deres egen side, ikke produktet

Åpne ikke med Placy. Åpne med kontrasten på deres eget objekt:

- EM1 kjører nasjonal selger-kampanje på **«Selge bolig? Vi kjenner ditt nærområde, vår erfaring er din fordel»** (logget `LOG.md` 2026-06-03).
- «Nærområdet»-accordionen på objektsiden leverer 500–2 800 tegn prosa, kollapset, med kartet bak en «Aktiver kart»-knapp.

### 2a. Premiss-korreksjon: teksten er IKKE en områdemal (empirisk avvist samme dag)

**Første utkast av denne doccen påsto at «samme tekst står på hver bolig i strøket». Det er for sterkt og ville blitt punktert i møtet av hvem som helst med en telefon.** Validert ved uttrekk av `locationDescription` (RSC-payload, samme felt som rendres i accordionen) fra **150 annonser hos fire EM1-kontor i Trondheim** — Grilstadporten, Lade, Sentrum Søndregate, Valentinlyst. Alle fire tilhører samme juridiske enhet (`associatedOffice.organization.legalName` = EiendomsMegler 1 Midt-Norge). Gruppert på EM1s **eget** `address.area`-felt.

11 annonser er nybygg-prosjekter fra Nybygg-avdelingen (`mn-49*`: Vangslia Panorama, Strandveiparken, Ladebyhagen) — **0 av 11 har nærområdeseksjon i det hele tatt**. Holdt utenfor. Bruktbolig, n=139:

| Kontor | Annonser | Har nærområdetekst | Tom | Andel tom |
|---|---|---|---|---|
| **Grilstadporten** | 36 | 36 | 0 | **0 %** |
| **Lade** | 33 | 32 | 1 | 3 % |
| **Sentrum Søndregate** | 45 | 42 | 3 | 7 % |
| **Valentinlyst** | 25 | 4 | 21 | **84 %** |
| Sum uten Valentinlyst | 114 | 110 | 4 | 4 % |

**Tomhet er ikke et kjede-problem** — tre av fire kontor ligger på 0–7 %. Valentinlyst er en avviker (og forfaller: 13 av 13 *aktive* tomme mot 8 av 12 solgte). Verifisert med to uavhengige metoder (payload-uttrekk + sidehenting).

**Grilstadporten er det eneste kontoret på 0 %.** Det er ekte ros, etterprøvbart, og det er inngangen til møtet.

### 2b. Det som ER galt, og som holder i alle retninger

**Gjenbruk finnes overalt — 41 av 114 tekster (36 %) er del av en kopi-klynge:**

| Kontor | Tekster | Unike | I kopi-klynge |
|---|---|---|---|
| Lade | 32 | 23 | **47 %** |
| Sentrum Søndregate | 42 | 32 | 36 % |
| Grilstadporten | 36 | 29 | 31 % |

Største klynger: **Lilleby** 11 annonser → 5 tekster (samme 1 694 tegn på fire objekter); **Ila** 9 → 4 (samme 515 tegn på **fire enheter i Hans Nissens gate 3**); **Solsiden** 5 → 3; **Brundalen** 7 → 3 (819-tegns-blokken ordrett på fem objekter, kopiert **mellom** Frank Robert og Eirik Ardal Øksnes).

**Kvaliteten varierer per kontor, ikke per megler — ingen innholdsstandard i selskapet:**

| Kontor | Nevner gangtid | Nevner avstand | Navngir butikk | **Uten ett eneste tall** |
|---|---|---|---|---|
| Lade | **62 %** | **69 %** | 62 % | **0 %** |
| Grilstadporten | 25 % | 36 % | 53 % | **31 %** |
| Sentrum Søndregate | 21 % | 31 % | 38 % | 19 % |

Lade skriver konkret hver gang; Grilstadporten har 11 av 36 tekster uten et tall i seg. **Ikke si «dere er best» til Frank Robert** — Grilstadporten er mest *konsekvent*, Lade er mest *konkret*.

**De unike tekstene er ikke fritt skrevet — de er satt sammen fra en blokkbank.** Av 29 unike Grilstadporten-tekster gjentas **23 setnings-skjeletter i ≥3 tekster** og 145 ordrette 45-tegns-fraser deles av ≥3. «…er det god offentlig kommunikasjon i området» går igjen i 7 av 29. Banken er **felles for kontoret, ikke personlig**: likhet mellom to unike tekster fra samme megler 27,1 %, fra ulike meglere 22,9 % — fire prosentpoengs forskjell.

**Og det avgjørende: 114 tekster, ikke én er delt mellom to kontor.** Lade og Søndregate selger begge i Solsiden, Midtbyen, Lade og Øvre Nyhavna og deler ikke én setning.

### 2c. Pitch-setningen

Ikke «dere gjør ikke jobben» — den er empirisk død. Men:

> **«Dere gjør jobben fire ganger, hver for seg, og ingenting av den overlever boligen.»**

Fire kontor, fire private blokkbanker, fire kvalitetsnivåer, null overføring — og kjøperens inntrykk av nabolaget avhenger av hvilket kontor som tilfeldigvis fikk oppdraget. Det er et **eierskapsproblem**, ikke et tekstproblem: lokalkunnskapen er selskapets viktigste aktivum og lagres som utklipp i enkeltmenneskers annonser.

**Møte-rekkefølge (trygg variant — ikke sett Kristian i forsvar foran sin egen megler):**

1. Åpne med en **god** tekst fra dem (Væressletta 13 B, 2 785 tegn, eller Reppetoppen 2 415 tegn): *«denne er god. Noen har brukt tid.»* Forsvaret er nede, og skrev han den, fikk han kreditt foran sjefen.
2. Gi ham telefonen og be ham lese den der. La formatet felle seg selv — ikke si noe.
3. *«Hvor er Reppetoppen? Hvor langt til Kiwi? Du vet det. Vet kjøperen fra Oslo det?»*
4. **Så** de tre Brundalen-annonsene side om side — som «dette er hva som skjer når det skal skrives på nytt for hver bolig», ikke som slurv.
5. Observasjonen, aldri som spørsmål han må svare på: *«Jeg så på fire av kontorene deres. Alle skriver nærområdetekst, men ingen deler en setning — 114 tekster, ikke én gjenbrukt på tvers. Lade har en ganske konkret måte å gjøre det på. Vet dere om den?»* Svaret er nesten garantert nei, og da har han sagt det selv.

**Tallhygiene i rommet:** ikke tallfest «84 % av Valentinlyst» som om du har revidert kjeden — si *«jeg gikk gjennom annonsene til fire av kontorene deres»*. Sant, menneskelig, og eneste forsvarlige framstilling gitt at `eiendomsmegler1.no`s robots.txt/vilkår forbyr systematisk innhenting (150 sider hentet med 3 sek pause; **ikke gjør datainnsamlingen til en del av historien**).

Deretter klikk inn i Placy-boardet på en av **deres egne** solgte adresser, i samme posisjon i siden.

**Sekundær verdi som treffer avdelingsleder-hodet:** fullmektigene slipper å skrive nærområde-teksten, og den blir aldri utdatert. Intern effektivitet, ikke bare markedsføring — koster dem ingenting å si ja til.

**Copy-disiplin:** aldri ordet «nabolagsprofil» (FINNs er gratis-bundlet i annonsepakka → commodity-ord, `2026-07-09`-wedge-doccen §1). Bruk **«nærområde»** — EM1s eget kampanjeord.

**Merk også:** meglerprofilsidene har **«Meglerens områder»**-chips (Trondheim Øst, Malvik, Klæbu…) uten innhold bak. «Frank Roberts Trondheim Øst» som én aggregert nærområdeflate på profilsiden er nesten gratis av eksisterende deler, og treffer megleren som personlig merkevare. **Fase 2 — ikke utvid demoen med det.**

---

## 3. Hardt funn: dekningsgeofencen stopper demoen (verifisert mot prod)

Self-serve-flaten (`feat/megler-self-serve`, uflettet) **hard-gater på kuraterte strøk-polygoner** i `app/api/generation-requests/route.ts` → `findAreaForPoint`. Verifisert mot prod-DB samme sesjon:

- **Bare 7 områder har `boundary`:** Ranheim, Charlottenlund, Lade, Eberg, Tyholt, Sentrum, Malvik (alle 7 har også `report_editorial` = nivå-2-arv mulig).
- De **37 andre** strøk-radene i `v2.areas` er navn uten geometri: Strindheim, Leangen, Jakobsli, Vikåsen, Brundalen, Moholt, Nardo, Valentinlyst, Byåsen m.fl.
- **Leistadgrenda 21 geokodet (10.477573, 63.41999) → faller utenfor samtlige polygoner.** API-et svarer `outside_coverage`: *«Vi lager nabolagskart for områder vi kjenner redaksjonelt. Dette stedet er ikke kartlagt ennå.»*

**Kvantifisert samme sesjon** — alle 146 annonser med koordinater ray-castet mot de 7 polygonene:

| Kontor | Boliger m/koordinat | Innenfor dekning | **Avvist** |
|---|---|---|---|
| **Grilstadporten** | 35 | 19 | **16** |
| Lade | 34 | 14 | 20 |
| Sentrum Søndregate | 52 | 10 | 42 |
| Valentinlyst | 25 | 11 | 14 |
| **Sum** | **146** | **54 (37 %)** | 92 |

Grilstadportens treff fordeler seg: Ranheim 15, Charlottenlund 2, Lade 1, Tyholt 1. **Ranheim-polygonet dekker allerede 15 av deres boliger** — der står demoen trygt.

**Konsekvens: 16 av Grilstadportens 35 boliger får `outside_coverage` i dag, og 7 av dem er hele Brundalen-klyngen.** Altså er ditt sterkeste pitch-eksempel (§2b) nettopp det strøket Placy nekter å lage kart for. Dette er den ene tingen som må fikses før møtet, og det er ekte arbeid (`/curate-area` per strøk: skolekrets-polygon + kuratert tekst).

**Kurateringsrekkefølge — avgjort av dataen, ikke magefølelse:**

| # | Strøk | Grilstadporten-boliger som frigjøres |
|---|---|---|
| 1 | **Brundalen** | **7** — og hele gjenbrukshistorien |
| 2 | Angelltrøa/Granåslia (inkl. Øvre Granåslia) | 2 |
| 3 | Væretrøa + Væresstranda (Ranheim-polygonet dekker dem ikke) | 2 |
| 4 | Strindalia, Sverresborg, Bakkaunet, Munkvoll Gård | 1 hver |

(Erstatter det tidligere gjettede forslaget «Strindheim / Vikåsen-Jakobsli / Leangen» — ingen av kontorets 35 boliger i utvalget lå i de strøkene.)

**Bruk resten som pitch, ikke som mangel:** *«vi dekker Trondheim Øst redaksjonelt; alt dere taster inn utenfor logges — det er sånn vi bestemmer hva som kureres neste.»* `v2.coverage_demand` gjør dette allerede (migrasjon 082). Hullet blir en invitasjon.

### Pre-møte-byggliste (prioritert)

| # | Hva | Hvorfor |
|---|---|---|
| 1 | Flett `feat/megler-self-serve` | Prod har fortsatt **Moat-2 event-drop-buggen** → måle-pitchen er ikke leverbar. Migrasjon 081/082 ligger allerede i prod uten kode (skjema foran kode). |
| 2 | Flett `feat/mobil-nabolagsflate` + verifiser på ekte iPhone + `publishViewport` på nivå-1-boards | Nivå-1-boards har ingen VO → uten Fase 1 er mobil fullskjerm kart med pins. Megleren tar opp sin egen telefon i møtet. |
| 3 | **Kurér Brundalen først**, deretter Angelltrøa/Granåslia, Væretrøa/Væresstranda, Strindalia (`/curate-area`) | Geofencen over: frigjør 16 av Grilstadportens 35 boliger, og Brundalen alene er 7 + hele gjenbrukshistorien i §2b. |
| 4 | ~~Falsk EM1-objektside med embed~~ (`scripts/embed-testside`) — **nedgradert 08-04 (§3b)** | Viser nå en *framtidig* tilstand, ikke leveransen. Behold som «slik blir det når SpareBank 1 sier ja», men led ikke med den. |
| 5 | `REVALIDATE_SECRET` i Vercel | Uten den venter tekstendringer på 1 times ISR — synlig vorte i en workshop der de retter en tekst og skal se den. |
| 6 | **Auth for megler-brukere** | Ny kritisk sti etter §6b: megler-utvalg og «legg til sted» er skriveoperasjoner, og admin er avslått i prod siden 07-07. Uten dette kan mekanismen bare *fortelles*, ikke vises. Ikke lov dem en portal før den finnes. Anbefalt: **magic link + e-postdomene-allowlist per kontor** (`broker_offices`, 081) — ikke Google SSO (EM1 er SpareBank 1-eid → Microsoft/Entra). |
| 7 | **Nabolagskart som karusellbilde** (1–3 slides, generert fra samme bestilling) | **Ny etter §3b: dette ER distribusjonen i piloten.** Virker på FINN *og* eiendomsmegler1.no, krever ingen utvikling hos dem. Uten den er karusell-flaten en påstand, ikke et artefakt. Designkrav: FINN rekomprimerer (`quality(70)`) og viser fullskjerm på mobil → stor type, høy kontrast, test på 390 px. |

**Vis ikke** 3D, VO, reels eller lyd. Det ankrer dem i «dyr bespoke medieproduksjon» og ødelegger grunnpakke-prisen (widget-fellen, 06-27 §7). Én premium-referanse på slutten *hvis* de spør — eksplisitt som annen SKU, annen pris. Si kanalskillet høyt i møtet, ellers blir det en rabattforhandling senere (den uløste channel-konflikten fra 06-25 §3).

---

## 3b. Hardt funn nr. 2: embed på objektsiden er umulig uten SpareBank 1

**Andreas' spørsmål: «vil en iframe kunne legges inn noe plass, eller må det faktisk utvikling til?» Svaret er utvikling — hos noen andre enn EM1 Midt-Norge.** Verifisert på DOM-nivå i 153 annonsesider: **0 iframes, 0 `dangerouslySetInnerHTML`**, whitelist fra meglerens tekstfelt = `<li>` `<ul>` `<br>` `<strong>`, **0 `<a>`-elementer** mot **108 URL-er som ligger som død klartekst** i de samme blokkene. Ikke engang en lenke overlever. Siden bruker `ffe-*` = SpareBank 1s **Felles Front End**, delt av alle 12 regionselskapene; objektet lever i **Webtop Solutions** (del av Visma Real Estate). Salgsoppgaven er en **PDF**, ikke en flate.

Full dokumentasjon, inkludert megler-kontrollerte flater, QR-ens mobil-dødpunkt, nabolagskart-bildet som karusell-artefakt og produkt-/flyt-definisjonen: **`2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md`**.

**Konsekvens for denne piloten — tre ting endres:**

1. **Asken er bilde + lenke + QR, ikke embed.** Nabolagskart som karusellbilde (virker på FINN *og* eiendomsmegler1.no, og trenger ingen utvikling), klikkbar lenke i visningsbekreftelsen fra Webtop Tide (høyest intensjon i hele løpet, megler-kontrollert), QR på papir under visningen. `?src=`-attribusjon er alt bygd → målingen fungerer fra dag én.
2. **Pre-møte-punkt 4 (falsk EM1-objektside med embed) er nedgradert.** Den demonstrerer nå en *framtidig* tilstand, ikke leveransen. Behold den som «slik ser det ut når SpareBank 1 sier ja», men led ikke med den.
3. **Embed-asken blir Kristians ask oppover, ikke din.** *«Hvis tallene holder etter tre måneder, er det du som tar dette til SpareBank 1 og Visma — med data.»* Det er en bedre ask enn en iframe han ikke kan levere.

**Ikke la dette lekke som skuffelse i rommet.** Piloten var aldri distribusjonsavtalen — den er bevis + dør. Det står uendret.

---

## 4. Pilot-strukturen: kontor-pilot, betalt, tidsavgrenset

Gratis pilot = ingen forpliktelse = dør. Begge rådgivere landet uavhengig på *betalt pilot til redusert pris med forankret target-pris* (06-25 §8).

- **Omfang: alle boliger kontoret legger ut i perioden.** Ikke «prøv på én» — per-bolig-valg dreper fast-inventar-logikken og gir ikke volum nok til at Innsikt blir noe annet enn anekdote.
- **Varighet: 3 måneder** (eller «de neste 50 salgene»), med **datofestet ja/nei**.
- **Pris: én kontoravgift, ikke per bolig — 15–25k for perioden.** Viktigste prisgrep: **navngi aldri en per-bolig-pris under piloten**, da brenner du ikke 500–800-ankeret før kjedesamtalen. En-sideren sier: *«etter pilot: per bolig, indikativt 500–800, eller kontor-/kjedeavtale.»* Under ~25k går typisk innenfor en avdelingsleders eget budsjett uten innkjøpsrunde (Markus: megler har full myndighet over egne salg — samme logikk ett nivå opp).
- **Det de gir utenom penger (den egentlige valutaen):**
  1. embed på objektsiden (distribusjon),
  2. 90 min per megler til lokalkunnskap-workshop (Moat 1),
  3. lov til å måle + bruke kontoret som referanse/logo,
  4. **forpliktet neste steg: ved ja åpner Kristian døra til EM1 Midt-Norge.** Verdt mer enn honoraret — be om det eksplisitt.
- **Svar på «kan vi ikke bare få prøve gratis»:** *«Jo, men da er jeg en hobby og ikke en leverandør — du får ikke prioritet når noe knekker, og jeg får ikke bruke dere som referanse. Betalt til en tredjedel er billigere for begge.»*

---

## 5. Statistikk-knaggene (Moat 2) — la dem spesifisere produktet

Innsikt er ikke ferdig som konsept. Grepet: **ikke pitch rapporten — be dem rangere knaggene.** *«Jeg kan måle alt. Jeg vil ikke bygge en rapport ingen leser — rangér disse, de tre øverste bygger jeg først.»* Da eier de resultatet (IKEA-effekt) og du får kravspesifikasjonen gratis.

| # | Knagg | Setningen megleren leser | Verdi / handling |
|---|---|---|---|
| 1 | **Interesse-temperatur før visning** | «340 åpninger, 210 personer, **41 kom tilbake en annen dag**» | Retur-besøk = interesse-signalet (⭐ i 06-27-katalogen). Hvem ringer du, hva sier du til selger i uka mellom annonse og visning — meglerens svarteste hull. |
| 2 | **Hva de lurte på, rangert** | «62 % åpnet Barn & oppvekst først, 48 % transport, 12 % trening» | Hvilken historie du leder visningen med; hvilke tre bilder øverst i annonsen. Åpne-rekkefølge = topp-prioritets-signal. |
| 3 | **Hvor de ville reise fra boligen** | «17 spurte reisetid til sentrum, 9 til Gløshaugen, 6 til Værnes» | Rikeste enkeltsignal (⭐⭐). **Bygg-avhengighet:** rute-/commute-UX må være synlig i boardet. |
| 4 | **Spørsmål uten svar (nudge)** | «11 skrev noe om hundepark / ladeplass / bomvei» | Megleren får spørsmålene *før* visningen. Mater samtidig Moat 1 (hva kureres neste). ⭐⭐ |
| 5 | **Delta mot strøk-snittet** | «2,3× mer tid på skole enn snittet i Charlottenlund» | Absolutte klikk lyver (kjent kafé får klikk uansett); avviket sier noe. **Finnes bare med volum** → argumentet for hele kontoret, ikke én bolig. |
| 6 | **Kanal-effekt** | «72 % fra FINN-lenka, 18 % fra QR på visningen, 10 % fra Instagram» | Hvor annonsekronene virker. **Allerede bygd** (`?src=` i konvolutten, Unit 5). |

**To kjøpere i samme person — pitch riktig til hver:**
- **Megleren** vil ha hjelp til å selge objektet → knagg 1–4.
- **Avdelingslederen** vil ha hjelp til å **vinne oppdraget** → den sterkeste linjen i hele møtet: *«i verdivurderingsmøtet kan du si: vi vet hva kjøpere i ditt nabolag ser etter, fordi vi måler det på 200 boliger i året.»* Ingen konkurrent i Trondheim kan si det. Lead med den til Kristian.

**Ærlighetsgrenser — si dem selv, først:** board nr. 1 er anekdote, verdien komponderer med volum, alt anonymt og aggregert, ingen innlogging/PII, ingen rapportering under volumterskel. EM1 er SpareBank 1-eid → compliance kommer uansett; personvern-arkitekturen er en *feature* når den sies før den forsvares. **Ikke lov effekt på salgspris** — lov beslutningsstøtte og engasjementsmåling, la dem selv vurdere om det hjalp. (Vil de ha effekt: soft A/B med halve listings, men vær ærlig om at N er for lav for signifikans på 3 mnd.)

---

## 6. Moat-1-rettigheter: skill innhold fra eksklusivitet

Ratifisert tidligere (Markus' term-sheet-punkt, 06-25 §4): **lokalkunnskapen eies av Placy.** Gir du EM1 eksklusivitet på innholdet, ødelegger du aktivumet — kjedeavtalen, de 11 andre EM1-selskapene og hver framtidig kunde forutsetter at basen er din og delt. **Dette er den ene tingen som ikke byttes bort.** Framing mot dem: *«dere skal ikke eie en innholdsdatabase — og ikke ha ansvar for fakta i den. Dere skal ha den beste flaten på boligene deres.»*

**Fire ting de kan få, som koster lite:**

1. **~~Tidsavgrenset markedseksklusivitet~~ — REVURDERT 2026-08-04 samme dag.** Formuleringen var: *«så lenge piloten løper — og 6–12 mnd ved kontoravtale — selger jeg ikke nivå-1-flate til andre meglerkontor i Trondheim Øst»*, med begrunnelsen **«koster ingenting i dag»**. Det var sant helt til `hem.no` ble identifisert som **den eneste kandidaten som kan bestemme seg for en embed alene** (`2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md` §5). Eksklusivitet i Trondheim Øst stenger nå Placys nest beste spor, og HEM *har* Trondheim Øst-objekter.
   **Ny anbefaling: ikke tilby eksklusivitet i det hele tatt.** EM1 har ikke spurt om den — å gi bort noe ingen har bedt om, for å stenge sitt eget alternativ, er dårlig handel. Blir den krevd: tegn den så smalt at den ikke biter — **bruktbolig, Trondheim Øst, kun pilotperioden** (HEMs bruktstyrke ligger sentrum/vest/sør; deres Trondheim Øst-objekter er nesten alle nybyggprosjekter). Trygghetsbehovet i §6b dekkes fortsatt av et *definert område og en periode* — bare mindre generøst tegnet enn først foreslått.
2. **~~Byline på strøket de bidro til~~ — FORKASTET av Andreas 2026-08-04.** Begrunnelse (hans, og den er riktig): et kurerings-lag merket med en EM1-meglers navn er **usalgbart til neste kjede** — ingen megler hos Heimdal eller Nordvik tar i et lag som bærer en konkurrents signatur, og det bryter grunnpakke-modellen der samme base selges på tvers av kjeder. Bylinen ga dem dessuten en moralsk eiendomsrett å påberope seg ved exit, og ansvar for steder som legger ned. **Ingen navn på punkter, ikke i noe kart.** Er en megler først til å sende inn et sted, er han først — men det skal ikke stå på punktet i alle senere board.
3. **Utvalg, ikke eierskap** (erstatter det tidligere «megler-eid lag»): megleren velger hvilke *eksisterende* steder som fremheves. Se §6b.
4. **Prioritet, ikke eierskap:** kontorene som bidrar bestemmer hvilke strøk som kureres først.

**Aldri:** eksklusivitet på fakta/POI-er, evig strøk-eksklusivitet, eller klausul der innhold dør hvis de går. Bidrag lisensieres irrevocabelt og ikke-eksklusivt til Placy (eller overdras); Placy eier den sammenstilte databasen.

**Workshop-mekanikk (interim, gjelder til §6b er bygd):** ikke be om «workshops» (åpen forpliktelse) — be om **90 minutter per megler, én gang, foran et kart.** Kjør `/curate-area`-kandidatlista på skjerm: hva mangler, hva er feil, hva sier du på visning som ikke står her. **Andreas driver skjermen selv** — bidragsflaten for meglere finnes ikke (admin er avslått i prod, `security_admin_prod_disabled`), så **ikke lov dem en portal** før auth er bygd. Du hører dessuten begrunnelsen og eier stemmen. Gi noe tilbake samme dag: *«teksten ligger på boligene deres i morgen»* (krever pre-møte-punkt 5).

---

## 6b. Megler-utvalg som Moat-1-motor (Andreas' modell, 2026-08-04)

**Dette er sesjonens sterkeste produktidé, og den erstatter workshop-modellen som primær Moat-1-innhentingsmekanisme.** Andreas' innvending mot workshop var reell: å be EM1 bistå med å bygge Moat 1 er tungt å selge — det er en engangsdugnad for en leverandør, må planlegges, og føles som ubetalt arbeid. Moat 1 må Placy bygge selv (egen Trondheim-kunnskap + nettkilder), men **innhentingen av det siste laget kan gjøres til noe megleren vil**.

### Mekanismen

Ved **oppsett av en megler i Placy** kjøres en gjennomgang: per kategori velger hun/han hvilke steder som skal fremheves. Mangler et sted, legges det inn i Placy — og dukker da opp på lik linje, klart til å velges. **Placy eier stedet.** Sender Frank Robert inn «Chamonix» (uteområde i Overvik-området, lokal innsikt som ikke finnes i noe geodatasett), kan en megler i Heimdal Eiendomsmegling bruke det senere på lik linje.

**Ingen navn på punktet.** Utvalget er en konfigurasjon, ikke en signatur.

### Visningssiden er allerede bygd

`components/variants/report/board/board-data.ts:315–334`: nivå-2-editorial har **`highlightPoiIds`** — en kuratert liste som resolves mot kategoriens POIer og **vinner over** den deterministiske `pickGeneratedHighlights()` (tier-1-utvelgere, `GENERATED_HIGHLIGHTS_MAX = 3`). Kuratert og generert drill-in ser bevisst like ut, og gating finnes (`generated: true`-flagget). «Verdt å merke seg» *er* slot'et. **Det som mangler er ikke visning — det er forfatterskap og innfanging.**

### Det ene designvalget som avgjør om det bygger moat eller støy

**Utvalget må ligge per strøk per megler — ikke per bolig.** `highlightPoiIds` ligger allerede på temaet (per strøk), som er riktig sted. Per bolig gjenskaper du kopier-lim-problemet i nytt medium: samme tre steder valgt sju ganger i Brundalen, ingenting akkumulerer.

Per strøk per megler gir tre ting samtidig:
1. Frank Robert kurerer Brundalen **én gang**, slår inn på alle hans boliger der
2. Boligen viser utvalget til den megleren som la den ut
3. **Flere meglere kurerer samme strøk over tid** → velger fire uavhengige lokaleksperter ISAK Bakeri, er det et **konsensus-signal fra folk som faktisk vet** — en rangeringsprior ingen konkurrent kan kjøpe. Uten byline blir aggregatet et **usynlig Placy-signal** (konkurrenter kan ikke se det, bidragsytere kan ikke kreve det tilbake) som kan forbedre nivå-1-defaulten for *alle*, også i strøk og byer der ingen megler ennå har kurert. Dette er Moat 1 som selvforsterkende, ikke statisk.

### Fire ting som må bygges riktig

1. **«Legg til sted» må være to felt, ikke et skjema.** Søk → «finner du ikke stedet? trykk i kartet» → navn + kategori. Placy beriker etterpå. Fem felt = aldri brukt = motoren står stille. Viktigste enkeltavgjørelse i mekanismen. POI-modellen tar allerede *valgfri* Google-data, så uformelle steder uten Place-ID (Chamonix) passer.
2. **Additivt, aldri subtraktivt.** En selgers megler kurerer *markedsføring*, ikke fakta — han fremhever kafeen, ikke industritomta. Nivå 1 må fortsatt vise alt, komplett. Utvalget legges oppå. Ellers er det en pen løgn.
3. **Må fungere tomt.** Valentinlyst-funnet (§2a) er advarselen: valgfritt ⇒ noen kontor rører det aldri. `pickGeneratedHighlights()` er gulvet — behold det, uten synlig hull.
4. **Moderasjonskø.** Her kommer søppel inn i moaten: dubletter («Chamonix» / «Chamonix uteområde»), feil koordinater, ikke-steder.

### Gjennomgangen må provosere hullet fram

Viser du «57 steder i Mat & Drikke — velg tre», plukker han tre fra lista og **du har lært null**. Men å spørre «hva mangler?» kaldt foran 57 navn er gjenkalling uten holdepunkt — de fleste fryser og sier «ser greit ut».

**Løsningen er holdepunktet, ikke ordlyden: vis stedene på kartet.** Tomme områder er synlige; 57 navn er det ikke. Da ser han selv at Overvik-siden er blank, og trykker på lenken. Kartet gjør jobben spørsmålet skulle gjort, uten å sette ham på prøve.

Ordlyd (Andreas'):

> Her er de 57 vi har i Mat & Drikke. **Savner du et sted? Legg det til** — det kommer rett inn i lista.

- **«steder», ikke «punkter»** — «punkt» er internt vokabular.
- **Løftet «kommer rett inn i lista» kolliderer med moderasjonskøen.** Løsning: stedet vises **umiddelbart for bidragsyteren**, merket til gjennomgang, og blir globalt synlig etter godkjenning. Ellers bryter du enten løftet eller køen.

### Hva det gjør med salget

Flytter Moat 1 fra noe du **ber om** til noe de **vil ha**: *«vi gjør 95 % — alle stedene, avstandene, kartet. Du legger til det bare du vet.»* Forutsetningen er at **Placy har bygget basen først** — møter megleren et tomt lerret, gjør han ingenting. Egen Trondheim-kunnskap og nettkilder er derfor ikke en krykke i påvente av meglerne; det er betingelsen for at megler-laget tas i bruk.

**Retensjon (ærlig korreksjon):** bylinen var mitt retensjonsargument, og den er borte. Det som erstatter den er svakere per person men sunnere: utvalget er **deres konfigurasjon** som må gjøres om på nytt hos en konkurrent, og kurerte strøk er dekning en konkurrent starter på null i. Produkt-retensjon, ikke person-retensjon — prisen for å kunne selge samme base til fire kjeder.

**Si aldri høyt at bidragene kan brukes av Heimdal Eiendomsmegling senere.** Sant, nødvendig for forretningsmodellen, og presis den setningen som gir nei. Det de skal høre er *«stedene ligger i Placys database»* — banalt, udramatisk. Trygghetsbehovet dekkes av **markedseksklusivitet i definert område og periode** (§6.1), ikke av eierskap til punktene. Spurt direkte: eksklusivitetsvinduet er svaret.

### Blokker: krever innloggingsbeskyttet skriveflate for meglere — den finnes ikke

Admin er avslått i prod siden 2026-07-07 (`security_admin_prod_disabled`), re-aktivering krever ekte auth. **Auth for megler-brukere er dermed flyttet til kritisk sti**, ikke «senere». Rekkefølge: (1) auth → (2) kurér strøkene, ellers har han ingenting å velge fra → (3) oppsett-gjennomgangen med kart-holdepunktet → (4) moderasjonskø.

---

## 7. Møte-mekanikk

- **Ikke send lenke før møtet.** Kort melding, referer til de to salgene, be om **45 minutter på kontoret med skjerm**, be Kristian ta med Frank Robert. Ingen deck.
- Grunn: åpner han boardet alene på desktop uten «Nærområdet»-innrammingen, ser han en kartgreie — nettopp widget-oppfatningen du ikke vil ha. Effekten ligger i sammenstillingen med deres døde tekstboks.
- **Demoen er live self-serve, ikke slides:** gi Kristian tastaturet på `/megler/em1-grilstadporten` og la ham taste adressen. Wow-en er at det tar to minutter uten Placy i loopen — det er det som gjør det til en grunnpakke og ikke et prosjekt.
- **Mobil er demoflaten** (FINN-trafikk er mobil-dominert). Meglerne tar opp sin egen telefon.
- Ærlig grep hvis noe faller utenfor dekning: vis **både** ukuratert nivå 1 og kuratert Ranheim side om side — *«forskjellen er at noen som kjenner strøket har gått gjennom det. Det er der dere kommer inn.»* Gapet blir workshop-asken.

---

## 8. Ærlige risikoer

1. **Leverings-readiness:** tre uflettede brancher, én prod-bug som dreper måle-pitchen, mobil uverifisert på ekte enhet, ingen manuell cache-bust. Samme risiko som 06-23 §10 flagget («demo-ready vs. kontrakt-leveranse-ready») — nå konkretisert til fem punkter.
2. **EM1s struktur:** ingen nasjonal kjøper. Piloten må dimensjoneres til kontor-myndighet, ellers stalles den oppover i alliansen.
3. **FINN Nabolagsprofil er gratis-bundlet** → prisdisiplin og ordvalg avgjør om Placy leses som commodity.
4. **Effekt-påstander:** meglere hører «flere klikk = høyere pris». Ikke lov det; det er ikke forsvarbart og undergraver troverdigheten når det ikke slår til.
5. **Kanalkonflikt:** tre prispunkter på samme meglerteam (grunnpakke / premium-single / utbygger). Uløst siden 06-25 — si skillet høyt før de finner det selv.
6. **Overdrivelse av deres svakhet er selvskade (påvist, §2a).** Første utkast av pitchen hvilte på en påstand som falt ved kontroll. Grilstadporten er 0 % tomme og skriver mer konkret enn Søndregate. **Enhver påstand om deres innhold må være etterprøvbar på deres egen telefon i rommet** — de har alltid moteksempelet, du har ikke.
7. **Nybygg-flaten er åpen, men er en annen kjøper.** 0 av 11 prosjektannonser har nærområdeinnhold i det hele tatt (Vangslia Panorama, Strandveiparken, Ladebyhagen). Det er utbygger-penger, ikke kontor-penger — hører til Aleksander-sporet, og skal ikke blandes inn i kontor-piloten (kanalkonflikt-risiko 5).

---

## Åpne beslutninger (Andreas')

1. **Kontor-pilot til 15–25k fast, alle boliger, 3 mnd** — eller per-bolig-pris fra dag én? (Anbefaling: kontoravgift; per-bolig brenner ankeret.)
2. **Kurér 4–5 strøk før møtet** (Strindheim / Brundalen / Vikåsen-Jakobsli / Leangen) — eller kjør demoen kun på Ranheim + Charlottenlund og la geofencen være pitchen?
3. **Markedseksklusivitet i Trondheim Øst under piloten** — ja/nei, og hvor lenge? (Semi-irreversibel ved for lang varighet.)
4. **Kristian alene, eller Kristian + Frank Robert samtidig?** (Anbefaling: begge — avdelingslederen har myndigheten, superselgeren har intern troverdighet.)
5. **Er megler-utvalg (§6b) med i piloten, eller fase 2?** Krever auth først. Alternativet er å *fortelle* mekanismen i møtet og kjøre 90-min-workshopen manuelt i pilotperioden (§6 interim). (Anbefaling: fortell den, kjør manuelt, bygg auth i pilotperioden — ellers utsettes møtet.)
6. **Bygges auth for megler-brukere før eller etter møtet?** Konsekvens hvis etter: ingen selvbetjent bidragsflate å vise, og §6b blir en påstand.
7. **Tilbys markedseksklusivitet i det hele tatt?** (Anbefaling etter §3b: nei, eller «bruktbolig / Trondheim Øst / kun pilotperioden» — den stenger HEM-sporet.)
8. **Bygges nabolagskart-bildegeneratoren før møtet?** (Byggliste 7. Uten den har piloten ingen distribusjon i annonsen.)

---

## Koblinger

- **`2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md`** — samme dag, senere: embed umulig på EM1s objektside (§3b her), megler-kontrollerte flater, produkt-/flyt-definisjonen, HEM som embed-kandidat, benchmark mot FINN Nabolagsprofil på Østmovegen 6 D
- `2026-06-25-markus-bruktmegler-vs-utbygger.md` — bruktmegler-først; åpent spørsmål (b) «Christian eller Frank Robert?» besvares her: **begge, som kontor**
- `2026-06-27-premium-single-bruktmarked-spor.md` §8–9 — grunnpakke 300–800/listing, «vinn én kjede», widget-fellen
- `2026-06-27-data-moatene-lokalkunnskap-innsikt.md` — tracking-katalogen knaggene er hentet fra; konsentrert-volum-prinsippet; Placy-eid IP
- `2026-07-09-megler-system-distribusjons-wedge.md` §3 — EM1 = allianse av 12, ingen nasjonal beslutningstaker; FINN Nabolagsprofil-inkumbenten
- `2026-07-09-locallogic-benchmark-eiendom.md` §7 — commute-input bekreftet (knagg 3), score forkastet
- `aktor-map.md` — Kristian Sundland-korreksjonen + EM1 Grilstadporten som enhet
- `PROJECT-LOG.md` 2026-07-08 (megler self-serve, 6 units) + 2026-08-04 (mobil nabolagsflate Fase 1) — de to uflettede branchene piloten hviler på
