---
title: "feat: Google-identisk stjerne-rating i Explorer"
type: feat
date: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-explorer-google-rating-display-brainstorm.md
---

# feat: Google-identisk stjerne-rating i Explorer

## Oversikt

Vis Google-rating med gjenkjennbar 5-stjerne visuell (★★★★☆ 4.5 (72)) i Explorer — i kompakt kort, utvidet kort, markør hover-tooltip, og mobil bottom sheet. Kun for kategorier der Google har meningsfull data.

## Motivasjon

- Nåværende visning (én gul stjerne + tall) mangler tyngde og gjenkjennbarhet
- Google-stil 5-stjerne er universelt forstått og bygger tillit
- Review-antall gir kontekst (4.5 med 200 reviews > 4.9 med 3 reviews)
- Placy som innsiktskilde bør presentere data med troverdighet

## Løsning

### 1. Delt `<GoogleRating>` komponent

Ny komponent i `components/ui/GoogleRating.tsx` med varianter:

```tsx
// Bruk i kort:
<GoogleRating rating={4.5} reviewCount={72} size="sm" />
// Renders: ★★★★☆ 4.5 (72)

// Bruk i tooltip (mørk bakgrunn):
<GoogleRating rating={4.5} reviewCount={72} size="xs" variant="dark" />
// Renders: ★ 4.5 (72) — kompakt, én stjerne

// Bruk i utvidet kort:
<GoogleRating rating={4.5} reviewCount={72} size="md" showLabel />
// Renders: ★★★★☆ 4.5 (72 anmeldelser)
```

**Props:**
- `rating: number` — Google-rating (1.0–5.0)
- `reviewCount?: number` — antall anmeldelser
- `size: "xs" | "sm" | "md"` — stjerrestørrelse (10px / 12px / 16px)
- `variant?: "light" | "dark"` — bakgrunnsfarge-kontekst
- `showLabel?: boolean` — vis "anmeldelser" etter tall
- `className?: string`

**Stjerne-rendering:**
- **Farger:** Google-gul `#FBBC04` (fylt), `#dadce0` (tom). Dark-variant: `#FBBC04` (fylt), `rgba(255,255,255,0.2)` (tom)
- **Half-star terskel:** `< x.25` = tom, `≥ x.25 og < x.75` = halv, `≥ x.75` = fylt
- **Rendering:** CSS `clip-path` på en fylt bar for halv-stjerner — unngår 5 separate SVG-er per kort (ytelse med 30+ kort)
- **Tilgjengelighet:** `aria-label="4.5 av 5 stjerner, 72 anmeldelser"` + `role="img"`

### 2. Kategori-basert synlighet

Ny konstant `CATEGORIES_WITH_RATING` i `lib/themes/rating-categories.ts`:

```typescript
/** Kategorier der Google-rating vises i UI */
export const CATEGORIES_WITH_RATING = new Set([
  // Mat & Drikke
  "restaurant", "cafe", "bar", "bakery",
  // Kultur & Opplevelser
  "museum", "cinema", "library",
  // Hverdagsbehov
  "supermarket", "pharmacy", "shopping", "haircare",
  // Trening & Velvære
  "gym", "spa", "swimming",
]);

export function shouldShowRating(categoryId: string): boolean {
  return CATEGORIES_WITH_RATING.has(categoryId);
}
```

**Ikke viser rating for:**
- Transport: `bus`, `train`, `tram`, `bike`, `parking`, `carshare`, `taxi`, `airport`, `ferry`
- Natur: `park`, `outdoor`
- Helse: `hospital`, `doctor`, `dentist` (ujevn datakvalitet)
- Tjenester: `bank`, `post_office`, `convenience` (lite relevant)

**Ukjente/egendefinerte kategorier:** Default skjult. Kan utvides per prosjekt senere.

### 3. Endringer per flate

#### a) Kompakt kort (`ExplorerPOICard.tsx`, linje ~179-186)

**Før:** `★ 4.5` (én Lucide-stjerne, ingen review count)
**Etter:** `★★★★☆ 4.5 (72)` med `<GoogleRating size="sm" />`

```tsx
// Erstatter nåværende:
{poi.googleRating && (
  <span className="flex items-center gap-0.5 text-xs text-gray-500">
    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
    {poi.googleRating.toFixed(1)}
  </span>
)}

// Med:
{shouldShowRating(poi.category.id) && poi.googleRating != null && (
  <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="sm" />
)}
```

Samme endring i utvidet tilstand (~linje 292-300).

#### b) Markør hover-tooltip (`ExplorerMap.tsx`, linje ~370)

Kompakt visning i mørk tooltip — **kun tall, ikke 5 stjerner** (plassbegrensning):

```tsx
// Legger til etter category.name:
{shouldShowRating(poi.category.id) && poi.googleRating != null && (
  <>
    <span className="text-gray-500">·</span>
    <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="xs" variant="dark" />
  </>
)}
```

`xs` + `dark` variant viser: `★ 4.5 (72)` (én fylt stjerne + tall) — passer i tooltip-bredden.

#### c) Aktiv markør info-pill (`ExplorerMap.tsx`, linje ~388)

**Ingen endring.** Info-pill er allerede bred med navn + travel time + "Rute"-knapp. Rating-info er tilgjengelig i sidebar-kortet som åpnes samtidig.

#### d) Mobil bottom sheet (`poi-bottom-sheet.tsx`)

Erstatt nåværende Unicode-stjerne med `<GoogleRating size="sm" />`, samme mønster som kompakt kort.

### 4. Null-håndtering

- `googleRating == null || googleRating === undefined` → vis ingenting
- `googleRating === 0` → vis ingenting (Google returnerer aldri 0, men defensivt)
- `googleReviewCount == null` → vis rating uten `(N)` parentes
- `googleReviewCount === 0` → vis rating uten `(N)` parentes

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/ui/GoogleRating.tsx` | **NY** — delt komponent |
| `lib/themes/rating-categories.ts` | **NY** — allow-list + helper |
| `components/variants/explorer/ExplorerPOICard.tsx` | Erstatt ★-visning (2 steder) |
| `components/variants/explorer/ExplorerMap.tsx` | Legg til rating i hover-tooltip |
| `components/poi/poi-bottom-sheet.tsx` | Erstatt ★-visning |

**Ikke endres (utenfor scope):**
- Report-kort (`ReportHighlightCard.tsx`, `ReportCompactList.tsx`) — eget produkt, egen stil
- 3D-kart (`poi-marker-3d.tsx`) — ingen hover-tooltip i dag, eget prosjekt
- POI-scoring (`poi-score.ts`) — display-endring påvirker ikke scoring
- Legacy `poi-card.tsx` / `poi-card-expanded.tsx` — brukes av Report, ikke Explorer

## Akseptansekriterier

- [x] `<GoogleRating>` komponent i `components/ui/GoogleRating.tsx`
  - [x] 5-stjerne visuell med fylt/halv/tom (linearGradient)
  - [x] Google-farger: `#FBBC04` fylt, `#dadce0` tom
  - [x] Props: `rating`, `reviewCount`, `size`, `variant`, `showLabel`
  - [x] `aria-label` med rating og review count
  - [x] `xs` variant: kompakt (★ 4.5 (72)) for tooltip
  - [x] `sm` variant: full 5-stjerne for kort
  - [x] `dark` variant: tilpasset farger for mørk bakgrunn
- [x] `CATEGORIES_WITH_RATING` set + `shouldShowRating()` i `lib/themes/rating-categories.ts`
- [x] Kompakt kort viser ★★★★☆ 4.5 (72) for relevante kategorier
- [x] Utvidet kort viser ★★★★☆ 4.5 (72 anmeldelser)
- [x] Hover-tooltip viser ★ 4.5 (72) kompakt
- [x] Transport-kategorier viser INGEN rating
- [x] POI uten rating-data viser ingenting (ikke grå stjerner)
- [x] Mobil bottom sheet oppdatert
- [x] Review count vises kun når `> 0`

## Referanser

- Brainstorm: `docs/brainstorms/2026-02-08-explorer-google-rating-display-brainstorm.md`
- Nåværende rating-kode: `ExplorerPOICard.tsx:179-186` (kompakt), `ExplorerPOICard.tsx:292-300` (utvidet)
- Hover tooltip: `ExplorerMap.tsx:366-385`
- POI-type: `lib/types.ts:36-41` (`googleRating?: number`, `googleReviewCount?: number`)
- Google Places API: `app/api/places/[placeId]/route.ts:76-84` (returnerer `rating` + `user_ratings_total`)
- Tema-kategorier: `lib/themes/default-themes.ts:10-67`
- Scoring (uendret): `lib/utils/poi-score.ts`
- Kompakt kort-mønster: `docs/solutions/ux-improvements/explorer-sidebar-compact-redesign-20260207.md`
