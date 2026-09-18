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

Innholdet fylles i to trinn etter denne rammen:

- **U5** tar inn prosjektgrunnlaget: bygg, fasiliteter og tidslinje, med kilde, kontrolldato og skille mellom byggestatus, åpning, tidspunkt og adgang.
- **U6** bygger nærområdet kategori for kategori, med samme kildekontroll og en lyttetest per kategori.

Fram til da er de tomme kategoriene et manglende **demogrunnlag**, ikke en påstand om at tilbudet ikke finnes i virkeligheten.

## Bakgrunn

- `baseline.md` — regresjonsgrunnlaget demoen måles mot.
- `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md` — planen.
- `docs/research/nyhavna-lokal-demo/README.md` — den første gjennomføringen av samme metode.
