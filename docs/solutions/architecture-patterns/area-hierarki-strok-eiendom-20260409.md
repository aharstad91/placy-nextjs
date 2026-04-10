---
module: Report
date: 2026-04-09
problem_type: database_issue
component: database
symptoms:
  - "Alle POI-er og place_knowledge tagget med area_id='trondheim' — ingen nabolagsgranularitet"
  - "Report-tekster kan ikke hente fakta per strok/nabolag — kun by-niva"
  - "Ingen match mellom meglerens bruk av strok-navn og Placys datamodell"
root_cause: missing_validation
resolution_type: migration
severity: high
tags: [area, strok, bydel, hierarchy, eiendom, neighborhood, supabase, place-knowledge]
---

# Area-hierarki: City → Bydel → Strok for eiendomsmarkedet

## Problem

Eiendomsmarkedet i Norge opererer pa strok-niva (~22-25 navngitte nabolag per by), men Placys `areas`-tabell hadde kun én rad: "trondheim". Alle POI-er og place_knowledge-fakta var tagget pa by-niva, noe som gjorde det umulig a hente nabolagsspesifikk kunnskap for Report-produktet.

## Environment

- Module: Report, place_knowledge, areas
- Stack: Next.js 14, Supabase (PostgreSQL)
- Migration: `050_areas_hierarchy_strok.sql`
- Date: 2026-04-09

## Symptoms

- `place_knowledge` kunne kun peke til "trondheim" — ikke "broset" eller "moholt"
- Report-tekster hadde ingen tilgang til strok-spesifikke fakta
- POI-er manglet nabolagstilhorighet — alt var "Trondheim"
- Meglerannonsene bruker konsekvent strok-navn ("Strindheim/Persaunet", "Moholt/Eberg") — Placy hadde ingen match

## Research: Granularitet i norsk eiendom

| Niva | Antall (Trondheim) | Brukt av |
|------|---------------------|----------|
| Kommune | 1 | SSB, offisielt |
| Bydel | 4 | FINN.no, kommune, prisstatistikk |
| **Strok** | **~25** | **Meglere, annonser, dagligtale** |
| Levekarssone | 60 | Kommune (helse/velferd) |
| Grunnkrets | ~280 | SSB (fineste enhet) |

**Konklusjon:** Strok-niva er riktig for Placy. Bydel er for grovt (Ostbyen = 39.000 innbyggere), grunnkrets er for fint.

## Solution

Utvidet eksisterende `areas`-tabell med hierarki istedenfor ny tabell — bevarer alle eksisterende FK-relasjoner.

**Nye kolonner pa `areas`:**
```sql
ALTER TABLE areas ADD COLUMN parent_id TEXT REFERENCES areas(id);
ALTER TABLE areas ADD COLUMN level TEXT NOT NULL DEFAULT 'city'
  CHECK (level IN ('city', 'bydel', 'strok'));
ALTER TABLE areas ADD COLUMN boundary JSONB;
ALTER TABLE areas ADD COLUMN postal_codes TEXT[];
```

**Seedet hierarki for Trondheim:**
- 1 city (trondheim)
- 4 bydeler (midtbyen, ostbyen, lerkendal, heimdal)
- 31 strok med center-koordinater og postnumre

**Kaskade-modell for kunnskapsbasen:**
```
place_knowledge WHERE area_id IN ('broset', 'lerkendal', 'trondheim')
→ Strok-fakta: "Pilotomrade for gronn byutvikling"
→ Bydel-fakta: "NTNU-campus, studentmiljo"
→ By-fakta: "Norges teknologihovedstad"
```

## Why This Works

1. **Én tabell, ingen FK-endringer:** `place_knowledge.area_id` og `pois.area_id` peker allerede til `areas(id)`. Na kan de peke til et strok istedenfor bare byen.
2. **Kaskaderende kunnskap:** En rapport for Broset henter fakta fra broset + lerkendal + trondheim — akkurat som en megler tenker.
3. **Postnummer-matching:** Hvert strok har `postal_codes` array for rask matching fra geocode-resultat.
4. **Utvidbart:** Boundary-polygoner (GeoJSON) kan legges til per strok for presis koordinat-matching.

## Prevention

- Nye prosjekter fra `/generate-bolig` skal bruke steg 1.5 for strok-matching — aldri sett `area_id = 'trondheim'` pa POI-er
- Nye byer krever seeding av bydeler og strok for migrasjonen fungerer — sjekk `areas`-tabellen
- Ved tvil om bydel-tilhorighet: Broset/Moholt/Valentinlyst er Lerkendal (IKKE Ostbyen), Tyholt/Singsaker er Midtbyen (IKKE Ostbyen)

## Related Issues

- See also: [bransjeprofil-eiendom-bolig-20260303.md](bransjeprofil-eiendom-bolig-20260303.md) — 7 temaer som matcher meglerens fokus
- See also: [report-kart-per-kategori-modal-20260409.md](report-kart-per-kategori-modal-20260409.md) — per-kategori modal-arkitektur
