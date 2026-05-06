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

## Endringslogg

- **2026-05-06**: Dokument opprettet. People-map etablert, hovedinnsikter fra møtet ført inn, 18 åpne tema kategorisert, beslutning om "begge spor, seriøs arbeidsdeling" landet.
