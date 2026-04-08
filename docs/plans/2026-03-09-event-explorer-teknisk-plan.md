# Event Explorer — Teknisk Plan

**Dato:** 2026-03-09
**Status:** Tech audit YELLOW — klar for implementering
**Avhenger av:** Forretningsplan (`2026-03-09-event-explorer-forretningsplan.md`)
**Tech audit:** 2026-03-09 — 4 agenter, alle findings mitigert

## Produktposisjon: Navigasjonslag, ikke innholdsplattform

**Kritisk avklaring:** Event Explorer er et **navigasjonslag** — ikke en erstatning for arrangørens nettside.

De fleste arrangementer har allerede innholdssider per event (beskrivelse, bilder, fasiliteter, kollektivinfo). Oslo Kulturnatt har f.eks. fullverdige sider per arrangement. Det de mangler er **navigasjon mellom** events — "hvor er ting, hva er nærmest meg, hva rekker jeg".

```
Arrangør (eier innhold)              Placy Event Explorer (eier navigasjon)
┌─────────────────────────┐          ┌──────────────────────────┐
│ Eventnavn               │    ←──   │ POI-markør på kart       │
│ Beskrivelse             │   link   │ "450m · 6 min gange"     │
│ Bilder                  │          │ "Åpent 18:00-22:00"      │
│ Fasiliteter             │          │ Tema: Håndverk           │
│ Kollektivinfo           │          │ [Åpne på kulturnatt.no →]│
│ Kart (deres eget)       │          │ [Lagre i min agenda]     │
│ Skriv ut                │          └──────────────────────────┘
└─────────────────────────┘
```

**Implikasjoner:**
- Hvert POI har `eventUrl` som lenker til arrangørens eksisterende side
- Placy trenger minimalt med innhold per POI: navn, koordinat, kategori, dag(er), tidspunkt, URL
- Null innholdsproduksjon — arrangøren har det allerede
- Raskere onboarding — importer navn + koordinat + URL, ferdig
- Ikke truende for arrangøren — "vi supplerer nettsiden, erstatter den ikke"
- Lavere pris å forsvare — det er et tilleggsverktøy

## Arkitektur-beslutninger (post tech audit)

### 1. Ruting: Bransjeprofil, ikke ny rute-tre

**Beslutning:** IKKE lag `/for/events/[customer]/[project]`. Bruk eksisterende `/for/[customer]/[project]/explore` med bransjeprofil-drevet feature-aktivering.

**Begrunnelse:** `events` kolliderer med `[customer]`-segmentet og krever parallelt layout-tre med dobbelt vedlikehold.

**Vanity-URL:** For `placy.no/events/kulturnatt` — bruk Next.js middleware rewrite:
```typescript
// middleware.ts: /events/foo/bar → /for/foo/bar/explore
```

### 2. Utvidelse av eksisterende Explorer

Gjenbruk `ExplorerPage.tsx` med feature flags basert på bransjeprofil-tag. Ekstraher event-logikk til hooks for å holde ExplorerPage under kontroll.

```typescript
// Feature detection i ExplorerPage
const isEventProject = projectTags?.some(t => t.startsWith("Event"));
const showDayFilter = isEventProject && eventDays.length > 1;
```

**Kompleksitetshåndtering:** ExplorerPage er 711 linjer. Event-logikk ekstraheres til:
- `useEventDayFilter(pois, selectedDate)` hook — ren filtreringslogikk
- `ExplorerDayFilter.tsx` — dag-velger UI
- Netto tillegg i ExplorerPage: ~30 linjer (state + hook-kall + conditional render)

### 3. Filter-state eies av ExplorerPage

Følger eksisterende mønster: `disabledCategories` er `useState` i ExplorerPage, ikke i child-komponenter eller Zustand. Dag-filter = ny uavhengig state-set + `useMemo`-derivasjon.

```typescript
const [selectedDay, setSelectedDay] = useState<string | null>(null);
```

### 4. eventConfig på Product, ikke Project

`eventConfig` legges i `ProductInstance.config` JSONB — ikke på Project. Følger eksisterende hierarki der product-spesifikk konfig lever på produktet.

## Datamodell

### Nye felter på POI (flate kolonner)

```typescript
interface POI {
  // ... eksisterende felter ...

  // Event-spesifikke felter
  eventDates?: string[];       // ["2026-04-18", "2026-04-19"] — hvilke dager
  eventTimeStart?: string;     // "10:00" — åpningstid under arrangementet
  eventTimeEnd?: string;       // "16:00" — stengetid
  eventDescription?: string;   // Kort beskrivelse spesifikt for arrangementet
  eventUrl?: string;           // Lenke til arrangørens side for dette stedet
  eventTags?: string[];        // ["Gratis", "Barnevennlig", "Guidet tur"]
}
```

**Merk:** Kun `eventDates[]` (array), IKKE `eventDate` (string). Single-day = array med ett element. Eliminerer branching overalt.

### Database-migrasjon

```sql
-- 045_add_event_fields.sql
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_dates TEXT[];
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_time_start TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_time_end TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_description TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_url TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS event_tags TEXT[];
```

### eventConfig i ProductInstance.config

```typescript
// Lagres i products.config JSONB
interface EventConfig {
  eventName: string;                     // "Open House Oslo 2026"
  eventDates: string[];                  // ["2026-09-20", "2026-09-21"]
  dayLabels?: Record<string, string>;    // {"2026-09-20": "Lørdag", "2026-09-21": "Søndag"}
  eventUrlLabel?: string;                // "kulturnatt.no" — visningsnavn for lenker
  enableAgenda: boolean;
  enableDayFilter: boolean;
}
```

## Feature-plan

### 1. Bransjeprofil: Event (Prioritet: Høy)

Utvid `Bransjeprofil`-interfacet med optional `features`:

```typescript
export interface BransjeprofilFeatures {
  dayFilter?: boolean;
  agendaView?: boolean;
  eventUrl?: boolean;
}

export interface Bransjeprofil {
  // ... eksisterende felter ...
  features?: BransjeprofilFeatures;  // NY, optional
}
```

Event-profilen bruker **auto-theme fallback** (Kulturnatt-mønsteret): import-kategoriene BLir temaer. Profilen har minimal/tom themes-array, høy total cap.

```typescript
const eventProfil: Bransjeprofil = {
  tag: "Event",
  themes: [],  // Auto-generert fra import-kategorier
  defaults: { radius: 5000, minRating: 0, venueType: "commercial" },
  explorerCaps: {},           // Ingen per-tema caps
  explorerTotalCap: 999,      // Events er kuratert, ikke scraped
  features: { dayFilter: true, agendaView: true, eventUrl: true },
};
```

**Filer:** `lib/themes/bransjeprofiler.ts`

### 2. Dagsfilter (Prioritet: Høy)

**Plassering:** Mellom header og tema-chips, som horisontal scrollbar.

```
[Alle dager] [Lørdag 18. apr] [Søndag 19. apr]
```

**Logikk:**
- Default: "Alle dager" = union (vis alt). Hvis dagens dato matcher en eventdato, auto-select den.
- Valgt dag: Filtrer POIs basert på `eventDates`-array
- POIs UTEN `eventDates` vises på alle dager (inklusiv — antar permanent venue)
- Kombineres med kategorifilter (AND-logikk)
- Tom tilstand (dag + kategori = 0): Spesifikk melding "Ingen [kategori] arrangementer på [dag]. Vis alle?"

**Mobil peek-oppførsel:** Dag-filter vises KUN ved half/full snap. Ved peek: vis aktiv dag i header-teksten ("Lørdag 18. apr").

**Pipeline-plassering:** Mellom `basePOIs` og `poisWithTravelTimes`:
```
project.pois → basePOIs → eventFilteredPOIs (NEW) → poisWithTravelTimes → filteredPOIs → visiblePOIs
```

**Implementasjon:**
- Ny hook: `useEventDayFilter(pois, selectedDate)` i `lib/hooks/`
- Ny komponent: `ExplorerDayFilter.tsx`
- State i ExplorerPage: `selectedDay: string | null`

**Events som krysser midnatt:** Dato = startdatoen. Filter viser events der `eventTimeEnd > nå` for forrige dag (Kulturnatt 18:00-02:00 case).

**Filer:** `ExplorerPage.tsx`, ny `ExplorerDayFilter.tsx`, ny `lib/hooks/useEventDayFilter.ts`

### 3. Event-tider på POI-kort (Prioritet: Høy)

**Event-tider overstyr Google opening hours** for event-prosjekter (`isEventProject === true`). Skjul Google `openingHoursJson` helt.

**Visningsformat:** "kl 10:00–16:00" (24-timer, norsk konvensjon)
- Bare startid: "Fra kl 18:00"
- Mangler tid: Ikke vis tidsrad

**eventUrl-lenke:** `target="_blank" rel="noopener noreferrer"`. Lenketekst: `eventConfig.eventUrlLabel` eller auto-extract domene fra URL (strip "www."). Valider med `isSafeUrl()` før rendering.

**Filer:** `ExplorerPOICard.tsx`

### 4. Kulturnatt data-migrasjon (Prioritet: Høy)

Eksisterende Kulturnatt-data lagrer tid i `poi_metadata.time` (f.eks. "15:00-01:00"). Migrér til nye felt:

```sql
-- Del av 045_add_event_fields.sql
UPDATE pois SET
  event_time_start = split_part(poi_metadata->>'time', '-', 1),
  event_time_end = split_part(poi_metadata->>'time', '-', 2),
  event_dates = ARRAY['2025-09-12']  -- Kulturnatt 2025 dato
WHERE id LIKE 'kn-%' AND poi_metadata->>'time' IS NOT NULL;
```

### 5. Import-pipeline (Prioritet: Medium)

Basert på `scripts/import-kulturnatt.ts`-mønsteret:
1. Parse CSV med kolonner: navn, adresse, kategori, dag(er), åpningstid, beskrivelse, URL
2. Geokode adresser (Mapbox Geocoding API)
3. Upsert: customer → categories → POIs (batch 100) → project → product → links
4. Validering: warn on missing `eventTimeStart`, error on invalid dates, validate URLs med `isSafeUrl()`
5. Rapport: "132 imported, 8 skipped: 3 no coords, 2 invalid date"
6. Støtt `--dry-run`
7. Kall `revalidateTag("supabase-public")` etter import

**Filer:** Ny `scripts/import-event-csv.ts`

## Edge cases (fra spec-flow-analyse)

| Case | Håndtering |
|------|-----------|
| POI uten eventDates | Vis på alle dager (permanent venue) |
| Dag + kategori = 0 treff | Spesifikk tom-state med reset-knapp |
| Events som krysser midnatt | Vis under startdatoen |
| eventTimeStart uten End | Vis "Fra kl 18:00" |
| Event-tider vs Google hours | Event-tider overstyr for event-prosjekter |
| eventUrl mangler | Skjul lenke, vis kun Placy-innhold + "Vis rute" |
| Duplikat-koordinater | Mapbox clustering håndterer det |
| Før arrangementet | Vis POIs med "Starter [dato]"-badge |
| Etter arrangementet | Vis POIs med banner "Arrangementet er over" |
| Auto-select dagens dato | Ja, hvis dagens dato matcher en eventdato |

## Implementeringsrekkefølge

```
Fase 1 — MVP for demo (denne sesjonen)
├── 1. Database-migrasjon (event-felter på pois)
├── 2. Type-utvidelser (POI, Bransjeprofil, EventConfig)
├── 3. Bransjeprofil "Event" + features-objekt
├── 4. useEventDayFilter hook
├── 5. ExplorerDayFilter.tsx komponent
├── 6. ExplorerPage integration (state + filter pipeline + conditional render)
├── 7. Event-tid badge på ExplorerPOICard
├── 8. eventUrl-lenke på ExplorerPOICard
├── 9. Kulturnatt data-migrasjon (poi_metadata → nye felter)
└── 10. Test med Kulturnatt-data (verifiser dagsfilter fungerer)

Fase 2 — Differensiator (neste sesjon)
├── 11. Agenda-visning
├── 12. Import-script for CSV
└── 13. Vanity-URL middleware rewrite

Fase 3 — Polish
├── 14. Før/etter-arrangement badges
├── 15. Auto-select dagens dato
├── 16. Ruteoptimering i agenda
└── 17. Deling: "Del min agenda" som lenke

Fase 4 — Skalering
├── 18. Selvbetjent onboarding
├── 19. placy.no/events landingsside
└── 20. Analytics per arrangement
```

## Akseptansekriterier (Fase 1)

- [x] Event-felter finnes i database (migrasjon kjørt)
- [x] Kulturnatt Explorer viser dagsfilter-chips
- [x] Klikk på dag filtrerer POI-listen og kartet
- [x] "Alle dager" viser alle POIs
- [x] POI-kort viser event-tid (kl HH:MM–HH:MM)
- [x] POI-kort viser eventUrl som ekstern lenke (target=_blank)
- [x] Eksisterende eiendom-Explorer er UENDRET (ingen regresjoner)
- [x] TypeScript kompilerer uten feil
- [x] ESLint passerer
- [x] Build passerer

## Nøkkelfiler

| Fil | Endring |
|-----|---------|
| `lib/types.ts` | Nye POI-felter |
| `lib/themes/bransjeprofiler.ts` | BransjeprofilFeatures interface + Event-profil |
| `lib/hooks/useEventDayFilter.ts` | NY — ren filtreringslogikk |
| `components/variants/explorer/ExplorerPage.tsx` | selectedDay state, hook-kall, conditional render (~30 linjer) |
| `components/variants/explorer/ExplorerDayFilter.tsx` | NY — dag-velger UI |
| `components/variants/explorer/ExplorerPOICard.tsx` | Event-tid badge, eventUrl-lenke |
| `components/variants/explorer/ExplorerPOIList.tsx` | Props for dag-filter |
| `components/variants/explorer/ExplorerPanel.tsx` | Props for dag-filter, peek-skjuling |
| `app/for/[customer]/[project]/explore/page.tsx` | Pass eventConfig til ExplorerPage |
| `supabase/migrations/045_add_event_fields.sql` | NY — database-migrasjon |
| `lib/data-server.ts` | Map nye kolonner til POI-type |
