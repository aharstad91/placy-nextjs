# Mobil rapport-board → desktop-paritet

**Dato:** 2026-06-07
**Status:** Levert (mobil-paritet for kjernen) + identifiserte iterate-senere-punkter
**Rute:** `/eiendom/[customer]/[project]/rapport-board`
**Orkestrator:** `components/variants/report/reels/ReportReelsPage.tsx`
**Verifisert på:** Stasjonskvartalet (`bane-nor-eiendom/stasjonskvartalet`), summary-kort på wesselslokka (`broset-utvikling-as/wesselslokka`)

---

## Mål

Mobil-MVP-en av rapport-board hadde ikke fått desktop-forbedringene. Alt på desktop skal kunne nås på mobil — på en mobil-native måte. Bruker spesifiserte 6 punkter: 3D-kart, intro/velkommen-beats med flythrough, splash, auto/fri/kart/3d-kontroller, dynamisk kart-sheet, summary på slutten.

## Arkitektur-beslutning

**Model A — reels fullskjerm + kart-sheet** (valgt av bruker over Model B "kart som base + reel-sheet").

- `ReelsStack` (fullskjerm TikTok-feed, z-10) er fortsatt basen.
- `MapLayer` (bunn-sheet, z-15) inneholder nå det ekte **3D `BoardMap`** i stedet for legacy 2D `ReelsMap`.
- Sheet-høyden er **beat-drevet**: kart-fremtunge beats (welcome/home/outro) fyller skjermen (flythrough/oversikt = helten, jf. brukerens prioritet), kategori-beats bruker peek 10% → snap-1 40% → full 100%.
- Data/state-kontrakten er delt med desktop (`board-data`, `reels-data`, `BoardReelsSync`, `useReelsAudioOrchestration`) — dette var en layout-rebuild, ikke en data-rebuild.

## Levert

| Tema | Hva | Nøkkelfiler |
|------|-----|-------------|
| 3D-kart på mobil | `MapLayer` rendrer `<BoardMap has3dAddon compactControls>`; `ReelsMap` slettet | `ReportReelsPage.tsx`, `BoardMap.tsx` |
| Eager mount | `markMapMounted()` ved sidelast → tiles varmes opp bak splash | `ReportReelsPage.tsx` |
| Splash | Portrait `MobileReportSplash` (hero/logo/copy/chips/CTA/swipe) | `MobileReportSplash.tsx` (ny) |
| Flythrough-handoff | Auto-advance av welcome→home→første kategori; sheet kollapser til peek når reel overtar; `ReelsStack` scroll-follow på `activeIndex` | `ReportReelsPage.tsx`, `ReelsStack.tsx` |
| Dynamisk sheet | Beat-drevet høyde + snap-stige 10/40/100; "Fortsett →"-skip | `ReportReelsPage.tsx`, `CategoryReel.tsx` |
| Kompakte kontroller | `compact`-prop på `BoardMapControls` (44px touch, løftet) | `BoardMapControls.tsx`, `BoardMap.tsx` |
| Summary-finale | `SummaryReel` + `SummaryReelCard`-kind, gated på `boardData.summary` | `SummaryReel.tsx` (ny), `reels-data.ts`, `board-data.ts` |

Mekanisk: lint ✓, tsc ✓, build ✓ (rapport-board 463 kB), ingen console-errors. Desktop urørt (regresjonssjekket).

## Kjente punkter å iterere på senere

1. **"Klikk for å åpne kart"-prompt i 40%-snap** — vises i både peek og snap-1; bør sannsynligvis kun vises i peek (10%) der kartvinduet er for smalt til å lese. Gating: `showOpenPrompt` i `MapLayer`.
2. **Vestigialt intro-kort på mobil** — etter splash hopper vi til welcome (index 1+). Scroller man OPP i feeden, dukker det gamle `IntroReel`-video-kortet (index 0) opp. Vurder å droppe intro-kortet fra mobil-feeden post-unlock (desktop ekskluderer det allerede).
3. **Welcome-flythrough mangler tekst-caption** — kun audio-VO under flythrough; ingen karaoke over kartet. Vurder en tynn caption-stripe (gjenbruk `KaraokeTeleprompter`) over kart-fremtunge beats.
4. **Gestures ved peek** — Mapbox/Google-gestures er aktive selv i 10%-peek; kan konkurrere med feed-swipe. Vurder å gate map-gestures til ≥ snap-1.
5. **Summary-data finnes nesten ikke** — kun wesselslokka/Brøset har strukturert `reportConfig.summary` i Supabase (sjekket 24 report-produkter). For å gi flere prosjekter et rikt summary-kort: enten kuratere `summary` per prosjekt, eller utlede insights fra kategori-leads/POI-antall som fallback.

## Gjenstående arbeid (neste økt)

- Polering av punktene over basert på brukerens skjermbilder.
- Vurder paritet for desktop-detaljer som ennå ikke er adressert på mobil (POI-detalj-popup/`BoardPOI3DMiniPopup`-oppførsel ved tap i kart-sheet, sub-kategori-filter).
- Avgjør om summary-kortet også skal surfaces på desktop (i dag filtrert ut av thumbnail-raden; desktop-recap er outro-sporet).

## Resumpsjon — slik tester du

- Mobil: `http://localhost:3000/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board` i Chrome device-mode (~390px).
- Summary-kort: `http://localhost:3000/eiendom/broset-utvikling-as/wesselslokka/rapport-board` (swipe til slutten).
- **Ikke** kjør `npm run build` mens `next dev` kjører mot samme `.next` (bryter dev-serveren — drep dev, `rm -rf .next`, restart).

## Relatert prior art

- `docs/plans/2026-05-21-refactor-mobile-board-sheet-plan.md` — tidligere mobil-sheet-arbeid
- `docs/plans/2026-05-24-001-feat-rapport-reels-stasjonskvartalet-plan.md` — original mobil reels-feed
- `docs/plans/2026-06-02-001-feat-3d-board-per-category-camera-waypoints-plan.md` — 3D per-kategori kamera (gjenbrukt på mobil)
