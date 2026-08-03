---
module: Next.js Build
date: 2026-08-03
problem_type: build_error
component: bundle_verification
symptoms:
  - "Error: ENOENT: no such file or directory, open '.next/app-build-manifest.json'"
  - "Verifiseringsscript som leser app-build-manifest krasjer etter vellykket npm run build"
  - "Ingen chunk-filer matcher navnet fra webpackChunkName (f.eks. report-splash-desktop.<hash>.js)"
  - ".next/static/chunks inneholder kun hashede navn (0rx3q4v122iug.js)"
root_cause: breaking_change
resolution_type: script_rewrite
severity: medium
tags: [build, next16, turbopack, chunks, webpackChunkName, code-splitting, bundle-verification, manifest]
---

# Turbopack dropper navngitte chunker og `app-build-manifest.json`

## Problem

Etter Next 16-oppgraderingen krasjer verktøy som inspiserer bygge-artefakter for å
verifisere code-splitting. To antakelser som holdt under webpack er ugyldige under
Turbopack — som er **default bundler for `next build` i Next 16**:

1. **`.next/app-build-manifest.json` emitteres ikke.** Filen som mappet app-ruter til
   deres entry-chunk-liste finnes ikke i det hele tatt.
2. **`webpackChunkName`-magic-comments ignoreres.** Chunkene får hashede navn, så en
   `import(/* webpackChunkName: "foo" */ ...)` produserer ingen `foo.<hash>.js`.

Feilen er stille i den forstand at `npm run build` er grønt — det er bare
etterverifiseringen som faller. Hos oss var `scripts/verify-board-bundle.mjs`
(bundle-beviset for board-skallets lazy-load-grenser) ute av drift i flere uker uten
at noe annet varslet om det.

## Environment

- Module: Next.js build toolchain
- Next.js Version: 16 (App Router, Turbopack som default build-bundler)
- Affected Component: `scripts/verify-board-bundle.mjs`
- Date: 2026-08-03

## Symptoms

```
Error: ENOENT: no such file or directory, open
  '/Users/.../placy/.next/app-build-manifest.json'
    at readFileSync (node:fs:442:20)
```

Og ved forsøk på å finne navngitte chunker:

```bash
$ ls .next/static/chunks | grep -iE "report-splash|reels-audio"
# ingen treff — kun hashede navn:
0rx3q4v122iug.js  08fr33ckh4p-8.js  2lxpaas0cpyp_.js  turbopack-34u1aigd6ka_5.js
```

## Root Cause

Turbopack har egen chunking-strategi og eget manifest-oppsett. Manifestene er
**per-rute** under `.next/server/app/<rute>/`, ikke globale i `.next/`-rota:

| Webpack (Next ≤15) | Turbopack (Next 16) |
|---|---|
| `.next/app-build-manifest.json` → `pages["/rute/page"]` = entry-chunker | `.next/server/app/<rute>/page/build-manifest.json` → `rootMainFiles` + `polyfillFiles` |
| `webpackChunkName` gir stabile chunk-navn | Magic comments ignoreres; navn er hashet |
| — | `.next/server/app/<rute>/page/react-loadable-manifest.json` → dynamic-import-chunkene |

`webpackChunkName`-kommentarene blir altså **inerte** — de står fortsatt i kilden og
ser meningsfulle ut, men påvirker ikke bygget. Det er fellen: en kilde-test som
asserter at kommentaren finnes vil passere, mens ingen chunk faktisk har det navnet.

## What Didn't Work

- **Lete etter manifestet et annet sted i `.next/`.** `build-manifest.json` i rota
  finnes, men `pages`-nøkkelen der inneholder kun pages-router-oppføringer (`/_app`)
  — ingen app-ruter. Dens `rootMainFiles` er global, ikke per rute.
- **Beholde navne-basert identifikasjon.** Det finnes ingen konfigurasjon som gir
  Turbopack til å respektere `webpackChunkName`.

## Solution

Bytt identifikasjon fra **chunk-navn** til **kode-markører**, og les de per-rute
manifestene:

```js
const ROUTE_MANIFEST_DIR = join(
  ".next", "server", "app",
  "eiendom", "[customer]", "[project]", "rapport-board", "page",
);

const bm = JSON.parse(readFileSync(join(ROUTE_MANIFEST_DIR, "build-manifest.json")));
const rl = JSON.parse(readFileSync(join(ROUTE_MANIFEST_DIR, "react-loadable-manifest.json")));

// Initiell last for ruta
const entryFiles = [...bm.rootMainFiles, ...bm.polyfillFiles];
// Dynamic-import-chunkene
const lazyFiles = [...new Set(Object.values(rl).flatMap((v) => v.files))];
```

En **kode-markør** er en string-literal som overlever minifisering — typisk fra JSX,
f.eks. en `sizes`-attributt (`"(min-width: 1024px) 50vw, 0px"`) eller et
analytics-event-navn. To assertions per modul:

- **A:** markøren finnes i **nøyaktig én** lazy-chunk → modulen er faktisk
  code-splittet, ikke bare fraværende/død.
- **B:** markøren er **fraværende fra alle** entry-chunker → ingenting tungt på
  initiell last.

Der ett token også kan stamme fra en annen modul (vårt `voiceover_played` er også en
`z.literal` i event-schema), krev **flere tokens i samme chunk** framfor å velge en
svakere markør.

## Why This Works

Assertion-paret beviser den samme invarianten som navne-sjekken gjorde, men på
modulens faktiske **kode** i stedet for på et chunk-navn bundleren ikke lenger
garanterer. Det er dermed bundler-agnostisk: en framtidig bundler-endring som flytter
kode inn i entry-chunken vil fortsatt fanges.

Sidegevinst: markør-basert verifisering dekker moduler som navne-sjekken ikke kunne
innholds-verifisere. Hos oss gikk dekningen fra 3 til 4 moduler.

## Verification

```bash
npm run build
node scripts/verify-board-bundle.mjs   # exit 0 = PASS
```

**Negativ-test guarden — ellers vet du ikke at den har tenner.** Kjør en kopi med (a)
en markør som ikke finnes, og (b) en markør som finnes overalt (f.eks. `"use strict"`).
Begge skal gi FAIL / exit 1:

```bash
sed 's/tokens: \["<ekte markør>"\]/tokens: ["FINNES-IKKE"]/' \
  scripts/verify-board-bundle.mjs > /tmp/negtest.mjs && node /tmp/negtest.mjs
```

## Prevention

- **Kode-markører framfor bundler-metadata** når du verifiserer code-splitting. Navn,
  chunk-IDer og manifest-format er bundler-implementasjonsdetaljer; string-literaler
  i din egen kode er ikke.
- **Verifiseringsscript som krever `npm run build` råtner stille.** De kjøres ikke av
  pre-commit-hooken og fanges ikke av `npm test`. Kjør dem eksplisitt etter
  framework-oppgraderinger.
- **Behold kilde-testen** på `dynamic()`-grensene — det er den lastbærende
  invarianten. Men vit at `webpackChunkName`-delen av en slik test kun dokumenterer
  intensjon under Turbopack, den beviser ingenting om bygget.

## Related Issues

- `docs/solutions/build-errors/next-cache-corruption-parallel-sessions-20260215.md`
- `docs/solutions/build-errors/build-race-with-dev-server-enoent-20260418.md`
- `PROJECT-LOG.md` → 2026-08-03 (commit `e47ecb5`, omskrivingen)
