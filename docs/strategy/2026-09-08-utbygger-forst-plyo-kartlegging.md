# 2026-09-08 — Utbygger-først: Plyo eier veggen, og kartleggingen av hvem som eier prosjektsidene i Trondheim

> Sesjonsdokument. Utløst av Andreas' ønske om et board for **Overvik** og spørsmålet:
> «kan EM1 legge inn en iframe selv, eller må det gjennom Plyo — og hvordan holder vi Placy under radaren?»
> Svaret snudde go-to-market-rekkefølgen fra megler-først til **utbygger-først**.

---

## §1 Metode og datagrunnlag

Alt under er **målt**, ikke antatt. Rekkefølgen:

1. **315** nybygg-prosjektannonser hentet fra FINN (`/realestate/newbuildings/search.html?location=0.20016`, 8 sider, hele Trøndelag).
2. **261** av dem ligger innenfor 45 km av Trondheim sentrum (koordinat hentet fra hver annonse; 314 av 315 hadde koordinat).
3. Av disse peker **49 til et eget prosjektnettsted** (resten lenker bare til meglersystem/portal).
4. Hver av de 49 er hentet og målt for: plattform-signatur, `content-security-policy`, `x-frame-options`, hvilke CMS-moduler siden faktisk bruker, og hvilke e-postdomener som opptrer i sidens data.

Rådata i sesjonens scratchpad (`projects_near.json`, `probe_out.jsonl`, `devs.txt`) — ikke i repo.

**Metoderegel som holdt:** leverandør-attribusjon skjer på **script-domenet**, ikke på utseendet.
`cdn.plyo.site` / `*.plyo.cloud` = Plyo · `newbuilds-assets.com` = Marketer · `kvass.no` = Kvass.
(Samme regel som fanget Marketer-attribusjonen på wesselslokka.no 2026-09-01.)

---

## §2 Plyo eier veggen i Trondheim

| Plattform | Antall av 49 prosjektsider |
|---|---|
| **Plyo** | **21** |
| WordPress | 7 |
| Marketer | 3 |
| Kvass | 2 |
| Squarespace / Next.js / eget / ukjent | 16 |

Plyo hevder selv 80 % markedsandel i Norge på nybygg. I dette utvalget er andelen 43 % av alle prosjektsider — og klart høyest blant de større prosjektene.

**Konsekvens:** spørsmålet «kan vi embedde uten Plyo?» er ikke en Overvik-detalj. Det er spørsmålet for nesten halvparten av markedet i vår egen by.

---

## §3 Ja — kunden kan embedde selv, hvis brukeren har BUILDER-rolle

Plyos CMS kjører **på kundens eget domene**, ikke på en sentral admin-portal:

- `overvik.no/login` svarer **200** med «Logg inn»
- `overvik.no/api/admin/image` svarer **401** → ekte, server-håndhevet rollestyring
- Hele editoren (`PlyoPadWrapper`, `CollaboratorsEditor`, `NavItemsEditor`, `FrameSettingsEditor`, `KlaroEditor`) ligger i sidens offentlige JS-bundle → redigering skjer in-place på den publiserte siden

**Modulkatalogen har tre nivåer, og editoren merker dem med rollenavn:**

| Tier i koden | Merkelapp i editoren | Eksempler |
|---|---|---|
| `SIMPLE` | **EDITOR** | Text, Carousel, Video |
| `ADVANCED` | **BUILDER** | **IFrame (`FrameTile`)**, Map, Travel Time, Form, Feed |
| `EXPERIMENTAL` | **ADMIN** | **Custom HTML (`HtmlFrame`)**, Sunstudy, 3D Chooser, Gaussian Splat |

Modulen heter bokstavelig talt **«IFrame»** og ligger på mellomnivået, ikke på Plyo-only-nivået.
Tilhørende rettigheter i bundelen: `tiles_simpleEdit`, `tiles_advancedEdit`, `tiles_experimentalEdit`, `advancedTile_manage`.

**Ingen av Plyo-sidene sender CSP eller X-Frame-Options** → en Placy-iframe rendrer.

**Presedensen er avgjørende:** Fredensborg har embeddet sin egen `husbanken-kalkulator-v4.netlify.app`
(tittel «Boliglånskalkulator — Fredensborg Bolig») på **tre** av sine Plyo-sider. Altså en egenbygd
tredjepartsting på et gratis Netlify-domene, inne i Plyo-siden, uten at Plyo hoster den.

**Forbeholdet:** rollen kan ikke observeres utenfra. Har markedspersonen bare EDITOR, må Plyo skru den opp
— og da er de involvert likevel.

**«Under the radar» må presiseres:** det betyr *ingen support-sak*, ikke usynlig.
Modulen er en rad i Plyos database, og de kjører PostHog + GTM på kundenes sider.

---

## §4 Plyos Travel Time-modul målt live

Plyos «Location»-kategori har **nøyaktig to moduler: Map og Travel Time**. Travel Time er live på
**7 Trondheim-sider**: Høisethlia, Arkaden Lademoen, Saupstad Torg, Godthåb Øya, Angelltrøa Hovedgård,
iRingve, Solåsen.

Kjørt live på hoisethlia.no med «Trondheim sentralstasjon» som utgangspunkt:

- Modulen er **tom til brukeren fyller den ut selv**. Overskrift «Beregn reisetid», ett fritekstfelt
  («Hvor reiser du fra?»), én knapp.
- Kaller `/api/googleMapsServices/distanceMatrix?origins=<prosjektets koordinat>&destinations=<fritekst>&travelModes=BICYCLING&DRIVING&WALKING&TRANSIT`
  (+ `placeAutocomplete` på inputfeltet). Google Distance Matrix, ingenting mer.
- Svaret er fire tall i fire bokser. Ingen steder, ingen kategorier, ingen kart.
- Hele modulens konfigurasjon i CMS-et er **ett koordinat + to farger**.

**Tre synlige feil i svaret, alle på en norsk side:**
1. Varighetene kommer rå fra Google på engelsk: «2 hours 46 mins», «39 mins»
2. Etiketten under hvert tall er en **tom** `<p class="TravelTimeFrame_travelMode">` — modus vises bare som ikon
3. Kollektiv-ikonet rendrer som et **firkant-symbol (#)** — ødelagt glyph

**Og kartmodulen deres slår av POI-ikonene** (`{"stylers":[{"visibility":"off"}],"elementType":"labels.icon"}`
i mapStyles på hoisethlia.no). De skjuler stedene.

**Posisjoneringen som følger:** vi konkurrerer ikke på reisetid-tall — vi henter fra samme Google-kilde.
Vi konkurrerer på **retning**. Deres modul spør kjøperen om det hun allerede vet og gir henne ingenting
hun ikke visste. Placy viser stedene uten å bli spurt. Nøyaktig samme svakhet som FINN Nabolagsprofil:
et tall uten et sted.

---

## §5 Plyo som kopirisiko — hva regnskapet sier

| | 2024 | 2025 |
|---|---|---|
| Sum driftsinntekter | 53,7 MNOK | **55,4 MNOK** |
| Driftsresultat (EBIT) | −10,5 MNOK | **−5,7 MNOK** |
| EBITDA | — | **+2,5 MNOK** |
| Egenkapital | — | **7,7 MNOK** |
| Likviditetsgrad | 0,78 | **0,33** |
| Soliditet | 44,1 % | **21,6 %** |

Lesning: omsetningen står stille (+3 %), tapet er halvert via kostnadskutt. Egenkapital 7,7 mot årlig tap
6,9 = omtrent **ett år runway**. Men gapet EBITDA +2,5 mot EBIT −5,7 er ~8 MNOK avskrivninger, i hovedsak
aktivert utvikling — **de bygger fortsatt for store penger, pengene er bare allerede lovet bort** til
UnitFinder og Console.

**Risikovurderingen som følger av dette:** et strategisk pivot inn i vår kategori er usannsynlig. En **billig
defensiv feature** er mer sannsynlig enn før — det er nettopp det et selskap med ett års runway gjør for å
holde på fornyelsene, og Location-gruppa står der allerede. Utløseren er **gjentakelse**: mange kunder som
ber om det samme.

**Operativ regel:** be aldri Plyo om noe. Gå til utbygger, la kunden legge inn modulen selv, og ikke rut
spørsmål via meglere som sender dem videre til leverandøren.
(Samme regel gjelder Marketer på HEM-siden — ikke foreslå at Thomas sjekker med dem.)

Plyos egen markedsføring bruker allerede språket vårt: «walked the area», «explored the area»,
`yourproject.unitfinder.com/map`. De er i kategorien — bare tynt.

---

## §6 Utbygger-kartet (Trondheim, Malvik, Melhus, Stjørdal, Klæbu, omegn)

Sortert etter porteføljestørrelse. Alle Plyo-sider er uten CSP/XFO med mindre annet står.

| Utbygger | Prosjekter i regionen | Plattform | Megler(e) | Kontakt |
|---|---|---|---|---|
| **Fredensborg Bolig** | Overvik, Bo Brøset, Steinan Park, Poulssons Kvarter, Vikhammerstrand | Plyo — **ÉN konto for alle** | EM1, HEM, Nylander, Sem & Johnsen | **Petter Knut Nedregotten, regionssjef Trondheim, 926 31 378, petter.nedregotten@fredensborgbolig.no** |
| **Koteng Eiendom** | Grilstad Marina, Leangen, Leangenbukta/Parktunet, Byhagen, Leangenbolig | Plyo (`*.plyo.cloud`), konto per prosjekt. `leangenbolig.no` har CSP | — | Travbanevegen 2, 73 80 22 20, koteng@koteng.no |
| **Trym Eiendom** | TUN32, Gildheim, Varden Byåsen, Nye Valentinlyst | Plyo, konto per prosjekt | Nylander (TUN32), EM1 (øvrige) | Terje Steen, daglig leder, 93 22 55 99 |
| **Rett Hjem Bolig** | Saupstad Torg (252 boliger), Heimdalsporten, Jonsvannsveien 82 | Plyo (Saupstad Torg, m/TravelTime). Firmaside på Wix | EM1 + HEM | Christoffer Søbstad, kontor@rett-hjem.no, 984 21 950, Brøsetvegen 164 E |
| **Villaservice** *(søkebasert, ikke primærverifisert)* | Høisethlia (42), Arkaden Lademoen (37, «Villaservice City AS») | Plyo, begge m/TravelTime | EM1, EM1+HEM | — |
| **KOBE / Karl-Ove Bjørnstad Eiendom** *(søkebasert)* | Godthåb Øya (37) | Plyo m/TravelTime | EM1 | Mikal Bjørnstad, daglig leder |
| **Nordr** | Nye Lilleby | Plyo — konto heter «Nordr» (konsern, ikke prosjekt) | DNB Eiendom | — |
| **HAW Gruppen** | Trøsen, Rådhusplassen Boliger (begge Klæbu) | Kvass | Proaktiv | — |
| **Solon Eiendom + OBOS** | Lille Lade | eget | EM1 + Solon | — |
| **Strandveiparken Eiendom AS** | Strandveiparken, Solsiden (33) | eget | EM1 | — |
| Skanska Bolig | Lillebytunet | eget (XFO satt) | — | — |
| Norgeshus | Furuhaugen, Melhus | WordPress | — | — |
| Betonmast / Gresseth | Sjøgata 7, Stjørdal | eget | — | — |
| Valbo AS | Tanem Hage (18) | eget (XFO satt) | — | — |
| Dyrendahl Bygg AS | Rissa sentrum | WordPress | — | — |
| PWS Godhavn Utbygging (Williksen) | pgutb.no | Plyo | — | — |
| Emera | Ranheim | Next.js, eget | Emera Eiendomsmegling | — |

**Sju Plyo-prosjekter mangler fortsatt utbygger-navn** — de navngir ham ikke på siden, i FINN-annonseteksten
eller i Plyo-dataene: iRingve, Angelltrøa Hovedgård, Solåsen, Sjetnegrenda, Moholtpynten, Sagapark,
Yippi Flatåsen. Navnet står i salgsoppgave-PDF-en. Fem av sju er EM1-meglet — det er *ikke* det samme som
at EM1 eier siden.

**Ekstra funn:** Plyos `accountsSites`-felt lekker hele kontoens søsken-sider. Finner du én Plyo-side,
får du hele utbyggerens portefølje gratis. Det er slik Fredensborgs seks sider ble funnet fra overvik.no.

---

## §7 Beslutning: utbygger-først, ikke megler-først

**Megleren eier ingen vegg.** Verifisert i august: `eiendomsmegler1.no` har 0 iframes på 153 sider og er delt
SpareBank 1-frontend. Utbyggeren eier prosjektsiden, CMS-påloggingen og markedsbudsjettet.

Det er ikke to konkurrerende dører, men **to forskjellige produkter**:

- **Utbygger** → prosjekt-SKU (oppsett 24 000 + 4 490/mnd, jf. LOG 2026-09-02 forts.), med en faktisk vegg
- **EM1-kontorpiloten** → bruktmarkedet, hvor det ikke finnes embed uansett og poenget er FINN «Nyttige
  lenker» + måling

**Sidegevinst:** EM1-meglerne som står på Overvik-siden ser resultatet uten at vi har solgt til dem. Det er
en varm inngang til Grilstadporten senere, betalt av noen andre.

**Unntaket som bekrefter regelen: Wesselsløkka.** Der eier HEM domenet selv (verifisert 2026-08-04), så der
*er* megleren eieren av veggen — og siden ligger på Marketer, ikke Plyo. Den mailen berører altså ikke Plyo
i det hele tatt, og er derfor den mest radar-trygge første døra vi har.

---

## §8 Første kalde mail sendt — Thomas Løbakk, 2026-09-08

Mail til `tl@hem.no` sendt samme dag. Emne: **«Wesselsløkka – la boligkjøperne utforske nærområdet»**.
Ber om en halvtime «neste tirsdag», på kontoret eller på infosenteret.

Formuleringen er lagret som mal i **`docs/strategy/maler/kald-mail-prosjektside.md`** — den er den første av
mange, og strukturen skal gjenbrukes mot utbyggerne i §6.

To ting ble rettet rett før sending:
1. Emnefeltet sto opprinnelig med feilstavet prosjektnavn («Wesseløkka»)
2. Setningen om at løsningen kan ligge på wesselslokka.no lå i en sitatblokk — flyttet til vanlig brødtekst,
   fordi en sitatblokk leser som om man siterer noen andre

Dette er første gang Placy går til noen som faktisk selger boliger.

---

## §9 Åpne tråder

- **Rollen kan ikke observeres utenfra.** Om Fredensborgs markedsperson har BUILDER eller bare EDITOR avgjøres
  først i samtalen. Har hun bare EDITOR, må Plyo skru den opp — planlegg svaret på det.
- **De sju uidentifiserte Plyo-utbyggerne** (§6) — hentes fra salgsoppgave-PDF eller Brønnøysund.
- **Villaservice og KOBE er søkebaserte**, ikke primærverifisert. Bekreft før kontakt.
- **Kvass-plattformen er ikke undersøkt** på samme måte som Plyo. Vi vet ikke om den har en tilsvarende
  selvbetjent iframe-modul. To Klæbu-prosjekter venter på det svaret.
- **Overvik-board ikke bygd.** Adressen står i Plyos egen kartmodul: Presthusvegen 45, 7056 Ranheim.

## Kilder

- Trello «Demo Pipeline» (HA0cmZhp) kort **#25–#35** — utbygger-kartet i pipeline-form
- `docs/strategy/2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md` — HEM/Wesselsløkka-grunnlaget
- `docs/strategy/2026-09-01-prisvalidering-bevispakke.md` §6 — Plyo-addendumet (2024-tallene)
- `docs/strategy/maler/kald-mail-prosjektside.md` — mal for førstekontakt
