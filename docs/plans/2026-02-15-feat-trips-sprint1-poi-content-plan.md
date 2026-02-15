---
title: "feat: Trips Sprint 1 — POI-grunnlag + innhold for 3 demo-turer"
type: feat
date: 2026-02-15
---

# Trips Sprint 1: POI-grunnlag + innhold for 3 demo-turer

## Overview

Klargjør databasen med alle nødvendige POI-er og kvalitetsinnhold for 3 demo-turer rettet mot Scandic Nidelven. Alle turer innenfor 1.5 km radius, under 60 min, med research-verifisert innhold.

**De 3 turene:**
1. **Bakklandet & Bryggene** (kultur, guided, ~45 min) — eksisterer, trenger innholdsoppgradering
2. **Smak av Trondheim** (mat, free, ~60 min) — eksisterer, trenger innholdsoppgradering
3. **Midtbyen på 30 minutter** (sightseeing, guided, ~30 min) — NY tur, må bygges fra scratch

**PRD-referanse:** `docs/prd/trips-v2.md` → Sprint 1 (linje 200-234)

---

## Teknisk kontekst

### Eksisterende infrastruktur
- **DB-schema:** `trips`, `trip_stops`, `project_trips` (migrasjon 016)
- **Seed-script:** `scripts/seed-trips.ts` med `findPoi()` ILIKE-matching og fallbacks
- **Queries:** `getTripBySlug`, `getTripsByProject`, `getTripsByCity` i `lib/supabase/queries.ts`
- **Typer:** `Trip`, `TripStop`, `TripCategory` i `lib/types.ts`
- **Trip-stopp har:** `transition_text`, `local_insight`, `name_override`, `description_override`, `image_url_override`
- **Curator-skill:** `.claude/skills/placy-editorial/SKILL.md` — 6 prinsipper for editorial voice

### Kjente gap
- `trips.category` CHECK-constraint mangler `'sightseeing'` — kun `food/culture/nature/family/active/hidden-gems`
- `TRIP_CATEGORIES` i `lib/types.ts` mangler `'sightseeing'`
- `TRIP_CATEGORY_LABELS` mangler norsk label for sightseeing
- `CATEGORY_GRADIENTS` og `CATEGORY_ICONS` i `TripLibraryClient.tsx` mangler sightseeing-entry
- Midtbyen-turen eksisterer ikke i seed-scriptet
- Seed-scriptet har kun INSERT-logikk — kan ikke oppdatere eksisterende turer (Bakklandet, Smak av Trondheim)
- POI-er som mangler i DB: Gamle Bybro (landemerke), Ravnkloa, Stiftsgården (bygning), mulig flere for Midtbyen-turen
- Ingen POI-er er noensinne opprettet via SQL-migrasjon — dette er et nytt mønster

### Migrasjon-konvensjoner
- Filer: `supabase/migrations/NNN_description.sql`, neste er `034_*`
- Kjør: `source .env.local && supabase db push --password "$DATABASE_PASSWORD"`
- Regenerer typer etter migrasjon: `source .env.local && supabase gen types typescript --linked > lib/supabase/types.ts`
- Editorial UPDATEs bruker: `WHERE name ILIKE '%Navn%' AND category_id = 'kategori' AND area_id = 'trondheim'`
- CHECK constraint-navn: Inline CHECK i migrasjon 016 genererer autogenerert navn. Bruk `DROP CONSTRAINT IF EXISTS` for sikkerhet.

### POI INSERT-mønster (nytt — ingen presedens i kodebasen)

Alle eksisterende migrasjoner (020-031) bruker kun UPDATE. POI-opprettelse via migrasjon er nytt. Påkrevde kolonner:

```sql
INSERT INTO pois (id, name, lat, lng, category_id, area_id, editorial_hook, local_insight, trust_score)
VALUES (gen_random_uuid()::TEXT, 'Stedsnavn', 63.XXXX, 10.XXXX,
        'sightseeing', 'trondheim', '...hook...', '...insight...', 1.0);
```

- `area_id = 'trondheim'` — påkrevd for konsistens med eksisterende data
- `trust_score = 1.0` — manuelt kuraterte POI-er er fullt verifisert
- Wrap alle INSERTs i `BEGIN; ... COMMIT;` for atomisk operasjon

### Editorial innholdsregler (fra docs/solutions/)

**Aldri inkluder forgjengelig informasjon** (ref: `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md`):
- Spesifikke priser, åpningstider, tidsbegrensede tilbud
- Bruk i stedet: etableringsår, atmosfære, nabolagskontekst, generelle tips uten tall

---

## Oppgaver

### 1. DB-migrasjon: Legg til `sightseeing` som trip-kategori

**Fil:** `supabase/migrations/034_add_sightseeing_trip_category.sql`

```sql
-- Add 'sightseeing' to trips.category CHECK constraint
-- Use IF EXISTS for safety (inline CHECK may have auto-generated name)
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_category_check;
ALTER TABLE trips ADD CONSTRAINT trips_category_check
  CHECK (category IN ('food', 'culture', 'nature', 'family', 'active', 'hidden-gems', 'sightseeing'));
```

**Fil:** `lib/types.ts`

- [x] Legg til `"sightseeing"` i `TRIP_CATEGORIES` array (linje 361-368)
- [x] Legg til `sightseeing: "Sightseeing"` i `TRIP_CATEGORY_LABELS` (linje 373-380)

**Fil:** `app/for/[customer]/[project]/trips/TripLibraryClient.tsx`

- [x] Legg til `sightseeing: "from-indigo-700 to-blue-600"` i `CATEGORY_GRADIENTS` (linje ~24-31)
- [x] Legg til `sightseeing: Eye` i `CATEGORY_ICONS` (linje ~33-40)
- [x] Import `Eye` fra `lucide-react`

**Fil:** `scripts/seed-trips.ts`

- [x] Legg til `"sightseeing"` i `TripDef.category` union type (linje 31)

**Verifisering:**
- [x] Kjør migrasjon: `source .env.local && supabase db push --password "$DATABASE_PASSWORD"`
- [x] Regenerer Supabase-typer: `source .env.local && supabase gen types typescript --linked > lib/supabase/types.ts`
- [x] Verifiser at `lib/supabase/types.ts` inkluderer `"sightseeing"` i category union
- [x] `npm run build` kompilerer uten feil

---

### 2. Identifiser og opprett manglende POI-er

Research hvert manglende sted med WebSearch. Opprett via SQL-migrasjon.

**Fil:** `supabase/migrations/035_trip_landmark_pois.sql`

#### 2a. Gamle Bybro (landemerke-POI)

DB har allerede "Gamle Bybro plass" (bysykkelstasjon). Trenger en separat POI for selve broen som landemerke.

- [x] WebSearch: "Gamle Bybro Trondheim" — koordinater, historikk, fakta
- [x] Opprett POI med `category_id = 'sightseeing'`, area = Bakklandet/Midtbyen
- [x] Skriv `editorial_hook` med Curator-skill (navngi mennesker, årstall, detaljer)
- [x] Skriv `local_insight` — "du står her, visste du at..."
- [x] Koordinater: ca. 63.4270, 10.4010 (midt på broen)

#### 2b. Ravnkloa

- [x] WebSearch: "Ravnkloa Trondheim fiskemarked" — koordinater, historikk, åpningstider
- [x] Opprett POI med `category_id = 'restaurant'` eller `'shopping'` (sjekk best passende)
- [x] Skriv `editorial_hook` + `local_insight`
- [x] Koordinater: ca. 63.4345, 10.3985

#### 2c. Stiftsgården (bygningen)

DB har "Stiftsgårdsparken" — sjekk om det dekker bygningen eller om vi trenger en separat POI.

- [x] Sjekk eksisterende: `SELECT * FROM pois WHERE name ILIKE '%stiftsgård%'`
- [x] Hvis parken, opprett separat POI for bygningen med `category_id = 'sightseeing'`
- [x] WebSearch: "Stiftsgården Trondheim" — Skandinavias største trebygning, kongelig residens
- [x] Skriv `editorial_hook` + `local_insight`

#### 2d. Torvet / Olav Tryggvasons statue

- [x] Sjekk eksisterende: `SELECT * FROM pois WHERE name ILIKE '%torvet%' OR name ILIKE '%olav tryggvason%'`
- [x] Hvis mangler, opprett med `category_id = 'sightseeing'`
- [x] WebSearch for fakta om statuen (solur-funksjonen, bygrunnleggeren)

#### 2e. Andre POI-er for Midtbyen-turen

Midtbyen på 30 min trenger 4-5 stopp innenfor 0.8 km fra Scandic Nidelven. Kandidater:
- [x] Sjekk eksisterende POI-er innenfor radius: `SELECT name, lat, lng FROM pois WHERE ...` (bounding box rundt hotellet)
- [x] Identifiser 4-5 ikoniske stopp som dekker "Trondheims høydepunkter rett utenfor hotelldøra"
- [x] Opprett manglende POI-er med editorial content

**Verifisering:**
- [x] Alle nye POI-er synlige i Explorer etter migrasjon
- [x] Koordinater verifisert med WebSearch / kartdata

---

### 3. Skriv transition_text med teaser chain

**Teaser chain-teknikk:** Hvert stopp avsluttes med en hook til neste. "Rundt hjørnet ligger..." Sterkeste driveren for completion.

**Tone-valg:** Skriv i hybrid-tone (start med retning, gli over i kontekst). PRD sier å prøve 3 varianter, men for autonomi-nivå velg hybrid som default og marker i kommentar.

#### 3a. Bakklandet & Bryggene (Guided — transition_text obligatorisk)

- [x] Gjennomgå eksisterende transition_text i seed-trips.ts (4 stopp: Gamle Bybro → Skydsstation → Øvre Bakklandet → Solsiden)
- [x] Oppgrader tekst med teaser chain: hvert avsnitt slutter med hook til neste stopp
- [x] Bruk Curator-skill: navngi spesifikke detaljer, mennesker, årstall
- [x] Research-verifiser fakta med WebSearch
- [x] Vurder om stopp-rekkefølge/utvalg bør justeres (PRD sier 5-6 stopp, nå er det 4)

#### 3b. Midtbyen på 30 minutter (Guided — transition_text obligatorisk)

- [x] Definer 4-5 stopp innenfor 0.8 km radius
- [x] Skriv transition_text for hele ruten med teaser chain
- [x] Kort og punchy — dette er en rask tur, teksten skal matche tempo
- [x] Research-verifiser fakta

#### 3c. Smak av Trondheim (Free — transition_text valgfritt)

- [x] Skriv `transition_text` for Guided-varianten (brukes hvis gjesten toggler til Guided)
- [x] Prioritér `local_insight` og `description_override` (dette er det gjesten ser i Free mode)
- [x] Kulinarisk kontekst i description_override: hvorfor dette stedet er valgt for turen
- [x] Gjennomgå eksisterende stopp-utvalg (5 stopp: Sellanraa → Dromedar → Skydsstation → Britannia → Credo)

---

### 4. Skriv/oppgrader local_insight for alle stopp

`local_insight` brukes i BEGGE moduser (Guided + Free). Retnings-uavhengig. "Du er her, visste du at..."

- [x] Gjennomgå eksisterende local_insight i seed-trips.ts
- [x] Oppgrader med Curator-skill: spesifikke navn, årstall, mennesker, sensoriske detaljer
- [x] Research-verifiser alle fakta med WebSearch
- [x] Sjekk at local_insight er distinkt fra transition_text (ikke overlap)

**Alle 3 turer:**
- [x] Bakklandet & Bryggene: oppgrader 4+ stopp
- [x] Smak av Trondheim: oppgrader 5 stopp (kulinarisk vinkling)
- [x] Midtbyen på 30 min: skriv nytt for 4-5 stopp

---

### 5. Oppdater seed-script og kjør

**Fil:** `scripts/seed-trips.ts`

#### 5.0. Legg til upsert-støtte (KRITISK — uten dette oppdateres ikke eksisterende turer)

Nåværende seed-script har kun INSERT-logikk. Eksisterende turer SKIPpes:
```typescript
if (existing) { console.log(`SKIP: Already exists`); skipped++; continue; }
```

Bakklandet & Bryggene og Smak av Trondheim eksisterer allerede. Uten endring vil kun Midtbyen opprettes.

- [x] Legg til `--force` CLI-flag i seed-scriptet
- [x] Hvis `--force` og trip eksisterer: slett gamle `trip_stops`, update `trips`-metadata, insert nye stopp
- [x] Behold eksisterende trip-ID (viktig for `project_trips`-referanser)
- [x] Test: `npx tsx scripts/seed-trips.ts --force --dry-run` — verifiser at eksisterende turer oppdateres

```typescript
const FORCE_UPDATE = process.argv.includes("--force");

if (existing) {
  if (!FORCE_UPDATE) {
    console.log(`SKIP: "${tripDef.title}" already exists (use --force to update)`);
    skipped++;
    continue;
  }
  console.log(`UPDATE: "${tripDef.title}" — deleting old stops, re-inserting...`);
  await client.from("trip_stops").delete().eq("trip_id", existing.id);
  await client.from("trips").update({ ...tripFields }).eq("id", existing.id);
  // Insert new stops with existing trip ID
}
```

#### 5a. Oppdater Bakklandet & Bryggene

- [x] Oppdater transition_text for alle stopp (med teaser chain)
- [x] Oppdater local_insight med research-verifisert innhold
- [x] Vurder å legge til 1-2 ekstra stopp (PRD: 5-6 stopp, nå har vi 4)
- [x] Verifiser at alle poiSearch-termer matcher eksisterende POI-er i DB

#### 5b. Oppdater Smak av Trondheim

- [x] Legg til `description_override` per stopp (kulinarisk kontekst)
- [x] Oppdater transition_text og local_insight
- [x] Sjekk at Ravnkloa er inkludert (PRD nevner den som POI-gap)
- [x] Verifiser poiSearch-matching

#### 5c. Opprett Midtbyen på 30 minutter (NY)

- [x] Legg til ny TripDef i TRIPS-arrayet
- [x] `category: "sightseeing"`, `difficulty: "easy"`, `durationMinutes: 30`, `distanceMeters: ~1200`
- [x] 4-5 stopp innenfor 0.8 km radius fra Scandic Nidelven (63.4337, 10.3981)
- [x] `featured: true`, `tags: ["sightseeing", "rask tur", "highlights"]`
- [x] Skriv transition_text med teaser chain (kort, punchy for rask tur)
- [x] Skriv local_insight per stopp

#### 5d. Deprioritér andre turer

- [x] Sett `featured: false` for Historisk Trondheim, Kaffebar-ruten, Barnas Trondheim
- [x] Behold dem i seed-scriptet (ikke slett), bare ikke featured
- [x] De 3 demo-turene skal ha `featured: true`

#### 5e. Oppdater metadata

- [x] Sett korrekt `distanceMeters` for alle 3 demo-turer (basert på faktisk rute)
- [x] Sett korrekt `durationMinutes`
- [x] Verifiser at `stopCount` stemmer med antall stopp

#### 5f. Kjør seed

- [x] `npx tsx scripts/seed-trips.ts --force --dry-run` — verifiser at alle 3 turer vises (2 UPDATE + 1 INSERT)
- [x] `npx tsx scripts/seed-trips.ts --force --publish` — seed og publiser
- [x] Verifiser i browser: `/for/scandic/scandic-nidelven/trips` viser 3 featured turer

---

### 6. Verifisering og opprydding

- [x] **Build:** `npm run build` kompilerer uten feil
- [x] **Lint:** `npm run lint` ingen nye feil
- [x] **Trip Library:** Verifiser at 3 featured turer vises korrekt
- [x] **Enkelt-tur:** Klikk på hver tur, verifiser at stopp vises med innhold
- [x] **POI-er i Explorer:** Nye POI-er synlige med editorial content
- [x] **Transition-tekst:** Les gjennom alle transition_text — teaser chain fungerer narrativt
- [x] **Local insight:** Les gjennom alle — distinkt fra transition_text, retnings-uavhengig

---

## Akseptkriterier

- [x] `sightseeing` er gyldig trip-kategori i DB, TypeScript-typer, og genererte Supabase-typer
- [x] TripLibraryClient.tsx har gradient og ikon for sightseeing (ingen TypeScript-feil)
- [x] Alle manglende POI-er (Gamle Bybro landemerke, Ravnkloa, evt. Stiftsgården, Torvet) finnes i DB med editorial content, `area_id = 'trondheim'`, `trust_score = 1.0`
- [x] Bakklandet & Bryggene har oppgradert transition_text med teaser chain og research-verifisert local_insight
- [x] Smak av Trondheim har description_override med kulinarisk kontekst og oppgradert local_insight
- [x] Midtbyen på 30 min eksisterer som ny tur med 4-5 stopp, komplett innhold
- [x] Seed-scriptet støtter `--force` flag for upsert av eksisterende turer
- [x] Alle 3 turer har `featured: true` i DB
- [x] Andre turer har `featured: false`
- [x] Ingen editorial content inneholder forgjengelig info (priser, åpningstider)
- [x] `npm run build` og `npm run lint` passerer
- [x] Alle nye POI-er synlige i Explorer

---

## Viktige filer

| Fil | Endring |
|-----|---------|
| `supabase/migrations/034_add_sightseeing_trip_category.sql` | NY — add sightseeing to CHECK (med IF EXISTS) |
| `supabase/migrations/035_trip_landmark_pois.sql` | NY — opprett manglende POI-er (med area_id, trust_score, BEGIN/COMMIT) |
| `lib/types.ts` | Legg til sightseeing i TRIP_CATEGORIES + labels |
| `lib/supabase/types.ts` | Regenerer etter migrasjon |
| `app/for/[customer]/[project]/trips/TripLibraryClient.tsx` | Legg til sightseeing gradient + ikon |
| `scripts/seed-trips.ts` | Legg til --force upsert, oppdater innhold, legg til Midtbyen-tur |

---

## Rekkefølge / avhengigheter

```
1. DB-migrasjon (sightseeing + type-regen)  ← må kjøres først
1b. TripLibraryClient.tsx (gradient/ikon)   ← avhenger av 1 (TripCategory-type)
2. POI-research + opprettelse               ← avhenger av 1 (sightseeing POI-er)
3. Innholds-skriving (transition/insight)   ← avhenger av 2 (trenger POI-er å referere til)
4. Seed-script: legg til --force upsert     ← kan gjøres parallelt med 2+3
5. Seed-script: oppdater innhold            ← avhenger av 2+3+4
6. Kjør seed + verifiser                    ← avhenger av 5
7. Opprydding + commit                      ← avhenger av 6
```

---

## Autonomi-notater

Dette sprinten er designet for **høy autonomi**. Claude kan:
- Researche med WebSearch for fakta-verifisering
- Bruke Curator-skill for editorial voice
- Kjøre migrasjoner og seed-script
- Verifisere visuelt med Chrome DevTools MCP

**Bruker reviewer etterpå** — visuelt i browser, spesielt:
- Tone i transition_text (hybrid valgt som default, bruker kan be om alternativer)
- Local insight-kvalitet
- Stopp-utvalg for Midtbyen-turen
- Cover images (IKKE del av dette sprinten — Sprint 5)
