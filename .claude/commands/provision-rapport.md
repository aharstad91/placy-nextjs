# /provision-rapport — Placy rapport-board (nivå 1 & 2)

Provisjonér ett rapport-board fra **prosjektnavn + adresse** til public URL — på valgt nivå.

- **Nivå 1** (default): deterministisk board med statiske tema-tekster. Rask, ren kode-pipeline.
- **Nivå 2**: nivå 1 **+ auto-kuratert innhold** — grounding (fakta per tema) → manus per kategori (manus-curator) → valgfri hero-illustrasjon → POI-trust-QA. Én kommando, kuratert board.

Målet er at operatøren bare sier «gi meg et board for adresse X, nivå 1 eller 2» — resten skjer i kjeden.

## Bruk

```
/provision-rapport "Prosjektnavn" "Full adresse"                 # nivå 1
/provision-rapport "Prosjektnavn" "Full adresse" --tier 2        # nivå 2 (kuratert)
/provision-rapport "Overvik" "Overvik, Trondheim" --customer "din-kunde" --tier 2
```

### Profil: bolig (default) vs. næring

`--profile naering` bytter til nærings-profilen for kontorbygg/næringseiendom:
lunsj/kaffe, kollektiv & pendling, trening, hverdagstjenester og et «Nabolaget»-
tema med hotell/kultur — ansatt-/besøkende-perspektiv, kortere radius (Trondheim
1500 m), `venue_type: commercial`, og INGEN skole/barnehage-import. Default er
`bolig` (uendret oppførsel).

### Nivå: 1 (basic) vs. 2 (kuratert)

`--tier` styrer leveransenivået. Uten flagg (non-interaktivt) = nivå 1.

- `--tier 1` — statiske tema-tekster. Ferdig etter Steg 2.
- `--tier 2` — kjør Steg 3-kjeden (grounding → manus → QA) etter Steg 2. **Krever Opus** (manus-curator krever skjønn) + `GEMINI_API_KEY` i `.env.local`.

```bash
npm run create-report -- --name "Teknostallen" --address "Teknostallen, Trondheim" \
  --profile naering --customer "klp-eiendom" --confirm-coords 63.41564,10.39599 --tier 2
```

## Hva kommandoen gjør

**Nivå 1 (alltid):**
1. **Geocode** adresse → koordinater (Mapbox), hent kommunenummer (Kartverket)
2. **Vis plasseringen** til operatøren for bekreftelse (eneste interaktive steg)
3. **Kjør full pipeline** autonomt (`create-report`):
   - Opprett kunde (upsert) + prosjekt + rapport-produkt med statiske tema-tekster
   - Importer offentlige POI-er: NSR (nærmeste barneskole/ungdomsskole/VGS), Barnehagefakta, Overpass (idrettsanlegg)
   - Importer Google Places + Entur + Bysykkel, hent CDN-foto
   - Hydrér product_pois, product_categories, featured-scoring
   - Revalidér prod-cache

**Nivå 2 (hvis `--tier 2`, kjøres etter steg 3 — Steg 3-kjeden under):**
4. **Grounding** — hent norsk faktakontekst per tema (Gemini + Google Search)
5. **Manus per kategori** — manus-curator skriver samlet manus per aktivt tema (driver skjerm-tekst, VO og karaoke)
6. **(Valgfri) Hero-illustrasjon** — kun hvis operatøren oppgir kildebilde
7. **POI-trust-QA** — validér nyimporterte POI-er

Til slutt (begge nivå): **Verifiser** på prod og lever public URL.

## Steg 1: Dry-run (plasserings-bekreftelse)

Kjør alltid `--dry-run` FØRST for å vise planlagt posisjon og kommuneinfo:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" --dry-run
```

Output:
```
── Steg 1: Geocoding ──
Plassering: Vikhammer Strand, Vikhammer, Malvik, Norway
Koordinater: 63.413, 10.769
Relevance: 0.89
Kommune: Malvik (5028)

── Dry-run: plan ──
Prosjektnavn: Vikhammer Strand
Kunde: placy-demo
Discovery radius: 2500 m

Ingen Supabase-writes (--dry-run)
```

**Spør operatøren:** «Er dette riktig sted? Koordinater: 63.413, 10.769 — Malvik kommune. Nivå 1 eller 2? Start provisjonering?»

Hvis nei: be om riktigere adresse og kjør dry-run på nytt.

## Steg 2: Full kjøring (board = nivå 1 ferdig)

Når koordinatene er bekreftet — pass `--confirm-coords` for å hoppe over ny geocoding, og `--tier` for nivå:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" \
  --confirm-coords <LAT>,<LNG> --tier <1|2>
```

Eksempel:
```bash
npm run create-report -- --name "Vikhammer Strand" \
  --address "Vikhammer Strand, Malvik" \
  --confirm-coords 63.413,10.769 --tier 2
```

Noter fra output: **Prosjekt-ID** (`{kunde}_{slug}`-form) og **Produkt-ID** (uuid) — begge trengs i Steg 3.

**Hvis nivå 1:** hopp til Steg 4 (verifiser). Board-et er ferdig.
**Hvis nivå 2:** fortsett til Steg 3.

## Steg 3 (kun nivå 2): Kuratert innhold — auto-chain

Kjør sekvensielt med Prosjekt-ID fra Steg 2. Fail-soft: et feilende delsteg blokkerer ikke de andre, men rapportér tydelig hva som mangler til slutt.

### 3a — Grounding (faktakontekst per tema)

```bash
npx tsx scripts/gemini-grounding.ts <PROSJEKT-ID> --apply
```

Skriver `grounding.narrative` per tema i `products.config.reportConfig.themes[]`. `--force` overskriver eksisterende grounding. Krever `GEMINI_API_KEY`. Dette er fact-feed-en manus-steget bygger på — kjør FØR 3b.

### 3b — Manus per kategori (manus-curator)

For **hvert aktivt tema** på produktet: kjør `manus-curator`-skillen med Prosjekt-ID + tema-id. Skillen distillerer grounding-fakta til ett samlet manus (5 setn, ~65-75 ord, 20-25 sek TTS), skriver staging til `.curation-staging/<prosjekt>/<tema>.md`, og patcher `config.reportConfig.themes[].audio.manus`.

- **Krever Opus** — manus-curator krever skjønn (ikke bytt til Sonnet for dette steget).
- Start med **Barn & Oppvekst** hvis det temaet finnes (validerer skolekrets-unntaket først).
- Auto-apply, men **presentér et kort sammendrag per tema** (manus + ord-antall) til operatøren etter kjøring, så avvik kan fanges. Staging-filene ligger for gjennomlesing/retting.

### 3c — (Valgfri) Hero-illustrasjon

Kun hvis operatøren har oppgitt et kildebilde. Kjør `placy-illustrations`-skillen (Mønster B, foto→akvarell) → `public/illustrations/<slug>-hero.jpg`, og patch `config.reportConfig.heroImage`. Uten kildebilde: hopp over (board-et bruker default).

### 3d — POI-trust-QA

```
/validate-poi-trust <PROSJEKT-ID>
```

Kjører Layer 1+2 (heuristikk) + Layer 3 (WebSearch på grensetilfeller), skriver `trust_score` + `trust_flags`.

### 3e — Revalidér

Etter alle writes: revalidér prod-cache for produktet (grounding/manus-skriptene gjør dette selv der de kan; verifiser at boardet viser oppdatert innhold).

## Re-kjøring (eksisterende prosjekt)

Legg til `--update` for å re-kjøre mot et prosjekt som allerede er provisjonert:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" \
  --confirm-coords <LAT>,<LNG> --tier <1|2> --update
```

NB: re-kjøring er idempotent — eksisterende kuraterte tekster og hooks røres ikke. For å regenerere grounding/manus: kjør Steg 3 på nytt (grounding med `--force`).

## Steg 4: Verifiser leveransen

Ta screenshot av rapport-boardet på prod og sjekk:

```
https://placy.app/eiendom/<kunde>/<slug>/rapport-board
```

Sjekkliste (nivå 1):
- [ ] Temakort vises (typisk 5–6 kort med POI-antall)
- [ ] Kartmarkører er synlige på 3D-kartet
- [ ] «Kom i gang»-knapp eller tilsvarende CTA er tilgjengelig
- [ ] Ingen 404 på `/illustrations/themes/`-bilder
- [ ] Ingen konsollfeil

I tillegg (nivå 2):
- [ ] Hvert aktivt tema har kuratert manus (ikke statisk lead-tekst)
- [ ] Grounding-fakta gjenspeiles i teksten (ingen vanilla-LLM-slop)
- [ ] Voice-over/karaoke-laget kan aktiveres (manus er kilden)
- [ ] POI-er har trust_score satt

## Steg 5: Lever

Del URL-en med ansvarlig megler:

```
https://placy.app/eiendom/<kunde>/<slug>/rapport-board
```

For nivå-1-leveranser, informer om oppgradering til nivå 2 (kjør kommandoen på nytt med `--tier 2 --update`, eller kjør Steg 3-kjeden alene mot Prosjekt-ID).

## Feilhåndtering

| Feil | Handling |
|------|----------|
| Geocode-relevance < 0.5 | Spesifiser mer presis adresse (gate + by + postnr) |
| Manglende GOOGLE_PLACES_API_KEY | POI-er uten foto — fortsett, legg til API-nøkkel og re-kjør |
| NSR feiler (kommunenummer ukjent) | Skoler mangler — re-kjør med `--update` etter at Kartverket er oppe |
| Overpass timeout | Idrettsanlegg mangler — re-kjør med `--update` |
| product_categories er tom | Kritisk feil — sjekk at import-stegene kjørte uten feil |
| Manglende GEMINI_API_KEY (nivå 2) | Grounding + manus hopper over — boardet leveres som nivå 1, re-kjør Steg 3 når nøkkel er satt |
| Grounding gir tynn faktakontekst for et tema | Manus for det temaet blir svakt — vurder `--force` re-grounding eller manuell curation |

Halvferdige prosjekter **slettes aldri** — de beholdes i Supabase for debugging.
Re-kjøring med `--update` er alltid trygt.
