# Brainstorm: Prosjekt POI-håndtering med kartvisning

**Dato:** 2026-02-06
**Kontekst:** POI-er-taben på prosjektdetalj (`/admin/projects/[id]`) er en flat liste uten innsikt. Vi har allerede en kartbasert POI-admin på `/admin/pois` som gir mye bedre UX. Målet er å bringe denne kartopplevelsen inn i prosjektkonteksten.

---

## Problemet

### Nåværende tilstand
1. **POI-er tab** viser en flat tabell: navn, kategori, slett-knapp. 60 POI-er = 60 rader uten struktur.
2. **Ingen visuell innsikt** — redaktører kan ikke se:
   - Hvor POI-ene fysisk er plassert
   - Hvor tett/spredt de er
   - Hvilke områder som mangler dekning
   - Kategorifordeling på kartet
3. **Legg til POI** er en dropdown-modal — krever at du kjenner POI-navnene på forhånd
4. **Ingen filtrering** — ingen mulighet til å filtrere etter kategori, rating, osv.

### Ønsket tilstand
- Redaktører ser prosjektets POI-er **på kart**, med kategorifarger
- Statistikk og kategorifordeling synlig med et blikk
- Legge til POI-er visuelt (klikk på kart eller velg fra globalt basseng)
- Fjerne POI-er fra prosjektet direkte
- Forstå dekningen — se "hull" i et område

---

## Ideer & tilnærminger

### A: Kart+sidebar i POI-er-taben (anbefalt)
Erstatt den flate tabellen med en todelt visning lik `/admin/pois`:
- **Venstre sidebar:** Kategorifiltre med antall, søk, statistikk-oppsummering
- **Høyre kart:** Prosjektets POI-er vist som markers, fargekodet etter kategori

**Fordeler:**
- Gjenbruker mønsteret fra `/admin/pois` som allerede fungerer
- Prosjektets `center_lat`/`center_lng` gir naturlig startvisning
- Visuell oversikt over dekning og distribusjon
- Kategorifiltre gir umiddelbar innsikt

**Risiko:**
- POI-er-taben er inne i en tab-komponent — krever god høydeberegning
- Må scopes til prosjektets POI-er, ikke globalt basseng

### B: Minimap + forbedret liste
Behold listen men legg til et lite kart øverst som viser alle POI-er.

**Fordeler:** Enklere implementering, bevarer eksisterende funksjonalitet
**Ulempe:** Halvveis løsning, gir ikke full interaktivitet

### C: Toggle mellom liste og kart
Beholder begge visninger med en toggle-knapp.

**Fordeler:** Bruker kan velge foretrukket visning
**Ulempe:** Mer kompleksitet, to views å vedlikeholde

---

## Beslutninger

### 1. Layout: Kart+sidebar i taben (Tilnærming A)
Vi kjører full todelt visning som erstatter den flate tabellen. Mønsteret fra `/admin/pois` er bevist og fungerer bra.

### 2. Kartvisning
- Kart sentrert på prosjektets `center_lat`/`center_lng`
- Viser kun prosjektets POI-er (ikke hele det globale bassenget)
- Markers fargekodet etter kategori (gjenbruk POIMarker-komponent)
- Klikk på marker → popup med POI-info + "Fjern fra prosjekt"-knapp

### 3. Sidebar: Statistikk + kategorifiltre
- **Oppsummering øverst:** "60 POI-er i prosjektet" med kategorifordeling
- **Kategorifiltre:** Toggle-chips med antall per kategori (som /admin/pois)
- **Velg alle / Fjern alle** for filtrering

### 4. Legg til POI — to metoder
1. **Fra globalt basseng:** Knapp "Legg til eksisterende POI" → modal/drawer med søk i globale POI-er som IKKE allerede er i prosjektet. Vis disse som dimmed markers på kartet.
2. **Ny POI direkte:** Knapp "Opprett ny POI" → klikk på kartet for å plassere, fyll inn detaljer. POI opprettes globalt OG legges til prosjektet.

### 5. Fjerne POI fra prosjekt
- Klikk marker → popup → "Fjern fra prosjekt"
- Eventuelt multi-select for bulk-fjerning

### 6. Statistikk-panel
- Antall POI-er per kategori (bar/donut)
- Google-rating distribusjon (snitt)
- Dekning-indikator (spread)

---

## Scope for MVP

### Må ha (Phase 1)
- [ ] Todelt layout: sidebar + kart i POI-er-taben
- [ ] Kart sentrert på prosjektets senterpunkt
- [ ] Prosjektets POI-er som fargekodede markers
- [ ] Kategorifiltre i sidebar med antall
- [ ] Klikk marker → popup med POI-info
- [ ] Fjern POI fra prosjekt (fra popup)
- [ ] "Legg til eksisterende POI" — søk + velg fra globalt basseng
- [ ] Statistikk-oppsummering (antall per kategori)

### Nice to have (Phase 2)
- [ ] Vis globale POI-er som dimmed markers (for å se hva man kan legge til)
- [ ] Opprett ny POI direkte fra kartet
- [ ] Dekning-heatmap
- [ ] Bulk-operasjoner (legg til/fjern flere)
- [ ] Eksporter POI-liste

---

## Tekniske notater

### Gjenbruk
- `react-map-gl/mapbox` — allerede brukt i `/admin/pois`
- `POIMarker` fra `components/map/poi-marker.tsx` — kan gjenbrukes med tilpasning
- Kategorifilter-mønsteret fra `poi-admin-client.tsx`
- Server actions `addPoiToProject` / `removePoiFromProject` finnes allerede i page.tsx

### Data-flow
- Prosjektets POI-er: `project_pois` JOIN `pois` JOIN `categories`
- Globale POI-er (for "legg til"): `pois` WHERE NOT IN project_pois
- Prosjektets senterpunkt: `projects.center_lat` / `center_lng`

### Høyde-håndtering
Taben er inne i et flex-layout. Kartet trenger `h-[calc(100vh-XXpx)]` eller flex-grow for å fylle tilgjengelig plass.
