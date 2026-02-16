# Placy PRD - Product Requirements Document

> **Sist oppdatert:** 2026-01-24
> **Kontekst:** Se `context/placy-concept-spec.md` for full produktspesifikasjon

---

## Prosjektstatus

### Implementert (fungerer)
- [x] Next.js 14 app med TypeScript og Tailwind
- [x] Dynamisk ruting (`/[customer]/[project]/`)
- [x] Global state med Zustand (travelMode, timeBudget, localStorage)
- [x] Sidebar med chapters-navigasjon og global settings
- [x] Story page med hero, seksjoner, POI-lister
- [x] Theme Story modal (50/50 split: liste + kart)
- [x] Mapbox kart med POI-markører
- [x] Rute-visning fra prosjekt-sentrum til valgt POI
- [x] Directions API for ruteberegning (`/api/directions`)
- [x] POI-kort med kategori-ikon, navn, reisetid
- [x] Demo-data for Ferjemannsveien 10

---

## Fase 1: Visuell Polish og UX

- [x] I `components/story/story-hero.tsx`: Erstatt emoji-placeholder (🍲) med en gradient bakgrunn. Bruk `bg-gradient-to-br from-orange-400 to-rose-500` som fallback når heroImages ikke finnes eller ikke laster.

- [x] I `components/poi/poi-card.tsx`: POI-kortet har allerede støtte for featuredImage, men mangler proper error handling. Verifiser at `imageError` state fungerer og at fallback til kategori-ikon vises korrekt. Test ved å sette en ugyldig `featuredImage` URL i data.

- [x] I `components/modal/theme-story-modal.tsx`: Legg til visuell dimming for POI-er utenfor tidsbudsjettet. I POICardExpanded-komponenten, legg til `opacity-50` klasse når `poi.travelTime?.[travelMode] > timeBudget`. Importer `useTravelSettings` og bruk `timeBudget` for sammenligning.

- [x] I `components/map/poi-marker.tsx`: Når `isActive={true}`, gjør markøren større (scale-125) og legg til en pulserende ring-effekt med `animate-ping` på en ytre div. Bruk Tailwind-klasser.

- [x] I `components/map/route-layer.tsx`: Legg til en hvit badge med reisetid midt på ruten. Bruk Mapbox `Marker` komponent plassert på midtpunktet av rute-koordinatene. Vis `{travelTime} min` i en hvit rounded badge med skygge.

- [x] I `components/poi/poi-card.tsx`: Legg til skeleton loading state. Lag en ny komponent `POICardSkeleton` i samme fil som viser animert placeholder med `animate-pulse` og grå bokser for bilde, tittel og knapp.

- [x] I `components/modal/theme-story-modal.tsx`: Når bruker klikker på kart-markør (handleMapPOIClick), scroll til POI-kortet og legg til `ring-2 ring-blue-500` highlight i 2 sekunder. Bruk setTimeout for å fjerne highlight.

---

## Fase 2: Sanntidsdata-integrasjoner

- [x] Opprett `app/api/entur/route.ts`: Lag en API-route som tar `stopPlaceId` som query parameter og returnerer de neste 5 avgangene. Bruk Entur Journey Planner GraphQL API (https://api.entur.io/journey-planner/v3/graphql). Query skal hente `estimatedCalls` for gitt StopPlace. Returner array med `{line, destination, departureTime, realtime}`.

- [x] Opprett `app/api/bysykkel/route.ts`: Lag en API-route som henter data fra Trondheim Bysykkel GBFS. Bruk `https://gbfs.urbansharing.com/trondheimbysykkel.no/station_status.json` for tilgjengelighet og `station_information.json` for stasjonsinfo. Ta `stationId` som parameter og returner `{availableBikes, availableDocks, isOpen}`.

- [x] Opprett `lib/hooks/useRealtimeData.ts`: Lag en custom hook som tar `poi` som parameter og returnerer sanntidsdata basert på POI-type. Hvis `poi.enturStopplaceId` finnes, fetch fra `/api/entur`. Hvis `poi.bysykkelStationId` finnes, fetch fra `/api/bysykkel`. Bruk `useState` og `useEffect` med 60 sekunder polling interval.

- [x] I `components/poi/poi-card-expanded.tsx`: Importer `useRealtimeData` hook og vis sanntidsdata under POI-info. For buss: vis de neste 3 avgangene med linjenummer og tid. For bysykkel: vis "X ledige sykler, Y ledige låser". Style med mindre tekst (text-xs) og grå farge.

---

## Fase 3: Mapbox Reisetid-beregning

- [x] Opprett `app/api/travel-times/route.ts`: Lag en API-route som tar `origin` (lat,lng), `destinations` (array av lat,lng), og `profile` (walking/cycling/driving). Bruk Mapbox Matrix API for å beregne reisetider til alle destinasjoner i én request. Returner array med `{destinationIndex, durationMinutes}`.

- [x] Opprett `lib/hooks/useTravelTimes.ts`: Lag en hook som tar `projectCenter` og `pois` array. Ved mount og når `travelMode` endres, kall `/api/travel-times` og oppdater POI-ene med faktiske reisetider. Cache resultater i localStorage med nøkkel `placy-travel-times-{projectId}-{travelMode}` og 24 timers TTL.

- [x] I `app/[customer]/[project]/page.tsx`: Erstatt den simulerte `poisWithTravelTime` logikken (linje 37-49) med `useTravelTimes` hook. Pass `projectData.centerCoordinates` og `projectData.pois` til hooken.

---

## Fase 4: Google Places Integrasjon

- [x] Opprett `app/api/places/[placeId]/route.ts`: Lag en API-route som henter Place Details fra Google Places API. Bruk `GOOGLE_PLACES_API_KEY` fra env. Returner `{rating, reviewCount, photos, website, phone, openingHours}`. Cache responsen i 24 timer med en enkel in-memory Map.

- [x] Opprett `app/api/places/photo/route.ts`: Lag en proxy-route for Google Place Photos. Ta `photoReference` og `maxWidth` som query params. Fetch bildet fra Google og returner det med `Cache-Control: public, max-age=2592000` (30 dager).

- [x] I `components/poi/poi-card-expanded.tsx`: Hvis POI har `googlePlaceId`, fetch detaljer fra `/api/places/[placeId]` ved mount. Vis website-lenke og telefonnummer hvis tilgjengelig. Bruk ikoner fra Lucide (Globe, Phone).

---

## Fase 5: Innholdsutvidelse

- [x] I `data/projects/klp-eiendom/ferjemannsveien-10.json`: Legg til flere POI-er fra `placy-data-export.md`. Inkluder minst 5 restauranter med editorial hooks (Amber Restaurant, Blomster og Vin, Hevd Bakery, Una pizzeria, Robata Asian Fusion). Kopier koordinater og data fra export-filen.

- [x] I `data/projects/klp-eiendom/ferjemannsveien-10.json`: Legg til en ny Theme Story for "Trening & Helse". Inkluder seksjoner for "Treningssentre" og "Utendørs aktiviteter". Bruk placeholder POI-er med kategori "gym" og ikon "Dumbbell".

- [x] Opprett `components/map/master-map.tsx`: Lag et fullskjerms-kart som viser alle POI-er i prosjektet. Inkluder kategori-filtrering med toggle-knapper øverst. Bruk samme MapView-komponent men med alle POI-er og uten rute-visning.

---

## Fase 6: Responsiv Mobil-UX

- [x] I `components/modal/theme-story-modal.tsx`: Legg til responsive breakpoints. På skjermer under 768px (`md:`), vis modal som fullskjerm med stacked layout: kart øverst (40vh), liste under (scrollbar). Bruk Tailwind `md:w-1/2` for desktop og `w-full` for mobil.

- [x] I `components/layout/sidebar.tsx`: Gjør sidebar til en collapsible drawer på mobil. På skjermer under 768px, skjul sidebar som default og vis en hamburger-meny knapp. Bruk useState for `isOpen` og animer med `transform translate-x`.

- [x] Opprett `components/poi/poi-bottom-sheet.tsx`: Lag en bottom sheet komponent for POI-detaljer på mobil. Vis kompakt info (navn, kategori, reisetid) og "Se mer" knapp som ekspanderer til full detaljer. Bruk `fixed bottom-0` posisjonering og drag-to-close gesture.

---

## SEO Optimalisering — POI Detail Pages

> **Audit:** 2026-02-16 | **Docs:** `docs/solutions/seo-optimization/poi-detail-structured-data-audit-20260216.md`
> **Status:** Parkert — tas når de offentlige sidene er mer modne og dynamiske.

### Høy prioritet
- [ ] Parse `openingHours` fra Google Places weekday_text til schema.org `OpeningHoursSpecification` format (`POIJsonLd.tsx`)
- [ ] Legg til `addressLocality` (bynavn) i JSON-LD PostalAddress (`POIJsonLd.tsx`)
- [ ] Send galleryImages-array (ikke bare én URL) til JSON-LD image-felt (`POIJsonLd.tsx`, `page.tsx`)
- [ ] Legg til `generateStaticParams` for POI-sider — pre-render ved build (`page.tsx`, `public-queries.ts`)

### Medium prioritet
- [ ] Bruk ekte `updated_at` fra database som `lastmod` i sitemap (`sitemap.ts`)
- [ ] Endre `og:type` fra "website" til "place" for steder-sider (`page.tsx`)
- [ ] Legg til `priceRange` i structured data, map fra Google `price_level` (`POIJsonLd.tsx`)
- [ ] Legg til favicon og apple-touch-icon (`layout.tsx`, `/public`)
- [ ] Fiks schema-type for hoteller — Hotel istedenfor Restaurant (`POIJsonLd.tsx`)

### Lav prioritet
- [ ] Legg til `twitter:site` meta tag (`page.tsx`)
- [ ] Legg til site-wide `Organization` JSON-LD schema (`layout.tsx`)
- [ ] Unnta `/api/places/photo` fra robots.txt blokkering (`robots.txt`)

---

## Tekniske Forbedringer

- [x] I `app/[customer]/[project]/page.tsx`: Wrap hovedinnholdet i en React Error Boundary. Opprett `components/error-boundary.tsx` som fanger feil og viser en bruker-vennlig feilmelding med "Prøv igjen" knapp.

- [x] I `lib/types.ts`: Legg til `loading` og `error` states i relevante typer. Opprett `type AsyncState<T> = { data: T | null; loading: boolean; error: string | null }` og bruk dette i hooks.

---

## Filstruktur

```
placy-ralph/
├── app/
│   ├── [customer]/[project]/    # Dynamisk prosjektside
│   ├── api/
│   │   ├── directions/          # Mapbox Directions proxy
│   │   ├── entur/               # Entur sanntidsdata
│   │   ├── bysykkel/            # Bysykkel tilgjengelighet
│   │   ├── travel-times/        # Mapbox Matrix API
│   │   └── places/              # Google Places proxy
│   └── layout.tsx
├── components/
│   ├── layout/                  # Sidebar, MainContent
│   ├── map/                     # MapView, POIMarker, RouteLayer, MasterMap
│   ├── modal/                   # ThemeStoryModal
│   ├── poi/                     # POICard, POICardExpanded, POIList, BottomSheet
│   └── story/                   # StoryHero, StorySection, ThemeStoryCTA
├── lib/
│   ├── types.ts                 # TypeScript-typer
│   ├── store.ts                 # Zustand global state
│   ├── data.ts                  # Data-henting
│   ├── utils.ts                 # Hjelpefunksjoner
│   └── hooks/                   # Custom hooks (useRealtimeData, useTravelTimes)
├── data/
│   └── projects/                # JSON-data per prosjekt
├── context/
│   └── placy-concept-spec.md    # Full produktspesifikasjon
└── PRD.md                       # Denne filen
```

---

## Kjør prosjektet

```bash
npm run dev          # Start dev server (port 3000/3001)
npm run build        # Bygg for produksjon
npm run lint         # Kjør linting
```

## Kjør med Ralphy

```bash
ralphy --prd PRD.md              # Kjør alle oppgaver sekvensielt
ralphy --prd PRD.md --max-iterations 7   # Kun Fase 1
```
