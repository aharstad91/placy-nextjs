---
title: "fix: POI SEO — structured data, rich snippets & content depth"
type: fix
date: 2026-02-15
---

# fix: POI SEO — structured data, rich snippets & content depth

## Overview

SEO-analyse av `/trondheim/steder/antikvariatet` avdekket feil og mangler i JSON-LD structured data, manglende rich snippet-data, og tynt innhold på POIs uten knowledge facts. Grunnlaget (title, meta, hreflang, sitemap, ISR) er solid — dette handler om å fikse feil og utnytte data vi allerede har.

## Problem Statement

1. **JSON-LD `url` peker til ekstern nettside** — `POIJsonLd.tsx:55` setter `url: poi.googleWebsite`, som for Antikvariatet er Facebook-URLen. Google kan tolke dette som at Facebook er den kanoniske URLen for stedet.
2. **Mangler `sameAs` i JSON-LD** — Ingen kobling mellom stedet og eksterne profiler (Facebook, Google Maps, nettside).
3. **Mangler `telephone` i JSON-LD** — `googlePhone` finnes i data men brukes ikke.
4. **Mangler `openingHoursSpecification` i JSON-LD** — `openingHoursJson` finnes i data men brukes ikke.
5. **`facebookUrl` ikke mappet i `transformPublicPOI`** — Feltet finnes i POI-typen men er ikke med i public queries.
6. **Tynt innhold** — POIs uten knowledge facts eller editorial hooks har bare Google-data og rating. Risikerer å bli ignorert av Google.

## Ting som allerede fungerer (ikke rør)

- `<title>` og `<meta description>` — korrekt og unikt per POI
- `hreflang` — rendrer korrekt via `alternates.languages`
- `canonical` URL — peker riktig
- `og:title`, `og:description`, `og:url`, `og:image` — komplett
- `BreadcrumbList` JSON-LD — korrekt
- `sitemap.xml` og `robots.txt` — tilgjengelig (307 → www, 200)
- ISR med 24h revalidation — fungerer

## Proposed Solution

### Steg 1: Fiks JSON-LD `url`, legg til `sameAs`, og locale-aware URL

**Fil:** `components/seo/POIJsonLd.tsx`

Endre `url` til Placy canonical URL **med locale-støtte**. Flytt `googleWebsite`, `facebookUrl`, og `googleMapsUrl` til `sameAs`-array **med `isSafeUrl()`-validering**.

> **Tech Audit funn:** Komponenten brukes på BEGGE språkversjoner. Uten locale-prop vil engelsk side få norsk URL i JSON-LD. Alle URL-er i `sameAs` må valideres med `isSafeUrl()`.

```typescript
// Oppdatert interface:
interface POIJsonLdProps {
  poi: PublicPOI;
  area: Area;
  locale: "no" | "en";  // NY — fra tech audit
}

// I komponenten:
const url = locale === "en"
  ? `https://placy.no/en/${area.slugEn}/places/${poi.slug}`
  : `https://placy.no/${area.slugNo}/steder/${poi.slug}`;

const sameAs = [poi.googleWebsite, poi.facebookUrl, poi.googleMapsUrl]
  .filter((u): u is string => !!u && isSafeUrl(u));  // isSafeUrl fra lib/utils/url

const jsonLd = {
  // ...eksisterende felter...
  url,
  ...(sameAs.length > 0 && { sameAs }),
};
```

- [x] Legg til `locale` prop i POIJsonLd interface `components/seo/POIJsonLd.tsx`
- [x] Endre `url` til locale-aware Placy canonical URL `components/seo/POIJsonLd.tsx`
- [x] Legg til `sameAs` array med `isSafeUrl()`-validering `components/seo/POIJsonLd.tsx`
- [x] Importer `isSafeUrl` i POIJsonLd `components/seo/POIJsonLd.tsx`

### Steg 2: Legg til `telephone` i JSON-LD

**Fil:** `components/seo/POIJsonLd.tsx`

```typescript
...(poi.googlePhone && { telephone: poi.googlePhone }),
```

- [x] Legg til `telephone` fra `poi.googlePhone` `components/seo/POIJsonLd.tsx`

### Steg 3: Legg til `openingHours` i JSON-LD

**Fil:** `components/seo/POIJsonLd.tsx`

Google Rich Results forventer `openingHoursSpecification` for LocalBusiness-typer. Vi har `openingHoursJson.weekday_text` (f.eks. `["Monday: 10:00 AM – 6:00 PM", ...]`).

Anbefaling: Bruk `openingHours` (fritekst-array) — enklere og tryggere enn å parse Google-dataen til strukturert format.

> **Tech Audit funn:** Legg til type-validering — sjekk at `weekday_text` er array av strings.

```typescript
const weekdayText = poi.openingHoursJson?.weekday_text;
const validOpeningHours = Array.isArray(weekdayText) &&
  weekdayText.every((t) => typeof t === "string");

...(validOpeningHours && { openingHours: weekdayText }),
```

- [x] Legg til `openingHours` fra `weekday_text` med type-validering `components/seo/POIJsonLd.tsx`

### Steg 4: Mapp `facebookUrl` i `transformPublicPOI`

**Fil:** `lib/public-queries.ts`

`facebookUrl` finnes i POI-typen (`lib/types.ts:55`) og i databasen (`facebook_url`), men er ikke mappet i `transformPublicPOI` (linje 245–273).

```typescript
// Legg til etter linje 270:
facebookUrl: (dbPoi.facebook_url as string) ?? undefined,
```

- [x] Legg til `facebookUrl` mapping i `transformPublicPOI` `lib/public-queries.ts:271`

### Steg 5: Send `locale` prop til POIJsonLd fra begge sider

**Filer:**
- `app/(public)/[area]/steder/[slug]/page.tsx` (norsk)
- `app/(public)/en/[area]/places/[slug]/page.tsx` (engelsk)

```typescript
// Norsk side:
<POIJsonLd poi={poi} area={area} locale="no" />

// Engelsk side:
<POIJsonLd poi={poi} area={area} locale="en" />
```

- [x] Send `locale="no"` til POIJsonLd fra norsk side `app/(public)/[area]/steder/[slug]/page.tsx:107`
- [x] Send `locale="en"` til POIJsonLd fra engelsk side `app/(public)/en/[area]/places/[slug]/page.tsx`

### Steg 6: Strategi for tynt innhold

POIs uten editorial hooks eller knowledge facts har bare:
- Navn, adresse, kategori, rating, bilde, kart

**Kortsiktig (denne PRen):** Ingen kodeendring. Prioriter å seede knowledge facts for flere POIs (research pipeline fra separat sesjon).

**Mellomlang sikt (egen plan):**
- Auto-generere en kort beskrivelse basert på tilgjengelig data (kategori, rating, åpningstider, bydel)
- Vise FAQ-seksjon med genererte spørsmål ("Hva er ratingen?", "Hvor ligger det?", "Når har de åpent?")
- Bruke `FAQJsonLd` (allerede finnes i `components/seo/FAQJsonLd.tsx`)

- [ ] Vurder: Legg til dynamisk `description` fallback i JSON-LD for POIs uten editorial hook
- [ ] Parkert: FAQ-seksjon og auto-generert beskrivelse → egen plan

## Acceptance Criteria

- [ ] JSON-LD `url` peker til korrekt locale-spesifikk URL (norsk: `/[area]/steder/[slug]`, engelsk: `/en/[area]/places/[slug]`)
- [ ] JSON-LD `sameAs` inkluderer Google Maps URL, nettside, og Facebook (validert med `isSafeUrl()`)
- [ ] JSON-LD `telephone` vises når `googlePhone` finnes
- [ ] JSON-LD `openingHours` vises når `openingHoursJson` finnes
- [ ] `facebookUrl` mappes i public queries
- [ ] Norsk og engelsk POI-side har oppdatert JSON-LD
- [ ] Verifiser med Google Rich Results Test at JSON-LD er valid
- [ ] Ingen regresjoner i eksisterende meta/OG/hreflang/breadcrumb

## Technical Considerations

**Risiko:** Lav. Endringene er begrenset til JSON-LD-output og én manglende field-mapping. Ingen database-endringer. Ingen UI-endringer.

**Testing:**
- Kjør `npx tsc --noEmit` for typesjekk
- Start dev server og verifiser JSON-LD i page source for:
  - POI med alle felter (Britannia Hotel)
  - POI med minimal data (uten telefon, åpningstider)
  - POI uten nettside/Facebook
- Google Rich Results Test: https://search.google.com/test/rich-results

## References

- `components/seo/POIJsonLd.tsx` — JSON-LD generator (hovedfil å endre)
- `lib/public-queries.ts:245-273` — `transformPublicPOI` (mangler `facebookUrl`)
- `lib/types.ts:27-76` — POI interface (har `googlePhone`, `openingHoursJson`, `facebookUrl`)
- `app/(public)/[area]/steder/[slug]/page.tsx` — Norsk POI-side
- `app/(public)/en/[area]/places/[slug]/page.tsx` — Engelsk POI-side
- `docs/solutions/best-practices/seo-keyword-strategy-public-site-20260213.md` — Innholdsstrategi
- `docs/solutions/feature-implementations/seo-content-strategy-public-site-20260213.md` — FAQ-schema ideer
