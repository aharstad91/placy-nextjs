# Plan: Importer ATB bussholdeplasser og trikkholdeplasser

**Dato:** 2026-01-25
**Status:** Draft

## Mål

Importere alle ATB bussholdeplasser (651 stk) og Gråkallbanen trikkholdeplasser (~20 stk) i Trondheim kommune til Placy som POI-er.

## Datakilde

- **API:** Entur GraphQL API (`https://api.entur.io/stop-places/v1/graphql`)
- **Kommune:** Trondheim = `KVE:TopographicPlace:5001`
- **Typer:**
  - `onstreetBus` - bussholdeplasser
  - `onstreetTram` - trikkholdeplasser (Gråkallbanen)

## Implementering

### 1. Opprett import-script

**Fil:** `scripts/import-atb-stops.ts`

**Funksjonalitet:**
1. Hent alle bussholdeplasser via GraphQL
2. Hent alle trikkholdeplasser via GraphQL
3. Transformer til POI-format
4. Upsert kategorier ("bus", "tram")
5. Batch-upsert POI-er til Supabase

### 2. GraphQL Query

```graphql
query GetTrondheimStops($type: StopPlaceType!) {
  stopPlace(
    size: 2000
    stopPlaceType: $type
    municipalityReference: "KVE:TopographicPlace:5001"
  ) {
    id
    name { value }
    geometry { coordinates }
  }
}
```

### 3. POI-mapping

| Entur-felt | POI-felt |
|------------|----------|
| `id` | `entur_stopplace_id` |
| `name.value` | `name` |
| `geometry.coordinates[1]` | `lat` |
| `geometry.coordinates[0]` | `lng` |
| - | `id` = `bus-{slugified-name}` eller `tram-{slugified-name}` |
| - | `category_id` = "bus" eller "tram" |

### 4. NPM script

Legg til i `package.json`:
```json
"import:atb": "npx tsx scripts/import-atb-stops.ts"
```

## Kategorier

Eksisterende kategorier fra `poi-discovery.ts`:
- `bus`: `{ id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" }`
- `tram`: `{ id: "tram", name: "Trikk", icon: "Tram", color: "#f97316" }`

## Testing

```bash
npm run import:atb
```

Verifiser i admin: `http://localhost:3000/admin/pois?categories=bus,tram`

## Estimert resultat

- ~651 bussholdeplasser
- ~20 trikkholdeplasser
- Totalt ~670 nye POI-er
