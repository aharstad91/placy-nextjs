# Plan: Kutt Google Maps Platform-forbruk

**Dato:** 2026-02-15
**Deepened:** 2026-02-16 (6 research/review-agenter)
**Brainstorm:** `docs/brainstorms/2026-02-15-google-api-cost-reduction-brainstorm.md`
**Branch:** `fix/google-api-cost-reduction`
**Tech Audit:** YELLOW → mitigert (R1-R4 fikset, R5-R8 inkludert)

---

## Enhancement Summary

**Research-agenter brukt:** 4 (lh3 URL longevity, Google Maps pricing, Places API New, image storage)
**Review-agenter brukt:** 2 (performance-oracle, architecture-strategist)

### Kritiske funn som endrer planen

1. **lh3 CDN-URLer er IKKE permanente.** Google dokumenterer dem som "short-lived" (~60 min for Photos API). For Places API er de empirisk stabile i uker/måneder, men uten garanti. Planen trenger en refresh-mekanisme.
2. **$200/mnd-kreditten er borte (mars 2025).** Erstattet av per-SKU gratis-kvoter: 10K Essentials, 5K Pro, 1K Enterprise. Foto-kall har 1000 gratis/mnd.
3. **Places API (New): foto-kall er GRATIS.** Med ny API koster Place Details med kun `photos`-felt $0 (Essentials IDs Only tier). Legacy koster $17/1K uansett felt.
4. **Kopiere bilder til egen storage bryter Google TOS.** Section 10.5d: maks 30 dagers caching. `place_id` er eneste unntak (kan lagres permanent).
5. **OG-bilder bruker rå lh3-URLer.** Social media crawlere går ikke gjennom Next.js Image Optimizer, så utløpte URLer = broken OG-bilder.

### Nye tiltak inkludert i planen

- **Steg 0:** Sett budget alert i Google Cloud Console
- **Steg 1 utvidet:** Legg til `photo_resolved_at` kolonne for refresh-tracking
- **Steg 3a utvidet:** Inkluder `photo_resolved_at` i migrasjon
- **Steg 5 utvidet:** Reduser `minimumCacheTTL` fra 30d til 7d
- **Nytt steg 6:** Dokumenter refresh-schedule og opprett refresh-script for foto-URLer
- **Oppdatert "ut av scope":** Places API (New) migrasjon = neste prioritet (med begrunnelse)

---

## Mål

Reduser Google Maps Platform-forbruk fra ~496 NOK/halvmåned til < 10 NOK/mnd ved å eliminere runtime Google API-kall for bildevisning og åpningstider.

### Prisingsreferanse (mars 2025+)

| SKU | Pris per 1K kall | Gratis/mnd | Placy-bruk |
|-----|-------------------|------------|------------|
| Places Photo | $7.00 | 1 000 | Bilderesolving |
| Place Details (Essentials) | $5.00 | 10 000 | Bare photos-felt |
| Place Details (Pro) | $17.00 | 5 000 | businessStatus, displayName |
| Place Details (Enterprise) | $20.00 | 1 000 | rating, openingHours, phone, website |
| Place Details (Legacy) | $17.00 | — | Alle felt, flat pris |

**Nøkkelinnsikt:** Med Legacy API koster et Place Details-kall $17/1K uansett hvilke felt du ber om. Med ny API koster et kall med kun `photos`-felt $0 (Essentials IDs Only).

---

## Steg 0: Budget alert i Google Cloud Console

**Tid:** 5 minutter

1. Google Cloud Console → Billing → Budgets & alerts
2. Create Budget → Sett $10/mnd (~100 NOK)
3. Alert thresholds: 50%, 80%, 100%
4. Notification: e-post

**NB:** Budget alerts stopper IKKE forbruk. For hard cap: APIs & Services → Places API → Quotas → Sett daglig grense (f.eks. 100 kall/dag).

- [ ] Budget alert konfigurert
- [ ] Daglig kvote satt som sikkerhetsnett

---

## Steg 1: Batch-script — resolve alle proxy-URLer til CDN-URLer

**Ny fil:** `scripts/resolve-photo-urls.ts`

Script som:
1. Henter alle POI-er fra Supabase der `featured_image LIKE '/api/places/photo%'` ELLER `photo_reference IS NOT NULL AND featured_image IS NULL`
2. Extracter `photoReference` fra URL-strengen (regex) eller bruker `photo_reference`-kolonnen direkte
3. Kaller Google Places Photo API med `redirect: "manual"` for å få 302 → `lh3.googleusercontent.com`-URL
4. Oppdaterer `featured_image` med direkte CDN-URL i Supabase
5. **NY:** Setter `photo_resolved_at = NOW()` for å tracke freshness
6. Logger progress, skiller mellom "resolved OK", "expired reference (HTTP 400/404)", og "network error (retry later)"
7. **NY:** For expired references — sett `photo_reference = NULL` og `featured_image = NULL` (forhindrer at proxy-fallback aktiveres)

**Batching:** 5 parallelle, 300ms delay mellom batches.

**Kjøres:** Manuelt. Idempotent — skipper POI-er som allerede har `lh3.googleusercontent.com`-URL.

```bash
npx tsx scripts/resolve-photo-urls.ts
```

### Research Insights

**lh3 URL-levetid:**
- Google dokumenterer dem som "short-lived" (Places API) / "~60 min" (Photos API)
- I praksis for Places API: stabile i uker til måneder (empirisk, ingen garanti)
- `photo_reference` utløper også — Google roterer dem periodisk uten varsling
- Ved utløp: HTTP 400/404 fra Google, bildet vises ikke

**Forsvarslagene:**
```
Supabase (featured_image = lh3 URL, photo_resolved_at = timestamp)
  → ISR (revalidate = 86400 / 24h) — baker URL inn i HTML
    → Next.js Image Optimizer (minimumCacheTTL = 7d) — cacher optimaliserte bytes
      → Browser
```
Selv om lh3-URLen utløper, serverer Image Optimizer cached bytes i opptil 7 dager. Dette gir en buffer.

**Google TOS (Section 10.5d):**
- Maks 30 dagers caching av Places API-innhold
- `place_id` kan lagres permanent (eneste unntak)
- Å kopiere bilder til egen storage (Supabase Storage, R2) er et klart TOS-brudd
- Vår tilnærming (resolve URL, la Next.js Image cache bildebytene) er innenfor grensen

**Anti-pattern funnet i kodebasen:**
`resolvePhotoUrl`-logikk er duplisert i 4 filer: `lib/resolve-photo-url.ts`, `scripts/resolve-photo-urls.ts`, `scripts/backfill-gallery-images.ts`, og inline i `lib/utils/fetch-poi-photos.ts`. Scriptet bør importere fra `lib/resolve-photo-url.ts`.

- [ ] Script skrevet og testet
- [ ] Bruker importert `resolveGooglePhotoUrl` fra `lib/resolve-photo-url.ts` (ingen duplisering)
- [ ] Setter `photo_resolved_at` på resolved POI-er
- [ ] Nuller ut `photo_reference` for expired references
- [ ] Kjørt mot produksjon
- [ ] Verifisert at featured_image inneholder `lh3.googleusercontent.com`-URLer

---

## Steg 2: Oppdater fetchAndCachePOIPhotos til å lagre CDN-URLer

**Endring i:** `lib/utils/fetch-poi-photos.ts`

Endre linje 106 fra:
```typescript
const featuredImage = `/api/places/photo?photoReference=${photoRef}&maxWidth=800`;
```
til å bruke `resolveGooglePhotoUrl()` for å resolve direkte CDN-URL. Fallback til proxy-URL hvis resolve feiler.

**NY:** Sett også `photo_resolved_at = NOW()` i Supabase PATCH (linje 148).

- [ ] Import `resolveGooglePhotoUrl` fra `lib/resolve-photo-url.ts`
- [ ] Resolve CDN-URL, fallback til proxy-URL
- [ ] Sett `photo_resolved_at` ved resolve
- [ ] Fremtidige imports lagrer CDN-URLer direkte

---

## Steg 3: Cache åpningstider og telefon i Supabase

### 3a: DB-migrasjon

**Ny fil:** `supabase/migrations/032_opening_hours_phone_cache.sql`

```sql
ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS opening_hours_json JSONB,
  ADD COLUMN IF NOT EXISTS google_phone TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN pois.opening_hours_json IS 'Cached Google opening hours: {"weekday_text": [...]}';
COMMENT ON COLUMN pois.google_phone IS 'Cached phone number from Google Places';
COMMENT ON COLUMN pois.opening_hours_updated_at IS 'When opening hours were last fetched from Google';
COMMENT ON COLUMN pois.photo_resolved_at IS 'When featured_image URL was last resolved from Google';

-- Backfill photo_resolved_at for existing resolved URLs
UPDATE pois SET photo_resolved_at = NOW()
WHERE featured_image LIKE 'https://lh3.googleusercontent.com%';
```

**JSONB-format:** `{"weekday_text": ["Monday: 8:00 AM – 5:00 PM", ...]}`
**NB:** `open_now` lagres IKKE — beregnes client-side fra `weekday_text` for å unngå stale data.

### Research Insights: Hvorfor `open_now` ikke lagres

Å lagre `open_now` fra Google ville gi en snapshot fra hentetidspunktet som fort blir feil. I stedet:
- Lagre `weekday_text` (statisk ukeskjema)
- Parse klokkeslett client-side med brukerens lokale tid
- Håndterer: "Closed", "Open 24 hours", enkelt intervall ("8 AM – 5 PM"), multiple intervall ("8 AM – 12 PM, 1 PM – 5 PM"), overnight ("6 PM – 2 AM")

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

### Research Insights: Prisimplikasjoner

Med Legacy API koster dette $17/1K (Contact Data-felt trigges av `formatted_phone_number`). Med Places API (New) ville `regularOpeningHours` + `nationalPhoneNumber` koste $20/1K (Enterprise tier). Legacy er altså billigere for dette spesifikke kallet.

### 3c–3f: (Uendret fra original plan)

**3c:** Utvid POI-typen og data-loading (`lib/types.ts`, `lib/public-queries.ts`)
**3d:** Refaktorer useOpeningHours til å lese fra POI-data
**3e:** Endre MapPopupCard til å lese cached data
**3f:** Endre poi-card-expanded til å bruke cached data

- [ ] Migrasjon 032 skrevet og kjørt (inkluderer `photo_resolved_at`)
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

## Steg 5: Typecheck, test, verifiser + cache-tuning

### 5a: Standard verifisering

- [ ] `npx tsc --noEmit` — null feil
- [ ] `npx vitest run` — alle tester passerer
- [ ] Manuell sjekk: Explorer-kort viser bilder (CDN-URLer)
- [ ] Manuell sjekk: MapPopupCard viser åpningstider (fra cache)
- [ ] Manuell sjekk: poi-card-expanded viser website og telefon (fra cache)
- [ ] Manuell sjekk: Offentlige sider viser bilder

### 5b: Reduser `minimumCacheTTL` (NY)

**Endring i:** `next.config.mjs`

Reduser fra 30 dager til 7 dager:

```javascript
images: {
  minimumCacheTTL: 604800, // 7 dager (var 2592000 / 30d)
}
```

**Begrunnelse:** 7 dager gir raskere feedback-loop hvis en lh3 URL utløper. Ytelsespåvirkning er neglisjerbar for ~500 POI-er — Image Optimizer re-fetcher sjeldnere enn 1x/uke per bilde. Holder oss godt innenfor Google TOS 30-dagers grense.

- [ ] `minimumCacheTTL` redusert til 604800

---

## Steg 6: Dokumenter refresh-schedule + opprett foto-refresh-script (NY)

### 6a: Opprett `scripts/refresh-photo-urls.ts`

**Ny fil:** Strukturelt identisk med `refresh-opening-hours.ts`.

Script som:
1. Henter POI-er der `photo_reference IS NOT NULL` og `photo_resolved_at` er eldre enn 14 dager (eller NULL)
2. Re-resolver `photo_reference` → lh3 CDN-URL via `resolveGooglePhotoUrl()`
3. Oppdaterer `featured_image` og `photo_resolved_at` i Supabase
4. Håndterer expired references: sett `photo_reference = NULL`

```bash
npx tsx scripts/refresh-photo-urls.ts
```

**Kostnad per kjøring:** ~500 Places Photo API-kall = innenfor 1000 gratis/mnd.

### 6b: Dokumenter i COMMANDS.md

```markdown
## Google Data Refresh Schedule

| Data | Frekvens | Script | Kostnad |
|------|----------|--------|---------|
| Foto-URLer | Hver 2. uke | `npx tsx scripts/refresh-photo-urls.ts` | ~500 kall (gratis) |
| Åpningstider + telefon | Månedlig | `npx tsx scripts/refresh-opening-hours.ts` | ~500 kall ($8.50) |
| Gallery-bilder | Ved behov (nye POI-er) | `npx tsx scripts/backfill-gallery-images.ts` | Varierer |
```

### Research Insight: Når automatisere?

Ved ~500 POI-er er manuell kjøring hver 2. uke tilstrekkelig. Automatiser (Vercel Cron) når:
- POI-antall > 2000 (manuell kjøring tar for lang tid)
- Teamet glemmer å kjøre og brukere rapporterer broken images
- Flere områder (byer) legges til

- [ ] `scripts/refresh-photo-urls.ts` skrevet og testet
- [ ] Refresh-schedule dokumentert i `COMMANDS.md`

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `scripts/resolve-photo-urls.ts` | **NY** — batch-resolve proxy→CDN + sett `photo_resolved_at` |
| `scripts/refresh-opening-hours.ts` | **NY** — batch-hent åpningstider+telefon til Supabase |
| `scripts/refresh-photo-urls.ts` | **NY** — periodisk re-resolve av foto-URLer |
| `supabase/migrations/032_opening_hours_phone_cache.sql` | **NY** — 4 kolonner: opening_hours_json, google_phone, opening_hours_updated_at, photo_resolved_at |
| `lib/utils/fetch-poi-photos.ts` | Lagre CDN-URL + photo_resolved_at |
| `lib/types.ts` | Legg til `openingHoursJson` og `googlePhone` på POI |
| `lib/public-queries.ts` | Map nye kolonner i `transformPublicPOI` |
| `lib/hooks/useOpeningHours.ts` | Les fra POI-data, beregn isOpen client-side |
| `components/variants/report/MapPopupCard.tsx` | Fjern runtime Google API-kall |
| `components/poi/poi-card-expanded.tsx` | Bruk `poi.googleWebsite` + `poi.googlePhone` |
| `app/(public)/[area]/[category]/page.tsx` | Fjern ISR-resolve |
| `next.config.mjs` | Reduser `minimumCacheTTL` til 7 dager |
| `COMMANDS.md` | Dokumenter refresh-schedule |

---

## Ut av scope (med prioritering)

### Neste prioritet: Places API (New) migrasjon

**Begrunnelse for å prioritere dette som neste oppgave:**
- Foto-kall (Place Details med kun `photos`-felt) blir **GRATIS** ($0 vs $17/1K)
- `skipHttpRedirect=true` gir direkte `photoUri` uten redirect-hack
- 4800px maks (vs 1600px legacy) — bedre for retina
- ~10 filer trenger endring, håndterbart scope
- Legacy API vil bli avviklet (ikke annonsert dato, men 12 mnd varsel garantert)

**Felt-mapping (legacy → new):**
| Legacy | New | Tier |
|--------|-----|------|
| `photos` | `photos` | Essentials (IDs Only) — **GRATIS** |
| `rating` | `rating` | Enterprise ($20/1K) |
| `opening_hours` | `regularOpeningHours` | Enterprise ($20/1K) |
| `formatted_phone_number` | `nationalPhoneNumber` | Enterprise ($20/1K) |
| `website` | `websiteUri` | Enterprise ($20/1K) |

**Viktig:** Ikke miks i dette PR-et. Hold API-migrasjon som separat, testbar enhet.

### Cleanup-pass

- Fjerne `/api/places`-endpointene helt
- Fjerne `photoReference` fallback-chains i 17 filer (8 komponenter + 9 public pages)
- Konsolidere `resolvePhotoUrl`-logikk (4 duplikater → 1 import)
- Fjerne in-memory cache i `/api/places/[placeId]/route.ts` (ubrukelig på Vercel serverless)
- Fikse OG-bilder: bruk `/_next/image?url=...` URL i stedet for rå lh3-URL i `generateMetadata`

### Skalering (når relevant)

- `getPOIBySlug` gjør O(n) scan — legg til `slug`-kolonne med indeks ved >2000 POI-er
- Automatisert Vercel Cron for foto + åpningstider refresh ved >2000 POI-er
- Materialized view for kategori-aggregeringer ved >10000 POI-er

---

## Risikoer og mitigeringer

| Risiko | Alvorlighet | Mitigering |
|--------|-------------|------------|
| lh3 URL utløper mellom refreshes | HØY | `photo_resolved_at` + bi-ukentlig refresh + 7d Image Optimizer cache som buffer |
| Proxy fallback re-aktiveres for POI-er uten featured_image | MEDIUM | Null ut `photo_reference` for expired refs i steg 1 |
| Gallery-bilder har ingen refresh-mekanisme | MEDIUM | Inkluder gallery i refresh-script (steg 6a) |
| OG-bilder bruker rå lh3-URL (ikke gjennom Image Optimizer) | MEDIUM | Cleanup-pass: endre til `/_next/image` URL i generateMetadata |
| Google TOS-brudd ved >30d caching | LAV | 7d minimumCacheTTL + bi-ukentlig URL-refresh = godt innenfor |
| Ingen monitoring for kostnadsspiker | LAV | Budget alert + daglig kvote (steg 0) |

---

## Forventet resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| Places API-kall/mnd | ~15 000 | ~50-100 (kun nye imports + bi-ukentlig refresh) |
| Forbruk/mnd | ~1000 NOK (feb-tempo) | < 10 NOK |
| Bildelading | 3 hopp (proxy) | 1 hopp (CDN direkte) |
| Image Optimizer cache | 30 dager | 7 dager (raskere feedback) |
| Åpningstider | Runtime per viewport | Cached i DB, isOpen beregnet client-side |
| Telefon/website | Runtime per klikk | Cached i DB |
| Foto-freshness | Aldri refreshet | Bi-ukentlig script |
| Budget-overvåking | Ingen | Alert ved $10/mnd + daglig kvote |

---

## Referanser

- [Google Maps Platform Pricing (mars 2025+)](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Places API Data Fields by Tier](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Places API (New) Migration Guide](https://developers.google.com/maps/documentation/places/web-service/legacy/migrate-overview)
- [Place Photos — skipHttpRedirect](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [Google Maps Platform TOS — Caching](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- `docs/solutions/performance-issues/google-api-runtime-cost-leakage-20260215.md`
- `docs/solutions/performance-issues/mobile-lcp-image-proxy-chain-20260214.md`
- `docs/solutions/integration-issues/vercel-data-cache-stale-across-deployments-20260215.md`
