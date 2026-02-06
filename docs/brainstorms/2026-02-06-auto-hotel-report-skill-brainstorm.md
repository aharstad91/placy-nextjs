# Brainstorm: Automatisert Hotel Report/Explorer Skill

**Dato:** 2026-02-06
**Status:** Besluttet

## Hva vi bygger

En Claude Code skill (`/generate-hotel`) som tar hotellnavn + adresse og automatisk genererer et komplett Report + Explorer-produkt med POI-er, editorial hooks, og kartmarkører.

**Eksempel bruk:**
```
/generate-hotel "Radisson Blu Trondheim Airport" "Langstranda 1, Stjørdal"
```

## Hvorfor denne tilnærmingen

- Claude Code har allerede tilgang til **nettsøk** (for editorial hooks), **Supabase API** (for database-operasjoner), og alle eksisterende **generatorer** i kodebasen
- Én kommando → komplett produkt. Ingen kontekstbytte mellom verktøy
- Fleksibelt: kan enkelt justere parametere, kjøre på nytt, polere resultatet
- Eksisterende byggeklosser dekker 90% av funksjonaliteten allerede

## Kontekst: Validering

Radisson Hotels har allerede en primitiv versjon av dette konseptet på sine hotellsider ("Attraksjoner i nærheten") - enkel liste med avstand. Placy kan levere en **dramatisk bedre** versjon med interaktivt kart, temabasert organisering, ratings, og redaksjonelt innhold.

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| **Input** | Hotellnavn + adresse | Balanse mellom enkelhet og presisjon |
| **Kvalitetsnivå** | Produksjonsklart | Skal kunne publiseres direkte |
| **Produkter** | Report + Explorer | Dekker nabolagsrapport og interaktivt kart |
| **Editorial hooks** | Nettsøk for ALLE POI-er | Best mulig kvalitet fra dag 1 |
| **Tilnærming** | Claude Code Skill | Utnytter nettsøk + eksisterende infrastruktur |
| **Kategoriutvalg** | Dynamisk + kontekstuell | Se "Report vs Explorer radius" nedenfor |
| **Volum** | 10-20 hoteller (kort sikt) | En hotellkjede med flere lokasjoner |

## Viktig innsikt: Report vs Explorer radius

**Explorer** = lokal radius (gangavstand fra hotellet)
- Stjørdal for Radisson Værnes
- Det som er rundt hjørnet

**Report** = kontekstuell radius (hva gjesten faktisk bryr seg om)
- For flyplasshotell: inkluder nærmeste by (Trondheim)
- For byhotell: bydelen + nærliggende attraksjoner
- For feriehotell: aktiviteter og natur i regionen

**Prinsipp:** 95% av gjestene på Værnes flyr til Trondheim, ikke Stjørdal. Rapporten må reflektere dette. Skillen må ha et "mindset" som forstår hotellkonteksten og tilpasser seg.

### Hvordan implementere dette

Skillen gjør to runder med discovery:
1. **Lokal discovery** (1km radius) → Explorer + deler av Report
2. **Regional discovery** (for flyplasshotell: finn nærmeste by, kjør discovery der også) → Report

## Skill-flyt (høynivå)

```
1. Geocode adresse → koordinater
2. Analyser kontekst (flyplasshotell? byhotell? feriehotell?)
3. Opprett/finn kunde i Supabase
4. Opprett prosjekt med koordinater
5. Opprett Report + Explorer produkter
6. Lokal POI-discovery (1km radius)
   - Google Places (alle kategorier)
   - Entur (buss, tog)
   - Bysykkel (hvis tilgjengelig)
7. Regional POI-discovery (kun Report, hvis relevant)
   - Finn nærmeste by
   - Kjør discovery for restauranter, kultur, attraksjoner
8. Upsert POI-er til database
9. Link POI-er:
   - Explorer: kun lokale POI-er
   - Report: lokale + regionale POI-er
10. Generer editorial hooks per POI via nettsøk
    - Alle POI-er får nettsøk
    - editorialHook + localInsight per POI
11. Valider og rapporter resultat med URL-er
```

## Eksisterende byggeklosser

| Modul | Fil | Status |
|-------|-----|--------|
| POI-discovery (Google) | `lib/generators/poi-discovery.ts` | Klar |
| POI-discovery (Entur) | `lib/generators/poi-discovery.ts` | Klar |
| POI-discovery (Bysykkel) | `lib/generators/poi-discovery.ts` | Klar |
| Import API | `app/api/admin/import/route.ts` | Klar |
| Upsert med editorial preservation | `lib/supabase/mutations.ts` | Klar |
| Story-struktur generering | `lib/generators/story-structure.ts` | Klar |
| Story-writer (DB) | `lib/generators/story-writer.ts` | Klar |
| Editorial hook generering | Claude Code nettsøk | Eksisterer som manuell prosess |
| Tema-basert organisering | `components/variants/report/report-themes.ts` | Klar |

## Mangler / må bygges

1. **Geocoding-steg** — Konvertere adresse → lat/lng (Mapbox eller Google Geocoding)
2. **Skill-definisjon** — SKILL.md med instruksjoner, flyt, og kontekstforståelse
3. **Kunde-oppsett logikk** — Utlede hotellkjede fra navn, slugifisering, opprett-eller-finn
4. **Kontekstanalyse** — Forstå hotelltype og tilpasse discovery-strategi
5. **Regional discovery** — "Finn nærmeste by"-logikk for flyplasshoteller
6. **Batch editorial hooks** — Systematisk nettsøk + AI-generering per POI
7. **Kvalitetsvalidering** — Sjekk at rapporten har nok POI-er og innhold

## Besvarte spørsmål

- **Kundenavn:** Utledes fra hotellnavn (f.eks. "Radisson Hotels" fra "Radisson Blu ...") — skillen bruker AI til å parse dette
- **Radius:** Dynamisk basert på kontekst. Lokal (1km) for Explorer, utvidet for Report ved behov
- **Editorial hooks:** Alle POI-er får nettsøk — best mulig kvalitet fra start
- **Geocoding:** Mapbox (allerede API-nøkkel i prosjektet) eller Google (allerede brukt for Places)

## Åpne spørsmål

- Hvor lang tid per hotell er akseptabelt? (editorial hooks for 50+ POI-er tar tid)
- Skal skillen ha en `--dry-run` modus som viser hva den planlegger å gjøre?
- Skal den supportere re-kjøring (oppdatere eksisterende prosjekt)?

## Neste steg

Kjør `/workflows:plan` for å designe den tekniske implementeringen av skillen.
