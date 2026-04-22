# Sem & Johnsen-prinsipper (rendyrket)

Denne skillen har **S&J som eneste stilmal** for beliggenhetstekster. Curator-skillens 6 prinsipper var destillert fra 4 kilder; her destillerer vi bare S&J.

Ikke bland inn:
- Reiseguide-mønstre (Lonely Planet, Visit Norway) — for turist-orientert
- Restaurant-anmeldelser (Anders Husa) — for restaurant-sentrisk
- Monocle/Kinfolk — for sensorisk-abstrakt

S&J er forankret i **bolig-kjøpeperspektivet** — det er vår målgruppe.

## 5 kjerneprinsipper (S&J-rendyrket)

### A. Navngi, aldri generaliser
S&J: *"Kiwi Finstad og Meny Nordbyveien i gangavstand. Ski storsenter ligger i umiddelbar nærhet med over 140 butikker."*

Hver påstand forankres i konkret navn. Ingen "flere dagligvarer i området" — spesifiser hvilke.

**Regel:** Minst 2 POI-navn per kategori-tekst. For H-kategorier: minst 3-4.

### B. Mal bevegelse
S&J: *"Langs Akerselva kan du spasere ned til Vulkan/Mathallen eller opp forbi Nydalen til Maridalsvannet."*

*"Fra Ski stasjon tar du deg til Oslo S på 11 minutter ..."*

Tekst flyter som en tur gjennom nabolaget. Leseren *går* gjennom området.

**Regel:** Minst 1 kategori-tekst per rapport skal ha eksplisitt bevegelse — *langs*, *fra...til*, *vestover*, *nedover*, *innenfor*.

### C. Bruk kontraster
S&J: *"Tilbaketrukket og rolig, samtidig med umiddelbar nærhet til sentrum."*

*"Leiligheten ligger på tredje etasje i et hjørne med skogen som nærmeste nabo."*

Spenn skaper energi. Stille + sentralt. Ro + liv. Historie + nytt.

**Regel:** heroIntro bør inneholde minst 1 kontrast. Noen kategori-tekster også der naturlig.

### D. Saklig entusiasme — ingen utropstegn
S&J: *"Ski Idrettspark ligger i umiddelbar nærhet med flotte fasiliteter for fotball, friidrett, tennis, ishall og klatrevegg."*

Konkrete fakta. Leseren lager konklusjonen selv. Ikke *"fantastisk"*, ikke *"utrolig"*, ingen *"!"*.

**Regel (maskinell):**
- Banned-ord: `fantastisk, utrolig, du vil elske, noe for enhver smak, hidden gem, must-visit, skjult perle, duftende oase, koselig, hyggelig, sjarmerende`
- Ingen utropstegn i brødtekst
- Ingen superlativer ("best", "beste", "flotteste") uten verifisert kilde

### E. Historisk forankring er trygg, nåværende er skjør
S&J tar med etablerings-årstall fra 1800-tallet uten blinke — det stemmer fortsatt i morgen.

**Regel:**
- ✅ "Trondheim katedralskole grunnlagt 1152" — trygt
- ✅ "Lysholms brenneri fra 1820 sto på tomten" — trygt
- ❌ "Pirbadet åpnet 2001" — trivia, ikke historisk forankring
- ❌ "Kokk X leder kjøkkenet" — kan endres i morgen

**Test:** Er dette sant om 5 år? Hvis nei, bruk historisk form.

### F. Ingen meter — avstand i minutter
Meter er en målestokk vi ikke kan stå for. Kilder oppgir ofte "luftlinje" eller "distanse fra sentroide", ikke faktisk gangavstand fra inngangsdøren. Vi konverterer alt til minutter.

**Konvertering:** 80 m/min (5 km/t gangtempo).

**Regel:**
- `< 80 m` → "rett utenfor døren" / "ved inngangen" / "like utenfor"
- `80–400 m` → "X minutter til fots" (1–5 min)
- `> 400 m` → bruk faktisk minutter

**Aldri:**
- ❌ "85 meter til togperrongen"
- ❌ "39 meter fra inngangsdøren"
- ❌ "120 meter mellom A og B"

**Unntak (ikke-avstand):**
- ✅ Areal: "1400 kvadratmeter spa"
- ✅ Basseng-dimensjon: "tolvmetersbasseng"
- ✅ Løype-totallengde: "28 kilometers rundløype", "40 kilometer merkede stier"
- ✅ Bygningshøyde: "Tyholttårnet 124 meter"

**Regex-blokker (mekanisk):** `/\b\d+\s*(meter|m)\b.*?(fra|til|unna)/i`

### G. Tidssensitive fakta — triangulering eller hedge
Alt som *kan* endres i morgen (åpningsdatoer, byggestatus, skolekretser, nye tilbud, kokk-bemanning) er høy-risiko. Vår WebSearch plukker ofte eldre kilder som spekulerer om framtiden. Google AI Mode triangulerer automatisk — vi må gjøre det manuelt.

**Regel:**
1. Fakta som kan endre seg → krever **2+ uavhengige kilder fra siste 6 mnd**
2. Kun én kilde → bruk hedge-ord: *planlagt*, *etter plan*, *ventet*, *under planlegging*, *ikke endelig fastsatt*
3. Google AI-sjekk med negativ-spørring (*"{fakta} status"*, *"{fakta} utsettelse"*) → hvis treff → stryk eller hedge
4. Hvis fakta er byggestein i et salgsargument: stryk helt hvis usikker (ikke hedge, men fjern)

**Banned pattern uten hedge:** `/åpner (i )?(sommeren|høsten|vinteren|våren|\d{4})/i`

**Eksempel:**
- ❌ "ny 1-7 skole åpner sommeren 2026, samtidig med innflytting" (fakta er ubekreftet — Brøset skole er i reguleringsfase per april 2026)
- ✅ "ny 1-7 skole er planlagt på Brøset, men byggestart er ikke endelig fastsatt"
- ✅ Alternativ: stryk skolen helt, bruk Eberg skole (current state) som ankerfakta

**Test:** Hvis jeg kjører en ny WebSearch i morgen, kan denne påstanden være falsifisert? Hvis ja: triangulér, hedge, eller stryk.

### H. Prosjekt-blindhet — skriv om beliggenhet, ikke prosjektet
Tekstene handler om *nabolaget rundt adressen*, ikke om selve boligprosjektet. Boligprosjektets nettsted har jobb med å selge prosjektet — vår jobb er å beskrive beliggenheten. Leseren skal kunne bruke teksten like godt om de vurderer *dette* prosjektet eller et *annet* prosjekt i samme kvartal.

**Banned:**
- Antall leiligheter/boliger: ❌ "122 leiligheter"
- Byggetrinns-info: ❌ "første byggetrinnet", "fase 2 ferdig 2027"
- Prosjekt-spesifikke arealtall: ❌ "53 prosent grøntareal", "1200 kvm fellesareal"
- Prosjekt-labels: ❌ "klimanøytral hageby" (men: "hageby-nabolag" som områdebeskrivelse OK)
- Arkitekt-navn: ❌ "tegnet av Snøhetta"
- Salgs-argumenter om prosjektet: ❌ "markedets beste takterasser"

**OK:**
- Områdekarakter: ✅ "hageby-nabolag", "stasjonsnabolaget"
- Kommuneplan-egenskaper som gjelder hele bydelen: ✅ "bilreduserte gater" (hvis kommuneplan, ikke prosjekt)
- Stedsnavn og toponymer: ✅ "Brøsetjordet", "kaifronten"

**Test:** Kan boligprosjektets nettsted kopiere påstanden og kalle den sin? Hvis ja → drop. Ville påstanden vært sann om adressen var en annen blokk i samme nabolag? Hvis ja → behold.

### I. Ikke etableringsår som argument
Alder i seg selv informerer ikke beslutningen. Et sted kan være 2 år eller 200 år gammelt — relevansen ligger i *hva det er nå*. Vår tidligere regel E tillot historisk forankring; vi strammer inn her.

**Banned:**
- ❌ "åpnet 1975", "åpnet i 2001", "åpnet sommeren 2025"
- ❌ "siden 1902", "fra 1870-tallet", "fra 2012"
- ❌ "ett av Norges eldste", "blant Norges første", "en av byens eldste"
- ❌ "har bakt siden..."

**OK (sjeldent, kun med skjønn):**
- ✅ Stedsnavn med historisk opphav (Bakklandet, Brattøra, Nedre Elvehavn) — toponymer, ikke alders-påstander
- ✅ Historisk kontekst som direkte forklarer dagens funksjon — men helst drop

**Test:** Hvis jeg sletter alders-referansen, mister teksten informasjon som hjelper leseren? Som regel nei. Drop.

**Eksempel:**
- ❌ "Valentinlyst Senter — ett av Norges eldste nærsentre, åpnet 1975"
- ✅ "Valentinlyst Senter, nabolagets praktiske nav"

### J. Færrest mulig tall
Tall trekker leseflyten ned og smaker av salgspitch. Bruk tall bare når funksjonelle (åpningstider, avstand i minutter, konkrete åpningsdatoer når relevant).

**Banned som standard:**
- ❌ Bemanning-telling: "tretten NTNU-studenter", "to hundre ansatte"
- ❌ Anlegg-telling: "fem treningssentre", "to ishaller", "tre badstuer" → bruk "flere", "omfattende", eller drop kvantifisering
- ❌ Totalstørrelser: "1400 kvadratmeter", "over 65 stasjoner", "40 kilometer merkede stier" (unntatt der størrelsen endrer leser-beslutning)
- ❌ Besøkstall (allerede banned i regel E)

**OK:**
- ✅ Avstand i minutter: "fem minutter unna"
- ✅ Åpningstider: "åpent 05 til 24"
- ✅ Verifiserte superlativer med kilde: "anbefalt i Guide Michelin"

**Test:** Hvis jeg bytter tallet med "flere" eller "omfattende", mister setningen noe avgjørende? Som regel nei. Drop.

### K. 1.grads spesifisitet — unngå 2.grads detaljer
Skalerings-regel: Jo mer spesifikk en påstand, jo høyere feilsannsynlighet. Og 2.grads detaljer hjelper sjelden leseren med en boligbeslutning.

**1.grads (stabilt — OK):**
- Stedsnavn (Valentinlyst, Brattøra, Bakklandet)
- Kategori (frisør, pizzeria, third-wave-risteri)
- Omtrentlig avstand i minutter
- Merkevare-navn (Britannia-hotellet, Byhaven, Olavskvartalet — merkevarer, ikke eiendomsnavn)

**2.grads (sårbart — drop):**
- ❌ Eksakte adresser: "Fjordgata 23", "Thomas Angells gate 3"
- ❌ Eiendomsnavn: "Mercur-bygget", "1960-bygget"
- ❌ Etasje/plassering i bygg: "over bord", "over flere etasjer"
- ❌ Bemanning: "coach Thomas Whillock", "drevet av X", "kokker med internasjonal erfaring"
- ❌ Spesifikke retter/produkter: "torsketunge", "surdeig etter tysk tradisjon" (med mindre det er kjernekonseptet)

**Test:** Hvis stedet flytter, bytter eier, eller endrer meny — blir setningen fortsatt sann? Hvis nei → drop detaljen.

**Eksempel:**
- ❌ "H2 Barber i Mercur-bygget" (de har flyttet — bygning-navn er utdatert-sårbart)
- ✅ "H2 Barber, fem minutter til fots"
- ❌ "Troll Restaurant på Fosenkaia bygger trøndersk råvare-kjøkken med torsketunge"
- ✅ "Troll Restaurant på Fosenkaia — trøndersk fine-dining"

### L. Rating-volum-terskel
Google-rating uten volum er statistisk støy. Et sted med 4.9 og 14 ratings er ikke mer kvalitativt enn et sted med 4.3 og 400.

**Regel:**
- `< 30 ratings`: må ikke navngis på rating-basis alene. Krever WebSearch-verifisering eller annen sterk signal (Michelin, offisiell anerkjennelse)
- `30–99 ratings`: kan navngis hvis kategori-relevans er sterk og andre signaler støtter
- `100+ ratings`: rating er stabil nok til å stole på

**Alternativ hvis under terskel:** Generaliser.
- ❌ "Enten Eller frisør i Fjordgata og H2 Barber" (Enten Eller = 14 ratings)
- ✅ "Flere frisørsalonger og barbershops ligger innen fem til åtte minutter"

### M. Beskriv, ikke påstå — ikke-påståelig tone
Påståelig tone er en fallgruve. "Ordnes uten at du forlater", "det perfekte for", "det beste for" — absolutter er skjøre. Beskriv hva som *finnes*; la leseren trekke konklusjonen.

**Banned:**
- ❌ "ordnes uten at du forlater"
- ❌ "det perfekte for", "det beste for"
- ❌ "alltid", "aldri" (med mindre faktuelt: "aldri stengt", "alltid åpen")
- ❌ "det eneste du trenger", "den perfekte adressen"
- ❌ "er bygget for" (kan være prosjekt-tale)

**Pattern å unngå:**
- `/uten at du .{0,30}(forlater|må)/i`
- `/(det perfekte|det beste|det eneste).{0,30}(for|til)/i`
- `/er bygget for/i`

**OK (beskrivende):**
- ✅ "Dagligvare, apotek og Vinmonopol innen fem minutter"
- ✅ "Matscenen er voksen og urban"
- ✅ Kontrast-oppriktighet: "ikke primært et barnefamilie-strøk, men grunnlaget er til stede"

**Test:** Kan påstanden falsifiseres av én leser med spesielle behov? ("Uten å forlate" falsifiseres av lege-besøk.) Hvis ja → beskriv istedenfor.

## MVP-regler (prioritet for default-modus)

Regel A–M beskriver S&J-aspirasjonen. MVP strammer inn ytterligere for skalerbarhet:

### N. Navngivings-hierarki
Hvilke POIs som *kan* navngis, ikke hvilke som *må*.

**ALLTID navngi (stedsankre):**
- Skole, barnehage, videregående
- Nærsenter (merkevare — Valentinlyst, Byhaven, Olavskvartalet)
- Stasjon, hurtigbåtterminal, stor buss-hub
- Park og friområde (navngitt)
- Museum, bibliotek, teater, kino (merkevare)

**KUN signatur navngis:**
- Restaurant: Michelin-anbefalt, Bocuse d'Or-deltagelse, etablert omtalt i kritiske medier
- Kafé: third-wave merkevare med volum (risteri > 3 år, 100+ ratings)
- Konseptuelle steder: offentlig kjente installasjoner/prosjekter (Stu-badstuer, Adressaparken-prisvinner)

**ALDRI navngi — bruk mengde + type:**
- Dagligvare-kjeder (Coop, Extra, MENY, Kiwi, Rema)
- Apotek (Vitus, Boots)
- Bank, post, lege, tannlege
- Frisør, barbershop
- Vanlige treningssentre (Fresh Fitness, MaxPuls, TrenHer) — bruk "budsjett / 24-timers / premium"

**Eksempel:**
- ❌ "Coop Mega dekker storhandelen, Vinmonopolet står på hjørnet, og Boots Apotek..."
- ✅ "Dagligvare, Vinmonopol og apotek samlet i Valentinlyst-senteret"

### O. Template-struktur per kategori

Fast struktur, 3 setninger, uavhengig av persona-vekting:

```
[Setn 1: Kategori-profil — hva kjennetegner tilbudet]
[Setn 2: Signatur-POI (hvis finnes) — navn + avstand + type]
[Setn 3: Mengde-oversikt — "X innen Y min, fra A til B"]
```

Hvis signatur ikke finnes: Setn 2 og 3 smelter til oversikt.

Ingen bro-setninger til neste kategori. Rød tråd ligger i hero + motiv-nevning i setn 1 der naturlig.

### R. Naturlig norsk — ingen oppfunnede sammensetninger
Klassisk AI-tekst-feil: sammensetninger som høres plausible ut men ikke brukes i norsk språk. Umiddelbar troverdighetstap.

**Banned mønstre:**
- ❌ "stasjonsnabolag" (ikke etablert; bruk "området rundt stasjonen" / "nær togstasjonen")
- ❌ "voksen-nabolag" / "barne-strøk" (bruk "voksent strøk" / "familievennlig nabolag")
- ❌ "bylivs-adresse" (bruk "urban adresse" / "sentralt")
- ❌ Andre ord-kombinasjoner som ikke brukes i naturlig norsk

**Test:** Hvis du er usikker på om sammensetningen brukes, søk Google på uttrykket med sitationstegn. Hvis under 100 faktiske treff (ikke AI-generert innhold), er det ikke et etablert uttrykk.

### V. Generisk tekst + Google AI-lenke for dybde
**Strategisk arbeidsdeling:** Placy er ekspert på nabolags-oversikt. Google AI er ekspert på ferske detaljer (rute-destinasjoner, priser, åpningstider, bemanning). I stedet for å verifisere fakta vi ikke kan stå for, generaliserer vi teksten og lar leseren klikke videre til Google AI Mode for dybde.

**Prinsipp:**
- **Bastante spesifikke fakta** (destinasjoner, rute-numre, priser, bemanning) → generaliser
- **Verifiserbare stabile fakta** (stedsnavn, kategorier, omtrentlig avstand) → behold
- **Les mer-knapp** per kategori → Google AI-søk

**Eksempel:**
- ❌ "direktetog til Oslo, Bodø og Östersund" (én er feil; vanskelig å verifisere for 100 prosjekter)
- ✅ "startpunkt for direktetog mot flere retninger" + "Les mer om togruter fra Trondheim S" (Google AI)

**Data-struktur:** Hvert tema i reportConfig får nytt felt `readMoreQuery`:
```json
{
  "id": "transport",
  "bridgeText": "...",
  "leadText": "...",
  "readMoreQuery": "kollektivtransport fra Trondheim S"
}
```

**URL-format:** `https://www.google.com/search?udm=50&q={URL-encoded query}` (udm=50 = Google AI Mode)

**Per-tema query-mal:**
| Kategori | Query-mal |
|---|---|
| Hverdagsliv | `{prosjekt} dagligvare og tjenester i nærområdet` |
| Barn | `skoler og barnehager nær {prosjekt}` |
| Mat | `restauranter og kafeer nær {prosjekt}` |
| Opplevelser | `museer og kulturtilbud {by} sentrum` |
| Natur | `friområder og parker nær {prosjekt}` |
| Trening | `treningssentre og spa nær {prosjekt}` |
| Transport | `kollektivtransport fra {prosjekt}` |

Malene kan justeres per prosjekt hvis det gir bedre søkeresultat.

### U. Ingen persona-nedvurdering
Personas styrer hva som *vektes* i tekstene, men teksten skal aldri eksplisitt rangere grupper mot hverandre. Alle som leser skal føle at nabolaget kan være for dem — uavhengig av hvilken persona som er primær. En 55+ leser kan ha barnebarn, en etablerer kan planlegge familie, en barnefamilie kan ha voksne venner på besøk.

**Banned:**
- ❌ "ikke primært et barnefamilie-strøk"
- ❌ "ikke for familier"
- ❌ "profilen er rettet mer mot voksne enn barnefamilier"
- ❌ "passer best for..."
- ❌ "mindre relevant for..."
- ❌ Direkte sammenligning av personas

**OK:**
- ✅ Beskriv objektivt hva som finnes (skoler, lekeplasser, restauranter listes)
- ✅ La leseren trekke konklusjoner fra fakta og vekting
- ✅ Nøytrale karakteristikker: "urban", "grønt", "rolig", "etablert"

**Test:** Hvis jeg var i en persona som ikke er primær, ville denne setningen få meg til å føle meg avvist? Hvis ja → drop eller omformuler.

**Vektings-prinsipp:** Mindre tekst til lavt-prioriterte kategorier er OK. *Nedvurderende* tekst er ikke.

**Eksempel:**
- ❌ "Stasjonskvartalet er ikke primært et barnefamilie-strøk, men grunnlaget er til stede. Tre lekeplasser..."
- ✅ "Nærmeste skoler ligger i Midtbyen og Rosenborg. Tre lekeplasser langs kaien innen fem minutter."

### T. Avstand i ankerverdier, ikke minutt-presisjon
Spesifikke minutt-verdier (6, 7, 8, 9, 11, 13) er falsk presisjon. Gangtid varierer med tempo og ruter; presisjonen har ingen leser-verdi og øker feilrisiko hvis data drifter.

**Ankerverdier:**
| Råverdi | Tekst |
|---|---|
| < 2 min | "rett utenfor døren" / "rett ved" |
| 2–4 min | "noen få minutter" / "innen fem minutter" |
| 5 min | "fem minutter" / "rundt fem minutter" |
| 6–9 min | "rundt ti minutter" / "under ti minutter" / "ca. ti minutter" |
| 10–12 min | "ti minutter" / "rundt ti minutter" |
| 13–18 min | "et kvarter" / "ca. et kvarter" / "rundt et kvarter" |
| 19–25 min | "rundt tjue minutter" |
| 25+ min | "kort sykkeltur" / "X med buss" |

**Konsekvens:**
- ❌ "Skansenmoloen elleve minutter vestover"
- ✅ "Skansenmoloen rundt ti minutter vestover"
- ❌ "Trondheim folkebibliotek på åtte minutter"
- ✅ "Trondheim folkebibliotek på ca. ti minutter"

**Implementasjon i pipeline:** I Steg 2 (avstandsberegning), konverter til ankerverdi umiddelbart. LLM-input inneholder kun ankerverdier, ikke minutt-tall.

### S. Bruk prosjektnavnet, ikke "adressen"
Prosjektet har et navn (Stasjonskvartalet, Wesselsløkka, Brøset). Bruk det. "Adressen" er generisk og upersonlig, og fjerner stedsforankringen.

**Banned:**
- ❌ "Adressen ligger i..."
- ❌ "Fra adressen..."

**OK:**
- ✅ "Stasjonskvartalet ligger på kaifronten..."
- ✅ "Fra Wesselsløkka er Valentinlyst fem minutter unna..."
- ✅ "Nabolaget" / "området" som generisk etter først-nevning

**Unntak:** Hvis prosjektnavnet er utypisk eller ikke etablert som stedsnavn, kan du bytte til "nabolaget" eller bydelsnavn etter første nevning for flyt.

### P. Input-filtrering før skriving
Filtrer POIs i Steg 3 (før LLM skriver):

- `review_count < 30` **og** ingen kjede-anerkjennelse → kun mengde-bidrag, ikke navngis
- Strip ustabile felt fra POI-input: adresse, bygning-navn, etasje, bemanning, eksakt meny
- Behold: navn, kategori, google_rating, review_count, distance_minutes, is_chain_flag, is_signature_flag

Denne filtreringen er **deterministisk** og skjer før LLM-trinnet. Reduserer LLM-skjønn der deterministisk filter er mulig.

### W. Lokasjon er stabilt, innhold er flyktig

Kjøpesentre, skoler og museer eksisterer over år. Hvilke butikker et senter inneholder, hvilke rektorer en skole har, og hvilke utstillinger et museum viser endrer seg ofte. Skillen navngir **lokasjoner** og beskriver **innhold kategorisk**, ikke per merke.

**Prinsipp:**
- ✓ Navngi senter/skole/museum/park/infrastruktur
- ✓ Beskriv kategorisk bredde ("mote, delikatesse, service" / "dagligvare, klær, elektronikk")
- ✗ Påstå spesifikk tilbuds-miks uten triangulering mot offisiell kilde fra siste 6 mnd
- ✗ Navngi enkelt-butikker som er del av senter-miksen (Kiwi Valentinlyst, Meny Solsiden) — det er kjedenavn + plassering, ikke stabil informasjon

**Praktisk test:** Er senterets "profil" (boutique, storhandel, kulturkvartal) triangulert mot senterets nettside eller Visit-by-siden? Kan profilen stå i 2-3 år uten at den blir falsk?

**Eksempel på brudd (iter 7):**
- ✗ "Byhaven samler de største dagligvarekjedene" — falsk (Byhaven har ingen lavpris-dagligvare)
- ✓ "Byhaven er mindre og mer spesialisert — mote, delikatesse og service i et kvartal med egen karakter"

**Regel N** er anvendelse av W på dagligvare/apotek/frisør/bank — disse er *alltid* flyktige, bare mengde+type.

### X. Beskriv tilbudet, ikke valget — ingen preskriptive anbefalinger

Skillen henviser til hva som finnes og hvor. Den rådgir ikke leseren om hva som passer best, er det naturlige valget, eller hvordan stedet bør brukes. Preskriptive anbefalinger gjør teksten til salgsstemme og låser leseren ut av egne vurderinger.

**Banned mønstre:**
- ✗ "det naturlige valget for X"
- ✗ "passer best for" / "passer bedre for"
- ✗ "best brukt som X heller enn Y"
- ✗ "bilen er ikke en nødvendighet" / "bilen er sjelden nødvendig"
- ✗ "hverdagen kan dekkes uten bil"
- ✗ "det eneste du trenger"
- ✗ "fungerer som X" (karakterpåstand om funksjon/rolle)

**Regex-pattern (håndheves i QA-sjekk):**
- `/(passer|egnet|best).{0,15}(for|til|brukt)/i`
- `/er ikke.{0,15}(nødvendig|en nødvendighet)/i`
- `/det (naturlige|perfekte|beste|eneste).{0,15}valget/i`
- `/fungerer (som|best)/i`

**OK (beskrivende):**
- ✓ "Solsiden ligger fem minutter unna"
- ✓ "Området har dagligvare, bakeri og apotek"
- ✓ "Pirbadet har svømmehall og badeland"

**Test:** Tar setningen en beslutning på vegne av leseren? Hvis ja → skriv om til beskrivelse.

### Y. Ingen udokumenterte superlativer

Superlativer må trianguleres mot offentlig kilde. Markedsføring fra stedets egen nettside regnes IKKE som triangulering.

**Banned uten triangulering:**
- ✗ "det store kjøpesenteret" (implisitt superlativ, flere er like store)
- ✗ "Norges største X" (egen markedsføring fra stedet)
- ✗ "blant byens beste / mest kjente"
- ✗ "det største idrettsanlegget"

**Hedge-mønster:** Bytt "det X-este" til "ett av de X-ere" eller "blant de X-ere".

**OK (triangulert eller offisielt):**
- ✓ "det nasjonale museet for populærmusikk" (Rockheim, offisiell status)
- ✓ "Michelin-anbefalt" (kilde-verifisert)
- ✓ "ett av de større kjøpesentrene i Midtbyen"
- ✓ "ett av de større idrettsanleggene i Trondheim"

**Eksempel på brudd (iter 8):**
- ✗ "Solsiden senter er det store kjøpesenteret i Midtbyen" — implisitt superlativ
- ✗ "Pirbadet er Norges største innendørs badeanlegg" — kilde er pirbadet.no egen tekst
- ✓ "Solsiden senter er ett av de større kjøpesentrene i Midtbyen"
- ✓ "Pirbadet er et innendørs badeanlegg med svømmehall og badeland"

### Z. Kvantitativ generalisering over konkrete navn

For **mange og flyktige** tilbud (frisører, apotek, kafeer, velværetilbud), kvantifiser i grove termer fremfor navn. Dette skalerer robust: setningen holder selv om individuelle tilbud skiftes.

**Mønster:** "[antall-kvalifikator] [kategori-liste] [innen X min]"

**Eksempler på riktig form:**
- ✓ "Titalls frisører, apotek og velværetilbud innen ti minutter til fots"
- ✓ "Flere restauranter og kafeer langs Valentinlyst og Tyholt innen kort sykkeltur"
- ✓ "I nabolaget finner du også flere servicebutikker innen ti minutter til fots"

**Banned:**
- ✗ "Enten Eller frisør, H2 Barber og Studio Sax" (navn med lav rating/volum, flyktige)
- ✗ "Bank, post og legekontor spredt" (utdatert meglervokabular, ikke relevant)

**Utdaterte kategorier — drop helt fra Hverdagsliv:**
- Bank (digitalisert, ingen går lenger)
- Post (post-i-butikk finnes overalt, ikke differensiering)
- Fastlege (geografi-uavhengig valg for de fleste)

**Relevante kategorier for moderne hverdagsliv:**
- Dagligvare, Vinmonopol (daglige valg)
- Apotek, tannlege (bevegelig men relevant)
- Frisør, velvære/spa (nabolags-forankret)
- Bakeri/kafé (del av Mat & Drikke)

### Æ. Ingen bransje-sjargong uten forklaring

Hvis et ord krever forklaring for en bred målgruppe (boligkjøpere 20-75 år), bytt det ut med vanlig norsk. Leseren er ikke kaffe-kjenner, mote-ekspert eller matbransje-student.

**Banned (uten forklaring):**
- ✗ "third-wave-brenneri" (bransje-term for spesialistkaffe)
- ✗ "nordiske fine-dining-konsepter" (engelsk bransje-ord)
- ✗ "boutique-preget" (mote-bransje, engelsk)
- ✗ "curated" / "curated selection"
- ✗ "artisan", "craft" (brukt som adjektiv)

**Vanlige bytter:**
| Sjargong | Vanlig norsk |
|---|---|
| third-wave-brenneri | egne brennerier, spesialistkaffe |
| fine-dining | smaksmenyer, flerretters restauranter |
| boutique-preget | mindre og mer spesialisert, kvartal med egen karakter |
| curated | utvalgte, kuraterte (i norsk kontekst), spesialutvalg |
| artisan-bakeri | håndverksbakeri |

**Test:** Hvis leseren må slå opp ordet, bytt det ut. Hvis leseren bare halv-kjenner ordet, bytt det ut.

## Hero-intro — strukturell disiplin (oppdatert)

**Mål:** 3 setninger som rammer *nabolaget*, ikke summerer kategoriene.

**Struktur:**
1. Posisjonering — hvor i byen, mellom hva (stedsnavn, geografisk anker)
2. Tilgjengelighet — den viktigste avstanden(e) for personaen
3. Karakter + kontrast — hva stedet *er* i motsetning til hva det *ikke er*

**Anti-pattern:** Hero som leser som "én setning per kategori". Hvis du ser én Barn-setning + én Transport-setning + én Mat-setning stablet, skrive om.

**Test:** Fungerer heroen for et helt kvartal, eller er den tung i prosjekt-detaljer? Skal fungere for kvartalet.

## Lengde-disiplin

S&J-tekstene er **strenge i lengde**. En typisk beliggenhetstekst er 100-250 ord for hele objektet — vi har 40-45 setninger for et helt prosjekt, som er *mer*. Det betyr:

- Ingen fyllord
- Ingen "atmosfære"-setninger
- Hver setning skal *inneholde* informasjon

## Struktur S&J følger

1. **Posisjonering:** "Leiligheten ligger i [nabolag], [kontekst]."
2. **Transport:** "Fra [punkt] kommer du til [punkt] på [tid]."
3. **Nærhet:** "[Dagligvare/butikker] i gangavstand/nærheten."
4. **Rekreasjon:** "[Naturområder/aktiviteter] like ved."
5. **Infrastruktur:** "Parkering, kollektiv, adkomst."
6. **Barn/skole** (hvis relevant): "Barnehage og skole ferdigstilles..."

Vi følger ikke denne *sekvensielt* — vi har 7 kategorier — men struktur-elementene er de samme: posisjonering, konkret navngiving, bevegelse, funksjonell info.

## Forbudte mønstre (fra dagens dårlige tekster)

Disse mønstrene er verifiserte klager fra faktiske rapporter og skal blokkeres:

### Trivia-fakta-mønsteret
**Eksempel:** *"Pirbadet åpnet i 2001 og tar imot rundt 400 000 besøkende i året."*

**Problem:** Verifiserbart ✓, men irrelevant for boligkjøperen.

**Regel:** Regex-blokker:
- `/åpnet (i|den) \d{4}/i` — med mindre kontekstsjekk bekrefter historisk forankring
- `/tar imot .{0,20}(besøkende|gjester|deltakere)/i` — besøkstall er alltid trivia
- `/\d{3,} (besøkende|gjester)/i` — konkrete tall er trivia

### Markedsføring-spin-mønsteret
**Eksempel:** *"Bølgebasseng, sklier og stupanlegg gjør det til en fast del av hverdagen for trondheimsfamilier."*

**Problem:** Usannhet forkledd som fakta. Pirbadet er dyrt → ikke "fast del av hverdagen".

**Regel:** Ingen setninger som *antar* hvordan familien bruker stedet. Bare det som kan verifiseres — tilbud, spesialitet, nærhet.

### Historisk-irrelevans-mønsteret
**Eksempel:** *"Dromedar Kaffebar var blant Norges første spesialkaffebarer da de åpnet på Bakklandet på slutten av 1990-tallet."*

**Problem:** Flytter fokus fra stedet nå til en historisk anekdote som ikke hjelper leseren med en beslutning.

**Regel:** Historiske fakta er OK hvis de *fortsatt er relevante nå*:
- ✅ "Trondheim katedralskole — Norges eldste skole i drift" (relevansen fortsetter)
- ❌ "Dromedar åpnet på slutten av 1990-tallet" (bare trivia nå)

Omformuler til: *"Dromedar holder til fire minutter unna — en av Norges mest anerkjente spesialkaffebar-serier."*

### Feilkategorisering-mønsteret
**Eksempel:** *"For brødelskere baker Backstube surdeig etter tysk tradisjon."*

**Problem:** Backstube er en kjede med ultraprosessert importert mat. "Brødelskere" velger Godt Brød, Hevd, eller lokale håndverksbakerier.

**Regel:** Relevans-sjekk per POI mot målgruppen. Ikke plasser POI i en identitetsrolle den ikke oppfyller.

## Eksempel — før og etter

### Før (dagens Stasjonskvartalet, Barn & Oppvekst leadText)
> Langs kaifronten fra Brattørkaia til TMV-kaia ligger tre lekeområder under seks minutters gange. Pirbadet åpnet i 2001 og tar imot rundt 400 000 besøkende i året — bølgebasseng, sklier og stupeanlegg gjør det til en fast del av hverdagen for trondheimsfamilier. Bispehaugen skole er nærskolen for 1.–7. trinn, elleve minutter til fots, og Rosenborg skole tar imot elevene videre til ungdomstrinnet. Trondheim katedralskole — grunnlagt i 1152, Norges eldste skole i drift — ligger elleve minutter unna for videregående.

### Etter (S&J-disciplin, 4 setn for L-kategori)
> Tre lekeområder langs kaien — Brattørkaia, TMV-kaia og ved Pirbadet — alle innen seks minutters gange. For nye familier på adresse her er Bispehaugen nærskolen for 1.–7. trinn, elleve minutter til fots, og Rosenborg skole tar imot elevene videre. Trondheim katedralskole, Norges eldste skole i drift, ligger elleve minutter unna. Stasjonsnabolaget er ikke primært et barnefamilie-strøk, men grunnlaget er på plass for dem som flytter inn med barn.

**Endringer:**
- Fjernet Pirbad-trivia ("åpnet 2001", "400 000 besøkende")
- Fjernet marketing-spin ("fast del av hverdagen")
- Behold historisk forankring ("Norges eldste skole i drift")
- Lagt til målgruppe-kontekst ("ikke primært et barnefamilie-strøk") — viser oppriktighet
- Referert karakter-motiv ("Stasjonsnabolaget")
- Bevegelse ("langs kaien")
