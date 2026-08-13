# 2026-08-13 — Moat 1 fikk en avgrensning: hva vi leier, hva vi eier, og hvor grensa går

> Strategi-sesjon som startet som teknisk arbeid (Utforsk-modalens innhold) og endte i en
> avgrensning av hva Moat 1 faktisk er. Utløst av Andreas' spørsmål: *«hvis vår moat 1 er at vi
> EIER kunnskapen, skyter vi oss i foten av å bruke leverandør-tekst da?»*

## Spørsmålet som utløste det

Utforsk-modalen ble bygget 2026-08-12: build-time Gemini-tekst med Google Search-grounding per
POI, med kildehenvisninger og Google-attribusjon. Den fungerte — 59 av 78 POI-er på Sundsøya fikk
tekst i én scriptkjøring.

Andreas stilte det riktige spørsmålet dagen etter: hvis Moat 1 er at vi *eier* kunnskapen,
undergraver vi den ved å bruke leverandør-tekst? Og hvis vi leier informasjonen fra Google, er det
Google som eier datahygienen — vi bare bruker den.

Formuleringen han satte opp mot seg selv: **eier vi kunnskapen, eller eier vi evnen til å formidle
den?**

## Svaret: ingen av dem

**Å eie tekst er ikke forsvarbart.** Vi beviste det selv samme dag: 59 stedstekster kostet én
scriptkjøring og lå innenfor Geminis gratiskvote. Marginalkostnaden for en konkurrent å generere
sammenlignbar tekst er nær null. «Vi har tekst om steder» er ikke en vollgrav — FINN Nabolagsprofil
har tekst, Google har tekst, alle med en API-nøkkel har tekst.

**Formidlingsevnen er produktet, ikke vollgrava.** Den har reell markedsverdi — HEM *kjøpte*
Marketers boligvelger framfor å bygge den, selv om det «bare» er et interaktivt grensesnitt (jf.
2026-08-04). Men et bedre produkt er ikke en vollgrav med mindre noe beskytter det.

**Det som ikke kan kopieres er dømmekraften:** å vite at 4 av 78 punkter betyr noe for en kjøper i
Straumen, og at Straumtorget-teksten handlet om feil park. Det manifesterer seg som tekst, men det
*er* ikke teksten.

## Arbeidsprinsippet: lei det som forvitrer, eier det som akkumulerer

Andreas' hygiene-poeng var riktig, men snudd: at Google eier datahygienen på det leide laget er en
**fordel** vi skal beholde.

| Lag | Eksempel | Hvem eier | Hvorfor |
|---|---|---|---|
| Forvitrer | Åpningstider, telefon, rating, bilder | **Google** | Endres konstant. Eier vi dem, eier vi forfallet. Vi har alt bygd for leieforholdet: månedlig oppdatering av åpningstider, 14-dagers utløp på lh3-bilde-URLer. |
| Akkumulerer | «Offentlig tannklinikk i samme bygg som rådhuset, prioriterer barn og unge» | **Placy** | Forvitrer ikke. Ingen attribusjonskrav, ingen utløpsdato. |
| Korreksjoner | «Straumtorget er ikke Muustrøparken» | **Placy** | Her dannes eiendelen. |

**Leverandør-laget er verken.** Gemini-teksten forvitrer (2-års lagringsgrense i vilkårene, kildene
råtner) *og* er ikke vår — så vi bærer vedlikeholdsplikten uten en leverandør som faktisk
vedlikeholder. Ingen oppdaterer vår Gemini-output.

**Konklusjon: leverandør-teksten er stillas, ikke varelager.** Jobben er å dekke boards billig i dag
og vise hvor hullene er. Dekningsrapporten er mer verdt enn teksten den produserte.

### Falsifisert premiss i min egen design

Jeg bygde `mergeCurated` slik at `generated` bevares under kuratert tekst, med begrunnelsen «da er
provider-swappen til Googles `generativeSummary` fortsatt mulig». Det var feil resonnement: hvis
Google ruller ut `generativeSummary` i Norge, henter vi den **live**, vi migrerer ikke gammel
Gemini-output. Å bevare `generated` kjøper oss ingenting utover en 2-års ToS-klokke å følge.

## Regnestykket som gjorde kuratert-bare mulig

Første innvending mot «bare skriv alt selv» var 4 264 nabolags-POI-er i basen. Det er feil
regnestykke på to måter:

1. **Vi trenger ikke tekst på alle.** Det som vises fram er høydepunktene: 4–6 per tema × 6 temaer,
   **per strøk**, delt av alle boards i strøket. Det er 25–35 tekster per strøk, ikke 4 000. Samme
   amortiseringslogikk som strøk-editorialen (2026-06-27).
2. **Volum er ikke en innvending med agent-kapasitet.** Andreas presiserte dette som generell
   arbeidsmåte: 4 000 tekster er en kjøring i batcher, ikke hundrevis av timer. Reelle blokkere er
   kvoter, penger, irreversible mutasjoner og ting som krever menneskelig verifisering — ikke
   arbeidsmengde.

Og gevinsten ved kuratert-bare er større enn dekningstallet: **et helt delsystem forsvinner.** Ingen
Google-attribusjon å rendre, ingen 2-års utløpsklokke, ingen kildelenker som råtner, intet
verbatim-krav på Googles søkeblokk, ingen SSRF-sjekk ved URL-resolving. Og ingenting publiseres som
ingen har lest — i denne sesjonen skrev jeg seks tekster fra Gemini-materiale med **én ukontrollert
kilde**, og måtte advare Andreas om det. Den risikoklassen forsvinner.

## Den strukturelle grensa — det viktigste funnet

Sundsøya endte på **9 kuratert, 63 med leverandør-tekst, 6 igjen** av 78 POI-er.

De 6 er igjen fordi de **ikke kan skrives fra offentlige kilder**. Researchet i denne sesjonen:
Nilsparken, Vaggplassen og Straumtorget har ingen publisert informasjon noe sted — ikke hos Inderøy
kommune, ikke i OSM, ikke hos Visit Innherred, ikke i dgo.no. De kan verken skrapes eller genereres.

**Det gjør megler-forfatterskapet til design, ikke nødløsning** (jf. `highlightPoiIds` +
megler-kuratering, 2026-08-04). Og det er den sterkeste versjonen av moat-argumentet: det dypeste
laget av Moat 1 er strukturelt utilgjengelig for enhver konkurrent med et API-abonnement —
**inkludert Google.** Google kan generere tekst om alt som er publisert. Ingen kan generere tekst om
det som ikke er.

Dette forsterker rural-asymmetrien fra 2026-08-11: ruralt ser området tomt ut hos FINN fordi det
*er* tomt i offentlige data. Der er avstanden mellom «hva API-et vet» og «hva som faktisk er der»
størst — og det er nøyaktig gapet Moat 1 selger.

## Datahygiene som Moat-1-biprodukt

Kurateringssteget avdekket feil ingen automatikk ville fanget:

- **Straumtorget:** Geminis genererte tekst handlet om Muustrøparken. Kvalitetsporten stoppet den
  fordi den hadde 1 kilde, ikke fordi den var feil. Uten menneskelig gjennomgang ville en tekst om
  feil park stått på boardet.
- **Sundsøya Ungdomsklubb:** var i ferd med å legges ned i januar 2024 (husleieøkning, senere
  reversert av huseier). Om den driver i 2026 er uavklart. Den ligger på **selve prosjekttomta**, så
  en feil der ser kjøperen først. Ikke skrevet — flagget for lokal verifisering.
- **Studio F:** står på Vennavegen 10 i basen, Vennalivegen 2 i salongens egne kanaler.
  Adressefeil i Google-dataen.

Dette er argumentet som gjør Moat 1 salgbart uten å love dybde vi ikke har (jf. korreksjonen
2026-08-04: «slåbar på dybde» er for optimistisk): **vi retter feil i annonsens nabolagsdata.** Det
er konkret, verifiserbart, og megleren kan se det selv.

## Besluttet rekkefølge

1. **Behold leverandør-teksten på boardene nå.** 63 av 78 punkter på Sundsøya har innhold på grunn
   av den. Slår vi den av i dag, går boardet fra 72 til 9 synlige tekster.
2. **Kuratér høydepunktene per strøk** (25–35 tekster). Agentene tar POI-ene som *har* offentlige
   kilder; `no-data`-listene går til megler.
3. **Så slå av rendringen av leverandør-laget.** Gemini-teksten blir kurator-input — som dossieret —
   som ligger i basen men aldri publiseres. Da forsvinner attribusjons-, ToS- og råtne-lenker-
   problemet helt.

## Åpne spørsmål

- **Når flippes bryteren?** Krever kuratert dekning på høydepunktene i minst ett strøk først. Ikke
  tidfestet.
- **De 94 kategori-funksjonstekstene** (idéen som startet sesjonen: «tannklinikk → hva gjør den? →
  fikser tenner») er ikke bygd. Med kuratert-bare som retning er spørsmålet om de er nødvendige, eller
  om høydepunkt-kurateringen dekker behovet.
- **Hvem skriver megler-laget, og hvordan får de tilgang?** `highlightPoiIds` finnes i board-data,
  men forfatterskap + auth mangler (2026-08-04).
- **Sundsøya Ungdomsklubb** — driver den i 2026? Blokkerer tekst på et POI midt på prosjekttomta.

## Kobling til tidligere beslutninger

- **2026-06-27** (`data-moatene-lokalkunnskap-innsikt.md`): Moat 1 navngitt. Denne sesjonen
  avgrenser *hva i den* som faktisk er vår.
- **2026-06-27** (`editorial-gemini-fable`): «Gemini henter, Fable skriver» står — men denne sesjonen
  presiserer at Geminis output er **input**, ikke publiseringstekst.
- **2026-07-09** (`locallogic-benchmark-eiendom.md`): score-primitivet forkastet som svada. Samme
  logikk her: bredde uten dybde er ikke et produkt.
- **2026-08-04** (`megler_curated_highlights`): megler-utvalg som Moat-1-motoren. Denne sesjonen
  leverer *begrunnelsen* — ikke bare at det er ønskelig, men at det er strukturelt nødvendig.
