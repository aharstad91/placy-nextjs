# Brainstorm: Inline POI-kortsystem i Story

**Dato:** 2026-04-08
**Status:** Ferdig brainstormet, klar for plan

---

## Hva vi bygger

Et **kortsystem med 5 varianter** for inline POI-dialoger i Story-visningen. Kortene er nøkkelen til at brukerne får innsikt om nabolaget mens de leser den redaksjonelle teksten. Klikkbare stedsnavn i prosa åpner modale dialoger med kontekstuelt innhold tilpasset POI-typen.

### Kortvarianter

| # | Variant | Innhold | Datakilde |
|---|---------|---------|-----------|
| 1 | **Standard POI** | Rating, editorial hook, local insight, gangtid | Eksisterende POI-data |
| 2 | **Kollektivtransport** | Sanntidsavganger, linjenummer, destinasjon, transportmodus | Entur API (eksisterer) |
| 3 | **Bysykkel** | Ledige sykler, ledige låser, stasjonsstatus | GBFS API (eksisterer) |
| 4 | **Bildeling (Hyre)** | Tilgjengelige biler, stasjonsnavn | Entur Mobility API (import-script eksisterer, trenger runtime-endepunkt) |
| 5 | **Skole/barnehage** | Trinn (barneskole/ungdomsskole/vgs), type (offentlig/privat) | POI-metadata (trenger felt på datamodell) |

---

## Hvorfor denne tilnærmingen

**Felles ramme + variabelt innhold:** Alle kort deler samme header (kategori-ikon, navn, underkategori, lukk-knapp). Under headeren er innholdet spesialisert per variant. Dette gir:
- Visuell konsistens — brukeren gjenkjenner kortformatet uansett type
- Enkel utvidelse — nye varianter er bare en ny innholdsseksjon
- Teknisk renhet — én dialog-shell, variant-innhold via komposisjon

**Modal dialog (ikke inline fold-ut):** Kortene popper opp over teksten. Brukeren lukker og fortsetter å lese. Passer editorial leseflyt bedre enn inline-ekspansjon som skyver tekst.

**Lazy datahenting for transport:** Sanntidsdata hentes først når brukeren klikker på et transport-POI. Unngår unødvendige API-kall for POI-er som aldri klikkes. Brukeren ser en kort loading-state (0.5–1s).

---

## Nøkkelbeslutninger

1. **Modal dialog** — beholder nåværende mønster, ingen inline fold-ut
2. **Felles ramme** — header delt, innhold varierer per korttype
3. **Lazy datahenting** — transport-data hentes ved dialog-åpning, ikke pre-fetch
4. **Skoler: trinn + type** — enkel metadata nå, kvalitetsdata (NSF/Skoleporten) senere
5. **Alt i én omgang** — hele kortsystemet bygges som én feature
6. **Automatisk variant-valg** — systemet velger korttype basert på POI-data (har `enturStopplaceId`? → kollektiv-kort)

---

## Eksisterende infrastruktur

Mye er allerede på plass:

| Komponent | Status | Sti |
|-----------|--------|-----|
| POI-dialog shell | Eksisterer | `components/variants/story/StoryPOIDialog.tsx` |
| Tekst-linker | Eksisterer | `components/variants/story/story-text-linker.ts` |
| Entur API | Eksisterer | `app/api/entur/route.ts` |
| Bysykkel API | Eksisterer | `app/api/bysykkel/route.ts` |
| useRealtimeData hook | Eksisterer | `lib/hooks/useRealtimeData.ts` |
| Transport-IDer på POI | Eksisterer | `enturStopplaceId`, `bysykkelStationId`, `hyreStationId` i `lib/types.ts` |
| Hyre import-script | Eksisterer | `scripts/import-hyre-stations.ts` |
| Hyre runtime API | **Mangler** | Trenger ny `/api/hyre/route.ts` |
| Skole-metadata | **Mangler** | Trenger nye felt på POI-type (`schoolLevel`, `schoolType`) |

---

## Variant-innhold (skisser)

### 1. Standard POI (eksisterer, refaktoreres inn i nytt system)
```
[Ikon] Valentinlyst Senter          [X]
       Kjøpesenter
──────────────────────────────────────
★ 4.0 (754)           🚶 5 min gange

Et av Norges første kjøpesentre fra 1975 —
9 000 kvadratmeter med alt fra apotek til
vinmonopol, frisør til kiropraktor.

Senteret samler hverdagsbehov på ett sted —
det gjør uken litt mer sammenhengende.
```

### 2. Kollektivtransport (Entur)
```
[Buss] Brøset                       [X]
       Bussholdeplass
──────────────────────────────────────
🚶 3 min gange

Neste avganger:
  🟢 3  Hallset         2 min
  🟢 3  Lohove          8 min
  🔵 46 Moholt          12 min
  🟢 3  Hallset         17 min

Oppdatert: akkurat nå
```

### 3. Bysykkel
```
[Sykkel] Brøset bysykkel            [X]
         Bysykkelstasjon
──────────────────────────────────────
🚶 2 min gange

🚲 7 ledige sykler
🔒 4 ledige låser

Oppdatert: akkurat nå
```

### 4. Bildeling (Hyre)
```
[Bil] Brøset Hyre                   [X]
      Bildeling
──────────────────────────────────────
🚶 4 min gange

🚗 3 tilgjengelige biler

Oppdatert: akkurat nå
```

### 5. Skole/barnehage
```
[Skole] Eberg skole                  [X]
        Barneskole · Offentlig
──────────────────────────────────────
★ 4.2 (12)            🚶 8 min gange

1.–7. trinn

En moderne barneskole med fokus på
uteskole og nærhet til Estenstadmarka.

Skolen har et aktivt nærmiljø med
engasjerte foreldre og kort vei til skog.
```

---

## Åpne spørsmål

1. **Variant-deteksjon:** Hvordan bestemmer vi korttype? Forslag: sjekk `enturStopplaceId` → kollektiv, `bysykkelStationId` → bysykkel, `hyreStationId` → Hyre, kategori `school`/`kindergarten` → skole, ellers → standard. Prioritering ved overlap?
2. **Polling i dialog:** Skal sanntidsdata oppdateres mens dialogen er åpen? `useRealtimeData` poller allerede hvert 60. sekund — kan gjenbrukes.
3. **Feilhåndtering transport:** Hva viser vi hvis Entur/GBFS er nede? Forslag: fallback til standard POI-kort med en "Sanntidsdata utilgjengelig"-melding.
4. **Hyre API:** Import-scriptet bruker Entur Mobility GraphQL. Lage et eget `/api/hyre/route.ts` eller utvide `/api/entur/`?

---

## Neste steg

Kjør `/workflows:plan` for implementeringsplan.
