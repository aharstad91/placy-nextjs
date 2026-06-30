# Transport — Reference-Only Klassifisering (PRD 11 Unit 6)

Dokumenterer hvilke transport-relaterte symboler som er **reference-only** i rebuild-boardet,
hvilke som er **live** (portert og montert), og hvorfor.

---

## 1. Live board-konsumenter (montert i PRD 9-skallet)

Disse symbolene er faktisk montert og live i rebuild-boardet:

| Symbol | Fil | Konsumenter | Status |
|--------|-----|-------------|--------|
| `useRealtimeData` | `lib/hooks/useRealtimeData.ts` | `BoardPOI3DMiniPopup:144-146`, `BoardPOIMiniPopup:91`, `DesktopStorySidebar:425` | **LIVE** |
| `POIRealtimeSection` | `components/variants/report/board/` | Montert via popup/sidebar (PRD 9) | **LIVE** |
| `/api/entur` | `app/api/entur/route.ts` | `useRealtimeData` → kaller proxyen | **LIVE** |
| `/api/bysykkel` | `app/api/bysykkel/route.ts` | `useRealtimeData` → kaller proxyen | **LIVE** |
| `/api/hyre` | `app/api/hyre/route.ts` | `useRealtimeData` → kaller proxyen | **LIVE** |
| `/api/mobility` | `app/api/mobility/route.ts` | `useRealtimeData` → kaller proxyen | **LIVE** |
| `/api/directions` | `app/api/directions/route.ts` | `use-route-data` → `BoardPathLayer`/`BoardPathMidpointMarker` | **LIVE** |

---

## 2. Reference-Only symboler (IKKE montert i rebuild-boardet)

### 2a. `useTravelTimes`
- **Fil:** `lib/hooks/useTravelTimes.ts`
- **Live konsumenter:** Kun `ExplorerPage.tsx` — Explorer-produktet er **ikke** del av rebuild-board-MVP
- **Audit:** `grep -rn useTravelTimes components/variants/report/board/` → 0 treff
- **Klassifisering:** Reference-only. Proxyen (`/api/travel-times`) beholdes; hooken porteres ikke til board
- **Build-time precompute:** PRD 3 har eget reisetid-precompute-steg; `/api/travel-times` er runtime-varianten for Explorer

### 2b. `useTransportDashboard`
- **Fil:** `lib/hooks/useTransportDashboard.ts`
- **Live konsumenter:** `ReportHeroInsight.tsx` + `ReportThemeSection.tsx` — begge er komponenter fra den **droppede scroll-rapporten** (gammel `ReportPage`-layout), ikke det nye board-skallet
- **Audit:** `grep -rn useTransportDashboard components/variants/report/board/` → 0 treff
- **Klassifisering:** Reference-only. Dashboarden er dead i rebuild-boardet. Fremtidig gjenoppbygging krever et navngitt live board-mount (PRD 9-skallet) — deferred, ikke bygd her

### 2c. `TransitDashboardCard`
- **Fil:** `components/variants/report/blocks/TransitDashboardCard.tsx`
- **Live konsumenter:** Kun `ReportHeroInsight.tsx` (scroll-rapport, droppet)
- **Audit:** `grep -rn TransitDashboardCard components/variants/report/board/` → 0 treff
- **Klassifisering:** Reference-only. Beholdes som referanse-implementasjon (`next/image`-konform, korrekt error/loading-tilstand). Gjenbrukes ved fremtidig dashboard-gjenoppbygging

### 2d. `useOpeningHours`
- **Fil:** `lib/hooks/useOpeningHours.ts`
- **Live konsumenter:**
  - `ExplorerPage.tsx`, `KompassTimeline.tsx`, `ExplorerPOICard.tsx`, `ExplorerPanel.tsx` → Explorer (dead i board)
  - `TripPage.tsx`, `TripStopDetail.tsx`, `TripStopList.tsx`, `TripStopPanel.tsx` → Trip (dead i board)
  - `computeIsOpen` brukes av `ReportMapDrawer.tsx` + `MapPopupCard.tsx` — disse er fra **scroll-rapporten** (gammel layout)
- **Audit:** `grep -rn useOpeningHours components/variants/report/board/` → 0 treff
- **Merknad:** `useOpeningHours` er ikke et transport-symbol — den henter åpningstider (Google Places). Plassert her fordi PRD 11 Unit 6 eksplisitt klassifiserte den
- **Klassifisering:** Reference-only for board. Transport-board (per-POI popup) bruker `isTransportPOI`-gating, ikke åpningstider

---

## 3. Navnekollisjon: `ReelsTransport`

**`components/variants/report/reels/ReelsTransport.tsx`** er **IKKE** et transport-data-symbol.
Det er **audio-player-bunnen** (play/pause + segment-hopp) i Reels-produktet (PRD 14/9).
Montert i `ReportReelsPage.tsx:969`.

- PRD 11 eier IKKE `ReelsTransport` — det tilhører PRD 14 (audio) + PRD 9 (reels-skall)
- Navnelikheten er tilfeldig; innholdet er utelukkende audio-transport-kontroll (UX), ikke sanntids-transportdata

---

## 4. `/api/travel-times` proxy-status

- **Proxy:** `app/api/travel-times/route.ts` — **beholdt** (Mapbox Matrix v1, POST <=24 dest + GET dup-logikk)
- **Live board-konsument:** Ingen. Eneste runtime-konsument er `useTravelTimes` → dead ExplorerPage
- **Build-time:** PRD 3 (`lib/pipeline/`) har reisetid-precompute som eget pipeline-steg (ikke via denne proxyen)
- **Token-håndtering:** `NEXT_PUBLIC_MAPBOX_TOKEN` i URL-querystring (Mapbox Matrix støtter KUN query-param-auth) — bevisst offentlig token, logg aldri full URL
- **Fremtidig gjenoppbygging:** Dashboarden (`useTransportDashboard` + `TransitDashboardCard`) krever navngitt live mount-flate i PRD 9-skallet — deferred

---

## 5. Verifisering (AC4)

Ingen reference-only symboler er montert i rebuild-board-stien:

```bash
# Ingen treffer forventet (board-stien)
grep -rn "useTravelTimes\|useTransportDashboard\|TransitDashboardCard\|useOpeningHours" \
  components/variants/report/board/ app/\(board\)/

# Bekreftet: ReelsTransport er audio, ikke transportdata
grep -n "import.*useRealtimeData\|useTravelTimes\|useTransportDashboard" \
  components/variants/report/reels/ReportReelsPage.tsx
# → Kun ReelsTransport (audio-player), null transport-data-importer
```

Verifisert 2026-06-30 (r11.6): 0 treff i board-stien for alle reference-only symboler.
