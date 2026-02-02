# Brainstorm: Explorer Geotargeting + Vercel Deploy

**Dato:** 2026-01-31
**Branch:** Ny branch fra `main` (som nå har all explorer-kode)

---

## Hva vi bygger

### 1. Geotargeting i Explorer-kartet

Live GPS-posisjon i explorer-kartet slik at brukeren ser seg selv blant POI-ene og får reisetider beregnet fra sin faktiske posisjon.

**Kjerneopplevelse:**
- Blå pulserende GPS-prikk som følger brukerens posisjon i sanntid
- Reisetider (walk/bike/car) beregnes fra brukerens posisjon — ikke hotellets
- Trykk på en POI for å se rute fra der du står nå

**Hybrid-modus når brukeren er utenfor området (>2km fra prosjektet):**
- Vis både brukerens GPS-prikk og hotellets "Du er her"-markør
- Zoom kartet ut til å vise begge punktene
- Vis en info-boks: "Du er X km fra [hotellnavn]. Avstander beregnes fra hotellets posisjon."
- Reisetider baseres på hotellets posisjon (som nå)

**Når brukeren er i nærheten (<2km):**
- GPS-prikken erstatter "Du er her"-markøren som utgangspunkt
- Reisetider beregnes fra brukerens posisjon
- Ruter tegnes fra brukerens posisjon
- Kartet sentreres på brukerens posisjon ved oppstart

### 2. Vercel Deploy

Sette opp Vercel-prosjekt fra scratch slik at appen kan testes på mobil med ekte GPS.

---

## Hvorfor denne tilnærmingen

- **Hybrid-modus** løser problemet med at brukere vil teste appen hjemmefra — de ser fortsatt relevant innhold basert på hotellet, men forstår at GPS er aktivt
- **Reisetider fra bruker** gir reell verdi når du faktisk er ute og utforsker nabolaget
- **2km-grensen** er en fornuftig terskel — innenfor 2km er du i "nabolaget" og reisetider fra deg er meningsfulle
- **Vercel** er nødvendig fordi `navigator.geolocation` krever HTTPS på mobil, og localhost ikke fungerer for real-world testing

---

## Nøkkelbeslutninger

1. **GPS-prikk:** Blå pulserende dot (Mapbox GeolocateControl-stil), distinkt fra prosjektmarkøren
2. **Avstandsgrense:** 2km — under dette brukes GPS-posisjon som origin for reisetider
3. **Info-boks:** Vises når brukeren er >2km unna, forklarer at avstander er fra hotellet
4. **Kart-zoom ved fjern posisjon:** Automatisk zoom ut med `fitBounds` for å vise både bruker og hotell
5. **Reisetids-recalc:** Når bruker er <2km, re-kalkuler travel times fra brukerens posisjon (bruker eksisterende `/api/travel-times` endpoint)
6. **Permission-håndtering:** Graceful fallback til hotell-posisjon hvis bruker nekter GPS-tilgang
7. **Vercel:** Nytt prosjekt, koble til GitHub repo, sette env vars

---

## Tekniske notater

**Eksisterende infrastruktur som kan gjenbrukes:**
- `ExplorerMap.tsx` — legge til GPS-markør og GeolocateControl
- `/api/travel-times` — allerede batch-støtte for å re-kalkulere fra ny origin
- `/api/directions` — allerede støtte for vilkårlig origin/destination
- `useTravelTimes` hook — må utvides til å akseptere dynamisk origin
- `react-map-gl` har innebygd `GeolocateControl` komponent

**Nye ting som trengs:**
- `useUserLocation` hook — wrapper rundt `navigator.geolocation.watchPosition`
- Logikk for å avgjøre om bruker er innenfor 2km (haversine-beregning)
- Info-boks komponent for "utenfor området"-melding
- Vercel prosjekt-oppsett med env vars

---

## Åpne spørsmål

- Skal GPS-prikken ha en "sentrér på meg"-knapp (som Google Maps)?
- Skal reisetider auto-oppdatere mens du går, eller bare ved oppstart/manuelt?
- Trengs det noen form for batteri/ytelseshensyn for watchPosition?

---

## Neste steg

Kjør `/workflows:plan` for å lage implementasjonsplan.
