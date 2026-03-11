---
title: "feat: Placy Kompass — Personlig event-anbefaling (Olavsfest prototype)"
type: feat
date: 2026-03-11
brainstorm: docs/brainstorms/2026-03-11-ai-concierge-event-prototype-brainstorm.md
---

# Placy Kompass — Event Prototype (Olavsfest)

## Sammendrag

Bygg **Kompass** — Placys fjerde produktkonsept. En bottom sheet stiller 3 spørsmål (tema, dag, tid), og genererer en personlig tidslinje med anbefalte events. Prototypen bygges med Olavsfest 2025-data (222 events, 14+ venues).

## Akseptansekriterier

- [ ] Olavsfest 2025-programmet er importert til Supabase (222 events med dato, tid, venue, kategori, pris)
- [ ] Kompass bottom sheet dukker opp ved første besøk på Olavsfest Explorer
- [ ] 3 steg: tema → dag → tid, med skip-CTA
- [ ] Etter svar: "Kompass"-tab viser filtrerte events i tidslinje-visning
- [ ] "Alle events"-tab viser vanlig Explorer-liste
- [ ] Anbefalte events er visuelt fremhevet på kartet
- [ ] Mobil-først: bottom sheet med kart synlig bak
- [ ] Fungerer på desktop med sidebar-tabs

---

## Implementeringsplan

### Steg 1: Olavsfest-importer (scripts/import-olavsfest.ts)

**Mønster:** Følg Arendalsuka-importeren (`scripts/import-arendalsuka.ts`)

**Datakilde:** Scrape `https://olavsfest.no/program/?aar=2025` (WordPress, HTML-parsing)

**Kategorier (6 stk, matcher nettsiden):**
```typescript
const CATEGORY_DEFS = [
  { id: "of-konserter", name: "Konserter", icon: "Music", color: "#7c3aed", sourceLabels: ["Forestilling/Konsert"] },
  { id: "of-samtale", name: "Samtaleprogram", icon: "MessageCircle", color: "#2563eb", sourceLabels: ["Snakk"] },
  { id: "of-familie", name: "Familiearrangement", icon: "Users", color: "#16a34a", sourceLabels: ["Familiearrangement"] },
  { id: "of-folkeliv", name: "Folkeliv", icon: "PartyPopper", color: "#ea580c", sourceLabels: ["Folkeliv"] },
  { id: "of-kirke", name: "Kirke", icon: "Church", color: "#854d0e", sourceLabels: ["Kirke"] },
  { id: "of-utstilling", name: "Utstillinger", icon: "Image", color: "#be185d", sourceLabels: ["Utstilling"] },
]
```

**Venues (hardkodede koordinater for Trondheim sentrum):**
```typescript
const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Nidarosdomen": { lat: 63.4269, lng: 10.3969 },
  "Borggården": { lat: 63.4271, lng: 10.3958 },
  "Vestfrontplassen": { lat: 63.4272, lng: 10.3955 },
  "Vår Frue kirke": { lat: 63.4305, lng: 10.3950 },
  "Nye Hjorten Teater": { lat: 63.4310, lng: 10.3970 },
  "Britannia Hotel": { lat: 63.4320, lng: 10.3980 },
  "Ytre Kongsgård": { lat: 63.4265, lng: 10.3975 },
  "Kirkehagen": { lat: 63.4268, lng: 10.3960 },
  "Prinsen kino": { lat: 63.4330, lng: 10.3980 },
  "Domkirkeparken": { lat: 63.4275, lng: 10.3965 },
  "Trondhjems Kunstforening": { lat: 63.4335, lng: 10.3970 },
  "Bifrons": { lat: 63.4340, lng: 10.4000 },
  "KFUK-KFUM": { lat: 63.4315, lng: 10.3960 },
  "Erkebispegården": { lat: 63.4263, lng: 10.3958 },
  // Fallback: Mapbox geocoding
}
```

**HTML-parsing:**
- Dato-headers: `<h2>` med "ONSDAG 9. APRIL 2025"-format → parse til YYYY-MM-DD
- Event-blokker: `<h4>` (tittel), `<h5>` (tid), kategori-badges, pris, "Les mer"-lenke
- Bruk cheerio eller jsdom for parsing

**Supabase-upsert:** Samme mønster som Arendalsuka — customer, categories, POIs (batch 100), project (tag: "Event"), product (explorer), link-tabeller.

**Filer:**
- `scripts/import-olavsfest.ts` — importerscript
- Kjør: `npx tsx scripts/import-olavsfest.ts`

**Verifiser:** 222 POI-er i Supabase med korrekte datoer, tider, venues og kategorier.

---

### Steg 2: Kompass Zustand store (lib/stores/kompass-store.ts)

**Separat store** (ikke i hovedstore — holder Kompass ortogonal):

```typescript
interface KompassState {
  // Brukerens svar
  selectedThemes: string[];     // ["of-konserter", "of-familie"]
  selectedDay: string | null;   // "2025-07-29" eller null (hele festivalen)
  selectedTimeOfDay: string[];  // ["afternoon", "evening"]

  // UI-state
  activeTab: "kompass" | "all"; // Hvilken tab er aktiv
  hasCompletedFlow: boolean;    // Har bruker svart på spørsmål?
  showBottomSheet: boolean;     // Vis bottom sheet?
  bottomSheetStep: 1 | 2 | 3;  // Nåværende steg

  // Actions
  setSelectedThemes(themes: string[]): void;
  setSelectedDay(day: string | null): void;
  setSelectedTimeOfDay(times: string[]): void;
  setActiveTab(tab: "kompass" | "all"): void;
  completeFlow(): void;
  skipFlow(): void;
  resetFlow(): void;
  nextStep(): void;
  prevStep(): void;
}
```

**Persistens:** `localStorage` key `"placy-kompass"` — persist `selectedThemes`, `selectedDay`, `selectedTimeOfDay`, `hasCompletedFlow`. Ikke persist UI-state.

---

### Steg 3: Kompass filtreringshook (lib/hooks/useKompassFilter.ts)

**Anbefaling, ikke filtrering** — returnerer to lister:

```typescript
interface KompassResult {
  recommended: POI[];  // Events som matcher alle kriterier, kronologisk
  all: POI[];          // Alle events (ufiltrert)
}

function useKompassFilter(
  pois: POI[],
  themes: string[],
  day: string | null,
  timeOfDay: string[]  // ["morning", "afternoon", "evening"]
): KompassResult
```

**Filtreringslogikk:**
1. **Tema:** Match POI category against selected themes
2. **Dag:** Match `eventDates` array (gjenbruk fra `useEventDayFilter`)
3. **Tid på dagen:**
   - morning: `eventTimeStart < "12:00"`
   - afternoon: `"12:00" <= eventTimeStart < "17:00"`
   - evening: `eventTimeStart >= "17:00"`
4. **Sortering:** Kronologisk etter `eventTimeStart`

---

### Steg 4: Kompass bottom sheet (components/variants/explorer/KompassBottomSheet.tsx)

**Mobil-først bottom sheet** som glir opp fra bunnen.

**3 steg:**

**Steg 1 — Tema (multi-select):**
```
🧭 Hva vil du oppleve?

🎵 Konserter          💬 Samtaler
👨‍👩‍👧 Familie           🎪 Folkeliv
⛪ Kirke               🎨 Utstillinger

[ Neste → ]                  Utforsk fritt →
```

**Steg 2 — Dag:**
```
🧭 Hvilken dag?

◯ Hele festivalen
◯ Man 28. jul  ◯ Tir 29. jul
◯ Ons 30. jul  ◯ Tor 31. jul
◯ Fre 1. aug   ◯ Lør 2. aug
◯ Søn 3. aug

[ ← Tilbake ]  [ Neste → ]
```

**Steg 3 — Tid:**
```
🧭 Når er du ledig?

☀️ Formiddag (før 12)
🌤️ Ettermiddag (12–17)
🌙 Kveld (etter 17)
📅 Hele dagen

[ ← Tilbake ]  [ Vis anbefalinger → ]
```

**Teknisk:**
- `framer-motion` eller CSS transitions for slide-up/step-animasjoner
- Overlay: semi-transparent bakgrunn, kart synlig bak
- Z-index over kart, under header
- Steg-progresjon: dots eller "1 av 3"
- Skip-CTA på alle steg: "Utforsk fritt →"
- Desktop: modal i stedet for bottom sheet (responsive)

---

### Steg 5: Tab-komponent (components/variants/explorer/KompassTabs.tsx)

**Plassering:** Over POI-lista i sidebar, under day filter.

```
  🧭 Kompass  |  Alle events
  ─────────────────────────
```

**Oppførsel:**
- Etter Kompass-flyt: "Kompass" er aktiv, "Alle events" tilgjengelig
- Etter skip: "Alle events" er aktiv, "Kompass" viser invitasjon
- Klikk bytter mellom tabs
- Styres av `kompassStore.activeTab`

**Visuell:** Gjenbruk chip/pill-styling fra ExplorerDayFilter — `rounded-full`, aktiv=mørk, inaktiv=lys.

---

### Steg 6: Tidslinje-visning (components/variants/explorer/KompassTimeline.tsx)

**Vises i Kompass-tab** i stedet for vanlig POI-liste.

```
● 14:00
│ Vestfrontmøtet: KAMPEN FOR TILVÆRELSEN
│ Vestfrontplassen · Samtale · Gratis
│
● 16:30
│ THE HERDS – THE OLD WAYS
│ Vestfrontplassen · Konsert · Gratis
│
● 19:00
│ FLUKT – Nidaros Vokal
│ Nidarosdomen · Konsert · 520,-
```

**Teknisk:**
- Vertikal linje: `border-l-2` med `relative` positioning
- Tid-noder: `absolute` positioned circles på linjen
- Event-kort: kompakte kort med tid, tittel, venue, kategori-badge, pris
- Klikk på kort → setter `activePOI` → kart flyr til venue
- Tom-tilstand: "Ingen events matcher dine valg. Prøv å endre filtrene."

---

### Steg 7: Kart-highlight for anbefalte events

**I Explorer-kartet:** Visuelt skille mellom anbefalte og ikke-anbefalte markører.

- **Anbefalte:** Standard markør med glow/ring (`box-shadow: 0 0 0 3px rgba(59,130,246,0.5)`)
- **Ikke-anbefalte:** Dimmet markør (opacity 0.4) — kun synlig når "Alle events"-tab er aktiv
- Når "Kompass"-tab er aktiv: kun anbefalte markører synlige på kart
- Når "Alle events"-tab er aktiv: alle markører, anbefalte med glow

**Integrasjon:** Prop `highlightedPoiIds: string[]` sendes til kart-komponenten.

---

### Steg 8: Integrasjon i ExplorerPage

**Koble alt sammen i ExplorerPage.tsx:**

1. Importer `useKompassStore` og `useKompassFilter`
2. Hent Kompass-state (themes, day, timeOfDay, activeTab)
3. Kjør `useKompassFilter(pois, themes, day, timeOfDay)` → `{ recommended, all }`
4. Vis `KompassBottomSheet` hvis `!hasCompletedFlow && features.kompass`
5. Vis `KompassTabs` i sidebar
6. Betinget render: `activeTab === "kompass"` → `KompassTimeline` med recommended, ellers vanlig POI-liste
7. Send `highlightedPoiIds` til kart

**Feature-flagg:** Legg til `kompass?: boolean` i `BransjeprofilFeatures`, aktiver for "Event"-profilen.

---

## Filstruktur (nye filer)

```
scripts/
  import-olavsfest.ts                    # Steg 1: Importer

lib/
  stores/kompass-store.ts                # Steg 2: Zustand store
  hooks/useKompassFilter.ts             # Steg 3: Filtreringshook

components/variants/explorer/
  KompassBottomSheet.tsx                 # Steg 4: Bottom sheet
  KompassTabs.tsx                        # Steg 5: Tab-komponent
  KompassTimeline.tsx                    # Steg 6: Tidslinje
```

**Endringer i eksisterende filer:**
- `lib/themes/bransjeprofiler.ts` — legg til `kompass?: boolean` i features
- `components/variants/explorer/ExplorerPage.tsx` — integrer Kompass
- `components/variants/explorer/ExplorerPOIList.tsx` — tabs + tidslinje

---

## Rekkefølge og avhengigheter

```
Steg 1 (import) → kan kjøres uavhengig
Steg 2 (store) → ingen avhengigheter
Steg 3 (hook) → avhenger av steg 2 (leser state)
Steg 4 (bottom sheet) → avhenger av steg 2 (skriver state)
Steg 5 (tabs) → avhenger av steg 2 (leser state)
Steg 6 (tidslinje) → avhenger av steg 3 (leser filtrerte POIs)
Steg 7 (kart-highlight) → avhenger av steg 3
Steg 8 (integrasjon) → avhenger av alt over
```

**Parallellisering:** Steg 1 kan kjøres parallelt med steg 2-4. Steg 5-6 kan bygges parallelt.

---

## Risikoer

| Risiko | Sannsynlighet | Mitigering |
|--------|--------------|------------|
| Olavsfest HTML-struktur endres | Lav | Bruker 2025-program som er arkivert |
| Venue-koordinater unøyaktige | Medium | Hardkode alle venues, verifiser på kart |
| Bottom sheet blokkerer kartet | Lav | Kart synlig bak, skip-CTA alltid tilgjengelig |
| For få events matcher filter | Medium | "Hele dagen" og "Hele festivalen" som defaults |
| Performance med 222 POIs | Lav | Allerede håndtert av Explorer (Arendalsuka har 134) |
