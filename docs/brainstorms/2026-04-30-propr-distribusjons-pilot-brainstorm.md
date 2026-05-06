# Brainstorm: Propr som første distribusjonspartner — go-to-market for rapport-board

**Dato:** 2026-04-30
**Status:** Beslutninger landet, klar for utførelse
**Trigger:** Markedsutvikler-sparring + observasjon av Propr som aktør (CEO og driftssjef begge med Sem & Johnsen-bakgrunn)

---

## Bakgrunn

Placy er pre-revenue. Demo for Broset (Trondheim) generert, ikke deployet. Rapport-board produktet (kuratert nabolagsrapport med kart, akvarell, kategori-narrativ, POI-er) har modnet UX-messig over de siste ukene — særlig 2026-04-30-sesjonene som gav rapport-paritet, sub-kategori-filter, mobil-UX.

To uavhengige forretningsutviklere har tidligere sagt: "dere har ikke et produkt enda" og "start med consumers først." Markedsutvikler-sparring 2026-04-30 reframet dette: målgruppen er **eiendomsmeglere som distribusjonskanal**, ikke sluttbruker direkte. Annonse-perioden (typisk 30-60 dager) er det naturlige eksperiment-vinduet.

Andreas oppdaget Propr som potensiell første partner — selvbetjent boligsalg, 16 990 listinger 2016-2026 (~1 700/år), tre prispakker (9 990 / 24 970 / 35 950 NOK). Skjermbilde av et eksisterende prospekt (Spro Havn, 322401) avdekket at Propr's nåværende "Nabolag"-seksjon er svak (en grønn sirkel med to etiketter). Placy fyller akkurat det hullet.

## Den testbare hypotesen

> Hvis privatbolig-meglere får Placy rapport-board gratis i annonseperioden, vil de dele det med kjøpere via Finn-annonse + visning, fordi det gjør boligen lettere å selge. Propr som plattform er optimal første-distributør fordi (a) deres "Nabolag"-element er åpenbart svakt, (b) Propr-selgere mangler den redaksjonelle kapasiteten tradisjonelle meglere har, og (c) ledelsen har personlig nettverk inn til premium-kjedene.

## Beslutninger

### 1. Manuell pipeline før automatisering

- **Drop /bestill-skjema-bygging i pilot-fasen.** /generate-bolig finnes allerede; manuell håndtering tar ~20 min per rapport. Du tåler 10-15/uke før det blir flaskehals.
- **Hver rapport leses gjennom av Andreas før levering.** Pilot-fasens manuelle QA er gratis brukerforskning på pipelinen — du oppdager hva grounding lyver om, hva som mangler, hva meglere reagerer på.
- **Skjemaet bygges når flaskehalsen er reell** (~10+ ukentlige bestillinger), basert på erfaringene fra de første manuelt leverte rapportene.

### 2. Produktposisjonering: kuratert, ikke automatisk

- Placy er **redaksjonelt kuratert**, ikke "automatisk indeks". Hver rapport går gjennom Andreas-redigering før utsending.
- Disclaimer formuleres ærlig: *"Rapporten er redaksjonelt kuratert basert på offentlige kart- og stedsdata. Faktiske avstander, åpningstider og tilbud kan endre seg — verifiser detaljer som er kritiske for kjøpsbeslutning. Subjektive nabolagsbeskrivelser er Placys redaksjonelle vurdering."*
- I Propr-pitch eksplisitt: *"I pilot-fasen leser jeg hver rapport selv. Skala-håndtering er noe pilot skal informere."* Modenhet, ikke svakhet.

### 3. Propr som første partner — vis-don't-tell-åpning

- **Steg 1:** Generer full Placy rapport-board for **Spro Havn-prospektet (322401)** — eksisterende live-objekt på Propr.
- **Steg 2:** Personlig hilsen + lenke til ferdig rapport sendes Kjetil Eriksson (CEO) eller Karoline Gjersvik (driftssjef). Du leverer arbeid før du ber om noe.
- **Steg 3:** Pitch er pilot — gratis i 30-60 dager mot integrasjon i utvalgte aktive prospekter, med kvitteringsdata (klikk, sidevisninger, engasjement).
- **Steg 4 (etter validert pilot):** Be Kjetil eksplisitt om warm intro til 2-3 av hans tidligere Sem & Johnsen-kollegaer.

### 4. Avtalevilkår som er ikke-forhandlerbare

For at Propr-piloten både skal være beachhead OG ikke spolere premium-pitchen senere:

- **Ikke-eksklusivitet.** Placy beholder retten til å samarbeide med alle andre meglere, kjeder og plattformer.
- **Placy-brand synlig.** Det skal være en *Placy-rapport vist via Propr*, ikke en "Propr nabolagsfunksjon". Brand-skille beskytter premium-pitchen.
- **Ingen segmentlås.** Ingen klausul som binder Placy til "kun privatselger" eller prisbånd.
- **Datarettighet.** Placy eier engagement-data og kan bruke aggregert/anonymisert data i pitcher til andre kjeder.

### 5. Strategisk vinkel: Propr-pilot er warm-intro-bro

CEO Kjetil Eriksson var partner i Sem & Johnsen i 15+ år. Driftssjef Karoline Gjersvik var eiendomsmeglerfullmektig i Sem & Johnsen. Det betyr S&J-systemet sannsynligvis ser Propr som *kollegaer*, ikke konkurrenter — og en suksessfull Propr-pilot kan gi varm intro inn til premium-segmentet via Kjetils nettverk.

Det forsterker hypotesen om at "begge a OG b" (læringsmaskin + beachhead mot enterprise) er gjensidig forsterkende, ikke valg-A-eller-B.

## Forventet økonomisk impact (realistisk)

Avtalen alene betaler ikke en lønn:

| Modell | Realistisk attach/andel | Placy-revenue/år |
|---|---|---|
| Add-on Propr-selger kjøper (990 kr) | 10-25% av 1 700 | 84-210k |
| Inkludert i pluss-pakken (500 kr flat) | 30-50% av 1 700 | 255-425k |
| Default på alle Propr-listinger (200 kr) | 100% av 1 700 | 340k |

**Hovedverdien er ikke pengene** — det er datavolum (1 700 rapporter/år som datagrunnlag), distribusjonsbevis ("vi er Propr's nabolagspartner"), operasjonell tvang (pipeline må modne), logo-effekt og **warm intro-broen til premium-segmentet**.

## Risiko-vurdering (justert etter Sem & Johnsen-koblingen)

| Risiko | Vurdering | Mitigering |
|---|---|---|
| Segment-lock-in til DIY-segmentet | ⬇️ Vesentlig redusert pga S&J-kobling i Propr-ledelsen | Krav 2-3 i avtalen (brand-skille + ingen segmentlås) |
| Single-customer-konsentrasjon | Reell — hvis Propr blir 80% og bytter strategi → eksponert | Aktiv pitch til Sem & Johnsen i parallell, fra mnd 3-4 |
| Skala-press for tidlig | 1 700/år = ~33/uke, ikke realistisk å lese alle manuelt over tid | QA + automatisk grounding-sjekk må modnes før volum tar av |
| Propr bygger selv | Reell etter 6-12 mnd hvis konseptet bevises | Forsvar = kuratorial dybde (akvarell, narrative tone, grounding-pipeline) + parallelle avtaler med andre kjeder |

## Konkrete neste skritt

### Denne uken
1. **Generer Spro Havn-rapport** med /generate-bolig. Les gjennom selv. Fjern subjektive påstander du ikke kan verifisere fra Street View / offentlig data.
2. **Skriv personlig hilsen** til Kjetil Eriksson — kort, konkret, med lenke til Spro Havn-rapporten. Ingen pitch-deck, ingen vedlegg. Bare arbeidet og et tilbud om pilot.
3. **Send mail.**

### Hvis Propr svarer positivt (innen 2 uker)
4. Booking av kort intro-møte (30 min). Forventning: pilot-vilkår, ikke storskala-kontrakt.
5. Forhandle pilot innenfor de fire ikke-forhandlerbare kravene.
6. Lever 5-10 manuelt kuraterte rapporter for aktive Propr-prospekter.

### Hvis Propr ikke svarer (innen 14 dager)
7. Følg opp én gang med kort melding.
8. Hvis fortsatt stillhet: Spro Havn-rapporten er ikke kastet — bruk den som fysisk demo til neste samtale (privatmegler, en annen plattform, eller direkte til Sem & Johnsen).

## Åpne spørsmål

- **Disclaimer-formulering:** Hvor sterkt skal det stå? Trenger juridisk gjennomlesning før første rapport går ut til faktisk Propr-kunde.
- **Spro Havn-rapport-kvalitet:** Hva er Andreas' terskel for å sende? (Variant a/b/c diskutert, ikke endelig låst.)
- **Pricing-modell:** I forhandling — add-on (990) vs flat fee i pluss-pakke (500) vs alle listinger (200). Avhenger av Propr's preferanse.
- **Kontaktstrategi:** Mail vs LinkedIn vs felles kjent-introduksjon? Andreas har sagt han ordner kontakt — ikke detaljert på vei.
- **Skjema-trigger:** Når blir manuelt for tungt? Foreløpig threshold antatt ~10 ukentlige bestillinger.
- **Sem & Johnsen-utreach-timing:** Hvor lenge venter vi før vi spør Kjetil om varm intro? Foreslått: etter 30-60 dagers pilot med målbare resultater.

## Suksess-kriterier for piloten

**Minimum (etter 30 dager):**
- Minst 1 Propr-listing har brukt Placy-rapport
- Vi har målbare engagement-tall (klikk, sidevisninger, tid på siden)
- Andreas har lest gjennom og kuratert minst 3 rapporter manuelt (lærings-input til pipelinen)

**Ambisiøst (etter 60-90 dager):**
- Propr har inkludert Placy som standard- eller pluss-pakke-element
- Minst 5-10 Propr-listinger ute med Placy-rapport
- Kjetil Eriksson har gjort minst én warm intro til Sem & Johnsen-kontakt
- Du har en signert eller muntlig avtale om utvidet pilot/full integrasjon

**Beslutningsgrunnlag for neste fase:**
- Hvis minimum + ambisiøst innfris → bygg /bestill, automatiser pipeline, pitch premium-kjedene
- Hvis kun minimum innfris → diagnose før skalering (er det produktet, distribusjonen, eller hypotesen som svikter?)
- Hvis ikke en gang minimum → produktet eller distribusjons-modellen må reframes

## Referanser

- Markedsutvikler-sparring: 2026-04-30 (uten dokumentert artefakt utover denne)
- Propr om-oss verifisert via WebFetch: Kjetil Eriksson (CEO, ex-partner Sem & Johnsen) + Karoline Gjersvik (driftssjef, ex-eiendomsmeglerfullmektig Sem & Johnsen)
- Propr priser verifisert via WebFetch: 9 990 / 24 970 / 35 950, per-listing
- Spro Havn-prospektet: https://propr.no/prospekt/322401
- Eksisterende skill: /generate-bolig (allerede operativt for kuraterte demo-prosjekter)
