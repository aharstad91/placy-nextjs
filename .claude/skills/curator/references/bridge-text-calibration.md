# Bridge Text Calibration — Gullstandard

Denne filen inneholder Brøset 046 som gullstandard for bridgeText, leadText og heroIntro. Bruk som kalibrering når du genererer nye tekster.

---

## Gullstandard: Brøset 046

Brøset-prosjektet (mars 2026) satte kvalitetsstandarden for boligrapporter. Alle 6 themes ble skrevet med Curator-stemmen og verifisert via WebSearch.

### heroIntro

> "Brøset ligger mellom Moholt og Strindheim, på høyden øst for Trondheim sentrum. Nærhet til marka, gode skoler og dagligvare i gangavstand gjør dette til et attraktivt sted for familier — med kort vei til alt du trenger i hverdagen."

**Mønster-analyse:**
- Setning 1: Geografisk posisjonering mellom to kjente bydeler + retning fra sentrum
- Setning 2: Tre hverdagsverdier (marka, skoler, dagligvare) + oppsummering
- Ingen spesifikke stedsnavn — de kommer i bridgeTexts
- Tonen er confident og varm, ikke selgende

---

### Theme 1: Hverdagsliv

**bridgeText:**
> "Valentinlyst Senter med Coop Mega, apotek og frisør i gangavstand — MENY Moholt for de større handlekurvene. Det meste ordnes uten bil."

**Mønster:** Ankersteder (Valentinlyst Senter, MENY Moholt) som ytterpunkter for dagliglivet. Siste setning = hverdagskonklusjon.

**leadText:**
> "Fra Brøset er det fem minutter ned til Valentinlyst Senter — Coop Mega, Apotek 1, Boots og postutlevering samlet under ett tak. Videre langs Valentinlystveien ligger MENY Moholt med ferskvaredisk og parkeringsmuligheter. For variasjon er Rema 1000 på Strindheim og Bunnpris på Eberg begge innen kort rekkevidde. Fem frisører finnes innen ti minutters gangavstand — fra Cowboys and Angels til Persaunet Hårsenter, som har holdt det gående i over førti år. Fastlege og legevakt ligger på Øya, rundt ti minutter med buss."

**Mønster:** Bevegelse fra nærmest til fjernest. Overraskelse i nest siste setning (Persaunet Hårsenter, førti år). Siste setning = helsetjenester som avrunding.

---

### Theme 2: Barn & Oppvekst

**bridgeText:**
> "Eberg skole i gangavstand for 1.–7. trinn, Brøset barnehage som nærmeste for de minste. Blussuvoll og Leangen dekker resten — fra svømmehall til friidrettsbane."

**Mønster:** Skolekrets først (nærskolen), deretter barnehage, til slutt idrettsanlegg som ytterpunkter.

**leadText:**
> "Eberg skole tar under ti minutter å gå til — aktivt FAU og variert SFO-tilbud for barna i Brøset-kretsen. Brøset barnehage er nærmest, men over tjue alternativer finnes innen kort avstand, både kommunale og private. Blussuvoll ungdomsskole ligger like ved, og for videregående er Strinda et naturlig valg med studiespesialisering og idrettsfag. Idrettsanleggene på Leangen og Blussuvoll har fotball, handball, svømming og friidrett — og lekeplassen i Ole Hogstads veg er to minutter fra døren."

**Mønster:** Følger barnets alder (barneskole → barnehage → ungdomsskole → VGS → fritid). Overraskelse = lekeplassen to minutter unna.

---

### Theme 3: Mat & Drikke

**bridgeText:**
> "Moholt Allmenning har fått nye spisesteder de siste årene, og studentbyen tilfører caféer og uformelle møteplasser. Sentrum med full restaurantbredde er et kvarter med buss."

**Mønster:** Lokal utvikling + sentrum som utvidelse. Ærlig om at forstaden ikke har alt — sentrum er tilgjengelig.

**leadText:**
> "Matscenen rundt Brøset er i utvikling. Moholt Allmenning fungerer som voksende knutepunkt med nyåpnede steder i takt med studentbyens utbygging. Leangen har restauranter knyttet til handelsområdet, og Strindheim byr på både pizzeria og asiatiske kjøkken. Bakeri og kafé finnes innen fem til ti minutters sykkeltur. Sentrum — fra Bakklandet til Solsiden — er ti til femten minutter med buss, med hele Trondheims restaurantscene innen rekkevidde."

**Mønster:** Ærlig om at forstaden utvikler seg. Bevegelse utover i konsentriske sirkler. Sentrum som endepunkt, ikke unnskyldning.

---

### Theme 4: Natur & Friluftsliv

**bridgeText:**
> "Estenstadmarka starter i enden av gaten — merkede stier, lysløype om vinteren og utsikt over byen. Brøset-parken og Leangenbekken gir grønne drag midt i nabolaget."

**Mønster:** Marka som dramatisk ankerpunkt (enden av gaten!), deretter lokale grøntområder som kontrast.

**leadText:**
> "Fra Brøset kan du gå rett inn i Estenstadmarka — et sammenhengende turområde med merkede stier, flere utsiktspunkter mot byen og fjorden, og lysløype for langrenn om vinteren. For kortere turer er Brøset-parken og grøntområdene rundt det gamle sykehusområdet fine for rundturer. Leangenbekken renner gjennom nabolaget og gir en naturlig grønn korridor. Jonsvatnet — Trondheims drikkevannskilde og populære badespot — er en kort sykkeltur unna. Bymarka er tilgjengelig via sykkelsti gjennom Moholt."

**Mønster:** Fra marka inn til lokalt, deretter ut igjen (Jonsvatnet, Bymarka). Overraskelse = Jonsvatnet som badespot.

---

### Theme 5: Transport & Mobilitet

Transport-temaet har tre tekstfelt (i stedet for to som de andre temaene):

| Felt | Plassering | Fokus | Lengde |
|------|-----------|-------|--------|
| `bridgeText` | Italic under tittel | Kategori-helhet — ikke sub-kategorier | 1–2 setninger |
| `upperNarrative` | Mellom bridge og live-kortene | Buss, bysykkel, sparkesykkel — "her og nå" | 2–4 setninger |
| `leadText` | Under live-kortene og knappen | Bil, bildeling, elbillading, tog, flybuss | 3–5 setninger |

**Viktig:** `bridgeText` skal IKKE nevne spesifikke linjenummer, stoppenavn eller sub-kategorier. Det er bridge textens jobb for andre temaer, men for transport gir `upperNarrative` og `leadText` detaljene.

> For transport-temaet rendres `leadText` posisjonelt under live-kortene (bil/bildeling/tog/flybuss). Teksten som rendres over live-kortene — fortsatt kjent som `upperNarrative` i datamodellen — er uendret av denne bruks-modusen.

---

#### bridgeText (generisk kategori-intro)

**Gullstandard:**
> "Brøset er godt koblet — hverdagsmobilitet på gangavstand og regional tilgjengelighet innen kort rekkevidde."

**Mønster:** Ett helhetsbilde, to dimensjoner (nær + regional). Ingen sub-kategori-spesifisitet.

**Anti-mønster (FEIL):**
> "AtB-linje 5 og 22 stopper ved Brøset — sentrum på tolv minutter i rushtid." *(for spesifikk — hører hjemme i upperNarrative)*

---

#### upperNarrative (buss + bysykkel + sparkesykkel)

Brukeren ser live-antall i kortene rett under. Teksten gir kontekst til tallene — IKKE gjenta dem. Skriv om tilgang, frekvens og karakteren av nærhet.

**Gullstandard (Wesselsløkka):**
> "Brøset Hageby holdeplass er rett utenfor — linje 12 og 113 gir direkteavganger mot Strindheimsentrum og Dragvoll. Trondheim Bysykkel har to stasjoner innen gangavstand: Valentinlyst og Kong Øysteins veg dekker begge retninger langs Valentinlystveien. Sparkesykler fra Ryde, VOI og Dott er spredt i nabolaget for korte, fleksible hopp."

**Mønster:** Nærmeste holdeplass → linjer og destinasjoner → bysykkel med stasjoner (ikke antall sykler) → sparkesykkel som kontrast (fri, fleksibel).

**Regler:**
- Nevn holdeplassen ved navn + linjenummer + destinasjoner
- Bysykkel: nevn stasjoner ved navn, ikke antall sykler (brukeren ser live-antall i kortet)
- Sparkesykkel: navn på operatørene, legg vekt på tilgjengelighet ikke antall

---

#### leadText (bil + bildeling + elbillading + tog + flybuss — under live-kortene for transport-temaet)

**Gullstandard (Wesselsløkka):**
> "For bil er Nyhavnavveien en rask vei mot E6 og videre sørover. Hyre og Getaround tilbyr bildeling uten binding — begge er tilgjengelige i nabolaget. Fire elbilladere finnes innen ti minutters gange. Leangen stasjon nås med kort sykkeltur og har regiontog mot Stjørdal og Steinkjer."

**Mønster:** Bil → bildeling → elbillading → tog/flybuss. Siste setning = regional rekkevidde.

**Regler:**
- Bil: navngi spesifikke veier mot E6/E18
- Bildeling: nevn operatørene ved navn (Hyre, Getaround, Hertz Connect)
- Elbillading: antall stasjoner + gangavstand (hentes fra live-data, men skriv statisk basert på faktum)
- Tog: stasjonsnavn + destinasjoner (regiontog, flybuss)
- Flybuss: kun nevnes om stasjonen er innen sykkelavstand, ellers er det misvisende

---

**leadText:**
> "Bussen går hvert tiende minutt i rushtid fra holdeplassene ved Brøset. NTNU Gløshaugen ligger to kilometer unna — de fleste sykler dit på under ti minutter via sykkelekspressen langs Klæbuveien. Trondheim bysykkel har stasjoner på Moholt og Blussuvoll, og e-sykler gjør bakken fra sentrum overkommelig. For bil er det kort vei til E6 via Omkjøringsveien. Nye gang- og sykkelveier planlegges i forbindelse med utbyggingen på Brøset."

---

### Theme 6: Trening & Aktivitet

**bridgeText:**
> "MaxPuls på Moholt, Fresh Fitness på Valentinlyst, svømmebasseng i Blussuvollhallen og Grip klatresenter på Leangen — alt i gangavstand. Estenstadmarka har treningsapparater og lysløype."

**Mønster:** Fire ankersteder som viser bredden, avsluttet med utendørsalternativ som kontrast.

**leadText:**
> "Treningsmulighetene er et av nabolagets sterkeste kort. MaxPuls på Moholt har det bredeste gruppetilbudet og er nærmest — Trondheims eneste HYROX-godkjente senter, etablert i 2007. Fresh Fitness på Valentinlyst er et rimelig alternativ med lang åpningstid. Blussuvollhallen har svømmebasseng, og Grip klatresenter på Leangen er populært for alle aldre. For utendørs trening har Estenstadmarka apparater langs stiene, og lysløypa er populær for langrenn om vinteren. Leangen idrettsanlegg har friidrettsbane, fotballbaner og tennisbaner tilgjengelige for publikum."

**Mønster:** Åpner med selvtillit ("sterkeste kort"). Hvert sted med ett differensierende faktum. Utendørs som kontrast. Overraskelse = HYROX-godkjent.

---

## Anti-mønstre

### "POI-hooks klebet sammen" (FEIL)

> "Bula Neobistro — åpnet av Top Chef-vinner Reneé Fagerhøi — ligger minutter fra hotellet, Backstube baker tyske surdeigsbrød i Jomfrugata, og Spontan Vinbar i Brattørgata er anbefalt i Guide Michelin."

**Hvorfor dette er feil:**
- Leser som tre separate anbefalinger, ikke nabolagskarakter
- Ingen overordnet beskrivelse av matscenen
- Cherry-picker 3 av mange steder uten å forklare hvorfor
- Leseren spør: "Hvorfor disse tre? Hva med resten?"

### Generisk AI-tekst (FEIL)

> "Området har et variert utvalg av restauranter og kaféer som passer alle smaker. Med alt fra fine dining til uformelle spisesteder, finner du noe for enhver anledning."

**Hvorfor dette er feil:**
- Ingen spesifikke stedsnavn
- "Alle smaker" / "enhver anledning" = generiske superlativer
- Kunne beskrive hvilken som helst by i Norge
- Ingen nabolagskarakter — ingen bevegelse, ingen kontraster

### For mange ankersteder (FEIL)

> "Med Coop Mega, Apotek 1, Boots, Kicks, Cubus, frisør og postutlevering alt på Valentinlyst Senter — pluss MENY Moholt, Rema 1000 Strindheim, Bunnpris Eberg og Kiwi Nidarvoll i nærheten."

**Hvorfor dette er feil:**
- For mange navn (10+) — bridgeText skal ha 1-2 ankersteder
- Leser som en oppramsing, ikke nabolagskarakter
- Mister skogen for bare trær
- Detaljene hører hjemme i leadText, ikke bridgeText

---

## Ankersted-valgguide

Når du velger 1-2 ankersteder for bridgeText:

### Prinsipper
1. **Definer ytterpunktene** — velg steder som viser spennet i kategorien
2. **Kjente referansepunkter** — bruk steder folk kjenner igjen (senteret, marka, skolen)
3. **Kontraster** — "fra X til Y" er sterkere enn "X og Y"
4. **Nabolagsidentitet** — velg steder som definerer dette spesifikke nabolaget

### Eksempler på gode ankersted-par
| Tema | Ankersteder | Hvorfor |
|------|-------------|---------|
| Hverdagsliv | Valentinlyst Senter ↔ MENY Moholt | Nærbutikk vs. storhandel |
| Mat | Moholt Allmenning ↔ sentrum | Lokalt i utvikling vs. full bredde |
| Natur | Estenstadmarka ↔ Brøset-parken | Villmark vs. nabolagsgrønt |
| Transport | Buss (linje 5/22) ↔ sykkelekspressen | Kollektiv vs. aktiv transport |
| Trening | MaxPuls/Fresh Fitness ↔ Estenstadmarka | Innendørs vs. utendørs |
| Barn | Eberg skole ↔ Leangen idrettsanlegg | Skole vs. fritid |

### Feil ankersted-valg
- To steder som er for like (to treningssentre uten kontrast)
- Ukjente steder som leseren ikke kan orientere seg etter
- Steder som ikke definerer nabolaget (global kjede uten lokal tilknytning)
