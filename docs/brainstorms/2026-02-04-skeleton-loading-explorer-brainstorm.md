# Skeleton Loading for Explorer

**Dato:** 2026-02-04
**Status:** Besluttet
**Neste steg:** `/workflows:plan`

---

## Hva vi bygger

En "Full Skeleton Until Ready"-løsning for Explorer som eliminerer hakkete lasting ved å vise shimmer-skeletons for både POI-liste og kart til alle kritiske data (POI + travel times) er klare.

### Problemene vi løser

1. **POI-listen er tom/blank før data kommer** — Brukeren ser ingenting før serveren svarer
2. **Bilder popper inn etter tekst** — POI-kort vises først uten bilde
3. **Kartet er blankt/hvitt i starten** — Mapbox tar tid å laste tiles
4. **Rekkefølge hopper når reisetider kommer** — POI-kort re-sorteres plutselig

### Målplattformer

- Mobil (bottom sheet + kart)
- Desktop (sidebar + kart)

Begge like viktige.

---

## Hvorfor denne tilnærmingen

### Valgt: Full Skeleton Until Ready

Vis shimmer-skeletons for hele UI-et til *alle* kritiske data er klare, deretter fade-in til faktisk innhold som allerede er sortert.

**Fordeler:**
- Ingen re-sortering eller hopping — listen er ferdig sortert når den vises
- Profesjonell, polert opplevelse som større apper (Airbnb, Spotify)
- Brukeren vet umiddelbart at noe laster (ikke bare tom side)
- Shimmer-effekt føles aktivt og responsivt

**Trade-offs akseptert:**
- Brukeren må vente 1-3 sek før faktisk innhold vises
- Kartet kunne teknisk vært synlig tidligere, men vi holder det tilbake for konsistens

### Forkastede alternativer

1. **Progressive med animasjon** — Re-sortering er fortsatt synlig, selv med animasjon. Bryter med ønsket om "ingen hopping".

2. **Hybrid (kart progressivt, liste skeleton)** — Risiko for forvirring når kart viser markers før listen er klar. Inkonsistent opplevelse.

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Skeleton-stil | Shimmer/wave | Føles mer aktivt enn pulse, brukt av store apper |
| Når vise faktisk innhold | Når travel times er ferdig | Unngår re-sortering helt |
| Bilder i kort | Skeleton → fade-in | Individuelle placeholders per bilde |
| Kart-overlay | Skeleton med dimmet bakgrunn | Matcher resten av UI-et |
| Antall skeleton-kort | 4-6 stk | Fyller viewport uten å overdrive |

---

## Teknisk kontekst

### Eksisterende infrastruktur vi bygger på

- `travelTimesLoading` boolean finnes allerede i `useTravelTimes()` hook
- `animate-pulse` brukes allerede for travel time-tekst
- Custom CSS animasjoner i `globals.css` (fadeInSlide, slide-up)
- Tailwind CSS for all styling — ingen komponentbibliotek

### Nye komponenter som trengs

1. **`SkeletonPOICard`** — Matcher layout til `ExplorerPOICard`
2. **`SkeletonPOIList`** — Wrapper som rendrer 4-6 skeleton-kort
3. **`SkeletonMapOverlay`** — Overlay for kartet under lasting
4. **Shimmer CSS** — Ny keyframe-animasjon for wave-effekt

### Nøkkelfiler å endre

- `components/variants/explorer/ExplorerPage.tsx` — Orkestrerer skeleton vs faktisk innhold
- `components/variants/explorer/ExplorerPOIList.tsx` — Viser SkeletonPOIList når loading
- `components/variants/explorer/ExplorerPanel.tsx` — Mobil-variant av samme logikk
- `components/variants/explorer/ExplorerMap.tsx` — Legger til skeleton overlay
- `app/globals.css` — Shimmer keyframe-animasjon

---

## Åpne spørsmål

1. **Skal vi vise progress-indikator?** — F.eks. "Beregner reisetider..." under skeleton, eller bare shimmer?

2. **Hva om travel times feiler?** — Vise innhold usortert, eller feilmelding?

3. **Skal skeleton matche tema?** — Lys/mørk modus-støtte for skeleton-farger?

---

## Scope

### Inkludert

- Skeleton for POI-liste (mobil + desktop)
- Skeleton for individuelle POI-kort
- Skeleton overlay for kart
- Shimmer-animasjon (CSS)
- Fade-in transition når data er klar

### Ikke inkludert (kan vurderes senere)

- Skeleton for CollectionDrawer
- Skeleton for Report/Guide-produktene
- Progressiv bilde-lasting med blur-up
- Offline/cache-first strategier

---

## Suksesskriterier

- [ ] Ingen blank/tom tilstand synlig ved første lasting
- [ ] Ingen re-sortering av POI-kort etter initial render
- [ ] Shimmer-animasjon kjører smooth (60fps)
- [ ] Fade-in til faktisk innhold føles naturlig
- [ ] Fungerer likt på mobil og desktop
