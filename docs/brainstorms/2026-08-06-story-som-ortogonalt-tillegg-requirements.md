---
date: 2026-08-06
topic: story-som-ortogonalt-tillegg
---

# Story som ortogonalt tillegg — nabolagsflaten blir mobil-standard, storyen blir opt-in

## Ordbruk

Dette dokumentet unngår **«nivå 1 / nivå 2»** om story-funksjonaliteten. De ordene
betyr *editorial tier* i Placy (`reportConfig.reportTier`), og `lib/types.ts:450-452`
slår eksplisitt fast at VO er en **ortogonal akse som ikke gater på tier**:

> «Ortogonale render-akser (3D, VO, camera-tours, brokers, brand) gates IKKE på
> feltet — de drives av egne flagg/data-presence.»

Å kalle storyen «nivå 2» ville derfor låst mersalget til boards med kuratert
editorial. Det er motsatt av hensikten: storyen skal kunne selges på et
`reportTier: 1`-board i grunnpakka.

| Ord | Betyr |
|---|---|
| **nabolagsflaten** | Mobil-flaten som alltid finnes: dragbar sheet med kategoriliste over ett montert kart, pluss kategorisiden som pushes over den. Dagens `NeighbourhoodSurface`. |
| **storyen** | Hele det opt-in narrative tillegget som produkt. |
| **story-flaten** | Den fullskjerms modalen storyen rendres i. |
| **samlespilleren** | Avspilleren som kjører hele kortsekvensen fra `buildReelsCards()` i rekkefølge. Eneste spiller i denne leveransen. |
| **kort** | Ett trinn i sekvensen (`ReelsCard`): intro, welcome, home, kategori, outro, summary, megler. |
| **tillegget** | `storyAutoplay` + VO-tilstedeværelse som ortogonal akse, på linje med `has3dAddon`. Aldri «nivå 2». |

## Problem Frame

Rapport-boardets mobilflate er i dag **forket av VO-tilstedeværelse**, ikke av
produktnivå. I `components/variants/report/reels/ReportReelsPage.tsx:825-833`:

```
hasAudioMobile       = firstIdx !== -1
mapIsSurface         = state.mapOpen || !hasAudioMobile
neighbourhoodSurface = !hasAudioMobile && boardRevealed
```

Har boardet spillbar VO, monteres story-flaten (`ReelSwipeStack`) og
nabolagsflaten finnes ikke. Mangler VO, monteres nabolagsflaten og storyen
finnes ikke. Det gir **to parallelle mobilflater** som må vedlikeholdes hver for
seg, og binder produktpakking til en teknisk datategenskap.

To konsekvenser, begge blokkere:

**Salg.** Storyen kan ikke selges som mersalg når den *erstatter* nabolagsflaten
i stedet for å legge seg på den. En utbygger som kjøper story får et annet
produkt, ikke et rikere. Og den kan ikke selges på et grunnpakke-board i det hele
tatt.

**UX.** Story-flaten viser i dag fortelling og oppslagsverk samtidig. I
`ReportReelsPage.tsx:936-960` ligger et peek-slør med «Se N punkter»-CTA
(`PEEK_MINIMIZED_VISIBLE = "125px"`) oppå story-slidet — det okkluderer
karaoke-teksten og gir fem konkurrerende elementer i én viewport. Flaten er ikke
for avansert i delene sine; den er **umodal**.

Endringen: nabolagsflaten blir mobil-standard for alle boards, og storyen blir en
fullskjerms modal med én inngang.

## To moduser, én dør

```
              NABOLAGSFLATEN — alltid montert, alle boards
        ┌────────────────────────────────────────┐
        │  kart (persistent gmp-map-3d)          │
        │  ─────────────────────────────────     │
        │  ┌──────────────────────────────────┐  │
        │  │ Nabolaget   [▶ Omvisning · 2 min]│  │ ← tilleggets eneste
        │  │ ── Barn & Oppvekst          →    │  │   bidrag til UI
        │  │ ── Transport                →    │  │
        │  └──────────────────────────────────┘  │
        └────────────────────────────────────────┘
              │                          │
     kategori │                          │ [▶] / storyAutoplay / ?play=1
              ▼                          ▼
     ┌─────────────────┐        ┌─────────────────────┐
     │  Kategorisiden  │        │  STORY-FLATEN       │
     │  kart + tekst   │        │  ●●●○○○○         ✕  │
     │  + highlights   │        │  bilde/video        │
     │                 │        │  karaoke-tekst   🔊 │
     │  ← tilbake      │        │  hold = pause       │
     └─────────────────┘        │  slutt: Se stedene  │
              │                 └─────────────────────┘
              │                          │
              └──────────┬───────────────┘
                         ▼
              tilbake til nabolagsflaten
```

Nabolagsflaten er alltid montert *under* story-flaten. `storyAutoplay` og
`?play=1` mater **samme switch** — de bestemmer bare om døra åpner seg selv.
Ingen board har et eget spor.

## Requirements

**Flate og modus-separasjon**

- R1. Nabolagsflaten (`NeighbourhoodSurface`) monteres som den underliggende
  mobilflaten på alle rapport-boards, uten betingelse på VO-tilstedeværelse.
  Story-flaten er et *overlegg* som kan åpnes over den — den erstatter aldri
  monteringen. Gatingen på `!hasAudioMobile` fjernes, og `mapIsSurface` kollapser.
- R2. Storyen har én inngang: en spill-av-affordans i den etterfølgende kanten
  (trailing) av sheetens header, synlig kun når spillbar VO finnes. Den bærer
  ikon **og** tekst med varighet — «Omvisning · 2 min», ikke et umerket ikon.
  Affordansen må ikke forstyrre `onSurfaceHeightChange`-målingen som driver
  kartets bottom-padding og utsnitts-rektangelet.
- R3. Mangler boardet spillbar VO, vises ingen spill-av-affordans, og
  nabolagsflaten er observerbart identisk med `feat/mobil-nabolagsflate` slik
  den står ved commit `916a601` — layout, gester, liste-scoping og kamera-ramme.
- R4. Etter endringen finnes én mobil-kodesti for flatevalg. Ingen board beholder
  en alternativ flate-implementasjon.
- R28. Ankomsten må ikke by fram to nye ting å oppdage samtidig. Nabolagsflatens
  eksisterende engangs-hint (`neighbourhood-hint`, «Dra i kartet …») og
  spill-av-affordansen skal være visuelt og romlig atskilte, og avgjørelsen om
  hvilken som eier oppmerksomheten ved ankomst tas eksplisitt — ikke som en
  bieffekt av hvor knappen havner.

**Story-flaten**

- R5. Under avspilling vises: bilde eller video, kategorilabel, karaoke-tekst,
  progresjonsindikator, og **nøyaktig to knapper** — lukk (✕) og lyd av/på (🔊).
  «Knapp» betyr synlig kontroll-chrome. Tappesoner og hold-gester (R8) er
  gestur-modaliteter på medieflaten selv og teller ikke mot dette budsjettet.
- R6. Peek-sløret og «Se N punkter»-CTA-en fjernes. Kartet er ikke synlig i
  story-modus.
- R7. Karaoke-teksten beholdes. Den er undertekst-laget som gjør VO-en brukbar
  når brukeren slår av lyden.
- R18. Ingen fast chrome (karaoke-tekst, ✕, 🔊, progresjonsindikator) kan
  okkluderes av noe annet element, og alle må holde lesbar kontrast over lyst
  som mørkt medieinnhold. ✕ og 🔊 har minimum 44×44 pt treffflate.
- R8. Avansering skjer automatisk ved spor-slutt. I tillegg: tapp på høyre
  skjermhalvdel går fremover, tapp på venstre går tilbake, og **langt trykk
  pauser** så lenge det holdes.
- R19. Lyd starter **på** ved story-start. Spill-av-tappet er brukergesten som
  låser opp lyd på iOS (`UNLOCK_AUDIO`), så lyd på er både mulig og påkrevd.
  Muted-som-trygg-default ville tømt storyen for sitt eget innhold.
- R20. Story-flaten har en definert ventetilstand mens første medie- og
  lydspor bufrer, slik at tappet aldri leses som at knappen ikke virket.
- R21. Story-flaten har en definert feiltilstand når et spor ikke kan lastes.
  `phase === "error"` og `resume()` finnes alt i splash-flyten
  (`ReportReelsPage.tsx:637`) og skal gjenbrukes, ikke omgås med stille hopp.
- R9. «Se stedene» vises **én gang, når hele sekvensen er ferdig** — ikke ved
  hvert kategori-kort. En utgangsrampe sju ganger gjennom fortellingen ville
  gjeninnført nettopp den midt-i-story-affordansen R6 fjerner.
- R22. Sekvensens sluttilstand er definert og terminal: ingen loop, ingen stille
  auto-retur. Siste kort etterfølges av en eksplisitt ferdig-tilstand med
  «Se stedene» (R9) som primærvei tilbake til nabolagsflaten.

**Ankomst og lenker**

- R11. `storyAutoplay` innføres som ortogonalt flagg på linje med `has3dAddon`.
  Default `false`.
- R12. `?play=1` legges til flagg-kontrakten i
  `components/variants/report/board/board-url-flags.ts` og mater samme switch
  som `storyAutoplay`.
- R13. Både lukk, feiltilstand og sekvens-slutt lander på nabolagsflaten. Ingen
  vei ut av storyen ender på fullskjerm kart.

**Vern av levende kundelenke**

- R14. `stasjonskvartalet` settes `storyAutoplay: true`. Story-flaten åpnes
  automatisk ved splash-fade, slik at den *synlige* ankomsten er uendret fra i
  dag. Nabolagsflaten er montert under hele tiden (R1).
- R15. De to endringene StasjonsKvartalet får er begge forbedringer og skal
  verifiseres som sådan: kartkortet som okkluderer teksten er borte (R6), og
  utgangen lander på nabolagslista i stedet for fullskjerm kart (R13).
- R16. Ingen merge til `main` før R14/R15 er verifisert på fysisk iPhone i
  Chrome, inkognito, én fane.
- R23. `welcome`-, `home`- og `outro`-kortene må ha en visuell bakgrunn som ikke
  er kartet. `defaultMapOpenForCard()` (`reels-state.tsx:58-61`) returnerer i dag
  `true` for nettopp disse tre, så kartet *er* deres primærflate. R6 fjerner den.
  Faller de tilbake på `illustrationSrc`, må resultatet være verifisert på begge
  testboards — `welcomeVideoSrc`/`homeVideoSrc` finnes bare for medlemmer av
  `REELS_MONTAGE_PROJECTS`, som i praksis er `stasjonskvartalet` alene.

**Ytelse på enhet**

- R10. Story-flaten skal ikke krasje eller utløse reload på fysisk iPhone med
  det persistente `gmp-map-3d`-elementet montert under seg. Elementet kan ikke
  unmountes (WebGL-context-lekk, `BoardMap.tsx`). **`?film=1` er avkreftet som
  mekanisme**: `filmMode` konsumeres kun av `use-board-marker-set.ts:146`
  (returnerer tom markørliste) og `BoardMap3D.tsx:232,256` (reveal-kaskaden) —
  det er markørsynlighet, ikke rendering. Finnes ingen render-stopp-mekanisme,
  er kravet å **måle** taket og dokumentere resultatet, ikke å anta at det holder.

**Innholdskrav**

- R17. Tillegget stiller ingen krav til media fra kunden. Utbyggerens video og
  grafikk er en override-akse over genererte stills, ikke en forutsetning for at
  storyen kan leveres.

**Tilgjengelighet**

- R24. `prefers-reduced-motion` respekteres: auto-advance, medieoverganger og
  karaoke-animasjon dempes eller stanses for brukere som ber om det.
- R25. Karaoke-teksten er ekte DOM-tekst eksponert for skjermleser, ikke et
  dekorativt lag.
- R26. Langt trykk (R8) er pause-mekanismen som oppfyller WCAG 2.2.2
  (Pause/Stop/Hide) for auto-advancing innhold. Uten den er kravet brutt.

## Success Criteria

- **`byggetrinn-4` på fysisk iPhone** (7 kuraterte temaer + 7 VO-spor — antatt
  det eneste boardet med begge lag fylt, se Dependencies): nabolagslista møter
  brukeren etter splash, spill-av-affordansen er synlig med varighet, storyen
  spiller **med lyd** etter ett tapp, karaoke-teksten er uklippet gjennom hele
  segmentet, kartkortet finnes ikke, langt trykk pauser, og
  `welcome`/`home`/`outro` har en bakgrunn som ikke er kartet.
- **`stasjonskvartalet` på fysisk iPhone**: story-flaten åpner av seg selv som i
  dag, spiller gjennom uten krasj eller reload, og lukk lander på nabolagslista.
- **`ferjemannsveien-10` og `cutover-pilot`** (ingen VO): ingen
  spill-av-affordans, flaten identisk med `916a601`.
- **Kodestruktur (R4):** `ReportReelsPage.tsx` inneholder ingen forgrening på
  `hasAudioMobile` for valg av mobilflate. Nabolagsflaten og story-flaten
  sameksisterer på én sti, ikke som betinget montering.
- Ingen `unmount` av `gmp-map-3d` ved åpning eller lukking av story-flaten.
- `npm run lint` 0 errors, `npx tsc --noEmit` rent, `npm test` grønt,
  `npm run build` uten feil.

## Scope Boundaries

- **Desktop er urørt.** `ReportReelsPage.tsx:729` returnerer en separat render
  for `isDesktop` med `DesktopStorySidebar`, som allerede håndterer både kuratert
  og generert innhold. En sidekolonne ved siden av et kart er ikke modal
  overbelastning; mental-load-problemet er mobil-spesifikt.
- **Ingen nye medie-produksjoner.** Eksisterende assets på de to testboardene.
- **Ingen endring i provisjonerings-pipelinen** eller `lib/pipeline/`.
- **Ingen endring i audio-tour-generering.** `scripts/audio-tour-build.ts`
  forblir per prosjekt.
- **Wesselsløkkas kjente innholdshull** (manglende `opplevelser.editorial`, tomme
  `highlightPoiIds`, radius-drift i `barn-oppvekst.editorial.body`) hører ikke
  til her.

### Deferred to Separate Tasks

- **Kategorispiller** — samme spiller med kortlista filtrert på `categoryId`, med
  utgang til den kategoriens kategoriside i stedet for til nabolagslista.
  Forventet som neste runde rett etter denne; modellen finnes alt
  (`CategoryReelCard`, `buildCategoryTracks()` i `reels-data.ts`), så arbeidet er
  filtrering og én ekstra utgang.
- **Per-strøk VO-amortisering** — forutsetningen for at tillegget blir en SKU med
  lav marginalkostnad i stedet for en per-prosjekt-produksjon. Krever at
  audio-tour-pipelinen kan skrive og lese spor på strøk-nivå.
- **Instrumentering av fullføringsrate** — hvor langt brukere kommer i
  samlespilleren. `lib/instrumentation/log-event.ts` finnes; hendelsesnavn
  avgjøres når spilleren står.

## Key Decisions

- **Storyen er et ortogonalt tillegg, ikke «nivå 2»**: `lib/types.ts:450-452`
  fastslår at VO ikke gater på `reportTier`. Med tier-framingen ville mersalget
  vært låst til boards med kuratert editorial; som ortogonalt flagg kan storyen
  selges på et hvilket som helst grunnpakke-board. `BoardCategory.audio` er
  allerede optional, så å legge VO på et levende board er en additiv
  dataoperasjon uten reprovisjonering.
- **`storyAutoplay` som flagg, ikke et legacy-spor for StasjonsKvartalet**: én
  boolean bevarer kundedemoens ankomst uten at forken overlever i koden. Samme
  mekanisme dekker `?play=1` for SOME- og QR-trafikk.
- **Karaoke blir i story-flaten.** Vurdert flyttet til kategorisiden, men
  forkastet: karaoke *er* undertekstlaget, og er det som gjør VO-en brukbar for
  en bruker som slår av lyden. Det som skal ut er kartkortet, ikke tekst.
- **Langt trykk pauser, ikke tapp.** Tapp er navigasjon (R8). Å droppe pause helt
  ville brutt WCAG 2.2.2; å legge pause på tapp ville kollidert med navigasjonen.
  Langt trykk er Instagram-konvensjonen, koster null synlige elementer, og er
  mønsteret målgruppen alt har lært.
- **«Se stedene» én gang til slutt, ikke per kategori**: sju utgangsramper
  gjennom fortellingen ville gjeninnført midt-i-story-affordansen R6 fjerner.
- **Spill-av-affordansen bærer tekst og varighet.** Et umerket ikon er
  default-utfallet hvis avgjørelsen skyves til implementering, og det er det
  eneste stedet i denne leveransen som ellers ville blitt generisk.
- **`byggetrinn-4` er primært testbrett, ikke StasjonsKvartalet**: antatt det
  eneste boardet med både kuratert editorial og VO, altså det eneste stedet
  nabolagsflaten og storyen kan ses sammen. StasjonsKvartalet har VO men 0
  kuraterte temaer, og er eneste medlem av `REELS_MONTAGE_PROJECTS` — det er
  medie- og ytelsestaket, ikke innholds-testen.
- **Worktree brancher fra `feat/mobil-nabolagsflate`, ikke `main`**: hele
  `NeighbourhoodSurface` ligger på den branchen og er ikke merget.

## Dependencies / Assumptions

- **`feat/mobil-nabolagsflate` er avhengigheten.** Den bærer
  `components/variants/report/board/neighbourhood/` og står på `916a601`,
  `ahead 1` mot origin, ikke merget til `main`. Prosjektets
  `worktree.baseRef`-default er `fresh` (origin/main) og må overstyres:
  `git worktree add ../placy-story -b feat/story-opt-in feat/mobil-nabolagsflate`.
- **`mapOpen` er story-intern tilstandsmaskin, ikke bare «vises kartet».** Den
  skrives av `defaultMapOpenForCard()` per kort (`reels-state.tsx:73,119`), leses
  av `decideTrackEndedAction()` (`reels-data.ts:572`), styrer advance-timeren
  (`ReportReelsPage.tsx:415-419`), teaser-garden (`:474-485`), peek-geometrien
  (`:842-884`), og `ReelsTransport` (`:1026`). Å fjerne peek-CTA-en fjerner det
  eneste mobile kallet til `setMapOpen(true)` (`:942`) — R6 og R9 er derfor
  **samme refaktorering**, ikke to.
- **Lyd-unlocken finnes.** `UNLOCK_AUDIO` / `state.audioUnlocked`
  (`reels-state.tsx:38`). Spill-av-knappen arver en bygd mekanisme og løser
  samtidig iOS-kravet om brukergest før lyd med volum kan spille.
- **VO er per prosjekt i dag** — `scripts/audio-tour-build.ts` tar `<project_id>`
  og skriver til `public/audio/{projectSlug}/`. Ingenting her antar
  per-strøk-spor.
- **`stasjonskvartalet` er en levende lenke sendt til kunde.** Merge til `main`
  deployer til produksjon, så merge-porten i R16 er reell, ikke seremoni.
- **UVERIFISERT:** innholdstellingene per board (7 kuraterte + 7 VO på
  `byggetrinn-4`; VO + 0 kuraterte på `stasjonskvartalet`) er hentet fra
  `docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md`, ikke lest
  mot Supabase i denne økta. Bekreftes før testbrett-valget låses.

## Outstanding Questions

### Deferred to Planning

- [Affects R10][Needs research] Finnes det i det hele tatt en måte å stanse eller
  strupe `gmp-map-3d`-rendering uten unmount? `filmMode` er avkreftet. Hvis svaret
  er nei, blir R10 en måling med dokumentert resultat i stedet for et tiltak.
- [Affects R1][Technical] Hele `mapOpen`-undermaskinen: hvor mye av
  `decideTrackEndedAction()`, `teaserArmed`, `CATEGORY_TEASER_MS` og
  `PEEK_MINIMIZED_VISIBLE` blir dødt på mobil når `setMapOpen(true)` mister sin
  eneste kaller? Skal det slettes eller beholdes for desktop?
- [Affects R11][Technical] Hvor hører `storyAutoplay` hjemme? `reportTier` ligger
  i `reportConfig` (`lib/types.ts:456`), `has3dAddon` på prosjektnivå (`:522`).
  Trengs migrasjon, eller er config JSONB?
- [Affects R5][Technical] Overlever `NowPlayingCard`, `ReelsMenu` og
  `ReelsTransport` i noen form på mobil, eller blir de desktop-/legacy-only?
- [Affects R2][Technical] Sheet-headerens faktiske plass: tåler den ikon + tekst
  + varighet ved siden av «Nabolaget» på de smaleste enhetene?
- [Affects R24][Technical] Hva betyr «dempet» auto-advance konkret under
  `prefers-reduced-motion` — lengre visningstid, ingen medieovergang, eller
  manuell avansering?
- [Affects R7/R8][Needs research] Er karaoke-tempoet garantert ≤ sporlengden for
  alle segmenter? Ved kort video og lang tekst kan en stille leser miste tekst før
  auto-advance fyrer.

## Next Steps

-> `/ce-plan` for structured implementation planning
