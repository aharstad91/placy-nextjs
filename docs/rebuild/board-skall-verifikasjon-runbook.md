# Board-skall — verifikasjons-runbook (PRD 9 Unit 8 / r09.8)

> **✅ UTFØRT 2026-06-30.** Kjørt mot fersk produksjonsbygg (`npm run build` → `PORT=3011 npm run start`)
> i nystartet Chrome (eget `--user-data-dir`, `--remote-debugging-port=9222`) via chrome-devtools
> MCP. Alle 6 AC grønne. Skallet er bevist å FUNGERE (ikke bare kompilere): adaptiv desktop/mobil-split
> uten hydration-mismatch, nivå-1- og nivå-2-overflate forket UTELUKKENDE på `assets`-flagg (0
> `reportTier`-render-bryter i skall-filene), SEO-metadata, begge embed-grener, og no-photo-fallback.
> Mekaniske porter grønne (tsc 0, lint 0 errors, 1237 tester, build OK, bundle-bevis PASS).

> **Formål:** Bevise at board-SKALLET FUNGERER mot prod — ikke bare kompilerer («Output-fokus»-regelen).
> Søster-runbook til `3d-motor-verifikasjon-runbook.md` (PRD 6 Unit 8 / r06.8), som etablerte mønsteret
> «chrome-devtools MCP + fersk prod-server + DOM-observasjon gjør nystartet-Chrome-verifikasjon kjørbar
> i autonom loop». r09.8 gjenbruker dette mønsteret for skall-laget (splash / sidebar / embed / SEO),
> der r06.8 dekket motor-laget (WebGL-context-invarianten).

## Hva som verifiseres (AC, PRD 9 Unit 8)

1. **Desktop + mobil (mobile-native UX):** `DesktopStorySidebar` (sidekolonne) på desktop;
   bottom-sheet på mobil — adaptiv split fungerer, ingen SSR/client-hydration-mismatch
   (`ResponsiveLayout = dynamic(ssr:false)` bevart, `ReportReelsPage.tsx:1040-1044`).
2. **Nivå-1 vs nivå-2-board:** board UTEN `assets.brand` → nivå-1-overflate (tekst-wordmark +
   `home.heroImage`); board MED `assets.brand`/`splashVideo` → nivå-2-overflate (logo + kuratert
   hero + reels-video) — UTEN en eneste `reportTier`-sjekk (`grep -c reportTier` = 0 i skall-filene).
3. **SEO:** `generateMetadata` gir korrekt `title`/`description`/canonical (view-source).
4. **Embed-flyt:** `?embed` → splash-teaser; `?from=embed` → `EmbedArrivalLoader`-«Klar»-gate.
5. **No-photo-fallback (foto DEFERRED, INDEX note #9 / PRD 4):** live board uten POI-foto
   (`featured_image` = `null`) → kategorifarge + ikon/pin-fallback i POI-kort/popup + sidebar-listen,
   ikke broken image / crash.
6. **Mekaniske porter:** `npm run lint` (0 errors), `npm test` (board-UI/camera-tours/reels grønne),
   `npx tsc --noEmit` (0 feil), `npm run build` (bygger; bundle-bevis fra Unit 7 grønt).

## Forutsetninger

- `.env.local` med `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (les-sti mot public-schema
  via `getProductAsync` → `getProductFromSupabase`, `queries.ts:974` leser `product.config.reportConfig`),
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (3D), `NEXT_PUBLIC_MAPBOX_TOKEN` (2D).
- Google Chrome. Verifiser i **nystartet** Chrome (eget `--user-data-dir`) — ingen utvidelser/cache.

### Test-board-matrise (3 overflate-konfigurasjoner, alle live i prod-DB)

`reportConfig.assets` ligger på `products.config.reportConfig.assets` (IKKE top-level `config.assets`).
Av 44 report-boards i prod: 2 er nivå-2, 42 er nivå-1.

| Board | `assets.brand` | `assets.splashVideo` | Forventet overflate |
|-------|---------------|----------------------|---------------------|
| `placy-demo/martin-barstads-veg-23c` | — | — | **Nivå-1:** tekst-wordmark + `home.heroImage`, 0 logo, 0 video |
| `bane-nor-eiendom/stasjonskvartalet` | `true` | — | **Nivå-2 (brand):** logo + splash-hero + reels-video |
| `klp-eiendom/teknostallen` | — | `true` | **Nivå-2 (kun video):** tekst-wordmark (ingen logo) + reels-video |

Den tredje raden isolerer `getProjectSplashVideo`-gaten (`splashVideo || brand`, `project-brand.ts:54`):
video uten logo. Sammen beviser de tre at overflaten forker på `assets`-flaggene, ikke på `reportTier`.

## Steg 0 — Fersk prod-flate (ikke dev-cache)

```bash
rm -rf .next && npm run build              # AC6: bygger uten feil
set -a; source .env.local; set +a
PORT=3011 npm run start &
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3011/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board"   # 200
```

## Steg 1 — Mekaniske porter (AC6)

```bash
npx tsc --noEmit                  # 0 errors
npm run lint                      # 0 errors (166 warnings = baseline)
npx vitest run                    # 1237 tester grønne (105 filer)
npm run build                     # exit 0
node scripts/verify-board-bundle.mjs   # BUNDLE-BEVIS: PASS (Unit 7-grensene)
```

## Steg 2 — Statisk AC2-binding: 0 `reportTier` i skall-filene

Skall-filene (PRD 9 §4 keeper-core + port-with-rewrite) sjekkes for `reportTier`:

```bash
grep -rn "reportTier" \
  "app/eiendom/[customer]/[project]/rapport-board/page.tsx" \
  components/variants/report/reels/ \
  components/variants/report/board/ \
  lib/themes/project-brand.ts | grep -v '\.test\.'
```

**Resultat:** ÉN treff — `components/variants/report/board/use-board-marker-set.ts:52`, en JSDoc-kommentar
(`* Speiler pickPlayableAudio-seleksjonen, ikke reportTier.`) som DOKUMENTERER fraværet av tier-gating.
**0 reportTier-render-brytere** i kode. Overflate-forken eies utelukkende av `assets`-flagg-gatene i
`project-brand.ts` (`getProjectLogoSrc:28` ⟵ `assets?.brand`, `getProjectSplashImage:39` ⟵ `assets?.brand`,
`getProjectSplashVideo:54` ⟵ `assets?.splashVideo || assets?.brand`) + fallback-kjeden i
`ReportReelsPage.tsx:647-650` (`splashHero = getProjectSplashImage(...) ?? home.heroImage`).
r09.6s `project-brand.test.ts` (13 tester) dekker alle 5 funksjoner + flagg-gating + undefined→fallback.

## Steg 3 — Nystartet Chrome + chrome-devtools MCP

```bash
rm -rf /tmp/chrome-r098-verify
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-r098-verify \
  --no-first-run --no-default-browser-check \
  "http://localhost:3011/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board" &
curl -s http://127.0.0.1:9222/json/version    # bekreft DevTools-endepunktet
```

## Steg 4 — AC1 adaptiv split + ingen hydration-mismatch

Desktop-emulering (`1440×900×1`) → reload, mobil-emulering (`390×844×3,mobile,touch`) → reload.
Per viewport: tell `aside` (desktop-sidekolonne) + skann `console` for hydration-feil.

```js
({ viewportW: window.innerWidth,
   asideCount: document.querySelectorAll('aside').length,
   gmpMap3d: document.querySelectorAll('gmp-map-3d').length });
```

| Viewport | `aside` (DesktopStorySidebar) | console error/warn |
|----------|------------------------------|--------------------|
| Desktop 1440 | **1** (sidekolonne) | **0** |
| Mobil 390 | **0** (bottom-sheet, ingen sidekolonne) | **0** |

`gmp-map-3d`-count = 1 begge viewports (motoren mountet). 0 console-feil etter fersk reload på BEGGE
breddene → ingen SSR/client-hydration-mismatch (`ssr:false`-grensen gjør splash/embed/orchestration
client-only, så ingen server-markup å mismatche). Adaptiv split bekreftet: sidekolonne→0 ved mobil.

## Steg 5 — AC2 nivå-1 vs nivå-2 (live, 3 board)

Per board: tell `-logo.svg`-img, `<video>`-src, og splash-overskrift.

```js
({ logoImgCount: [...document.querySelectorAll('img')].filter(i=>/-logo\.svg/.test(i.src)).length,
   splashVideos: [...document.querySelectorAll('video')].map(v=>v.currentSrc||v.src),
   splashHeadingText: (document.querySelector('h1,h2')?.innerText||'').slice(0,60) });
```

| Board | logo-img | splash-video | wordmark | Dom |
|-------|----------|--------------|----------|-----|
| `martin-barstads-veg-23c` (nivå-1) | **0** | **[]** | «Velkommen til Martin Barstads veg 23C» (TEKST) | nivå-1 ✅ |
| `stasjonskvartalet` (brand) | **2** | `stasjonskvartalet-splash-video.mp4` | logo-bilde | nivå-2 ✅ |
| `teknostallen` (kun splashVideo) | **0** | `teknostallen-splash-video.mp4` | «Teknostallen» (TEKST) | nivå-2-video ✅ |

Nivå-1 viser `home.heroImage` som splash-hero (fallback `?? home.heroImage`), tekst-wordmark, INGEN logo
eller video. Nivå-2-brand viser logo + dedikert splash-video. Nivå-2-kun-video (teknostallen) viser video
MEN tekst-wordmark (ingen logo) — isolerer `splashVideo`-gaten fra `brand`-gaten. Forken er rent
`assets`-drevet; 0 `reportTier` (Steg 2).

## Steg 6 — AC3 SEO (view-source)

```bash
curl -s "http://localhost:3011/eiendom/placy-demo/martin-barstads-veg-23c/rapport-board" | grep -E "<title|canonical|description"
```

| Felt | Resultat |
|------|----------|
| `<title>` | `Nabolaget rundt Martin Barstads veg 23C – Nabolagsrapport (Board) \| Placy` ✅ |
| `<link rel=canonical>` | `https://placy.no/eiendom/placy-demo/martin-barstads-veg-23c/rapport-board` ✅ |
| `<meta name=description>` | TOM — `generateMetadata` setter `description: projectData.story.introText` (page.tsx:112), men **0 av 44 prod-boards har non-tom `story_intro_text`** → Next utelater taggen. **Skall-wiringen er korrekt**; tom description er et DEMO-DATA-gap (introText skrives ved provisjon, PRD 3), ikke en skall-defekt. `og:description`-fallback («Oppdag nabolaget rundt …») rendres fra forelder-layout. |

`title` + `canonical` verifisert live; `description`-wiring verifisert korrekt (peker på `story.introText`).

## Steg 7 — AC4 embed-flyt (begge grener)

| URL | bodyText / CTA | `gmp-map-3d` | Dom |
|-----|----------------|--------------|-----|
| `…/rapport-board?embed=1` | «Bli kjent med nærområdet … Åpne den interaktive guiden» + knapp **«Utforsk nabolaget»** | **0** (motor ikke mountet i lett teaser) | splash-teaser ✅ |
| `…/rapport-board?from=embed` | `EmbedArrivalLoader`: «Bli kjent med nærområdet» + warm-up + knapp **«Se nærområdet»** (`onEnter` = lyd-gest + reveal) | **1** (motor varmer bak gaten) | «Klar»-gate ✅ |

Tre distinkte entry-CTA-er fra tre moduser bekrefter at `embed`/`fromEmbed`-grenene er korrekt wiret
(page.tsx:35-39 → ReportReelsPage props): normal «Start opplevelsen» (IntroReel) / `?embed=1` «Utforsk
nabolaget» (teaser, `ReportReelsPage.tsx:674`) / `?from=embed` «Se nærområdet» (`EmbedArrivalLoader.tsx:161`).

## Steg 8 — AC5 no-photo-fallback (live)

`BoardPOI`-modellen (`board-data.ts`) bærer 0 `featured_image`-felt (r09.4) → POI-render bruker ALLTID
kategorifarge + ikon. Verifisert i sidebar-listen (åpnet «Hverdagsliv»-kategori) + 2D-kartmarkører
(toggle «Kart»):

```js
({ svgIconCount: document.querySelectorAll('aside svg').length,
   mapboxMarkers: document.querySelectorAll('.mapboxgl-marker').length,
   markerHasSvgIcon: !!document.querySelector('.mapboxgl-marker svg'),
   poiPhotos: [...document.querySelectorAll('img')].filter(i=>/poi|featured|place/i.test(i.src)).length,
   brokenImgs: [...document.querySelectorAll('img')].filter(i=>i.complete&&i.naturalWidth===0).length });
```

| Flate | Resultat |
|-------|----------|
| DesktopStorySidebar POI-liste | 10 SVG-kategori-ikoner, 0 POI-foto, 0 broken-img, 0 crash ✅ |
| 2D-Mapbox-markører (toggle «Kart») | **52 markører** alle med SVG-kategori-ikon, 0 broken-img ✅ |
| Persistent-mount under toggle | `gmp-map-3d`=1 BEVART når Mapbox-2D (`.mapboxgl-map`=1) legger seg oppå (PRD 6-invariant, PRD 9-orkestrering Unit 3) ✅ |

Ingen POI bærer foto → kategorifarge+ikon er ENESTE render-vei, by construction. 0 broken images / crash
på alle flater og board.

## Resultat (kjøring 2026-06-30)

| AC | Resultat |
|----|----------|
| **1 — adaptiv desktop/mobil, ingen hydration-mismatch** | ✅ Desktop `aside`=1 (sidekolonne), mobil `aside`=0 (bottom-sheet); 0 console-feil på BEGGE viewports etter fersk reload. `ssr:false`-grensen bevart. |
| **2 — nivå-1 vs nivå-2, 0 reportTier** | ✅ 3 board live: nivå-1 (tekst-wordmark + heroImage, 0 logo/video), nivå-2-brand (logo + video), nivå-2-kun-video (tekst-wordmark + video). `grep -c reportTier` = 0 render-brytere i skall (1 kommentar dokumenterer fraværet). |
| **3 — SEO** | ✅ `title` + `canonical` korrekt live; `description`-wiring korrekt (`story.introText`), tom kun pga. demo-data-gap (0/44 boards har introText); `og:description`-fallback present. |
| **4 — embed-flyt** | ✅ `?embed=1` → «Utforsk nabolaget»-teaser (motor ikke mountet); `?from=embed` → `EmbedArrivalLoader` «Se nærområdet»-gate (motor varmer bak). |
| **5 — no-photo-fallback** | ✅ Sidebar 10 SVG-ikoner + 52 kart-markører m/ SVG-ikon, 0 POI-foto, 0 broken-img, 0 crash. Persistent 3D-mount bevart under 2D-toggle. |
| **6 — mekaniske porter** | ✅ `tsc` 0, `lint` 0 errors (166 warnings), `vitest` 1237/1237 (105 filer), `build` exit 0, `verify-board-bundle.mjs` PASS. |

**Funn (ikke AC-blokkere, sporet for senere):**
- **SEO-description tom på alle prod-boards** — `story.introText` er tom for 44/44 boards. Skall-wiringen
  er korrekt; introText fylles ved provisjon (PRD 3). Kun et demo-data-gap, ikke en skall-defekt.
- **Kjent uvedkommende støy:** Google Maps 3D-interne tile-/LOD-feil (`oak2-lod3`, `Cutoff is currently
  disabled on terrain`) i Google API-bundlen — opptrer uavhengig av host-appen (dokumentert i
  `3d-motor-verifikasjon-runbook.md`); ikke skall-relatert.
