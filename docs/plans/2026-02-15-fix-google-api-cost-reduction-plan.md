# Plan: Kutt Google Maps Platform-forbruk

**Dato:** 2026-02-15
**Brainstorm:** `docs/brainstorms/2026-02-15-google-api-cost-reduction-brainstorm.md`
**Branch:** `fix/google-api-cost-reduction`
**Tech Audit:** YELLOW → mitigert (R1-R4 fikset, R5-R8 inkludert)

---

## Mål

Reduser Google Maps Platform-forbruk fra ~340 NOK/halvmåned til < 10 NOK/mnd ved å eliminere runtime Google API-kall for bildevisning og åpningstider.

---

## Steg 1: Batch-script — resolve alle proxy-URLer til CDN-URLer

**Ny fil:** `scripts/resolve-photo-urls.ts`

Script som:
1. Henter alle POI-er fra Supabase der `featured_image LIKE '/api/places/photo%'` ELLER `photo_reference IS NOT NULL AND featured_image IS NULL`
2. Extracter `photoReference` fra URL-strengen (regex) eller bruker `photo_reference`-kolonnen direkte
3. Kaller Google Places Photo API med `redirect: "manual"` for å få 302 → `lh3.googleusercontent.com`-URL
4. Oppdaterer `featured_image` med direkte CDN-URL i Supabase
5. Logger progress, skiller mellom "resolved OK", "expired reference (HTTP 400/404)", og "network error (retry later)"

**Batching:** 5 parallelle, 300ms delay mellom batches.

**Kjøres:** Manuelt. Idempotent — skipper POI-er som allerede har `lh3.googleusercontent.com`-URL.

```bash
npx tsx scripts/resolve-photo-urls.ts
```

- [ ] Script skrevet og testet
- [ ] Kjørt mot produksjon
- [ ] Verifisert at featured_image nå inneholder `lh3.googleusercontent.com`-URLer

---

## Steg 2: Oppdater fetchAndCachePOIPhotos til å lagre CDN-URLer

**Endring i:** `lib/utils/fetch-poi-photos.ts`

Endre linje 106 fra:
```typescript
const featuredImage = `/api/places/photo?photoReference=${photoRef}&maxWidth=800`;
```
til å bruke `resolveGooglePhotoUrl()` for å resolve direkte CDN-URL. Fallback til proxy-URL hvis resolve feiler.

- [ ] Import `resolveGooglePhotoUrl` fra `lib/resolve-photo-url.ts`
- [ ] Resolve CDN-URL, fallback til proxy-URL
- [ ] Fremtidige imports lagrer CDN-URLer direkte

---

## Steg 3: Cache åpningstider og telefon i Supabase

### 3a: DB-migrasjon

**Ny fil:** `supabase/migrations/032_opening_hours_phone_cache.sql`

```sql
ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS opening_hours_json JSONB,
  ADD COLUMN IF NOT EXISTS google_phone TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN pois.opening_hours_json IS 'Cached Google opening hours: {"weekday_text": [...]}';
COMMENT ON COLUMN pois.google_phone IS 'Cached phone number from Google Places';
```

**JSONB-format:** `{"weekday_text": ["Monday: 8:00 AM – 5:00 PM", ...]}`
**NB:** `open_now` lagres IKKE — beregnes client-side fra `weekday_text` for å unngå stale data.

### 3b: Batch-script for å hente åpningstider + telefon

**Ny fil:** `scripts/refresh-opening-hours.ts`

Script som:
1. Henter alle POI-er med `google_place_id IS NOT NULL`
2. Kaller Google Places Details med `opening_hours,formatted_phone_number` (Basic + Contact)
3. Lagrer `weekday_text` i `opening_hours_json`, telefon i `google_phone`, timestamp i `opening_hours_updated_at`
4. Batched: 5 parallelle, 300ms delay

```bash
npx tsx scripts/refresh-opening-hours.ts
```

### 3c: Utvid POI-typen og data-loading

**Endring i:** `lib/types.ts`
- Legg til `openingHoursJson?: { weekday_text?: string[] }` på POI-interface
- Legg til `googlePhone?: string` på POI-interface

**Endring i:** `lib/public-queries.ts` (transformPublicPOI)
- Map `opening_hours_json` → `openingHoursJson`
- Map `google_phone` → `googlePhone`

### 3d: Refaktorer useOpeningHours til å lese fra POI-data

**Endring i:** `lib/hooks/useOpeningHours.ts`

Fjern Google Places API-kall helt. Hook-en leser nå `openingHoursJson` direkte fra POI-objektet. Behold `OpeningHoursData` type-export (brukes av 5+ komponenter).

Ny signatur: `useOpeningHours(pois: POI[])` → returnerer `Map<string, OpeningHoursData>` basert på cached data.

**Beregn `isOpen` client-side:** Parse `weekday_text` for dagens dag, sammenlign med nåtid. Gir realtime open/closed uten API-kall.

**Consumers som må oppdateres:**
- `components/variants/explorer/ExplorerPage.tsx` (linje 227) — allerede kaller hooken, fungerer etter refaktor
- `components/variants/trip/TripPage.tsx` (linje 73) — allerede kaller hooken, fungerer etter refaktor

### 3e: Endre MapPopupCard til å lese cached data

**Endring i:** `components/variants/report/MapPopupCard.tsx`

Fjern `fetch(/api/places/${poi.googlePlaceId})` for åpningstider. Les fra `poi.openingHoursJson` i stedet. Beregn `isOpen` fra `weekday_text` client-side.

### 3f: Endre poi-card-expanded til å bruke cached data

**Endring i:** `components/poi/poi-card-expanded.tsx`

Fjern `fetch(/api/places/${poi.googlePlaceId})` for website/phone. Bruk:
- `poi.googleWebsite` (allerede i POI-typen, linje 55)
- `poi.googlePhone` (ny, fra steg 3a/3c)

- [ ] Migrasjon 032 skrevet og kjørt
- [ ] Script `refresh-opening-hours.ts` skrevet og testet
- [ ] POI-type utvidet med `openingHoursJson` og `googlePhone`
- [ ] `transformPublicPOI` i `public-queries.ts` oppdatert
- [ ] `useOpeningHours` refaktorert (les fra POI, beregn isOpen client-side)
- [ ] `MapPopupCard` bruker cached data
- [ ] `poi-card-expanded` bruker `poi.googleWebsite` og `poi.googlePhone`
- [ ] Kjørt script mot produksjon

---

## Steg 4: Forenkle ISR-resolve i category page

**Endring i:** `app/(public)/[area]/[category]/page.tsx`

Fjern `resolveGooglePhotoUrl`-kallet for de 2 første bildene (linje 121-133). Etter steg 1 er `featuredImage` allerede en CDN-URL.

Fjern import av `resolveGooglePhotoUrl`.

- [ ] Fjern resolve-logikk fra category page
- [ ] Verifiser at bilder fortsatt vises korrekt

---

## Steg 5: Typecheck, test, verifiser

- [ ] `npx tsc --noEmit` — null feil
- [ ] `npx vitest run` — alle tester passerer
- [ ] Manuell sjekk: Explorer-kort viser bilder (CDN-URLer)
- [ ] Manuell sjekk: MapPopupCard viser åpningstider (fra cache)
- [ ] Manuell sjekk: poi-card-expanded viser website og telefon (fra cache)
- [ ] Manuell sjekk: Offentlige sider viser bilder

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `scripts/resolve-photo-urls.ts` | **NY** — batch-resolve proxy→CDN |
| `scripts/refresh-opening-hours.ts` | **NY** — batch-hent åpningstider+telefon til Supabase |
| `supabase/migrations/032_opening_hours_phone_cache.sql` | **NY** — opening_hours_json + google_phone kolonner |
| `lib/utils/fetch-poi-photos.ts` | Lagre CDN-URL i stedet for proxy-URL |
| `lib/types.ts` | Legg til `openingHoursJson` og `googlePhone` på POI |
| `lib/public-queries.ts` | Map nye kolonner i `transformPublicPOI` |
| `lib/hooks/useOpeningHours.ts` | Les fra POI-data, beregn isOpen client-side |
| `components/variants/report/MapPopupCard.tsx` | Fjern runtime Google API-kall |
| `components/poi/poi-card-expanded.tsx` | Bruk `poi.googleWebsite` + `poi.googlePhone` |
| `app/(public)/[area]/[category]/page.tsx` | Fjern ISR-resolve |

---

## Ut av scope (cleanup-pass senere)

- Fjerne `/api/places`-endpointene helt
- Fjerne `photoReference` fallback-chains i 8 komponenter + 9 public page-filer (dead code etter steg 1)
- Oppdatere `fetchPlaceDetails` i `lib/google-places/fetch-place-details.ts` til CDN-URLer
- Migrasjon til Places API (New)
- Automatisk cron-jobb for åpningstider

---

## Forventet resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| Places API-kall/mnd | ~15 000 | ~50-100 (kun nye imports + månedlig refresh) |
| Forbruk/mnd | ~680 NOK | < 10 NOK |
| Bildelading | 3 hopp (proxy) | 1 hopp (CDN direkte) |
| Åpningstider | Runtime per viewport | Cached i DB, isOpen beregnet client-side |
| Telefon/website | Runtime per klikk | Cached i DB |
