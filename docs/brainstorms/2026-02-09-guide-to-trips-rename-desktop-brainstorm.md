# Brainstorm: Rename Guide → Trips + Desktop Layout

**Dato:** 2026-02-09
**Status:** Brainstorm

---

## Kontekst

Placy har tre produkter: Explorer, Guide, og Report. "Guide"-navnet er misvisende — det antyder at noen guider deg gjennom opplevelsen, men produktet er egentlig kuraterte turer der brukeren selv velger tempo og rekkefølge. **Trips** er et bedre navn: kort, klart, og beskriver hva produktet faktisk er.

I tillegg er hele Guide/Trips-produktet bygd kun for mobil (fullscreen kart + draggable bottom sheet). Vi trenger en desktop-versjon som utnytter bredskjermen med side-by-side layout.

---

## Del 1: Rename Guide → Trips

### Hva som endres

**Brukersynlig (UI/URL):**
- URL-ruter: `/guides` → `/trips`, `/:customer/:project/guide` → `/:customer/:project/trip`
- Alle norske tekster: "guides" → "turer", "guide" → "tur"
- Side-titler, søkefelt-placeholder, feilmeldinger
- Library-overskrift: "Utforsk guides" → "Utforsk turer"

**Kodeinternt:**
- Mapper: `components/variants/guide/` → `components/variants/trip/`
- Komponentnavn: `GuidePage` → `TripPage`, `GuideMap` → `TripMap`, etc.
- Typer: `GuideConfig` → `TripConfig`, `GuideCategory` → `TripCategory`, etc.
- Hooks: `useGuideCompletion` → `useTripCompletion`
- localStorage key: `placy-guide-completions` → `placy-trip-completions` (med migrasjon)
- Feiltyper: `GuideErrorCode` → `TripErrorCode`
- Validering: `guide-schema.ts` → `trip-schema.ts`
- Data-funksjoner: `getGuidesByCustomer` → `getTripsByCustomer`
- ProductType: `"guide"` → `"trip"`

**Bakoverkompatibilitet:**
- Middleware redirect: `/guides` → `/trips` (301)
- Legacy `-guide` URL-suffix → redirect til ny path
- localStorage migrasjon: les gammel key, skriv til ny

### Beslutning

Gjennomfør full rename i ett pass. Ingen halvveis — vi gjør det grundig slik at kodebasen er konsistent.

---

## Del 2: Desktop Layout for Trips

### Nåværende mobil-layout

```
┌──────────────────────┐
│  [Title bar overlay] │
│                      │
│    FULLSCREEN MAP     │
│                      │
│                      │
├──────────────────────┤
│  ◀ [Merk besøkt] ▶  │  ← Bottom sheet (draggable)
│  Stop info panel     │
│  Description, image  │
└──────────────────────┘
```

- Kart tar hele skjermen
- Bottom sheet kan dras opp/ned (3 snap points)
- Navigasjon (prev/next) i bottom sheet
- Progress dots + mark complete button

### Desktop-layout (nytt)

```
┌──────────────────────────────────────────────────────┐
│  Trips header (title, progress, back)                │
├───────────────┬──────────────────────────────────────┤
│               │                                      │
│  Stop list    │           MAP                        │
│  (sidebar)    │                                      │
│               │                                      │
│  1. Stop A ✓  │                                      │
│  2. Stop B ●  │                                      │
│  3. Stop C    │                                      │
│               │                                      │
│  ─────────── │                                      │
│  Stop detail  │                                      │
│  Description  │                                      │
│  Image        │                                      │
│  [Merk besøkt]│                                      │
│               │                                      │
└───────────────┴──────────────────────────────────────┘
```

**Sidebar (~380px):**
- Stop-liste øverst (klikkbare, viser completion-status)
- Valgt stop viser detaljer under
- Mark complete-knapp i sidebar
- Scrollbar for lange turer

**Map-area (resten):**
- Større kart-areal enn mobil
- Ingen overlays over kartet bortsett fra Mapbox controls
- Nummererte markører (som nå)
- Route polyline (som nå)

### Responsiv strategi

- **Breakpoint:** `md` (768px) — under = mobil (som nå), over = desktop sidebar
- Samme komponenter for kart og stopp-panel, men ulik layout-container
- `TripPage` detekterer viewport og rendrer enten:
  - Mobil: fullscreen map + bottom sheet (eksisterende)
  - Desktop: grid med sidebar + kart

### Beslutninger

1. **Sidebar vs top-bar:** Sidebar er bedre for desktop — kartet får mer vertikal plass
2. **Stop-liste i sidebar:** Ja — gir oversikt over hele turen uten å måtte bla
3. **Samme komponent-logikk:** Ja — TripStopPanel gjenbrukes, men wrapper endres
4. **Bottom sheet på desktop:** Nei — erstattes av sidebar
5. **Progress bar:** Flyttes til header-bar på desktop

---

## Del 3: Test-data (Scandic Nidelven)

For å teste desktop-layout trenger vi en demo-trip. Vi lager en JSON-fil med:

- **Kunde:** `scandic`
- **Prosjekt:** `scandic-nidelven`
- **Trip:** "Historisk byvandring langs Nidelva" (5-6 stopp i Trondheim sentrum)
- **Reward:** "15% rabatt i baren" fra Scandic Nidelven

Stoppene (rundt Scandic Nidelven, Trondheim):
1. Gamle Bybro (63.4270, 10.4020) — Ikonisk trebro
2. Bakklandet (63.4280, 10.4040) — Fargerike trehus
3. Nidarosdomen (63.4269, 10.3967) — Norges nasjonalhelligdom
4. Erkebispegården (63.4272, 10.3987) — Middelaldersk residens
5. Solsiden (63.4345, 10.4090) — Mat- og utelivsområde
6. Scandic Nidelven (63.4350, 10.4060) — Tilbake til hotellet

---

## Oppsummering

| Oppgave | Omfang |
|---------|--------|
| Full rename Guide → Trips | ~20 filer, typer, ruter, tekst |
| Desktop sidebar-layout | Ny layout-wrapper, responsive breakpoint |
| Test-data Scandic Nidelven | 1 JSON-fil med 6 POI-er |
| Bakoverkompatibilitet | Middleware redirects + localStorage-migrasjon |

### Rekkefølge

1. Rename (kodeinternt + brukersynlig)
2. Desktop-layout (ny responsive container)
3. Test-data (Scandic Nidelven trip)
4. Verifiser at mobil fortsatt fungerer
