# Hvem bygger vi for — og prototypemiljøet som svarer på det

**Dato:** 2026-08-25
**Kilde:** Andreas' brain dump (`placy-dumpå.json`, 10:28 lydopptak)
**Status:** Sparring landet, prototypemiljø bygget og verifisert. Prototype-køen er
forslag — ikke ratifisert.

---

## Del 1 — Hva du sa

Sortert etter hva det faktisk er, ikke rekkefølgen det ble sagt i.

### Utfordringen du kjenner på

Fokuset flyttes fra pipeline/data til **selve produktet** — hvordan det oppleves og
faktisk brukes. Formålet er å jobbe strategisk og visuelt med UX for å forbedre flyten.

Det konkrete symptomet: **desktop og mobil er ute av takt.** Desktop åpner boardet med
en kategoriutlisting; trykker du deg inn får du omtrent det mobilen har som *forside*.
To formater som må optimaliseres hver for seg, men som skal føles som samme konsept.

Men du sier selv at symptomet ikke er problemet. Problemet under er: **hvem skal bruke
det her, og hvor mye kompleksitet tåler de?**

### Erkjennelsen om deg selv som bruker

Du har høy mental kapasitet for programvare — du er ikke normalen. Du går inn i Google
Maps, finner punkter, får inntrykk av et område, googler videre det som er
interessant. Samme mønster på Sydenferie: satellittmodus, finn en fin plass, utforsk
hoteller og prisrange derfra.

Og så konklusjonen som er den skarpeste tanken i hele dumpen:
**folk drar på charterferie for en grunn.** Apollo og TUI er normalen fordi folk vil ha
pakketert og ferdig. Placy må kuratere ferdig og servere ferdig.

### Motsigelsen du selv fanget

Hvis du skal *skrive og fortelle* om et område, blir det tekst og bilder — altså
nettside igjen. Så hva er Placy?

Ditt svar: Placy skal ha mye innhold, og skal være **best på å få det frem**. Å sy
sammen tekst og multimedia med et kart — fordi kartet er den mest optimale måten å få
frem et geografisk område på. Det er sammensyingen som er produktet, ikke tekst alene
eller kart alene.

Og det er en kjempeutfordring — særlig på mobil web, uten native-mulighetene
(haptikk, gesture-patterns, skjermflate).

### Innholdsnivåene

Nivå 1 og nivå 2 finnes. Lydspor per kategori finnes. Du vil ikke bort fra det — men
**nivå 1 må få denne typen innhold** for å differensiere seg nok mot andre aktører til
å være verdt det.

Med forbeholdet: fleksibiliteten må ikke skade skalerbarheten. Skalerbarhet =
programmatisk bygging, automatikk, skills som kuraterer, nok datagrunnlag. (Du markerte
selv det som eget tema.)

### Det du ber om

Et prototypemiljø. Raskt bygde prototyper som åpnes på telefon og i nettleser, der du
kjenner hvordan interaksjonen, UX-en og UI-et faktisk fungerer — på ekte Placy-materiale.
Poenget er **langt raskere prototype-evne** enn å bygge det for ekte med worktrees og
tester. «Man kan sitte og tenke seg i hjel» — bruk teknologien til å faktisk besvare
utfordringene, slik at de blir konkrete.

---

## Del 2 — Sparring

Her utfordrer jeg. Fem punkter, i den rekkefølgen de påvirker hverandre.

### 1. «Hvem skal bruke det» har allerede et svar — det er bare ikke UX-svaret ennå

Forretningssporet har landet dette: **kjøperen er megleren eller utbyggeren, brukeren er
boligkjøperen.** Det du mangler er ikke en målgruppe-beslutning, men den *situasjonen*
brukeren er i når de møter boardet.

Fra distribusjonsarbeidet vet vi hvor de kommer fra: en lenke i FINN-annonsens «Nyttige
lenker», en visningsbekreftelse på e-post, en QR på papir, eller et embed på et
prosjektnettsted. Det betyr:

- **De kom ikke for å utforske et område.** De så på *én bolig*.
- **De er på telefon**, midt i en annen sesjon (FINN-scrolling, e-post).
- **De har titalls sekunder**, ikke minutter, før de bestemmer om dette er noe.
- **De har alt en inkumbent i samme slot**: FINNs Nabolagsprofil.

Det gjør Google Maps-analogien til feil referanse — og charter-analogien til nesten
riktig. Nesten, fordi:

### 2. Charter-analogien er riktig, men du stopper for tidlig

Apollo-kunden vet at de skal til *et sted* og velger pakke. Placy-brukeren har alt
valgt stedet — boligen ligger der den ligger. De har ikke et valg-problem. De har et
**spørsmåls-problem**: «er dette et sted jeg kan bo?»

Det snur produktdefinisjonen din litt: du sier «kuratere ferdig og servere ferdig», og
det er riktig — men det som skal serveres ferdig er ikke et *utvalg*, det er et **svar**.

Og det avgjør rollefordelingen du sliter med å sy sammen:

> **Fortellingen er produktet. Kartet er beviset.**

Kartet er ikke halvparten av en likestilt sammensying. Det er det som gjør at den
kuraterte teksten ikke er en påstand. Derfor er «å sy dem sammen» lettere enn du frykter
— det er ikke to like tunge lag som skal balanseres, det er en påstand med bevis under.
Prototype 01 er bygget på nøyaktig denne tesen, og prototype 03 er der for å motbevise
den ærlig.

### 3. Desktop/mobil-mismatchen er ikke et formatproblem — det er et hierarkiproblem

Du beskriver det som «to helt ulike format som må optimaliseres hver for seg». Det er
sant om *layout*, men det er ikke der feilen sitter.

Desktop åpner med kategoriutlisting. Det er et **verktøy** — «velg en kategori» — og det
forutsetter en bruker som vet hva de leter etter. Mobil åpner med noe annet. Ingen av
dem åpner med svaret.

Fiks hierarkiet, og mismatchen løser seg nesten av seg selv:

```
svar  →  bevis  →  dybde på forespørsel
```

Samme ryggrad, to renderinger: bottom-sheet over kart på mobil, fast kolonne ved siden
av kart på desktop. Prototype 04 tester nøyaktig om det holder.

Merk: dette er ikke tvungen felles komponent — mobil-native UX er viktig og komponenter
skal divergere der mønstrene divergerer. Men *rekkefølgen på informasjonen* skal være
den samme, ellers er det to produkter.

### 4. Kompleksitets-spørsmålet er feil stilt

Du spør «i hvilken grad kan man ha kompleksitet?». Riktigere spørsmål:
**hvor mye kompleksitet før svaret er levert?**

Svaret på det er ~null. Etter at svaret er levert: så mye du vil, fordi alle som er der
har valgt å gå dypere.

Apollo har en enorm kompleksitets-hale — filtrer på 40 kriterier hvis du vil. Men
forsiden er ett bilde og én pris. Det er ikke enkelhet, det er **progressiv avdekking**,
og det er allerede mønsteret i disclosure-arbeidet vi har gjort.

Det betyr også at «kart eller kuratering» ikke er et valg. Ditt Google Maps-instinkt
skal *ikke* kastes — det skal ligge i halen. En kuratert forside for de 95 %, og en
utforsk-flate for de 5 % som er deg. Du taper ingenting på å legge din egen bruksmåte
ett nivå ned.

### 5. Fleksibilitet vs. skalerbarhet har en presis grense — skriv den ned

Du sier fleksibiliteten ikke må skade skalerbarheten, men ikke hvor grensen går. Forslag
til regel:

> **Fleksibiliteten ligger i innholdet, ikke i layouten.**

Innhold kurateres per strøk og amortiseres over alle boliger i strøket (Moat 1 — det er
selve grunnen til at per-bolig-kostnaden ikke eksploderer). Layout er én. Hver
layout-variant du tillater multipliserer QA-flaten og undergraver kjede-SaaS-modellen,
der poenget er at alle listings får samme inventar.

Det gir også kravet til nivå 1 en presis form: nivå-1-boards skal ikke ha *mindre* UI —
de skal ha **samme UI med tynnere innhold**, og det innholdet må likevel *føles*
stedsspesifikt og ikke templatet. Om det faktisk føles slik er et UX-spørsmål, og
prototype 06 er der for å svare på det.

### En innvending mot meg selv

«Svar-først» kan bli en floskel-generator: et hero-kort som sier «rolig nabolag med
gode skoler» er nøyaktig den svadaen vi forkastet da vi kastet score-primitivet. Svaret
må være **konkret og etterprøvbart** («Eberg skole, ti minutter til fots») — ikke en
karakteristikk. Prototypene må testes med ekte data nettopp fordi det er der man ser om
svaret bærer eller blir tåke.

---

## Del 3 — Prototypemiljøet (bygget)

Ligger i `prototypes/`. Vanilla HTML/CSS/JS, ingen build, ingen worktree, ingen tester.

```bash
npm run proto                                              # server + live-reload + LAN-URL
npm run proto:data -- broset-utvikling-as wesselslokka      # hent ekte board til JSON
```

Fire ting den gjør:

1. **Ekte data.** `scripts/export-proto-snapshot.ts` kjører v2-lesestien og dumper hele
   `Project`-objektet til `prototypes/_data/<customer>__<slug>.json`. Wesselsløkka er
   hentet: 98 POI-er, 16 kategorier, 7 temaer med bridgeText/leadText/editorial.
   Tekstmengde og POI-tetthet er en del av det som testes — lorem ipsum ville løyet.
2. **Mobil uten friksjon.** Serveren binder `0.0.0.0` og printer LAN-URL-en. Ingen
   Next, ingen HMR-websocket, ingen `allowedDevOrigins` som må oppdateres med dagens IP
   — den klassen av mobil-verifiseringsproblemer finnes ikke her.
3. **Live-reload.** `fs.watch` + Server-Sent Events, reload-snippet injiseres i all
   HTML. Lagre fil → telefon og desktop laster på nytt samtidig.
4. **Galleri.** `prototypes/index.html` lister prototypene med *spørsmålet hver av dem
   stiller*. Én prototype, ett spørsmål.

Delt kode i `_shared/` er bevisst tynt (tokens.css, `loadBoard()`, `themeColor()`,
`poisForTheme()`). Divergens mellom prototyper er billigere enn abstraksjon.

Genererte artefakter (`_data/`, `_shared/env.js`) er gitignored. Mapbox-tokenet leses
fra `.env.local` ved serverstart — kun `NEXT_PUBLIC_`-tokenet, aldri secrets.

### Baseline 00 — dagens nivå-1-board, gjenskapt (bygget, verifisert)

**Andreas' styring (samme sesjon):** ikke bygg spekulative retninger først —
gjenskap UX-mønstrene vi har i nivå 1 og iterer videre på dem. Baselinen er
derfor prototype nr. 0, og alt annet måles mot den.

**Nivå-definisjonen ble korrigert underveis, og det er en viktig korreksjon:**
nivå 1 = board **uten avspillbar lyd**. Jeg antok først at skillet lå i om
`theme.editorial` fantes. Det er feil, og kodens egen forgreining beviser
Andreas' definisjon: `isPlayableAudio` (krever både `url` og ikke-tom `manus`)
→ `hasPlayableContent` på desktop, `hasAudioMobile` på mobil. Stasjonskvartalet
har `reelsAudio` på alle sju temaer og er altså nivå 2, ikke nivå 1.

Kuratert vs. ukuratert er en **uavhengig akse**: et nivå-1-board kan godt ha
kuratert strøkstekst. Samme UI, ulik datarikdom. Baselinen veksler mellom
begge:

- **Ranheim** (`megler-harstad/strindfjordvegen-10-...`) — nivå 1, kuratert
  strøk: 6 kategorier med kuratert prosa, 4–6 FAQ-svar hver, 3 highlights
- **Ferjemannsveien 10** (`klp-eiendom`) — nivå 1, ukuratert: 5 kategorier med
  deterministisk generert tekst, ingen global FAQ

Snapshot-scriptet eksporterer den **avledede** board-modellen (samme
`transformToReportData` → `adaptBoardData` boardet selv kjører), ikke rå
`products.config`. Det var nødvendig: minimum-garantien oppstår nedstrøms av
configen, så rå config får et ukuratert board til å se tomt ut selv når boardet
faktisk viser tekst.

**Det viktigste funnet fra gjenskapingen:** desktop og mobil svarer i dag på to
*ulike spørsmål*, ikke bare i to ulike layouter. Det er den egentlige
mismatchen Andreas kjenner på:

| | Desktop | Mobil |
|---|---------|-------|
| Kategorikort | Illustrasjon + kuratert lead-prosa | Ikon + dekningstall + 3 POI-rader + «Se alle N» |
| Stemme | Redaksjonell | Data (Citymapper-aktig) |
| Indeks-lista | Alle kategorier | Utsnitts-scopet — å dra kartet ER filteret |
| Drill-in | Kun det som er i kartutsnittet | Hele kategorien |
| POI-trykk | Mini-popup ved markøren | Modalen ER POI-flaten |

Begge valgene er velbegrunnede hver for seg (mobilens «se alle 17» ville løyet
hvis den var utsnitts-filtrert; desktops liste leses side om side med kartet).
Men til sammen betyr det at desktop selger *stedet* og mobil viser *avstander*.
Det er en produktbeslutning som aldri er tatt eksplisitt, og den bør tas før
noen ny retning bygges.

Verifisert i Chrome: mobil 390×844 (sheet 0.34–0.86 fri drag, drill-in 58 %,
peek 20 %, POI-modal), desktop 1440×900 (438 px sidekolonne, drill-in med
«127 av 128 synlig · 3–50 min»), 0 console-feil på begge boards.

### Prototype 01 — «Fortelling-scroll» (bygget, verifisert)

Bygget FØR styringen over, og er derfor en kandidat-retning, ikke utgangspunktet.
Peker nå på Ranheim (nivå 1).

**Spørsmål:** kan hele boardet leses som én fortelling der kartet bare følger med — null
interaksjon utover scroll?

Kartet ligger fast i bakgrunnen. Fortellingen scroller over: hero med heroIntro, ett
kort per tema med bridgeText + leadText + POI-chips med gangtid, outro med summary.
Ved hvert steg bytter markørene til temaets POI-er og kameraet flyr til utsnittet.
Chip-klikk er den valgfrie dybden — flyr til punktet uten å forlate fortellingen.

Samme DOM på begge formater: mobil = kort over fullskjermkart, desktop = venstre kolonne
med fast kart til høyre. Verifisert i Chrome på 390×844 og 1440×900, 0 console-feil.

---

## Del 4 — Plan

### Køen av spørsmål

Hver prototype stiller ett spørsmål og skal kunne kjennes på under et minutt.
Rekkefølgen er valgt slik at hver besvarer noe den neste bygger på.

Alle iterasjoner starter som `cp -r 00-niva1-baseline`, aldri fra blankt ark.
Det holder dem sammenlignbare, og det tvinger endringen til å være et *inngrep*
i dagens flate framfor en ny flate ved siden av den.

| # | Iterasjon | Spørsmålet den svarer på |
|---|-----------|--------------------------|
| 00 | Baseline ✅ | Ingen — den er målestokken |
| 02 | Én stemme, to formater | Skal mobil-kortet få desktops kuraterte prosa, eller skal desktop få mobilens POI-rader? Én av dem er feil i dag. |
| 03 | Svar-først | Kan «er dette et sted jeg kan bo?» besvares konkret øverst — uten å bli svada? |
| 04 | Nivå-1-følelsen | Føles Ferjemannsveien (ukuratert) kuratert, eller templatet? Baselinens veksler gjør dette målbart nå. |
| 01 | Fortelling-scroll ✅ | Kandidat-retning, bygget før styringen. Kan boardet leses som én fortelling? |

**02 er den neste som bør bygges.** Den følger direkte av baseline-funnet: i dag
selger desktop stedet og mobil viser avstander, og siden mobil er der brukeren
faktisk er, er det mobilen som taper mest på å mangle stemmen. Iterasjonen er
liten (bytt innholdet i `.m-card`), og resultatet er en produktbeslutning, ikke
en preferanse.

**04 er den kommersielt tyngste**: den avgjør om nivå-1-boards kan selges som
fast inventar i en kjedeavtale, eller om de er en svakhet vi må skjule. Den er
billig nå — baselinen veksler mellom kuratert og ukuratert med én klikk.

### Hvordan vi avgjør

En prototype er ikke ferdig når den ser bra ut, men når den har en **dom**: vant eller
tapte, og hvorfor. Dommen skrives i `PROJECT-LOG.md` når en retning avgjøres — prototypen
selv slettes ikke, den ligger i git.

Retningen som vinner går inn i normal `/full`-flyt mot produksjonskoden. Prototypene er
ikke kode som skal migreres; de er beslutninger som skal tas raskt.

### Det jeg ikke rørte

- **Skalerbarhet/pipeline** — du markerte selv som eget tema.
- **Nivå-1-innhold i produksjon** — venter på dommen fra 06.
- **Native app** — mobil web er premisset, og begrensningen er ikke haptikk. Det er at
  du ikke kan regne med at gestures blir oppdaget. Regel for alle prototyper: ingen
  gesture skal være eneste vei til noe.
