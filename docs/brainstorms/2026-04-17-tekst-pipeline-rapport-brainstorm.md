---
date: 2026-04-17
topic: tekst-pipeline-rapport
---

# Ny tekst-pipeline for rapport-produkt

## What We're Building

Ny tekst-genererings-pipeline kun for rapport-produktet, som erstatter dagens Steg 10 (editorial_hook per POI) og Steg 11 (heroIntro + bridgeText + extendedBridgeText) i `/generate-bolig`. Den bygger på S&J-beliggenhetstekst som eneste stilmal, bruker persona som eksplisitt input, og behandler teksten som primær (ikke supplement til Hero Insight Cards).

Kategori-strukturen (7 temaer) beholdes, men tekstene innenfor hver kategori veves sammen med motiver og broingssetninger så leseren opplever én sammenhengende beliggenhetstekst — ikke 7 fragmenterte nedsnitt.

POI-innsamling, kategori-logikk, Hero Insight Cards og kart er urørt. Dette handler kun om tekst-delen.

## Why This Approach

Dagens pipeline har fire rotårsaker til "ikke-livlaget" tekst:

1. **Målgruppe er ikke input** — Stasjonskvartalet får samme barn-oppvekst-tekst som Brøset, selv om målgruppen er unge kjøpere + 55+.
2. **Faktaverifisering ≠ relevansverifisering** — Steg 11c fanger falske fakta men ikke irrelevante ("Pirbadet åpnet 2001", "400 000 besøkende") eller villedende ("Backstube for brødelskere" om billig kjede).
3. **Curator-stemmen er for bred** — destillert fra 4 kilder, men bare S&J er boligmegler-kontekst. Husa/Monocle/LP drar stemmen mot reiseguide.
4. **Tema-fragmentering + Tier-regel** — 7 bridgeText + 7 extendedBridgeText med "ingen gjentakelse"-regel tvinger teksten bort fra strukturerte fakta → havner i generisk stemningsspråk.

Vi valgte å bygge ny pipeline (heller enn patche) fordi `/generate-bolig` har sedimentasjon fra flere iterasjoner og er modnet for fornyelse.

## Key Decisions

- **Q1 — Målgruppe-input:** Pre-definerte personas. Velg 1-3 fra fast liste (f.eks. førstegangskjøper / barnefamilie / 55+ flyttere / investor / pendler). Hver persona har forhåndsdefinert vekting per kategori. *Rasjonale: Fri tekst er upålitelig på skala; livsstilsprofiler er for abstrakt; prosjekttype alene gjør dagens feil.*

- **Q2 — Rød tråd-mekanikk:** Hybrid motiver + broingssetninger. `heroIntro` etablerer 2-3 motiver (f.eks. *kaifronten*, *10-minutters-livet*). Alle kategori-tekster refererer til minst ett motiv, og hver kategori-tekst slutter med en broingssetning til neste. *Rasjonale: Motiver alene er svevende; broer alene er mekaniske; kombinasjonen gir både tematisk dybde og leseflyt.*

- **Q3 — Lengde:** Adaptiv per persona-relevans, minimum 4 setninger. Høy relevans = 6-7 setn, lav = 4 setn. `heroIntro` = 2-3 setn. *Rasjonale: Adresserer direkte målgruppe-problemet. Alle-like behandling er en mildere versjon av dagens feil.*

- **Q4 — POI-valg til tekst:** Kvalitativ research + LLM-kuratorisk skjønn. Steg 11a utvides: research per POI gir kvalitetsnivå, priskategori, kjede vs. håndverk, voksen/familie-fokus. Claude evaluerer per POI mot (persona, kategori, prosjektkontekst) før tekst skrives. *Rasjonale: Statisk whitelist skalerer ikke; ren LLM uten data hallusinerer. Data + skjønn er det eneste skalerbare + nyanserte.*

- **Q5 — Tekst vs. Hero Insight Card:** Tekst = primær, kort = supplement. Tekstene kan navngi strukturerte fakta (skolekrets, nærmeste dagligvare, holdeplasser) konkret. Kortene viser samme info for skanners — redundans er en UX-feature, ikke en bug. *Rasjonale: Dagens "tekst skal ikke gjenta kortet"-regel er hovedårsaken til atmosfære-driften. S&J navngir konkret og det er kjerneprinsippet vi vil replikere.*

**Implicit decision (validert tidligere):** Curator-stemmen renses til *kun S&J*. Husa/Monocle/LP-referansene droppes fra stil-malen for beliggenhetstekst. (De kan beholdes for POI-beskrivelser i Explorer, ikke her.)

## Finalized Decisions (Q6-Q11 + autonome)

**Q6 — Persona-settet:** 4 personas + Pendler-flagg.
- `forstegangskjoper`, `etablerer`, `barnefamilie`, `femtiefem-pluss`
- Pendler er modifikator (bumper Transport til minimum H)
- Investor droppes (annen produkttype)

**Q7 — Persona-vektmatrise:** Tre nivåer (H=6-7 setn, M=5 setn, L=4 setn). Union-regel ved flere personas. Se `.claude/skills/generate-rapport/references/vektmatrise.md` for full matrise.

**Q8 — Kvalitetsaksler per POI:** 5 aksler — kjede-status, priskategori, målgruppe-appell, spesialitet, kvalitetsnivå. Se `.claude/skills/generate-rapport/references/kvalitetsaksler.md`.

**Q9 — Motiv-generering:** 3 typer (geografisk anker, avstand/tempo, karakter). Mekanisme C (fast med fallback). Se `.claude/skills/generate-rapport/references/motiver.md`.

**Q10 — editorial_hook per POI:** A (uendret, utenfor scope). Rapport-pipelinen ignorerer hooks, skriver fra scratch.

**Q11 — Pipeline-arkitektur:** D — egen standalone skill `/generate-rapport` som eier hele rapport-produktet. Bygges gradvis (MVP = kun tekst). Legacy-skiller (`/generate-bolig` etc.) uendret, fases ut på sikt. Scope-ren: ikke-rør Explorer/Trips.

**Skill-lokasjon:** `.claude/skills/generate-rapport/SKILL.md` + references/.

### Autonome beslutninger (tatt 2026-04-17 uten eksplisitt brukervalidering)

- **Datamodell:** Beholder `bridgeText` + `extendedBridgeText` i reportConfig for bakoverkompatibilitet. Ingen kode-endring på rapport-side. `bridgeText` = åpning (1-2 setn), `extendedBridgeText` = hovedinnhold (3-5 setn). Pluss `motiver` (string-array) som nytt felt på reportConfig-nivå.
- **S&J-prinsipper som maskinelle regler:** Implementert i `references/qa-checklist.md` sjekk 4-7. Regex-blokkere trivia-fakta + banned-ord + utropstegn. LLM-skjønn for relevans-filter.
- **Ny QA-sjekk:** 10-punkts sjekkliste (erstatter Steg 11c). Se `references/qa-checklist.md`.
- **Justering fra Q3:** heroIntro minimum **3 setninger**, maks 4 (bruker sa "3 setninger også" = gulv, ikke interval 2-3).

## Next Steps

1. **Test-kjøring på Stasjonskvartalet** (i dag) — verifiser skillen produserer tekster som slår dagens versjon.
2. `/workflows:plan` for Iter 2 (hero-illustrasjon, 3D, publisering) når Iter 1 er stabil.
