---
title: "feat: Automatisk generer-pipeline — skjema til Explorer uten manuell intervensjon"
type: feat
date: 2026-04-07
brainstorm: Inline i /full-sesjon (oppdatert scope fra 2026-03-06 brainstorm)
branch: feat/auto-generer-pipeline
---

# Plan: Automatisk generer-pipeline

## Kontekst

Selvbetjent megler-pipeline er delvis bygget:
- Landing page (`/eiendom/generer`) med skjema, AddressAutocomplete, Zod-validering
- API-route (`/api/generation-requests`) som lagrer request i Supabase
- Bekreftelsesmail via Brevo
- URL-arkitektur (`/eiendom/{kunde}/{slug}`)
- Explorer-side som leser fra Supabase

**Det som mangler:** Bindeleddet mellom "request lagret" og "Explorer viser kart". I dag gjøres POI-generering manuelt via CLI.

**Scope:** Lokal prototype for demo til meglere. Trenger ikke produksjonsrobusthet.

## User Story

> Megler fyller ut skjema → venter 15-30 sek → får e-post med link → klikker link → ser interaktivt nabolagskart med ekte POI-data.

## Arkitekturbeslutning: Alt synkront i API-ruten

Ingen background functions, cron, eller polling. API-ruten gjør alt inline:

```
POST /api/generation-requests
  1. Valider input (Zod) ✅ allerede bygget
  2. Duplikat-sjekk ✅ allerede bygget  
  3. Opprett/finn kunde ✅ allerede bygget
  4. === NYTT: Start pipeline ===
  5. Opprett prosjekt i Supabase (projects + products)
  6. Kall Google Places API per kategori
  7. Upsert POI-er i Supabase (pois)
  8. Link POI-er til prosjekt (project_pois + product_pois)
  9. Oppdater generation_request (status=completed, project_id, result_url)
  10. Send bekreftelsesmail ✅ allerede bygget
```

Lokalt tar dette 15-30 sek. Greit for prototype-demo.

## Implementeringssteg

### Steg 1: Refaktoriser POI-discovery til gjenbrukbar modul → TC-01, TC-02

**Problem:** `lib/generators/poi-discovery.ts` bruker Google Places API direkte og returnerer `DiscoveredPOI[]`. Det er fine. Men `/api/admin/import/route.ts` har også POI-discovery + Supabase-insert logikk bakt inn i API-ruten (~400 linjer).

**Løsning:** Ikke refaktoriser — gjenbruk `/api/admin/import` internt. API-ruten kan kalles server-side via fetch til seg selv, eller vi kan ekstrahere insert-logikken.

**Enkleste tilnærming:** Ekstraher en `importPOIsToProject()` funksjon fra import-ruten som:
- Tar `{circles, categories, projectId, includeEntur, includeBysykkel}` 
- Kaller Google Places + Entur + Bysykkel
- Upsert-er POI-er i Supabase
- Linker til project_pois + product_pois
- Returnerer `{imported: number, skipped: number}`

**Fil:** `lib/pipeline/import-pois.ts` (ny)

### Steg 2: Lag prosjekt-opprettelse funksjon → TC-03, TC-04

**Fil:** `lib/pipeline/create-project.ts` (ny)

Funksjon: `createGeneratedProject(request: GenerationRequest): Promise<{projectId, productId}>`

1. Upsert kunde via `getOrCreateCustomer()` (allerede i API-ruten)
2. Insert i `projects`:
   - `id`: UUID
   - `customer_id`: kunde-slug
   - `name`: adressen
   - `url_slug`: address_slug fra request
   - `center_lat/lng`: fra request
   - `venue_type`: "residential"
   - `tags`: `["Eiendom - Bolig"]`
   - `discovery_circles`: `[{lat, lng, radiusMeters: 2000}]`
3. Insert i `products`:
   - `project_id`: fra steg 2
   - `product_type`: "explorer"

### Steg 3: Bestem kategorier basert på boligtype → TC-05

**Fil:** `lib/pipeline/housing-categories.ts` (ny)

```typescript
const HOUSING_CATEGORIES = {
  family: ["restaurant", "cafe", "bakery", "supermarket", "pharmacy", 
           "gym", "park", "library", "museum"],
  young: ["restaurant", "cafe", "bar", "bakery", "gym", "supermarket"],
  senior: ["supermarket", "pharmacy", "doctor", "dentist", "park", 
           "library", "cafe"],
};
```

Entur (kollektivtransport) og Bysykkel inkluderes alltid.

### Steg 4: Koble pipeline inn i API-ruten → TC-06, TC-07, TC-08, TC-09

**Fil:** `app/api/generation-requests/route.ts` (endre)

Etter eksisterende insert, legg til:

```typescript
// === Pipeline: Generer prosjekt automatisk ===
try {
  // 1. Opprett prosjekt + produkt
  const { projectId, productId } = await createGeneratedProject({
    customerSlug, slug: finalSlug, address, lat, lng, housingType
  });

  // 2. Importer POI-er
  const categories = getHousingCategories(housingType);
  const result = await importPOIsToProject({
    circles: [{ lat, lng, radiusMeters: 2000 }],
    categories,
    projectId,
    includeEntur: true,
    includeBysykkel: true,
  });

  // 3. Oppdater request til completed
  await supabase.from("generation_requests").update({
    status: "completed",
    project_id: projectId,
    result_url: eiendomUrl(customerSlug, finalSlug),
    completed_at: new Date().toISOString(),
  }).eq("address_slug", finalSlug);

} catch (err) {
  // Pipeline feilet — oppdater request med feilmelding
  await supabase.from("generation_requests").update({
    status: "failed",
    error_message: err instanceof Error ? err.message : "Ukjent feil",
  }).eq("address_slug", finalSlug);
}
```

### Steg 5: Oppdater bekreftelsesmail og respons → TC-10

Endre flyten slik at:
- Hvis pipeline lykkes: send mail med **ferdig** URL (ikke "genereres")
- Klient-siden viser spinner mens request pågår (15-30 sek)
- Respons inkluderer `status: "completed"` eller `status: "failed"`

### Steg 6: Håndter venteside i Explorer → TC-11, TC-12

**Fil:** `app/eiendom/[customer]/[project]/page.tsx`

Sjekk om siden allerede håndterer `generation_requests` status — forskningsagenten fant at den gjør dette (linje 44-112). Verifiser at ventesiden og feilsiden fungerer korrekt.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `lib/pipeline/import-pois.ts` | **NY** — Ekstraher POI-import logikk |
| `lib/pipeline/create-project.ts` | **NY** — Prosjekt+produkt opprettelse |
| `lib/pipeline/housing-categories.ts` | **NY** — Boligtype → kategorier mapping |
| `app/api/generation-requests/route.ts` | **ENDRE** — Koble inn pipeline |
| `app/api/admin/import/route.ts` | **ENDRE** — Ekstraher gjenbrukbar funksjon |

## Avhengigheter

- Google Places API key (allerede i `.env.local`)
- Mapbox token (allerede i `.env.local`)
- Supabase service role key (allerede i `.env.local`)
- Kategorier må finnes i `categories`-tabellen (allerede populert)

## Akseptansekriterier

- [ ] AC1: Megler fyller ut skjema, venter, og Explorer-siden viser ekte POI-er
- [ ] AC2: POI-er kommer fra Google Places API basert på adressens koordinater
- [ ] AC3: Boligtype (family/young/senior) påvirker hvilke kategorier som importeres
- [ ] AC4: Entur-stopp (buss, trikk, tog) inkluderes automatisk
- [ ] AC5: Bysykkel-stasjoner inkluderes automatisk
- [ ] AC6: Explorer-siden viser temaer fra "Eiendom - Bolig" bransjeprofilen
- [ ] AC7: Explorer caps begrenser antall POI-er per tema
- [ ] AC8: Bekreftelsesmail inneholder link som fungerer umiddelbart
- [ ] AC9: Duplikat-adresser returnerer eksisterende prosjekt (ikke re-generer)
- [ ] AC10: Feilede genereringer settes til status "failed" med feilmelding
- [ ] AC11: generation_request oppdateres med project_id og result_url
- [ ] AC12: Venteside vises hvis bruker besøker URL før generering er ferdig

## Risiko

| Risiko | Mitigering |
|--------|------------|
| Google Places timeout (>60s) | Lokalt problem — ingen timeout. Prod: maxDuration=60 |
| Ingen POI-er funnet (ruralt) | Tomt Explorer-kart med melding — ikke krasj |
| Kategorier mangler i DB | Upsert kategorier som del av import |
| Race condition: to requests for samme adresse | Eksisterende duplikat-sjekk (7-dagers vindu) |
