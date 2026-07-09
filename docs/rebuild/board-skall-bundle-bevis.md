# Board-skall — bundle-bevis (lazy-load-grenser)

> **PRD 9 Unit 7 / PRD 2 Beslutning 14.** Faller­serbart bevis for at de tre
> PRD-2-verifiserte tunge nivå-2-/ortogonale modulene IKKE ligger i entry-chunken
> for et nivå-1 rapport-board, men i SEPARATE lazy-chunker. Kjørbar som binær
> pass/fail mot navngitte identifikatorer via `scripts/verify-board-bundle.mjs`.

## De tre modulene → grenser i kode

`dynamic()`-grensene er implementert i `components/variants/report/reels/ReportReelsPage.tsx`
(+ ny `ReelsAudioOrchestrator.tsx`). Skall-grensen `ResponsiveLayout = dynamic(ssr:false)`
(`:1040`-mønsteret) er BEVART (bevisst `ssr:false` mot `useMediaQuery`-hydration-mismatch).

| PRD-2-modul | Kode | Lazy-chunk (`webpackChunkName`) |
|-------------|------|----------------------------------|
| reels/splash-`<video>`-pipeline **+** kuratert hero-asset-lasting¹ | `DesktopReportSplash` | `report-splash-desktop` |
| ″ | `MobileReportSplash` | `report-splash-mobile` |
| embed-chrome (fullskjerm-knapp + aktiveringsgate, kun embed-modus) | `EmbedChrome` | `report-embed-chrome` |
| voiceover-orchestration | `ReelsAudioOrchestrator` → `use-reels-audio-orchestration` | `reels-audio-orchestration` |

¹ **Kode-realitet (reconciliation):** AC navngir tre moduler, men i denne kodebasen
er «splash-`<video>`-pipeline» og «kuratert hero-asset-lasting» co-lokalisert i
splash-cluster-en — de samme tre komponentene rendrer BÅDE splash-`<video>`
(`heroVideo` = `getProjectSplashVideo`, reels-video) OG den kuraterte hero-asseten
(`heroImage` = `getProjectSplashImage` → `next/image`). De to konseptene deler altså
chunk(er) by-construction. Det FALSIFISERBARE kravet — «de tre modulene fraværende
fra entry-chunken» (AC2: «separat lazy-chunk (ikke entry-chunken)») — er oppfylt for
alle tre: ingen av dem ligger i entry-chunken. Second-system-vakt (AC3): vi splitter
IKKE hero-asset-rendringen ut i en egen abstraksjon kun for å øke chunk-tellingen —
det ville vært den spekulative abstraksjonen AC3 forbyr.

## (a) Navngitte lazy-chunk-identifikatorer

Etter `npm run build` (webpack, Next 14.2) emitteres fire stabilt navngitte chunker
i `.next/static/chunks/` (hash varierer per build):

```
report-splash-desktop.<hash>.js        (~4.6 kB)
report-splash-mobile.<hash>.js         (~4.3 kB)
report-embed-chrome.<hash>.js          (~1 kB)
reels-audio-orchestration.<hash>.js    (~0.9 kB)
```

## (b) Fravær-assert mot entry-chunkens modulliste

Rutas entry-chunk-liste leses fra `.next/app-build-manifest.json` →
`pages["/eiendom/[customer]/[project]/rapport-board/page"]`. `verify-board-bundle.mjs`
gjør to uavhengige assertions:

- **[A] (autoritativ, alle 4):** hver navngitt chunk-fil EKSISTERER, og chunk-en er
  FRAVÆRENDE fra entry-lista (lastes on-demand, ikke ved initiell board-render).
- **[B] (innholds-kryssjekk, splash-trioen):** en unik kode-markør (string-literal som
  overlever minifisering) finnes i modulens lazy-chunk, men i INGEN av entry-chunkene
  → modul-KODEN, ikke bare chunk-navnet, er ute av entry. Markører:
  `DesktopReportSplash` = `(min-width: 1024px) 50vw, 0px`; `MobileReportSplash` =
  ` – nabolag`; `EmbedChrome` = `Trykk for å utforske nabolaget`.
  (`reels-audio-orchestration` har ingen unik string-literal — struktural unikhet —
  så den dekkes kun av [A], som er rock-solid for webpack: `webpackChunkName` plasserer
  modulen i den navngitte chunken by-construction.)

Kjør:

```bash
npm run build && node scripts/verify-board-bundle.mjs
# → "BUNDLE-BEVIS: PASS" + exit 0, ellers exit 1 (FAIL) / exit 2 (mangler .next)
```

## (c) Før/etter-chunk-kart

Målt på `main` (samme commit), `npm run build` med vs. uten Unit-7-grensene:

| | FØR (statiske imports) | ETTER (dynamic-splittet) |
|---|---|---|
| Navngitte lazy-chunker | INGEN (`report-splash-*`/`reels-audio-*` finnes ikke) | 4 (se over) |
| Desktop-splash-markør (`(min-width: 1024px) 50vw, 0px`) | i ENTRY-chunken `250-<hash>.js` | i lazy `report-splash-desktop.<hash>.js`, fraværende fra alle entry-chunker |
| `/…/rapport-board` First Load JS | 487 kB | 485 kB |
| `verify-board-bundle.mjs` | ikke anvendbar (ingen named chunks) | **PASS** |

«Før»-kolonnen reproduseres ved å `git stash` Unit-7-diffen, `npm run build`, og
observere at (1) ingen `report-splash-*`-chunker emitteres, og (2) splash-markøren
ligger i en entry-chunk (`250-<hash>.js`).

> **Hvorfor `ssr:false` allerede garanterer split, og hvorfor beviset likevel er
> nødvendig (AC2):** den gamle `ResponsiveLayout = dynamic(() => Promise.resolve(
> ResponsiveLayoutInner), {ssr:false})` splitter IKKE strukturelt — `Promise.resolve`
> av et lokalt symbol er ingen `import()`, så `ResponsiveLayoutInner` + alle dens
> statiske imports (splash, embed, orchestration) lå i entry-chunken. Unit 7 bytter
> til ekte `dynamic(() => import("…"))` med navngitte chunker. Beviset er derfor en
> NAVNGITT tilstedeværelses-/fravær-assertion, ikke en relativ-størrelse-måling.

## Kilde-invariant (build-fri vakt)

`__tests__/ReportReelsPage.lazy-boundaries.test.ts` låser kilde-invariantene
(`dynamic()` + `webpackChunkName` per modul, ingen statisk import, skall-grense bevart,
nøyaktig 4+1 dynamic-grenser) så bygget fortsetter å produsere de separate chunkene
uten å kreve en full build i enhetstest-løpet.
