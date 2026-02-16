# Plan: Migrate photo operations to Places API (New)

**Dato:** 2026-02-16
**Mål:** Eliminere importkostnad for bilder — Place Details Essentials (IDs Only) med photos = $0/ubegrenset

## Bakgrunn

Legacy API koster $17/1K (Place Details) + $7/1K (Place Photo) for bilde-operasjoner.
Places API (New) med `photos` field mask = $0 (Essentials IDs Only).
`skipHttpRedirect=true` returnerer `photoUri` direkte — ingen 302 redirect-hack.

## API-endringer

### Operation A: Hente foto-referanser for et sted
**Legacy:**
```
GET maps.googleapis.com/maps/api/place/details/json?place_id=X&fields=photos&key=KEY
→ { result: { photos: [{ photo_reference: "REF" }] } }
```
**New:**
```
GET places.googleapis.com/v1/places/X
Headers: X-Goog-Api-Key: KEY, X-Goog-FieldMask: photos
→ { photos: [{ name: "places/X/photos/REF" }] }
```

### Operation B: Resolve foto til CDN-URL
**Legacy:**
```
GET maps.googleapis.com/maps/api/place/photo?photo_reference=REF&maxwidth=800&key=KEY
→ 302 redirect til lh3.googleusercontent.com
```
**New:**
```
GET places.googleapis.com/v1/places/X/photos/REF/media?maxWidthPx=800&skipHttpRedirect=true&key=KEY
→ { photoUri: "https://lh3.googleusercontent.com/..." }
```

## Steg

### Steg 1: Opprett delt helper-modul
- [ ] Opprett `lib/google-places/photo-api.ts`
- [ ] `fetchPhotoNames(placeId, apiKey)` — henter foto-navn via New API
- [ ] `resolvePhotoUri(photoName, apiKey, maxWidthPx)` — resolver til CDN-URL via New API

### Steg 2: Oppdater import-pipeline
- [ ] `lib/utils/fetch-poi-photos.ts` — bruk `fetchPhotoNames` + `resolvePhotoUri`
- [ ] Lagre foto `name` (nytt format) i `photo_reference`-kolonnen
- [ ] Fjern proxy-URL fallback (`/api/places/photo?photoReference=...`)

### Steg 3: Oppdater batch-scripts
- [ ] `scripts/backfill-gallery-images.ts` — bruk `fetchPhotoNames` + `resolvePhotoUri`
- [ ] `scripts/resolve-photo-urls.ts` — for POIs med legacy proxy-URLer: re-hent via `fetchPhotoNames` + resolve
- [ ] `scripts/refresh-photo-urls.ts` — detect format: `places/` prefix → New API, ellers re-hent via google_place_id

### Steg 4: Oppdater ISR-utility
- [ ] `lib/resolve-photo-url.ts` — oppdater `resolveGooglePhotoUrl` til New API
- [ ] Trenger nå `photoName` (ikke `photoReference`) som input — men eksisterende ISR-sider sender `photo_reference` fra DB, som kan være begge formater

### Steg 5: Rydde opp
- [ ] `app/api/places/photo/route.ts` — slett (dead code, proxy trengs ikke)
- [ ] Fjern proxy-URL fallback fra `fetch-poi-photos.ts`

### Ut av scope (bevisst)
- `lib/google-places/fetch-place-details.ts` — mixed fields (rating, website, hours), ikke ren foto. Migrere senere.
- `scripts/refresh-opening-hours.ts` — opening_hours er ikke Essentials tier, migrering sparer ikke penger
- `app/api/places/route.ts` — general proxy, mixed fields

## Format-kompatibilitet

`photo_reference`-kolonnen lagrer nå to formater:
- **Legacy:** opak streng (eksisterende data)
- **New:** `places/{placeId}/photos/{ref}` (nye imports)

Refresh-scriptet håndterer begge: detecter prefix `places/`, velg riktig API.
Over tid migrerer all data til nytt format via refresh-sykluser.

## Ingen DB-migrasjoner

Ingen nye kolonner. `photo_reference` gjenbrukes med nytt format.
