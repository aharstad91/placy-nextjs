# Leangenbukta — lokal demo

Den andre lokale demoen på den delte kjernen i `lib/demo/local-board/`. Samme board, kart og samtalemotor som Nyhavna-demoen, men med `data/demo/leangenbukta-lokal/` som eneste kilde til faginnhold. Ingen Supabase, ingen POI-pool, ingen arv fra Nyhavna.

Demoen starter **tom**: åtte kategorier uten tekst, null steder, null temaer, null spørsmål. Kartet viser prosjektets utgangspunkt og ingenting annet. Det er meningen — hvert fakta som dukker opp, har noen lagt inn med vilje og med kilde.

## Kjør den

```bash
npm run dev          # eller PORT=3107 npm run dev i en worktree
```

Åpne `http://localhost:3107/demo/leangenbukta-lokal`. Ruta er `force-dynamic` og svarer bare i utvikling; i produksjon gir den 404.

Talesamtalen med Anja går over `/api/prototype/live` med `dataset=leangenbukta-lokal`. Den krever mikrofon og en `OPENAI_API_KEY`, og er den samme avgrensede lokale prototypen Nyhavna bruker.

Nettsidekopien som lenker hit ligger på `/demo/leangenbukta-nettside` — se `docs/demos/leangenbukta-nettside.md`.

## Hvor innholdet kommer fra

Datasettets seks JSON-filer er formatet i `lib/demo/local-board/schema.ts`. Profilen er `housing-development`; hva den krever står i `docs/demos/board-profiler.md`.

Hele oppskriften — prosjektoppsett, researchbestilling, dekningsregnskap, import, validering, skjermkontroll, lyttetest og hvordan oppdateringer oppfører seg — ligger i **[`docs/demos/boligprosjekt-arbeidsprosess.md`](../../demos/boligprosjekt-arbeidsprosess.md)**. Den gjelder både denne demoen og neste boligprosjekt.

Fram til innholdet er lagt inn er de tomme kategoriene et manglende **demogrunnlag**, ikke en påstand om at tilbudet ikke finnes i virkeligheten.

## Status per enhet

| Enhet | Hva den leverer | Status |
|---|---|---|
| U1 | Baseline og kartlegging av Nyhavna-koblingene | Levert — `baseline.md` |
| U2 | Felles lokal board-kjerne med eksplisitt register | Levert — `lib/demo/local-board/` |
| U3 | Boligprosjektprofil og `development`-objektet | Levert — `docs/demos/board-profiler.md` |
| U4 | Tom Leangenbukta-demo koblet til kart og Anja | Levert — `/demo/leangenbukta-lokal` |
| U5 | Prosjektgrunnlaget: bygg, fasiliteter, tidslinje | **Venter på research.** Ingen rapportsti registrert. |
| U6 | Nærområdet kategori for kategori, med lyttetest | **Venter på research.** |
| U7 | Nettsidekopien koblet, og demoprøve i nettleser og lyd | Venter på U5–U6 |
| U8 | Arbeidsprosessen dokumentert og bevist | Delvis — oppskriften og det syntetiske tredje prosjektet er levert. Gjenstår: å prøve oppskriften mot faktisk innholdsarbeid i U5–U6. |

Det syntetiske tredje prosjektet ligger i `lib/demo/local-board/third-project.test.ts`. Det finnes bare i testen, er ikke oppført i registeret og kan ikke nås fra Live-ruta.

## Bakgrunn

- `baseline.md` — regresjonsgrunnlaget demoen måles mot.
- `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md` — planen.
- `docs/demos/boligprosjekt-arbeidsprosess.md` — oppskriften for neste boligprosjekt.
- `docs/research/nyhavna-lokal-demo/README.md` — den første gjennomføringen av samme metode.
