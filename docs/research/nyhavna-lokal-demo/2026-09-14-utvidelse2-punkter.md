# 60 steder fra start i Nyhavna-demoen

14. september 2026. Aktiv lokal demo: http://localhost:3103/demo/nyhavna-lokal.

Brukeren så 44 steder etter forrige utvidelse. Basen hadde 63, men 19 trenings- og natursteder ble holdt tilbake til «Vis flere steder». Forrige rapportering skilte ikke tydelig mellom totalt datagrunnlag og startvisning. Denne runden legger til 16 steder i kategorier uten reserve: **60 synlige fra start, 19 i reserve, 79 totalt**.

## Nye punkter

| Kategori | Før → nå i startvisningen | Tillegg |
|---|---:|---|
| Servering | 9 → 17 | Egon Solsiden, Olivia Solsiden, Cafe Løkka, Dromedar Kaffebar Solsiden, Héctor Food & Fiesta, Tollbua, Bror Solsiden, SOT Bar & Burger Solsiden |
| Hverdag | 3 → 6 | Apotek 1 Solsiden, Vinmonopolet Solsiden, REMA 1000 Solsiden |
| Oppvekst | 9 → 11 | Leo's Lekeland Trondheim, Lade Motor |
| Opplevelser | 5 → 8 | Rockheim, Pirbadet, Dokkhuset |

17 kandidater vurdert, 16 inkludert og én holdt utenfor: Pizzabakeren Lade ble erstattet av SOT fordi egenkildestøttet besøksadresse ikke kunne leses. Alle 16 inkluderte steder og alle 32 fakta er kontrollert, også ved kryssreview. Det er lagt til 39 nye kilder; tidligere oppføringer er bevart.

## Kunnskap og kart

Hvert sted har to korte kildekoblede fakta, kort beskrivelse og relevante forbehold. Lade Motor er et tilbud med fast deltakelse og rekruttering, ikke drop-in. Cafe Løkkas publiserte meny er datert oktober 2025. Kildenes tekniske leseproblemer og redaksjonelle kontrollnotater finnes i researchfilene, ikke i publikumsinnholdet.

Alle 16 koordinater kommer fra Kartverkets adressepunkter og er merket omtrentlig inngangsplassering. Flere virksomheter deler senteradresse; det betyr ikke at de har samme interne inngang. Det er beregnet 32 ruter fra demoens faste utgangspunkt: gange og sykkel til hvert adressepunkt. Største forskjell mellom forespurt kartpunkt og rutens endepunkt er 22,8 meter.

Manus, FAQ, topics og radiusfunksjon er beholdt. Den eksisterende testen for lignende kaféer er utvidet med Cafe Løkka og Dromedar før alternativene er uttømt. Produktkode er ikke endret.

## Verifikasjon

- Skjema og alle referanser kontrollert før aktivering.
- Alle 16 tillegg finnes i faktisk startutvalg, kartadapter, stemmens kunnskapsbase og kuratert stedsgrunnlag.
- `visibleReserveBoard` gir 60 steder, mens hele boardet har 79.
- Ny Chrome-fane åpnet på aktiv demo. Nettleserens tilgjengelighetstre viste **«60 steder · 8 temaer»**, med Servering 17, Hverdag 6, Oppvekst 11 og Opplevelser 8.
- Alle 73 lokale demotester passerte.
- Ingen ekte talesamtale kjørt i denne økten.

## Leveranse og tilbakeføring

`2026-09-14-utvidelse2-punkter.json` inneholder de nøyaktige additive stedene og kildene. De to researchfilene dokumenterer kandidatene. Adresseoppslag og rutesvar ligger i egne JSON-filer. `2026-09-14-utvidelse2-testjustering.patch` dokumenterer den smale testendringen.

For å fjerne tillegg: fjern bare punktfilens steds-ID-er fra aktiv `places.json`, og bare nye kilde-ID-er som deretter er uten referanser. Fjern også de nye kaféforventningene ved full tilbakeføring. Ikke gjenopprett hele filer over parallelløktens arbeid.

Aktive data og testfil forblir ukommittert sammen med parallelløkten. Denne leveransen lagres separat i innholdsarbeidskopien. Ingen push. Last gamle demo-faner på nytt og start ny samtale for oppdatert innhold.

Mekaniske sjekker: `npm run lint` passerte med 0 feil og 53 advarsler; `npx tsc --noEmit` passerte. Hele `npm test` ga 4313 passerte og de samme tre tekniske testfeilene som før denne runden: stemmeinstruksens ordgrense og to forventninger i `BoardVoiceControl.test.tsx`. Ingen nye feil. Disse testene bruker andre instruksjoner/fixture-data og leser ikke de nye stedene. Ingen produksjonsbygg eller PR.
