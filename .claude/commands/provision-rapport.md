# /provision-rapport — Placy rapport-board (nivå 1 & 2)

Provisjonér ett rapport-board fra **prosjektnavn + adresse** til public URL — på valgt nivå.

- **Nivå 1** (default): deterministisk board med statiske tema-tekster.
- **Nivå 2**: nivå 1 **+ kuratert editorial per tema, arvet automatisk fra strøket** boardet ligger i (Lokalkunnskap-moaten). Ett kall — `--tier 2` — hvis strøket allerede er kuratert.

Målet er at operatøren bare sier «gi meg et board for adresse X, nivå 1 eller 2».

## Slik henger nivå 2 sammen (les før bruk)

Nivå 2 = `editorial` (brødtekst + highlight-chips) på ALLE temaer. Den **genereres ikke per board** — den **arves fra det kuraterte strøket** (Steg 8, `inherit-area-editorial`). Konsekvensen:

- Ligger adressen i et **kuratert strøk** (per 2026-07-07: Ranheim, Tyholt, Eberg, Malvik, Lade, Charlottenlund, Sentrum) → `--tier 2` arver editorial automatisk og består nivå-2-akseptansen. Ingen ekstra manuelle steg.
- Ligger adressen i et **ukuratert strøk** → boardet leveres som nivå 1 (akseptansen flagger «mangler editorial»). **Kurér strøket først** (Lokalkunnskap-bygg: `curate-area.ts` + `curator`/`manus-curator`-skill + strøk-boundary), så re-kjør med `--tier 2 --update`.

**VO/manus, 3D og kamera er ortogonale render-flagg — IKKE del av nivå.** `manus-curator`, grounding og `placy-illustrations` er valgfrie berikelseslag (se nederst), ikke nivå-2-krav.

### Forutsetning for nivå 2
Steg 8 kjører editorial-arven via `/api/admin/inherit-editorial` (fordi render-filtreringen drar `server-only`/`"use client"` som ikke kjører i en ren CLI). Derfor: **lokal dev-server på `:3000` med `ADMIN_ENABLED=true`**. Uten den er arven fail-soft → boardet leveres som nivå 1. Overstyr port med `PROVISION_LOCAL_URL` (f.eks. worktree på `:3001`). Editorial-arv trenger IKKE `GEMINI_API_KEY` (det er for grounding/berikelse).

## Bruk

```
/provision-rapport "Prosjektnavn" "Full adresse"                 # nivå 1
/provision-rapport "Prosjektnavn" "Full adresse" --tier 2        # nivå 2 (arver strøk-editorial)
/provision-rapport "Overvik" "Overvik, Trondheim" --customer "din-kunde" --tier 2
```

### Profil: bolig (default) vs. næring

`--profile naering` bytter til nærings-profilen for kontorbygg/næringseiendom:
lunsj/kaffe, kollektiv & pendling, trening, hverdagstjenester og et «Nabolaget»-
tema med hotell/kultur — ansatt-/besøkende-perspektiv, kortere radius (Trondheim
1500 m), `venue_type: commercial`, og INGEN skole/barnehage-import. Default er
`bolig` (uendret oppførsel).

```bash
npm run create-report -- --name "Teknostallen" --address "Teknostallen, Trondheim" \
  --profile naering --customer "klp-eiendom" --confirm-coords 63.41564,10.39599 --tier 2
```

## Hva kommandoen gjør

1. **Geocode** adresse → koordinater (Mapbox), hent kommunenummer (Kartverket)
2. **Vis plasseringen** til operatøren for bekreftelse (eneste interaktive steg)
3. **Kjør full pipeline** autonomt (`create-report`):
   - Opprett kunde (upsert) + prosjekt + rapport-produkt (statiske tema-tekster)
   - Importer offentlige POI-er: NSR (skoler), Barnehagefakta, Overpass (idrett)
   - Importer Google Places + Entur + Bysykkel, hent CDN-foto
   - Hydrér product_pois, product_categories, featured-scoring
   - Reisetider (Mapbox Matrix)
   - **Nabolags-editorial (Steg 8):** arv fra kuratert strøk hvis funnet. Nivå 2 uten treff = board forblir nivå 1.
   - Revalidér prod-cache
   - **Akseptansesjekk (Steg 10):** verifiser at deklarert nivå er dekket (nivå 2 → editorial på alle temaer)
4. **Verifiser** på prod og lever public URL

## Steg 1: Dry-run (plasserings-bekreftelse)

Kjør alltid `--dry-run` FØRST:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" --dry-run
```

**Spør operatøren:** «Er dette riktig sted? Koordinater: … — <kommune>. Nivå 1 eller 2? Start provisjonering?»

Hvis nei: be om riktigere adresse og kjør dry-run på nytt.

## Steg 2: Full kjøring

Når koordinatene er bekreftet — pass `--confirm-coords` (hopp over ny geocoding) + `--tier`:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" \
  --confirm-coords <LAT>,<LNG> --tier <1|2>
```

Les fra output: **Prosjekt-ID** (`{kunde}_{slug}`) + **Produkt-ID**.

- Ser du `✓ nivå: nivå 2 OK` i Steg 10 → boardet er komplett nivå 2.
- Ser du `✗ nivå: … mangler: editorial` → strøket er ikke kuratert. Boardet er et gyldig nivå-1-board; kurér strøket og kjør `--tier 2 --update` for å løfte det.

## Re-kjøring (eksisterende prosjekt)

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" \
  --confirm-coords <LAT>,<LNG> --tier <1|2> --update
```

Idempotent — eksisterende kuraterte tekster/hooks røres ikke; editorial-arv er alt-eller-ingenting (aldri delvis).

## Steg 3: Verifiser leveransen

```
https://placy.app/eiendom/<kunde>/<slug>/rapport-board
```

Sjekkliste (nivå 1):
- [ ] Temakort vises (typisk 5–6 kort med POI-antall)
- [ ] Kartmarkører synlige på 3D-kartet
- [ ] Ingen 404 på `/illustrations/themes/`-bilder + ingen konsollfeil

I tillegg (nivå 2):
- [ ] Hvert tema har kuratert editorial (drill-in-panel med brødtekst + highlight-chips)
- [ ] Steg 10 rapporterte `nivå 2 OK`

## Steg 4: Lever

Del URL-en med ansvarlig megler. For nivå-1-leveranser: løft til nivå 2 ved å kurere strøket og kjøre `--tier 2 --update`.

## Berikelseslag (ortogonale — IKKE nivå-krav)

Legges til uavhengig av nivå, ett lag om gangen:
- **Grounding** (norsk faktakontekst per tema): `npx tsx scripts/gemini-grounding.ts <PROSJEKT-ID> --apply` (krever `GEMINI_API_KEY`)
- **Voice-over / karaoke** (manus per kategori): `manus-curator`-skill → `config.reportConfig.themes[].audio.manus`. Driver VO-render-flagget.
- **Hero-illustrasjon**: `placy-illustrations`-skill (foto→akvarell) → `config.reportConfig.heroImage`
- **POI-trust-QA**: `/validate-poi-trust <PROSJEKT-ID>`

## Feilhåndtering

| Feil | Handling |
|------|----------|
| Geocode-relevance < 0.5 | Spesifiser mer presis adresse (gate + by + postnr) |
| Manglende GOOGLE_PLACES_API_KEY | POI-er uten foto — fortsett, legg til nøkkel og re-kjør |
| Overpass timeout / HTTP 406 | Idrettsanlegg mangler — fail-soft, Google gym dekker ofte temaet; re-kjør `--update` |
| `✗ nivå 2 … mangler: editorial` | Strøket er ikke kuratert — kurér strøket, kjør `--tier 2 --update` |
| Steg 8: «Editorial-arv via route feilet» | Dev-server nede eller `ADMIN_ENABLED` av — start `npm run dev` på `:3000`, kjør `--tier 2 --update` |
| product_categories tom | Kritisk — sjekk at import-stegene kjørte uten feil |

Halvferdige prosjekter **slettes aldri** automatisk. Re-kjøring med `--update` er alltid trygt.
