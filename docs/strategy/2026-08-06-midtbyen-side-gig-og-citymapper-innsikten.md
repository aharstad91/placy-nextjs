# Midtbyen som side gig + Citymapper-innsikten

**Dato:** 2026-08-06
**Trigger:** Andreas kom tilbake fra London med en turisme-tanke etter å ha brukt Citymapper, og landet den på et konkret prospekt: `midtbyen.no/shopping` som et raskt salg til Midtbyen Management. Samtalen utvidet seg til et arbeidsprinsipp for side gigs og en referansestige (Open House).
**Type:** Sparring → side-gig-sporet åpnet + prospekt anbefalt (ikke besluttet, ingen kontakt tatt)
**Merk:** Claudes første formulering av side-gig-regelen ble **forkastet av Andreas samme dag** og erstattet — se §2a/§2b. Siter §2b, ikke §2a.

---

## 1. Citymapper-innsikten — hva som faktisk overføres

Andreas' observasjon: Citymapper i London gjorde at de kom seg til helt ulike deler av byen, og ut av byen, **fordi de stolte på appen**. Byen må tjene enormt på det. Selv-flagget: sannsynligvis en dårlig forretningsmessig løsning (Citymapper bruker ads).

**Presiseringen som gjør innsikten brukbar:** Citymapper viste dem ikke bedre severdigheter. Den gjorde at de *stolte på* at de kom seg dit. Atferdsendringen kom fra **transportlaget**, ikke POI-laget — den fortalte om en linje de ikke visste fantes, og da ble halve byen innenfor.

> Citymapper selger **rekkevidde**. Placy selger i dag **steder med avstand påklistret**. Ikke samme produkt selv om skjermbildet ligner.

**Forretningsmodell-lærdommen er negativ, og det er poenget.** Citymapper er lærebok-eksempelet på gapet mellom skapt og fanget verdi: ~50 MUSD reist, transformativt i et titalls byer, og de måtte likevel klatre *ned* i transaksjonslaget for å tjene penger (Citymapper Pass, egen buss i London, Ride) før oppkjøpet til Via i 2023 — så vidt vi vet langt under toppverdsettelsen. Byen som tjente mest, betalte minst.

**Konsekvens for sporvalget: ingen.** Betalerkartet fra 2026-05-06 står — VT anbefaler og betaler ikke, Avinor/AtB parkert på anskaffelses-treghet, hotell er betalings-proxyen fordi hotellet fanger verdien selv. Citymapper-observasjonen styrker **produktargumentet**, ikke forretningsargumentet. Andreas' egen magefølelse var korrekt og allerede dokumentert.

### Den gratis høstingen inn i eiendomssporet

**Ram nivå 1 rundt rekkevidde i stedet for nærhet.** «Herfra når du dette på 15 minutter» er Citymapper-følelsen oversatt til boligkjøperens faktiske usikkerhet — som ikke er «finnes det kafeer», men «blir livet mitt trangt her».

Time Budget (5/10/15 min) finnes allerede i produktet, men som *filter*. Å forfremme det til overskriften er en liten endring med skarpere salgshistorie, og den treffer FINN-svakheten kartlagt 2026-08-04: Nabolagsprofil er statiske scorer bak trekkspill nr. 9. **Scorer beskriver et sted. Rekkevidde beskriver livet ditt derfra.** Det er også en akse fire designere uten utvikler ikke kan tegne seg til — samme argument som plasserte Placy på Marketer-siden av kjøp-vs-bygg-streken (2026-08-05).

---

## 2. Side-gig-prinsippet

Andreas' formulering: *«se små prosjekter hvor en kan starte å faktisk besvare noen side gigs behov/løsninger for å begynne å tjene noen kroner på dette, samtidig som man har de større løpene mot bl.a. eiendom.»*

### 2a. Første formulering — forkastet samme dag

Claudes utgangspunkt var en binær regel: *side gigs betaler seg bare når leveransen er **konfigurasjon av eksisterende produkt**; alt som krever en ny flate, stryker.*

Andreas avviste den: vi må ha **maks fleksibilitet**, side gigs kan godt være **faktiske egne applikasjoner** som gjenbruker tech og kompetanse fra miljøet, og leveransene skal kunne utvikle seg over tid.

**Han har rett, og regelen var trukket fra feil økonomi.** «Ingen custom» er en regel fra da byggekostnad var arbeidstimer. Med agent-kapasitet er marginalkostnaden for en egen Next-app som gjenbruker `lib/` dramatisk lavere, og regelen blir en unødvendig tvangstrøye.

**SEO er det avgjørende moteksempelet, og det er ikke en detalj.** Rapport-boardet er en **innebygd** flate som lever inne på andres sider — den skal ikke rangere. En Midtbyen-katalog skal rangere på «klesbutikk Trondheim sentrum»: server-rendret side per virksomhet og kategori, egen sitemap, egen metadata. Det er ikke en toggle på boardet, det er en annen renderingsstrategi. Den gamle regelen ville forbudt riktig løsning.

### 2b. Gjeldende formulering

> **Gjenbruks-enheten er stacken og dataene, ikke produktformen.**

Det som gjenbrukes er **fabrikken**: Next + Supabase v2 + kartmotorene + provisjonerings-pipelinen + Moat-1-kurering + editorial-genereringen (Gemini henter, Fable skriver) + ops-skillene (`/provision-rapport`, `/curate-area`). En produksjonslinje som kan lage flere produkter — ikke ett produkt som må passe alle kunder.

**Tre tester erstatter den binære:**

| Test | Spørsmål | Grense |
|---|---|---|
| **Substrat** | Kjører den på eksisterende stack og gjenbruker `lib/`? | Egen app: ja. Egen stack: nei. |
| **Avsetning** | Legger den igjen noe i det delte laget som neste leveranse arver — Moat-1-data, `lib/`-modul, i18n på board-flaten, SEO-flate? | Ingenting igjen → ren konsulentinntekt. Helt greit, men **pris den som det**. |
| **Drift** | Hvem eier den om 12 måneder, og er det betalt for? | Uvedlikeholdte apper er gjeld, ikke referanser. |

**Det kapasitet IKKE senker** — og som er der advarselen fortsatt gjelder:

- **Vedlikeholdsflaten.** Ti apper × litt vedlikehold dreper solo-operasjoner. WP-syncen ryker mens man sitter i EM1-møte, og tokens hjelper ikke på at noen må oppdage det.
- **Andreas' oppmerksomhet.** Flaskehalsen er kundesamtaler, prising og scoping — ikke tasting.
- **Kontekst-skatten.** Hver separate kodebase er noe framtidige sesjoner må holde i hodet samtidig.

### 2c. Strukturell beslutning som følger

**Samme repo, egen route-namespace** (`app/midtbyen/…`) — ikke eget repo per gig. Grunnen er nøyaktig Andreas' eget argument: delt `lib/` *er* poenget, og repo-splitt ødelegger gjenbruken. Egen Vercel-deploy og eget domene (`kart.midtbyen.no`) kan komme når en kunde krever det, uten splitt.

**Prisen for valget:** når `lib/` får to konsumenter er den ikke lenger intern — den blir et grensesnitt som ikke kan endres fritt. Sunt for produktet uansett, men en reell endring i arbeidsform.

---

## 3. Midtbyen-vinkelen

### 3a. Hva som faktisk står på `midtbyen.no/shopping`

Verifisert 2026-08-06:

| Funn | Verdi |
|---|---|
| Antall virksomheter | **147** (telt i DOM; «Vis mer» er uttømt etter ett klikk) |
| Presentasjon | **Alfabetisk tekstliste** — ingen kort, ingen kart |
| Data per oppføring | Navn, adresse, Google Maps-lenke, nettside-lenke, Midtbykort-status |
| Filtre | **28** kategorier + **«Tar fysisk Midtbykort» / «Tar digitalt Midtbykort»** |
| Midtbykort | 140 av 147 tar kort |
| Tilgjengelighet | Alle 147 ligger i rå-HTML fra et vanlig GET — ingen headless browser |
| Plattform | WordPress |

> **Talkorreksjon 2026-08-06:** første notat i dette dokumentet sa «280+». Det var et anslag fra en tekstlesning, ikke en telling. Riktig tall er **147**. De «250 ulike steder» MM selv oppgir er et annet og større sett — alle Midtbykort-brukersteder, ikke shopping-listen. Bruk **147** om denne siden.

**Gapet er ekte:** filtrer til «klær» og få ~20 navn du ikke kan plassere i forhold til hverandre. Det er nøyaktig gapet produktet lukker.

### 3b. To korreksjoner av premisset

**Det er ikke nivå 1.** Nivå 1 er home + kategorier + tier-1-POI-er rundt ett punkt. Her finnes ingen home, det er 147 POI-er, og verdien *er* katalogen. Formen er **event-boardet** (Variant A: filter-drevet liste + kart, `feat/event-board-foundation`) — som allerede er bygd, og som er designet for nøyaktig dette: mange kategorier × mange punkter. Leveransen blir dermed konfigurasjon, ikke bygg → **passerer side-gig-testen**.

*(Presisering 2026-08-06, etter scope-reduksjonen til demo: «ingen home» gjelder datamodellen, ikke flaten. Demoen bruker et **fast ankerpunkt på Torvet** som home, nettopp for at nivå-1-flatens avstands- og gangtidslogikk skal ha noe å måle fra.)*

**Pitchen ligger ikke i shopping — den ligger i Midtbykortet.** Midtbykortet er MMs eget kommersielle produkt. Et kart som svarer *«hvor kan jeg bruke kortet mitt akkurat nå»* er ikke en penere katalog, det er salgsstøtte for noe de selv tjener på og måler. «Shopping-kart» er nice-to-have; **flere innløste Midtbykort er en budsjettlinje.**

### 3c. QR-inversjonen — innvendingen fra 2026-05-06 oppløses

Andreas' poeng fra møtet med MM: butikkene får spørsmål i kassa fra både turister og lokale om hva man bør få med seg i nærheten. Karis QR-utsagn («alle hoteller, cruise, Værnes, flybuss bør ha QR») ble 2026-05-06 dekomponert til «30+ separate salg», og butikker individuelt satt til *aldri direkte — via MM*.

**Rollene snur, og da faller innvendingen:**

> **MM kjøper ett board. Butikkene får QR-en gratis som medlemsgode.** 147 distribusjonspunkter, én faktura. Butikken betaler ikke — den får et svar å gi i kassa.

Dette **motsier ikke** beslutningen fra 2026-05-06: den forkastet å selge til butikker enkeltvis. Ett board solgt til MM som organisasjon står ved siden av, ikke i strid med.

**Maskineriet finnes.** Self-serve-piloten gjør allerede **adresse → nivå-1-board → delingsside med QR og `?src=`** (`feat/megler-self-serve`, fortsatt umerget). Bygd for meglerkontor, generaliserer til et hvilket som helst utsalgssted uten ny arkitektur — hver butikks QR forankrer flaten i butikkens egne koordinater.

**Økonomien holder på per-strøk-amortiseringen.** Midtbyen er **ett strøk**. Kurér det én gang, og alle 147 ankerpunktene deler samme lokalkunnskap. Samme argument som bærer grunnpakke-modellen (2026-06-27).

### 3d. Tre reelle gap — ett er ikke konfigurasjon

**Kategoriene er feil målgruppe.** Boardet viser i dag boligkjøper-taksonomi (Transport & Mobilitet, Natur & Friluftsliv, Trening & Aktivitet). Den som spør i kassa vil ha kaffe, mat, severdigheter, andre butikker. Midtbyen-boardet trenger eget kategorisett — data, ikke kode, men et produktvalg noen må ta.

**Engelsk er halvveis bygd, og halvparten som mangler er den man viser fram.** Verifisert i koden 2026-08-06:

- `lib/i18n/` finnes: `strings.ts` (`Locale = "no" | "en"`), `locale-context.tsx`, `apply-translations.ts`, oversettelser lagret i Supabase (`lib/supabase/translations.ts`)
- Koblet inn i **rapport-varianten, reels og paraform** + `TierBadge`
- **Null i18n-bruk i `components/variants/report/board/`**

→ Engelsk på board-flaten er ekte arbeid, ikke et flagg. **Skal ikke loves i et møte før det er gjort.**

**Vedlikeholdet er hele den kommersielle risikoen.** 147 butikker roterer. De oppdaterer WordPress; en utdatert kopi er verre enn ingen kart.

### 3e. Pris

**Ikke 10k som engangsjobb.** To holdbare former:

1. **Sync mot WordPress + løpende:** ~15k oppsett + 2–3k/mnd drift
2. **10k engangs med skriftlig «vi oppdaterer ikke»**

Manuelt vedlikehold uten løpende betaling er fella som gjør side gigs ulønnsomme. Kartet er engangsverdi; det som fornyes årlig må ha en fornyende betaling.

### 3f. Kjøperen er ikke identifisert

Sissel Piene er **arrangementskoordinator** (leie av byrom og standplass) — en events-rolle, ikke nettside-eier. Samme jobb som ble gjort hos HEM 2026-08-05, der kjøperen viste seg å være systemeieren (Einar Ringen Jr.), ikke prosjektlederen (Løbakk). **Finn hvem som eier `midtbyen.no` før noe pitches.**

### 3g. Måling skal ikke selges

Argumentet som gjør dette til abonnement i stedet for engangs, er at 147 skannepunkter med `?src=` er etterspørselsdata ingen i Trondheim har — «de som skanner i Nordre gate spør om mat». Det treffer rett i framingen fra 2026-05-06 (*case study du kan bruke i medlemsrapport*).

**Men Andreas fastslo 2026-08-06 at Moat-2-tracking ikke er ordentlig bygd.** Derfor: måling er **fase 2 med egen prislapp**, ikke en egenskap ved leveransen. Ikke lov det.

*(Teknisk sidefunn samme dag: `event-schema.ts` validerer `projectId` mot pipeline-formen `{customer}_{slug}` mens boardet sender `projects.id`-UUID → alle engasjements-events droppes; siste rad i `v2.events` er 2026-07-07. Andreas besluttet å la den ligge. Hører hjemme i `PROJECT-LOG.md`, ikke her — tas med kun fordi det bekrefter at måling ikke kan selges i dag.)*

---

## 4. Disiplin og rekkefølge

**Ikke pitch hele visjonen.** Vinkelen vokste i løpet av samtalen fra «10k side gig» til «by-dekkende distribusjonsprodukt med engelsk og egen taksonomi». Det er nøyaktig driften som utsetter inntekten side giggen skulle gi.

> **Selg shopping-kartet på `midtbyen.no`. Ship det. La QR-asken komme fra dem** — den kommer, fordi butikkene deres allerede spør. Da forhandles fase 2 fra en levering, ikke fra en PowerPoint.

**Rekkefølge mot eiendomssporet:** 10k er ~1,5 % av Wesselsløkka-asken (60k/6 mnd) og ~1 % av ett HEM-grunnpakkeår. Pengene er ikke poenget — referansen og kontantstrømmen er. Men eiendomssekvensen er varm, og **iPhone-verifiseringen av Wesselsløkka-boardet er fortsatt blokkerende** (2026-08-05) og billig. Den først. Midtbyen-demoen er en datainnlesning fra en offentlig WP-side, ikke et prosjekt.

**Sammensatt verdi utover cash:**
- **Moat 1-inventar for Midtbyen** — 147 kuraterte sentrumsvirksomheter er ekte lokalkunnskap, og Midtbyen overlapper EM1 Sentrum Søndregates strøk (Midtbyen/Ila/Solsiden) → mater boligproduktet
- **Embed-bevis nr. 2** — WordPress er trivielt å embedde. Etter `wesselslokka.no` (Squarespace) gir det to levende embeds å vise Einar, mot EM1-veggen som ikke slipper inn noe
- **VT-referansen får et objekt** — Kari skulle «anbefale, ikke distribuere». En levende integrasjon på `midtbyen.no` gjør en anbefaling konkret

---

## 5. Referansestigen: Open House, og hva den kjøper

### 5a. Målet akkurat nå

Andreas: *«akkurat nå vil jeg bare ha noe å kunne levere og få tjent noe på, samt lære.»*

**Læring er dermed et eksplisitt leveransemål, ikke en bieffekt.** Det endrer hvordan et side gig vurderes: et gig som lærer oss en ny leveranseform — SEO-katalog, flerspråklig flate, festival-/tidsvindu-produkt — har verdi selv ved lav margin. Det er en tredje verdiakse ved siden av kontantstrøm og referanse.

### 5b. Open House-nettverket (verifisert 2026-08-06)

| Fakta | Verdi |
|---|---|
| Struktur | **60 organisasjoner**, desentralisert med lokal autonomi per by |
| Sentralt organ | **Open City**, UK-registrert charity — grunnla og administrerer nettverket |
| Norske medlemmer | **Oslo og Bergen** (også Stockholm, København, Helsinki) |
| Skala 2023 | 1,2 mill. besøkende · **6 250 bygninger/aktiviteter** · 14 460 frivillige |

**Stigen Andreas beskriver:** rimelig, testbar løsning til Oslo/Bergen → validering *«jammen, dette var virkelig noe som hjalp oss»* → oppover i bystørrelse mot **London Open House**.

**Produktformen er allerede bygd og validert.** En festival med daterte, åpne bygninger som skal filtreres og kartfestes *er* event-boardet (Variant A, Kulturnatt — `feat/event-board-foundation`). Det består substrat-testen uten diskusjon. Sentralorganet gjør dessuten stigen kortere enn 60 separate salg: vinner man én by, finnes det et nettverk å bli anbefalt i.

**Moat-vinkelen:** 6 250 bygg over 60 byer er stedsinventar ingen andre har. Andreas flagger at det ligger mye Moat-1- og Moat-2-verdi i disse gigene som kan komme Placy til gode både strategisk og i videre salg. **Notert som retning, ikke bygg-nå** — konsistent med hvordan moat-build-input-rapportene er foldet inn (fremtidig retning, ikke byggeoppdrag).

### 5c. Posisjoneringen dette kjøper — og fallgruven i Marketer-analogien

Andreas' poeng: selv om slike prosjekter ikke skaper enorm direkte verdi, er de enormt verdifulle som referanser — de viser at **Placy ikke er rettet mot én spesifikk løsning, men er kurator og stedsforvalter** gjennom produkt 1, 2, 3 osv. *«Litt som Marketer.»*

**Merk at Marketer-analogien nå har to lesninger, og de må ikke blandes:**

| Lesning | Hvor den kommer fra | Hva den sier |
|---|---|---|
| **Konkurrent** | 2026-06-02 (Marketer/HomeKey) | De eier transaksjonslaget, vi eier kontekstlaget |
| **Forbilde for selskapsform** | Her, 2026-08-06 | Flere produkter, én posisjon i stedsbransjen |

Begge kan være sanne samtidig. Men **foran en megler er Marketer konkurrent, ikke rollemodell** — og på `wesselslokka.no` sitter de allerede embeddet på samme side. Analogien hører hjemme i intern posisjonering, ikke i et kundemøte der Marketer er alternativet.

---

## 6. Åpne punkter

1. **Hvem eier `midtbyen.no`?** Ikke identifisert. Blokkerende for pitch.
2. **Vigdis eller Kari?** Andreas refererte til «Vigdis på Visit Trondheim». `aktor-map.md` har **Kari Aarnes** som markedssjef i VT. Uavklart om det er en annen person som skal inn i aktør-mappet, eller en navneforveksling. *(Presedens: talegjenkjenning ga «Cicero og Karesan» for Sissel/Kari 2026-05-06.)*
3. **Kategorisett for et besøkende-board** — ikke definert.
4. **Engelsk på board-flaten** — estimat ikke gjort.
5. **Prisform** — sync + løpende vs. engangs med no-update-klausul. Ikke valgt.
6. **Open House: hvilken by først** — Oslo eller Bergen? Og går man via den lokale festivalen eller via Open City sentralt? Ingen kontakt kartlagt, ingen av dem i `aktor-map.md` ennå.
7. **Engelsk blokkerer begge spor.** Board-flaten mangler i18n (§3d). Midtbyen kan leveres norsk-først; Open House kan det ikke — et arkitekturfestival-publikum er internasjonalt fra dag én. Estimat mangler.
