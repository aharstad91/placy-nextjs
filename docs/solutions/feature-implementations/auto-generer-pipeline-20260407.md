---
title: "Automatisk generer-pipeline: Skjema til Explorer uten manuell intervensjon"
category: feature-implementations
tags: [pipeline, generation, supabase, google-places, explorer, poi-import]
date: 2026-04-07
---

# Automatisk generer-pipeline

## Problem

Selvbetjent megler-skjema (`/eiendom/generer`) lagret en forespørsel i Supabase, men selve genereringen av nabolagskartet krevde manuell CLI-kjøring (`npm run generate:story`). Generatoren skrev til filsystemet (JSON-filer), som ikke fungerer på Vercel (serverless/read-only).

## Løsning

Hele pipelinen kjøres synkront i API-ruten (`/api/generation-requests`):

1. Lagre request i `generation_requests`
2. Opprett kunde + prosjekt + Explorer-produkt i Supabase
3. Kall Google Places API per kategori via `importPOIsToProject()`
4. Lagre POI-er i `pois` + `product_pois`
5. Oppdater request til `completed`
6. Send bekreftelsesmail via Brevo

Tar 15-30 sekunder lokalt. Megleren fyller ut skjema → venter → klikker link i e-post → ser Explorer med ekte POI-data.

## Arkitektur

```
lib/pipeline/
  create-project.ts      — Opprett projects + products i Supabase
  import-pois.ts         — Google Places + Entur + Bysykkel → Supabase
  housing-categories.ts  — Boligtype → Google Places-kategorier
```

`import-pois.ts` er en ekstraksjon av logikken fra `app/api/admin/import/route.ts`. Admin-ruten er uendret.

## Gotchas

### 1. `story_title` lever på `products`, ikke `projects`
`projects.story_title` eksisterer i TS-types men IKKE i produksjons-DB. Den ble migrert til `products`-tabellen. Supabase PostgREST gir `column not found in schema cache`.

### 2. `short_id` er NOT NULL på `projects`
Alle scripts genererer en 7-tegns random string. Glem ikke denne ved programmatisk prosjekt-opprettelse.

### 3. Supabase schema cache vs TypeScript types
Felter som `discovery_circles` og `short_id` finnes i DB men ikke i genererte TS-types. Bruk `as any` cast på `.from("projects")` for å omgå.

### 4. Boligtype-kategorier bestemmer POI-kvalitet
`family` gir 11 kategorier (inkl. doctor, dentist), `young` gir 8 (inkl. bar, movie_theater), `senior` gir 8 (vekter pharmacy, doctor). Entur + Bysykkel inkluderes alltid.

### 5. Bekreftelsesmail bør vente på pipeline
Flytt e-post-sending ETTER pipeline — da kan mailen si "kartet er klart" i stedet for "genereres".

## Filer

| Fil | Endring |
|-----|---------|
| `lib/pipeline/import-pois.ts` | NY — Gjenbrukbar POI-import funksjon |
| `lib/pipeline/create-project.ts` | NY — Prosjekt+produkt opprettelse |
| `lib/pipeline/housing-categories.ts` | NY — Boligtype→kategorier mapping |
| `app/api/generation-requests/route.ts` | ENDRET — Integrert pipeline + oppdatert mail |
