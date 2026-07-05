# Transport-verifikasjon — runbook (PRD 11 Unit 7)

**Eier:** PRD 11 (`docs/rebuild/prd/11-realtime-transport.md` Unit 7) · **Bead:** `placy-ralph-r11.7`
**Referanse-kjøring:** 2026-07-05 mot dev-server `:3010`, nystartet Chrome
(`/tmp/chrome-r157-verify`, remote-debugging `:9222`, chrome-devtools MCP).
Beviser at transport **FUNGERER** (live data i UI), ikke bare at koden kompilerer.

## Oppsett

```bash
PORT=3010 npm run dev
open -na "Google Chrome" --args --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-transport-verify --no-first-run --no-default-browser-check
```

Test-board: **wesselslokka** (`/eiendom/broset-utvikling-as/wesselslokka/rapport-reels`)
— eneste board med både entur- (13) og bysykkel-koblinger (4). Hyre har ingen
prosjekt-data ennå (se «Kjente data-gap»).

---

## AC1 — Live data i alle tre flater ✓

### Proxy-nivå (curl mot dev-server, alle tre kilder)

| Proxy | Kall | Live-svar (2026-07-05 ~23:15) |
|---|---|---|
| `/api/entur` | `?stopPlaceId=NSR:StopPlace:60260&limit=3` | Strindfjordvegen, sanntidsavganger `isRealtime:true` (linje 20 Grillstad) |
| `/api/bysykkel` | `?stationId=1883` | Baldershage: 7 ledige sykler · 13 ledige låser |
| `/api/hyre` | `?stationId=HYR:Station:ff10fda3-…` | Leangen, parkeringsplass: 1 bil ledig |
| `/api/hyre` kontrakt | `<script>` → **400** · ukjent gyldig ID → **404** | input-validering + not-found intakt |

### 3D-overlay-popup (BoardPOI3DMiniPopup) — live ✓

Klikk på `gmp-marker-3d-interactive` («Valentinlyst bussholdeplass») åpnet popupen med
**live avganger**: `22: Tyholt — 1 min · 13: Østmarka via Strindheim — 12 min · 22:
Vestlia via sentrum-Othilienborg — 18 min`. Bysykkel-markør («Bysykkel: Valentinlyst»):
`1 ledige sykler · 23 ledige låser`.

### 2D-popup (BoardPOIMiniPopup) — live ✓

Byttet til 2D-kart (Mapbox-overlay; `gmp-map-3d` forblir mountet — persistent-3D,
memory `project_3d_default_map_engine`). Klikk på bussmarkør åpnet popup med live
avganger: `Brøset Hageby bussholdeplass — 12: Dragvoll 11 min · 12: Marienborg via
Strindh.-sentrum 16 min · 12: Dragvoll 41 min`. Screenshot:
`docs/rebuild/assets/r11-7-transport-2d-popup-verify.png`.

### Desktop-sidebar (DesktopStorySidebar:426) — komponent-tester ✓ (data-gap live)

Sanntid i sidebaren rendres av `POIHighlightRow` i drill-in-panelet («Verdt å merke
seg») — det krever nivå-2-editorial med `highlightPoiIds` som peker på transport-POIer.
**Ingen prosjekter har transport-highlights i dag** (verken lokale JSON-er eller
Supabase-boards — skannet begge kilder). Stien er derfor verifisert med komponent-tester
(`DesktopStorySidebar.test.tsx`, 3 tester, ny i denne beaden): transport-highlight →
live avganger rendres via samme `useRealtimeData`+`POIRealtimeSection`-kjede som er
live-verifisert i begge popupene; ikke-transport-rad → ingen sanntidsseksjon; nivå-1 →
index-liste uten drill-in. Live-verifikasjon av sidebar-leggen faller naturlig ut når
første board får kuraterte transport-highlights (PRD 8-arv / PRD 15-kurering).

---

## AC2 — 3D-stabilitet under 60s-poll ✓

Metode: popup-DOM-noden ble tagget med en JS-egenskap (`__pollTag`), deretter ventet
forbi en poll-syklus (`POLLING_INTERVAL` = 60 s i `useRealtimeData`).

- Poll-request observert: `/api/bysykkel?stationId=110` → 200 (fetch-logger)
- **Samme DOM-node etter poll** — taggen intakt = ingen remount/opacity-churn
- `gmp-map-3d.isConnected === true` gjennom hele forløpet — ingen WebGL-context-tap
- Live-oppdatering synlig i UI: avgang «1 min» ble «Nå» ved neste poll

---

## AC3 — Walk-route + AbortController på rask POI-bytting ✓

Fetch-logg fra rask dobbeltklikk (Brøset Hageby → 120 ms → Solvollvegen):

```
/api/entur?stopPlaceId=NSR:StopPlace:43929&limit=5   → ERR:AbortError (aborted: true)
/api/entur?stopPlaceId=NSR:StopPlace:43141&limit=5   → 200
/api/directions?origin=10.450617,63.422074&destination=10.458037,63.42534&profile=walking → 200
```

- Forrige POIs fetch **kanselleres** (AbortController i `useRealtimeData`-cleanupen)
- Ny POI får friske avganger uten stale-flicker (`stalePopup: false` — gamle navnet
  borte fra DOM)
- **Walk-rute hjem→POI** hentes via PRD 6-primitivet (`/api/directions`,
  `profile=walking`) ved POI-aktivering (`use-route-data`)

---

## AC4 — Delvis degradasjon ✓ (inkl. fiks i denne beaden)

Arkitekturen: `useRealtimeData` bruker `Promise.allSettled` per kilde — én kilde nede
velter aldri de andre. Enhetstester (`useRealtimeData.test.ts`): «one source rejects →
error set, other sources still populated».

**Funn under verifikasjonen:** hooken satte feilmeldingen
(`"Noe sanntidsdata er utilgjengelig"`), men INGEN konsument rendret den —
degradasjonen var stum. **Fikset i denne beaden** (per CLAUDE.md: funn oversettes til
«implementer riktig», ikke scope-kutt): `POIRealtimeSection` rendrer nå meldingen som
diskret gråtekst — under de fungerende kildene ved delvis svikt, alene ved total svikt
(i stedet for `null`, som fikk POI-en til å se kobling-løs ut). +3 tester i
`POIRealtimeSection.test.tsx`.

Live-sim (fetch-intercept → `/api/entur` 500): popup viser
`Brøsetflata bussholdeplass — Noe sanntidsdata er utilgjengelig`, kartet i live,
ingen crash.

---

## AC5 — Arkitektur-konformitet ✓ (grep-verifisert)

| Sjekk | Resultat |
|---|---|
| Hemmelig nøkkel i header | `ET-Client-Name` (entur `:114/:193`, hyre `:54`, mobility `:77`), `Client-Identifier` (bysykkel `:63/:107`) |
| Nøkkel i URL-querystring | 0 treff i entur/bysykkel/hyre/mobility |
| Mapbox-token i URL | BEVISST unntak — `NEXT_PUBLIC_MAPBOX_TOKEN` er offentlig, query-param er Mapbox-kontrakten (dokumentert i `directions/route.ts:16-18` + `travel-times/route.ts:17`) |
| Full-URL-logging | ingen — `console.error` logger error-objekt/tekst, aldri URL-en med token |
| `if (reportTier)` render-gating | 0 treff i components/app/lib (kun anti-gating-doc-kommentar i `use-board-marker-set.ts:51`) |
| Supabase i transport-laget | 0 treff (proxyer + hook + blokk). `useEffect`-poll er det dokumenterte unntaket (CARRY-OVER 7/344-347; PRD 11 §4 — affirmert i hook-kommentaren) |
| Upstream-timeout | `AbortSignal.timeout(8000)` i alle proxyer (audit-fiks 2026-07-05) |

---

## AC6 — Mekaniske porter ✓

Kjørt ved bead-lukking (2026-07-05): `npm run lint` 0 errors · `npx tsc --noEmit` rent ·
`npx vitest run` alle grønne · `npm run build` OK. Se commit for eksakte tall.

---

## Kjente data-gap (ikke kode-gap)

1. **Hyre:** ingen prosjekter har `hyreStationId` satt (verken lokal JSON eller
   Supabase). Proxy + hook + UI-seksjon er verifisert (proxy live-curl, hook/blokk
   enhetstester). Første prosjekt med Hyre-kobling får live-verifikasjon gratis.
2. **Sidebar-highlights:** ingen prosjekter har transport-POIer i
   `editorial.highlightPoiIds` — se AC1.
3. **favicon.ico 404** på board-sidene (kosmetisk, sporet i bead `placy-ralph-rik`).
