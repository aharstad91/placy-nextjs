# Brainstorm: Workflow for å sette opp Scandic Nidelven Demo

**Dato:** 2026-02-05
**Kontekst:** Salgsdemo av Explorer og Report produkter for Scandic Nidelven

---

## Hva vi bygger

En **admin-workflow** for å sette opp Explorer og Report produkter for et nytt hotell (Scandic Nidelven), inkludert automatisk POI-import fra Google Places.

**Målgruppe:** Hotellgjester + Scandic-ansatte (salgsdemo)

**Scope:** Full dekning av området rundt hotellet med alle relevante POI-kategorier:
- Restauranter og kaféer
- Kultur og severdigheter
- Shopping og service
- Uteliv og underholdning

---

## Hvorfor denne tilnærmingen

### Eksisterende byggeklosser (allerede i kodebasen)

| Funksjonalitet | Fil | Status |
|----------------|-----|--------|
| Google Places Nearby Search | `lib/generators/poi-discovery.ts` | Fungerer |
| Entur holdeplasser | `lib/generators/poi-discovery.ts` | Fungerer |
| Bysykkel stasjoner | `lib/generators/poi-discovery.ts` | Fungerer |
| Supabase POI-lagring | `lib/supabase/mutations.ts` | Fungerer |
| Prosjekt-hierarki (projects → products) | Database schema | Fungerer |
| Admin prosjektoversikt | `app/admin/projects/` | Fungerer |
| Admin POI-liste | `app/admin/pois/` | Fungerer |

### Mangler (må bygges)

1. **Admin-side for POI-import** - Koble `poi-discovery.ts` til et admin-UI
2. **Import til Supabase** - Lagre discoverede POI-er til `pois`-tabellen
3. **Kobling POI → Prosjekt** - Etter import, legge POI-er til prosjektets pool

---

## Nøkkelbeslutninger

### 1. Arkitektur: Ny import-side vs. utvide Generator

**Valgt:** Ny dedikert import-side (`/admin/import`)

**Begrunnelse:**
- Generator (`/admin/generate`) er for å lage story-strukturer fra *eksisterende* POI-er
- Import handler om å *fylle Supabase med POI-er* fra eksterne kilder
- Separasjon gir klarere ansvarsfordeling

### 2. Import-workflow

```
/admin/import
    ↓ Velg senterpunkt (kart-klikk)
    ↓ Velg radius (300m - 2km)
    ↓ Velg kategorier (checkboxes)
    ↓ [Søk] → Kaller poi-discovery.ts
    ↓ Vis preview av funn (antall per kategori)
    ↓ [Importer] → Lagrer til Supabase pois-tabell
    ↓ Valgfritt: Koble til eksisterende prosjekt
```

### 3. Deduplisering

- Bruk `googlePlaceId` som unik nøkkel
- Ved re-import: oppdater eksisterende POI-er, ikke dupliser
- Vis tydelig "X nye, Y oppdaterte" i import-resultat

### 4. Kategori-mapping

- Google Places kategorier mappes til eksisterende `categories`-tabell
- Hvis kategori ikke finnes → opprett automatisk med standard ikon/farge
- Bruk `GOOGLE_CATEGORY_MAP` fra poi-discovery.ts

---

## Åpne spørsmål

1. **Skal import-siden også støtte KML-import?** (Eksisterende `import-kml.ts` script)
2. **Editorial hooks:** Genereres disse automatisk eller legges til manuelt etterpå?
3. **Rate limiting:** Trenger vi å vise progress for store imports?

---

## Forslag til implementeringsrekkefølge

1. **API-route:** `POST /api/pois/discover` - Wrapper rundt poi-discovery.ts
2. **API-route:** `POST /api/pois/import` - Lagrer array av POI-er til Supabase
3. **Admin-side:** `/admin/import` - UI med kart, radius-slider, kategori-checkboxes
4. **Kobling:** Mulighet for å velge prosjekt og legge importerte POI-er til project_pois

---

## Neste steg

Klar for `/workflows:plan` for å lage detaljert implementeringsplan.
