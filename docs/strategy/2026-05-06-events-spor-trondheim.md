# Events-spor Trondheim — strategi-sesjon

**Dato startet:** 2026-05-06
**Status:** Aktiv — pågående brainstorm
**Trigger:** Introduksjonsmøte med Kulturnatt Trondheim (Nanna Berntsen), Midtbyen Management (Sissel Piene) og Visit Trondheim (Kari Aarnes). Møtet utvidet seg fra Kulturnatt-pitch til bredere event-/turist-distribusjonssamtale.

**Relaterte dokumenter:**
- People-map: `docs/strategy/aktor-map.md`
- Eiendoms-spor (parallelt): `docs/brainstorms/2026-04-30-propr-distribusjons-pilot-brainstorm.md`
- Eksisterende kundeprospekter Trondheim: `docs/brainstorms/2026-02-05-kundeprospekter-trondheim-brainstorm.md`
- Kompass-konseptet (event-produktet): `docs/brainstorms/2026-03-11-ai-concierge-event-prototype-brainstorm.md`
- Forretningsmodell-grunnlag: `docs/brainstorms/2026-02-01-placy-pricing-business-model-brainstorm.md`

**Lokale ressurser fra dagens møte (ikke i repo):**
- `/Users/andreasharstad/Desktop/oppsummering-aandreas.json` — Andreas' egen oppsummering
- `/Users/andreasharstad/Desktop/first-meeting-kulturnatt.json` — opptak del 1 (Kulturnatt-team alene)
- `/Users/andreasharstad/Desktop/synk-visit-trd-events.json` — opptak del 2 (etter Sissel + Kari kom inn)
- `/Users/andreasharstad/Desktop/– Det er vanskelig å finne fram i mylderet av alt som skjer - adressa.no.html` — Adressa 2023 om Konsertbyen Trondheim

---

## Bakgrunn

Andreas viste tre prototyper i møtet på `localhost:3009`:

1. **Kulturnatt Trondheim 2025 Explorer** med Kompass-onboarding (3-stegs filter på kategori/dag/tid) og Min samling (lagre events → personlig URL → del med andre).
2. **Scandic Nidelven Rapport-board** — Mat & Drikke i 3D Google Maps, 114 kuratert POI-er, redaksjonell tekst.
3. **Scandic Nidelven Trips** — kuratert tur "Bakklandet & Bryggene" som walkthrough.

Visningen utvidet seg fra Kulturnatt-pitchen til en bredere samtale om Visit Trondheims pain points (cruise-turister, transport, butikker som distribusjonsledd) etter at Nanna inviterte Sissel og Kari inn.

---

## Hovedinnsikter fra møtet

### 1. TRD Events er en levende database, ikke statisk

Kulturnatt-events i prototypen var importert som engangs-snapshot. I møtet ble det avslørt at Kulturnatt-events i virkeligheten er et **tag-filter på TRD Events** — Trondheim Kommunes event-database — som arrangører selv vedlikeholder. Mange aktører (Visit Trondheim inkludert) fetcher fra samme DB.

**Konsekvens:** Placy kan være en *dynamisk visualiseringsmotor* for hele TRD Events-økosystemet, ikke bare statiske event-pakker. Martnan, Christmas Market, Olavsfest — alle henger på samme feed med ulike tags. Det forskyver Placy fra "engangs-prototype per arrangement" til "alltid-på event-platform med skall pr. avsender".

### 2. Karis trigger var transport, ikke events

Visit Trondheims markedssjef ble mest engasjert da prototypen viste **Entur-/buss-/taxi-/bysykkel-data**. Hun pekte på at "hva er nærmeste taxi/buss til Værnes?" er det de daglig får spørsmål om i interiørbutikken under VTs kontor. Event-visualiseringen var interessant, men transport-vinkelen var det som virkelig festet seg.

**Konsekvens:** Hvis vi skal pitche VT, må transport-laget være eksplisitt i pitchen — ikke en bonus-feature.

### 3. VT vil ikke selv distribuere — de vil at hotellene gjør det

Markedssjefen sa eksplisitt at VT ønsker at *hotell, cruise, butikker* eier QR-kodene som leder til Placy. VTs rolle er å **anbefale Placy til medlemsnettverket**, ikke å være sluttkunde selv.

**Konsekvens:** VT er ikke en betalende kunde — de er en *intro-/distribusjonspartner*. Forretningsmodellen mot dem må være "vi løser deres pain point med medlems-tjenester" snarere enn "betal X kr per måned".

### 4. Konsertbyen Trondheim er dokumentert pain point siden 2023

Adressa-artikkelen fra 2023 (samme måned som Sissel/Kari etablerte felles offensiv for "Kulturbyen Trondheim") siterer Ingrid Marie Sylte Isachsen: *"Det tok tre timer og jeg var innom 85 unike sider for å finne info"* om byens konsertprogram. Næringsforeningens undersøkelse i samme periode dokumenterte at konsertbrukere legger igjen ~800 millioner kr i annet næringsliv per år, og at 20% av hotell-gjestedøgn drives av konsertgjester.

**Konsekvens:** Konsertbyen Trondheim er bokstavelig talt målgruppen Placy beskriver. 12 konsertscener bak organisasjonen. Krever varm intro fra Sissel eller Kari, ikke kald-pitch.

### 5. Cruise-/turist-segmentet er underbetjent og rystende stort

200 000+ båt-turister/år i Trondheim, gjennomsnittlig 8-9 timer i byen. Markedssjef Kari fortalte direkte om hvordan disse i dag står med papir-kart i regn og spør tilfeldig forbipasserende. Hun mener QR-koder på cruise-skipene er det åpenbare grepet — VT vil ikke selv eie dem, men anbefale aktørene å implementere.

---

## People-map

Se `docs/strategy/aktor-map.md` for full oversikt og levende status. Korte highlights:

- **Varmest, har sett produktet**: Nanna Berntsen, Sissel Piene, Kari Aarnes, Philip, Isabelle (alle i dagens møte)
- **Identifisert prospekt, ingen kontakt**: Ingrid Sylte Isachsen, Ann Elisebeth Wedø (Konsertbyen), Torstein Langeland (Næringsforeningen)
- **Demo eksisterer, ingen kontakt**: Scandic Nidelven, Britannia, andre Trondheim-hoteller

---

## Strategiske beslutninger

### 2026-05-06 — Begge spor, seriøs arbeidsdeling

**Beslutning:** Event-spor og Propr-spor (eiendom) lever side om side, men med eksplisitt arbeidsdeling. Ingen pivot fra Propr.

**Begrunnelse:** Propr-piloten ble besluttet 6 dager siden og er ikke testet. Å pivotere før Spro Havn-rapporten har truffet er prematurt. Samtidig er event-momentum fra dagens møte for sterkt til å parkere — det vil avta hvis ikke fulgt opp innen uker.

**Forutsetning:** Konkret arbeidsplan med timesallokering må bygges, ikke bare "vi gjør begge". Andreas har dagjobb (designsjef Nyhavna) — realistisk Placy-kapasitet er ~15-20 t/uke.

---

## Åpne tema

Alle åpne tema fra dagens diskusjon. Hver kan bli sin egen mini-brainstorm — eller løses løpende.

### Strategisk (hvem kjøper, og hva)

- [ ] **S1.** Hvem blir første betalt event-pilot — Kulturnatt-org via Sissel/Nanna, Konsertbyen Trondheim, eller hotell?
- [ ] **S2.** Er Visit Trondheim en kunde eller en distribusjonspartner — og hva er VTs incentiv til å pushe Placy ut til medlemsnettverket?
- [ ] **S3.** Hva er tilbudet til Kulturnatt 2026 (pris, scope, leveranse, deadline)?
- [ ] **S4.** Cruise/turist-segmentet — hvordan kommer vi inn der uten å være kunde av VT direkte?
- [ ] **S5.** Forholdet til Propr-piloten — fokus, ikke pivot. Konkret arbeidsdeling per uke?

### Produkt / teknisk (hvordan bygges det)

- [ ] **P1.** TRD Events som dynamisk feed — bygges nå eller venter? Arkitektonisk grunnstein for hele event-spor.
- [ ] **P2.** Drop-in vs. start-stop event-typer — hvordan visualisere i kart, liste og trip-format?
- [ ] **P3.** Trip/playlist-konseptet for events — formaliseres som Kompass-tillegg eller eget produkt?
- [ ] **P4.** Branding/white-label — Kulturnatt-skall vs. Olavsfest-skall vs. Konsertbyen-skall: hvordan bygges teknisk?
- [ ] **P5.** Transport-integrasjon (Entur/buss/taxi/bysykkel) — er den klar nok til å være pitchsentrum hos Kari?
- [ ] **P6.** Pokémon Go-/gamification-konseptet — reelt produkt eller bare moro idé fra møtet?

### Forretningsmodell (hvem betaler hvor mye)

- [ ] **F1.** Prismodell for events vs. eksisterende Explorer 1490/mnd / Report 25-35k. Per arrangement? Per år? Per visning?
- [ ] **F2.** Distribusjonsmodell via VT-partnernettverket — provisjon? Flat fee? Kommersiell ramme?
- [ ] **F3.** Suksess-kriterier for event-pilot — hva er minimum bevis på "dette funker"?

### Operasjonelt (denne uken/måneden)

- [ ] **O1.** Hva forbereder du til Sissels "interne prat" — beslutningsgrunnlag, eksempel-tilbud, demo-link?
- [ ] **O2.** Tidsdeling Propr/events per uke — konkret plan, ikke prinsipp.
- [ ] **O3.** Når og hvordan be om varm intro til Konsertbyen Trondheim — etter eller parallelt med Kulturnatt-oppfølging?
- [ ] **O4.** Følge opp Kari (VT) separat — hun trenger eget tilbud, ikke samme som Kulturnatt.

---

## Neste runde

Følges opp i ny brainstorm-økt — kan velge en av fire klustere å bore dypest i:

1. **Strategisk** (S1-S5) — hvem kjøper først, hva tilbyr vi, hvordan deles event/eiendom
2. **Operasjonelt** (O1-O4) — denne ukens konkrete actions
3. **Forretningsmodell** (F1-F3) — penger og distribusjon
4. **Produkt/teknisk** (P1-P6) — TRD Events-feed, branding, drop-in

Eller — alternativt — adresseres et tema om gangen ad-hoc i andre sesjoner uten formell rekkefølge.

---

## Sesjon 2026-05-06 (kveld 2) — QR-distribusjons-analyse, hotell-fokus, performance pilot

Dypere diskusjon om Karis utsagn om at "alle hoteller, cruise, Værnes, flybuss bør ha QR-kode på Placy". Sesjonen lukker tre åpne tema (S1, S2, S4) og åpner tre nye operasjonelle.

### QR-distribusjons-analyse — hva Kari faktisk sa

Aktørene som SKAL eie QR-kodene: hotellene, cruise-skipene, butikker, Værnes, flybussen. Aktøren som IKKE skal eie: VT selv (de "anbefaler", ikke "distribuerer").

**Strategiske implikasjoner:**

- **Forretningsmodell:** VT betaler ikke noe. Hver QR-aktør er separat kjøper. Eksisterende prising holder (Explorer 1 490/mnd per hotell, Report 25-35k engangs). VT er gratis trust signal, ikke revenue stream.
- **Produkt:** Krever branding-fleksibilitet (white-label per aktør eller felles "Placy Trondheim" med scanneren-detektion). Åpent tema P4.
- **Verdi for VT:** "Placy er anbefalt løsning for medlemmene" leverer på medlemsforpliktelse uten egen kostnad. Det er hvorfor Kari aktivt vil pushe.

**Fellen:** "Alle aktørene" høres ut som ett bredt prosjekt. Det er det ikke — det er **30+ separate salg** med ulik beslutningstaker, salgssyklus og pris-tolleranse. Solo-Andreas kan ikke seriøst forfølge alle parallelt.

| Aktør | Salgssyklus | Pris-tolleranse | Volum-effekt | Prioritet |
|---|---|---|---|---|
| Enkelthotell (markedssjef) | 30-60 dager | Middels-høy | Lav-middels | **Fase 1 — primær** |
| Hotellkjede sentralt | 6-18 mnd | Høy | Veldig høy | Fase 2 |
| Cruise (Hurtigruten/Havila) | Privat 2-6 mnd | Veldig høy | Veldig høy ved skala | Fase 3 — parkert |
| Avinor (Værnes) | 6-12 mnd offentlig | Høy + byråkrati | Veldig høy | Parkert |
| AtB (flybuss/kollektiv) | 6-12 mnd offentlig | Middels | Middels | Parkert |
| Butikker individuelt | Lav pris-tolleranse | Lav | Lav | Aldri direkte — via MM |

### Cruise pilot-by-modell — vurdert og parkert til fase 3

Idé: Trondheim som pilotby for Hurtigruten Group (32 anløpshavner) eller Havila Voyages (14 havner). Hvis pilot lander, skaleres til hele ruten.

**Hvorfor smart:**
- Privat innkjøp (rask) vs Avinor (treg)
- Pain point er bokstavelig talt produktet (8-10 timer i havn, ny by, mobil i hånd)
- Skalering innbygd i pitchen
- Ingen direkte konkurrent
- Per-havn-arkitektur: plattform + branding er felles, POI-base + lokale guider er det som må bygges per by

**Hva som kreves før pitch:**
- (a) Hotell-case study med målbare engagement-tall
- (b) Konkret pilot-tilbud (pris, scope, tidsramme)
- (c) Skalerings-modell på papir (per-havn-pris × hele ruten)
- (d) Flerspråklig skall (norsk + engelsk + tysk minimum)

**Beslutning:** Parkert til fase 3 — etter hotell-pilot har levert case study. Hurtigruten/Havila ført inn i `aktor-map.md` som identifiserte men ikke-aktive prospects.

### Performance pilot-modell — strukturert gratis pilot

Andreas observerte at Placy har lave driftskostnader (~4-8 timer Andreas-tid per pilot-setup). Det betyr "gratis 30-60 dagers pilot" har lav marginalkostnad og høy data-verdi. Men ren "gratis prøve" har tre feller:

| Felle | Mitigering |
|---|---|
| Passiv pilot = dårlig data ("vi prøvde, fikk 12 scans") | **Promosjons-forpliktelse** — avtalt minimum-eksponering (QR-plakat × N lokasjoner, in-room info-kort) |
| Manglende konverterings-mekanisme (60-70% konverterer aldri) | **Pre-avtalt konverterings-terskel** — definert engagement-tall → automatisk overgang til 1 490/mnd × 12 mnd |
| Presedens-effekt (alle krever gratis) | **Tidsbegrenset eksklusivitet** — første pilot får eksklusiv vindu, deretter åpent for andre |

**Pilot-vilkår (foreløpig):**
- 30 dagers gratis pilot for hotell (60 dager for cruise hvis senere relevant)
- Branding: "Powered by Placy" + hotellets logo (per Propr-pilot brand-skille-policy)
- Suksess-terskel: åpent — tre alternativer drøftet, ikke besluttet (alt 1 låste tall, alt 2 subjektivt, alt 3 hybrid med minimum-aktivitet + forhandling om endelig pris)

### Hotell-fokus — beslutning og topp prospects

**Beslutning:** Hotell er primær fase-1-spor. Stasjonære, forutsigbare, VT som intro-mekanisme, eksisterende fundament (pricing + demo + kundeprospekter), gjentatte gjester gir tidsserie-data.

**Topp 3 prospects rangert for første lukke:**

| # | Hotell | Beslutningskraft | Brand-effekt | Risiko |
|---|---|---|---|---|
| 1 | **Britannia** | Markedssjef beslutter (uavhengig) | Premium signal — åpner alle dører | Lav |
| 2 | **Nidaros Pilegrimsgård** | Markedssjef beslutter (uavhengig, lite hotell) | Unikt konsept ved Nidarosdomen | Lav. Lavt volum, men case study-rikt |
| 3 | **Scandic Nidelven** | Lokal markedssjef + sentral koordinering | Volum (349 rom) gir høyt brukstall | Middels — Scandic-Stockholm kan vetoe |

Tier 2 (etter første lukke): Quality Hotel Prinsen, Clarion Hotel Trondheim. Krever Strawberry-kjede-koordinering.

### VT-intro-mekanikken — versjon C-formulering

Kari er medlemsorganisasjon for hotellene. Intro fra henne er ikke favør — det er medlemspleie. Tre versjoner ble vurdert:

- A (svak): *"Kan du introdusere meg til hotellsjefene?"* — for bredt, krever at hun gjør jobben
- B (medium): *"Kan du introdusere meg til markedssjefene på Britannia og Scandic Nidelven?"* — spesifikt, lite arbeid for henne
- **C (sterk):** *"Vi tilbyr 30-60 dagers gratis pilot for 2-3 Trondheim-hoteller før sommer-sesongen, der vi måler engagement-data og leverer case study du kan bruke i medlemsrapporten din. Hvilke hoteller tror du vil ha mest nytte? Kan du sende kort intro?"* — gir Kari grunn til å pushe (data hun selv kan rapportere), spesifikt, lavt friksjon, attraktiv ramme for hotellene som mottar intro.

**Valgt:** Versjon C. Binder VT-stempel + pilot-tilbud + intro i ett trekk.

### Konkret first-step

**Denne uken:**

1. Sende oppfølgings-mail til Kari (versjon C-formulering) — be om intros til Britannia + Pilegrimsgård + Scandic Nidelven
2. Forberede pilot-pakke: 1-siders dokument med pilot-vilkår, eksempel-QR, mockup av hotell-skall, suksess-metrikker
3. Identifisere markedssjef-navn på de tre hotellene (5 min LinkedIn-søk per stk)

**Når intros kommer:**

4. Direkte mail til markedssjef (Kari som CC) — "her er pilot-tilbudet, kan vi ta 20 min?"
5. Demo-møte → pilot-avtale signert → live-launch

### Lukket i denne sesjonen

- **S1** Hvem blir første pilot → hotell (Britannia / Pilegrimsgård / Scandic Nidelven)
- **S2** VT som kunde vs partner → partner/intro-mekanisme, ikke betalende kunde
- **S4** Cruise/turist-segment → parkert til fase 3

### Nye åpne tema

- [ ] **O5.** Konverterings-terskel-modell: alt 1 (låste tall) / alt 2 (subjektivt) / alt 3 (hybrid). Påvirker pilot-avtale-formuleringen.
- [ ] **O6.** Parallell vs sekvensiell pitch — tre hoteller samtidig (høyere odds for første-yes, men risiko for å håndtere tre piloter parallelt) eller én om gangen?
- [ ] **O7.** Pris-justering etter pilot-data — etter konvertering, holdes 1 490/mnd eller revurderes basert på faktisk engagement-volum?

---

## Endringslogg

- **2026-05-06**: Dokument opprettet. People-map etablert, hovedinnsikter fra møtet ført inn, 18 åpne tema kategorisert, beslutning om "begge spor, seriøs arbeidsdeling" landet.
- **2026-05-06 (kveld 2)**: QR-distribusjons-analyse, cruise pilot-by-modell vurdert og parkert, performance pilot-strukturen formet (3 vilkår), hotell-fokus-beslutning landet, topp 3 prospects rangert, VT-intro-mekanikken landet på versjon C. Lukket S1/S2/S4. Åpnet O5/O6/O7.
