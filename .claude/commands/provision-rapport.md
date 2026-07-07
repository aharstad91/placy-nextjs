# /provision-rapport — Basic Placy rapport-board

Provisjonér ett basic rapport-board fra prosjektnavn + adresse til public URL.

## Bruk

```
/provision-rapport "Prosjektnavn" "Full adresse"
/provision-rapport "Vikhammer Strand" "Vikhammer Strand 1, 7560 Vikhammer"
/provision-rapport "Overvik" "Overvik, Trondheim" --customer "din-kunde"
```

### Profil: bolig (default) vs. næring

`--profile naering` bytter til nærings-profilen for kontorbygg/næringseiendom:
lunsj/kaffe, kollektiv & pendling, trening, hverdagstjenester og et «Nabolaget»-
tema med hotell/kultur — ansatt-/besøkende-perspektiv, kortere radius (Trondheim
1500 m), `venue_type: commercial`, og INGEN skole/barnehage-import. Default er
`bolig` (uendret oppførsel).

```bash
npm run create-report -- --name "Teknostallen" --address "Teknostallen, Trondheim" \
  --profile naering --customer "klp-eiendom" --confirm-coords 63.41564,10.39599
```

## Hva kommandoen gjør

1. **Geocode** adresse → koordinater (Mapbox), hent kommunenummer (Kartverket)
2. **Vis plasseringen** til operatøren for bekreftelse (eneste interaktive steg)
3. **Kjør full pipeline** autonomt:
   - Opprett kunde (upsert) + prosjekt + rapport-produkt med statiske tema-tekster
   - Importer offentlige POI-er: NSR (nærmeste barneskole/ungdomsskole/VGS), Barnehagefakta, Overpass (idrettsanlegg)
   - Importer Google Places + Entur + Bysykkel, hent CDN-foto
   - Hydrér product_pois, product_categories, featured-scoring
   - Revalidér prod-cache
4. **Verifiser** på prod (screenshot av rapport-board) og lever public URL

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

**Spør operatøren:** «Er dette riktig sted? Koordinater: 63.413, 10.769 — Malvik kommune. Start provisjonering?»

Hvis nei: be om riktigere adresse og kjør dry-run på nytt.

## Steg 2: Full kjøring

Når koordinatene er bekreftet — pass `--confirm-coords` for å hoppe over ny geocoding:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" \
  --confirm-coords <LAT>,<LNG>
```

Eksempel:
```bash
npm run create-report -- --name "Vikhammer Strand" \
  --address "Vikhammer Strand, Malvik" \
  --confirm-coords 63.413,10.769
```

For annen kunde:
```bash
npm run create-report -- --name "Overvik" --address "Overvik, Trondheim" \
  --customer "overvik-as" --confirm-coords 63.41,10.48
```

## Re-kjøring (eksisterende prosjekt)

Legg til `--update` for å re-kjøre mot et prosjekt som allerede er provisjonert:

```bash
npm run create-report -- --name "<NAVN>" --address "<ADRESSE>" \
  --confirm-coords <LAT>,<LNG> --update
```

NB: re-kjøring er idempotent — eksisterende kuraterte tekster og hooks røres ikke.

## Steg 3: Verifiser leveransen

Ta screenshot av rapport-boardet på prod og sjekk:

```
https://placy.app/eiendom/<kunde>/<slug>/rapport-board
```

Sjekkliste:
- [ ] Temakort vises (typisk 5–6 kort med statiske tekster og POI-antall)
- [ ] Kartmarkører er synlige på 3D-kartet
- [ ] «Kom i gang»-knapp eller tilsvarende CTA er tilgjengelig
- [ ] Voice-over-laget er IKKE aktivt (empty-state viser «kommer» implisitt)
- [ ] Ingen 404 på `/illustrations/themes/`-bilder
- [ ] Ingen konsollfeil

## Steg 4: Lever

Del URL-en med ansvarlig megler:

```
https://placy.app/eiendom/<kunde>/<slug>/rapport-board
```

Informer om premium-oppgraderingssti (kan legges til ett lag om gangen):
- **Grounding** (norsk kontekst per tema): `npm run gemini:grounding -- <prosjekt-id>`
- **Voice-over/reels**: separat kuratering + VO-generering
- **Kuraterte tekster (nivå 2)**: `manus-curator`-skill — samlet manus per kategori (driver skjerm-tekst, VO og karaoke)

## Feilhåndtering

| Feil | Handling |
|------|----------|
| Geocode-relevance < 0.5 | Spesifiser mer presis adresse (gate + by + postnr) |
| Manglende GOOGLE_PLACES_API_KEY | POI-er uten foto — fortsett, legg til API-nøkkel og re-kjør |
| NSR feiler (kommunenummer ukjent) | Skoler mangler — re-kjør med `--update` etter at Kartverket er oppe |
| Overpass timeout | Idrettsanlegg mangler — re-kjør med `--update` |
| product_categories er tom | Kritisk feil — sjekk at import-stegene kjørte uten feil |

Halvferdige prosjekter **slettes aldri** — de beholdes i Supabase for debugging.
Re-kjøring med `--update` er alltid trygt.
