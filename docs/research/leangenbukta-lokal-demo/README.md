# Leangenbukta — lokal demo

Den andre lokale demoen på den delte kjernen i `lib/demo/local-board/`. Samme board, kart og samtalemotor som Nyhavna-demoen, men med `data/demo/leangenbukta-lokal/` som eneste kilde til faginnhold. Ingen Supabase, ingen POI-pool, ingen arv fra Nyhavna.

Demoen er fylt fra et fullstendig revidert researchgrunnlag: 565 prosjektpåstander og 145 nabolagskandidater er vurdert. Runtime inneholder 56 steder, 36 temaer, 34 faktiske FAQ-er og 35 separate samtalescenarier. Hvert aktivt fakta har kilde og kontrolldato; uavklarte eller avviste råpåstander importeres ikke som bekreftet kunnskap.

## Kjør den

```bash
npm run dev          # eller PORT=3107 npm run dev i en worktree
```

Åpne `http://localhost:3107/demo/leangenbukta-lokal`. Ruta er `force-dynamic` og svarer bare i utvikling; i produksjon gir den 404.

Talesamtalen med Anja går over `/api/prototype/live` med `dataset=leangenbukta-lokal`. Den krever mikrofon og en `OPENAI_API_KEY`, og er den samme avgrensede lokale prototypen Nyhavna bruker.

Nettsidekopien som lenker hit ligger på `/demo/leangenbukta-nettside` — se `docs/demos/leangenbukta-nettside.md`.

## Hvor innholdet kommer fra

Datasettet bruker det delte stedsformatet i `lib/demo/local-board/schema.ts`: `places-audited.json` eies av researchbyggeren, mens `places-register.json` eies av registerimporten. Runtime slår lagene sammen etter separat validering. Profilen er `housing-development`; hva den krever står i `docs/demos/board-profiler.md`.

Hele oppskriften — prosjektoppsett, researchbestilling, dekningsregnskap, import, validering, skjermkontroll, lyttetest og hvordan oppdateringer oppfører seg — ligger i **[`docs/demos/boligprosjekt-arbeidsprosess.md`](../../demos/boligprosjekt-arbeidsprosess.md)**. Den gjelder både denne demoen og neste boligprosjekt.

Runtime bygges deterministisk. `_build_runtime.py` leser bare reviderte kategori- og prosjektpakker, koordinatkvitteringen og den valgfrie rutekvitteringen, og skriver bare `places-audited.json`. Rårapportene er bevart for revisjon, men leses ikke av runtime-byggeren. Registerimporten skriver bare `places-register.json`; ingen av byggerne kan dermed overskrive den andres lag.

```bash
# Oppfrisk målte ruter ved behov (krever NEXT_PUBLIC_MAPBOX_TOKEN)
python3 docs/research/leangenbukta-lokal-demo/_measure_travel_times.py

# Bygg det reviderte runtime-laget fra godkjent materiale
python3 docs/research/leangenbukta-lokal-demo/_build_runtime.py

# Oppfrisk det brede kartregisteret innen 2 km fra det eksisterende boardet.
# Uten --write viser kommandoen bare opptellingen. Registeret gir Anja navn,
# type, adresse og lagret reisetid, men aldri kildekontrollerte fakta.
NODE_OPTIONS=--conditions=react-server node --env-file=.env.local \
  ./node_modules/.bin/tsx scripts/demo/import-local-register.ts \
  --customer placy-demo --source-slug leangenbukta \
  --dataset data/demo/leangenbukta-lokal --radius-km 2 \
  --checked-at 2026-09-18 --write

# Kontroller full dekning og runtime-grenser
npx vitest run lib/demo/local-board/leangenbukta-content.test.ts
```

`place-coordinate-verification.json`, `travel-times.json`, `runtime-import-report.json` og `register-import-report.json` er kvitteringene for importen. Et omtrentlig revidert kartpunkt er merket med synlig inngangsforbehold. De reviderte stedene bruker målte Mapbox-minutter; registeret beholder de lagrede reisetidene fra kildeboardet. Filgrensen håndhever `knowledgeLevel: audited|register`, og lasteren stopper hvis et sted ligger i feil lag. Alle 504 registersteder, også virksomhetene inni et anker, er søkbare for Anja med bare navn, type, adresse og lagret reisetid.

## Status per enhet

| Enhet | Hva den leverer | Status |
|---|---|---|
| U1 | Baseline og kartlegging av Nyhavna-koblingene | Levert — `baseline.md` |
| U2 | Felles lokal board-kjerne med eksplisitt register | Levert — `lib/demo/local-board/` |
| U3 | Boligprosjektprofil og `development`-objektet | Levert — `docs/demos/board-profiler.md` |
| U4 | Leangenbukta-demo koblet til kart og Anja | Levert — `/demo/leangenbukta-lokal` |
| U5 | Prosjektgrunnlaget: bygg, fasiliteter, tidslinje | Levert — 565/565 påstander vurdert, 124 godkjente runtime-påstander |
| U6 | Nærområdet kategori for kategori | Levert mekanisk — 145/145 kandidater, 26 reviderte kartankre, 30 reviderte medlemmer og målte ruter. Breddeimporten legger til 504 registersteder og gir 357 kartankre totalt innen 2 km. |
| U7 | Nettsidekopien koblet, og demoprøve i nettleser og lyd | Delvis levert — CTA og desktop/mobil er kontrollert; faktisk lydprøve gjenstår |
| U8 | Arbeidsprosessen dokumentert og bevist | Levert for research/import og nettleser; lydkvittering legges til etter lydprøven |

Det syntetiske tredje prosjektet ligger i `lib/demo/local-board/third-project.test.ts`. Det finnes bare i testen, er ikke oppført i registeret og kan ikke nås fra Live-ruta.

## Bakgrunn

- `baseline.md` — regresjonsgrunnlaget demoen måles mot.
- `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md` — planen.
- `docs/demos/boligprosjekt-arbeidsprosess.md` — oppskriften for neste boligprosjekt.
- `docs/research/nyhavna-lokal-demo/README.md` — den første gjennomføringen av samme metode.
