# Reels-manus — mal

Mal for reels-manus brukt i sidebaren på `/rapport-board`. Feeden har fem manus-bærende kort-typer i rekkefølge:

1. **Velkomst** — meta-orientering, helt i topp. *"Velkommen, dette skal vi gå gjennom."*
2. **Nabolaget (Home)** — etablerer nabolaget før kategoriene starter
3. **Kategori** (en per kategori — mat-drikke, transport, natur osv.) — stemning og type-spekter
4. **Outro / Oppsummering** — knytter sammen før megler-cardet
5. **Megler** — statisk kontaktkort, ingen audio

Hver audio-bærende manus er ~15-30 sek VO, spilles mens video-bg ruller og karaoke flyter i sidebar. Kartet til høyre står for spesifikk data (POI-markører) — manuset står for stemning og type-spekter.

## Velkomst-manus (helt i topp)

Det aller første audio-bærende kortet i feeden. Funksjonen er **meta-orientering** — boligkjøperen får vite hva hun har foran seg.

Dette er ikke nabolags-innhold. Det er en *rammesetting* som forteller hva de neste kortene kommer til å gjøre. Tilsvarer den gamle "Start opplevelsen"-knappen øverst i sidebaren.

### Hva velkomsten skal levere

| Element | Hvorfor |
|---------|---------|
| **Hilsen + prosjektnavn** | "Velkommen til Stasjonskvartalet." — festepunkt for hele opplevelsen, og det eneste manuset hvor prosjektnavnet skal sies tydelig. |
| **Hva som kommer** | "De neste minuttene skal vi gå gjennom nærområdet." — gir tids-/innholdsforventning. |
| **Hvordan brukeren navigerer** | Eventuelt ett hint om at hun kan swipe / scrolle. Hold det kort — UI-en taler for seg selv etterhvert. |

### Struktur (2-4 setninger, kort manus)

Velkomsten er det korteste manuset i feeden. ~8-15 sek total. Brukeren skal komme seg videre raskt.

| Slot | Type | Eksempel-tekst |
|------|------|---------------|
| 1 | Hilsen + prosjektnavn | "Velkommen til Stasjonskvartalet." |
| 2 | Hva som kommer | "De neste minuttene skal vi gå gjennom nærområdet — det som omgir deg her i hverdagen." |
| 3 (valg) | Karakter-anker | "En tett, urban bydel med kort vei til både elv og fjord." |
| 4 (valg) | Ankerlinje | "Klar? La oss starte." |

### Hva velkomsten IKKE skal være

- **Ikke en bygg-presentasjon.** Bane NORs prosjekt-detaljer hører hjemme hos megler eller i rapport-toppen.
- **Ikke en nabolags-etablering.** Det er nabolaget-cardets jobb (slot 2 i feeden).
- **Ikke en kategori-oppramsing.** Hver kategori introduserer seg selv.
- **Ikke en salgsfrase.** "Ditt nye hjem venter" lander billig.

### TTS-merknad for velkomst

Dette er det eneste manuset hvor prosjektnavnet **må** uttales tydelig. Test rendering — hvis Erik snubler på "Stasjonskvartalet", legg det først i setningen og bruk en kort pause etter.

---

## Nabolaget (Home) — etablerings-manus

Andre audio-bærende kort. Funksjonen er **innhold-etablering** — plasserer nabolaget i en stemning og forteller hva slags rom det er, før kategori-narrativet starter.

### Hva nabolags-manuset skal levere

| Element | Hvorfor |
|---------|---------|
| **Geografisk plassering** | Hvor i byen / hvilken bydel — én setning, kart løser resten |
| **Karakter-signal** | Hva slags nabolag er dette? (urbant, tett, historisk, sjønært, familievennlig) |
| **Bredde-signal** | Hva slags liv kan man leve her, på et høyt nivå — uten å gå inn i kategorier |
| **Ankerlinje** | Peker fremover mot kategori-kortene ("La oss se nærmere på...") |

### Struktur (3-5 setninger, ~10-18 sek)

| Slot | Type | Eksempel-tema |
|------|------|---------------|
| 1 | Plassering | "Nabolaget ligger sentralt i Trondheim, rett ved hovedstasjonen." |
| 2 | Karakter | "Det er en tett og urban bydel, men med kort vei til både elv og fjord." |
| 3 | Bredde-signal | "Innenfor ti minutters gange finner du alt fra restauranter og parker til kollektivtransport som tar deg ut av byen." |
| 4 | Ankerlinje | "La oss se nærmere på hva som omgir deg her." |

### Hva nabolags-manuset IKKE skal være

- **Ikke gjenta prosjektnavnet.** Det er allerede sagt i velkomsten. Bruk "nabolaget", "her", "området".
- **Ikke ramse opp kategorier.** Bredde-signalet er én setning, ikke en liste.
- **Ikke gå inn i spesifikke POI-er.** Kart + kategori-kort tar det.

---

## Hvorfor en mal

Reels-manus skiller seg fra rapport-/audio-tour-manus på fire viktige punkter:

1. **Cut-punkter ligger på setningsslutt** (Level B beats-match). Bildet bytter når punktum kommer. Pakker du to temaer i én setning, bytter ikke bildet i takt med stemmen.
2. **Pacingen er kort.** ~20-30 sek total ved Erik turbo_v2_5 → 6-8 setninger.
3. **Manuset må være TTS-trygt og bilde-skalerbart.** Lokale stedsnavn er TTS-eksplosiver, og spesifikke POI-navn krever spesifikke bilder — det skalerer ikke over kategorier eller prosjekter.
4. **Kartet løser spesifisitet.** Boligkjøperen får faktiske navn, åpningstider og avstand fra markørene. Manuset trenger ikke duplisere det.

## Kjerneprinsipper

### 1. Generisk på navn, konkret på type

Manuset får **ikke** nevne lokale POI-navn ("Kafé Sebastian", "Britannia Hotel"). Det får godt nevne:
- **Allmenne destinasjons-navn** som har betydning utenfor lokalmiljøet ("Oslo", "Røros", "Værnes")
- **Standard type-kategorier** ("Michelin-kjøkken", "bakeri", "kaffebar", "yogastudio", "fjordbad")
- **Bynære områdebetegnelser** som har allmenn bruk ("Midtbyen", "Bakklandet" — men kun hvis TTS klarer dem, og helst i én setning maks per manus)

Tomt: *"Mat-tilbudet i området er bredt og variert."*
Bra: *"Du finner alt fra Michelin-stjernet kjøkken til folkelige bakerier — og kaffebarer som er åpne fra grytidlig morgen."*

Det andre er fortsatt generisk på navn, men konkret nok på type-spektrum at boligkjøperen får et faktisk bilde.

### 2. Ett tema per setning

Cut-punkter ligger på `.`/`?`/`!`. Hver setning får sin egen visuelle beat. Mikser du to temaer per setning (f.eks. "bakerier og bryggerier") må bildet enten holde lengre på ett av dem eller hoppe midt i — begge er dårlig.

**Tommelfingerregel:** Hvis en setning krever to ulike bilder, splitt den.

### 3. Fakta-orientert framfor poetisk

Manuset er kuratert, ikke litterært. Tomt: *"Lukten av nybakt brød følger deg hele veien hjem."* Bra: *"Bakeriene åpner fra grytidlig morgen."* Forskjellen er: fakta beskriver hva som ER (åpningstider, dekning, antall, sesong, avstand, type). Poesi beskriver hva det "kjennes som".

Drop alltid:
- *"Lukten av..."*, *"smaken av..."*, *"følger deg..."*, *"drømmen om..."*, *"perfekt for..."*

Sansebaserte detaljer er OK når de er konkrete fakta — *"Mange kaffebarer brenner egne bønner"*, *"Uteservering åpner langs elva fra mai til september"* — ikke når de er litterære bilder.

### 4. 6-8 setninger

Mindre enn 6 mangler tema-spektrum. Mer enn 8 blir for langt VO og bryter SOME-pacing. Vanlig leveranse: 7 setninger.

### 5. Avslutning skal IKKE være sales pitch

Den siste setningen knytter manuset til hverdagen — ikke til "verdien" av boligen. La boligkjøperen selv trekke verdi-koblingen. Salgsfraser ("perfekt for deg som elsker mat") gjør manuset billig.

## Skjelett-struktur (fleksibel)

Ikke obligatorisk i denne rekkefølgen — bruk som sjekkliste, ikke som tvang.

| Slot | Type | Funksjon |
|------|------|---------|
| 1 | Stemnings-etablering | Plasserer kategorien i et nabolags-rom, ikke i et tilbud-katalog |
| 2-4 | Type-spektrum | 2-3 setninger som dekker bredden. Hver setning ett type-tema. |
| 5 | Differensieringssignal | Hva er spesielt med akkurat dette nabolaget? (urban tetthet, hist. kontekst, nærhet til noe) |
| 6 | Tilgjengelighet/rytme | Avstand/tid/når-på-dagen — "innen ti minutters gange", "tidlig morgen til sent på kvelden" |
| 7 | Fakta-detalj | Konkret fakta — sesongåpning, åpningstider-rytme, antall/dekning, avstands-detalj |
| 8 (valg) | Avslutning | Knytter til hverdagen. Ikke salg. |

## TTS-regler for norsk (Erik turbo_v2_5)

- **Stedsnavn** — én lokal stedsnavn per manus, maks. Velg det viktigste. Resten håndteres via kart-markører.
- **Bindestrek-ord** — Erik leser hver del separat. "Kaffe-bar" blir "kaffe" pause "bar". Bruk det bevisst eller skriv sammen ("kaffebar").
- **Tall** — skriv som ord (`ti`, ikke `10`) for sikker rendering, unntatt år (`2026`).
- **Pris-formuleringer** unngås — manuset skal ikke aldres med endrede priser.
- **Engelske ord** — bruk sparsomt. Erik håndterer "SoMe", "stand-up", "co-working" ok, men sjekk lytte-validering.

## Bildemateriale per manus

Hver setning skal kunne matches mot 1 bilde fra prosjektets bilde-pool:

- **Imagen 4 fra scratch** når bildet er konseptuelt (yogastudio-stemning, kontordeling, hyggelig fortauskafé)
- **Megler/byggherre-uploadet** når bildet er fra faktisk lokasjon og rettighetene er klare
- **Stock + AI-modifisering** når vi trenger spesifikk vinkel
- **IKKE Google Places-bilder** — Maps Platform ToS section 3.3 forbyr eksplisitt AI/ML-input (se worklog 2026-05-25 natt)

Pool-størrelse per kategori: 6-8 bilder for et 7-setningers manus (litt overlapp gir komposisjons-fleksibilitet).

## Validering før commit

1. **Les manuset høyt** — flyter setningene som tale, eller skriver-pose?
2. **TTS-rendering på full pipeline** — Erik turbo_v2_5 stability 0.75 på det FULLE manuset, ikke en kort snippet (modellen er stokastisk per request)
3. **Sjekk bildebredde** — har du 6-8 bilder som faktisk dekker setningene? Hvis ikke, juster manus eller utvid pool.
4. **Lytt med karaoke** — flyter karaoke-tempo med VO uten å henge etter eller løpe foran?

---

## Referanse-eksempel: Mat & drikke (Stasjonskvartalet)

Tema: 7 setninger, dekker spekter fra fin- til folkelig, urban tetthet, dags-rytme (morgen→kveld) som strukturerende akse, fakta-orientert avslutning. Velkomst-manuset etablerer "Stasjonskvartalet" — her brukes "her" / "i nabolaget".

```text
Matscenen her hører til de tetteste i landet.
Du finner alt fra Michelin-stjernede kjøkken til folkelige bakerier.
Sushi og asiatiske kjøkken holder seg i egne kvartaler med valg i alle prisklasser.
Vinbarer og bryggerier overtar etter mørket — flere er åpne til godt forbi midnatt.
Kaffebarer er åpne fra grytidlig morgen, mange med eget brennverksted.
Alt ligger innenfor ti minutters gange, og du krysser elva mellom kvartalene.
Uteservering åpner langs elva fra mai til september.
```

**Hvorfor disse valgene:**

1. **"Matscenen her hører til de tetteste i landet"** — tetthets-signal som differensieringssignal. "Her" fordi velkomst-manuset alt har sagt Stasjonskvartalet.
2. **"Michelin-stjernede kjøkken til folkelige bakerier"** — bredde-signal som type-spektrum. Ingen restaurantnavn — kartet leverer dem.
3. **"Sushi og asiatiske kjøkken"** — distinkt visuell beat (asiatisk mat ser annerledes ut enn nordisk fin-dining). "Alle prisklasser" som fakta-signal.
4. **"Vinbarer og bryggerier"** — kvelds-aksens. "Etter midnatt" gir konkret åpningsfakta.
5. **"Kaffebarer ... eget brennverksted"** — morgen-aksens. "Eget brennverksted" er konkret fakta om hva aktørene gjør, ikke poesi.
6. **"Ti minutters gange"** + **"krysser elva"** — fakta om avstand + romlig orientering. Elva (Nidelva) ikke nevnt med navn pga TTS-risiko.
7. **"Uteservering åpner fra mai til september"** — fakta-avslutning med sesong-signal. Konkret, ikke poetisk.

**Hva som IKKE er med (bevisst):**
- Ingen lokale restaurantnavn (kartet leverer dem)
- Ingen prisindikasjoner i kroner (aldres)
- Ingen Michelin-stjerners faktiske antall (ville endret seg)
- Ingen poetiske formuleringer ("lukten av...", "følger deg hele veien hjem")
- Ingen "perfekt for foodies"-salgsfraser
- Ingen detaljerte åpningstider per kategori (kartet løser det)

**Bilde-pool-skisse (7 bilder for 7 setninger):**
1. Bredt nabolags-bilde med flere matsteder i samme ramme (etablering)
2. Fin-dining-detail — duket bord, lystenning, nordisk minimalisme
3. Asiatisk mat — sushi-rull i nærbilde, eller asiatisk gateserveringskjøkken
4. Vinbarscene — kveld, vinglass, dempet lys
5. Kaffebar morgen — espresso-trekk, eller bønne-brenning
6. Folk som krysser bro i Midtbyen, dagslys
7. Uteservering langs elva, sommerkveld

**TTS-estimat:** ~26-28 sek. Innenfor sweet-spot.
