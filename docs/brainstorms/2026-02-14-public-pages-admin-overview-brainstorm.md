# Brainstorm: Admin-oversikt for offentlige sider

**Dato:** 2026-02-14
**Status:** Ferdig — videre til plan

## Problem

Placy har bygget en rekke offentlige sider (kategorisider, guider, landingssider) som driver dynamisk trafikk. Men det finnes ingen admin-oversikt over dette innholdet — i motsetning til `/admin/projects` som gir full kontroll over kundeprosjekter.

Brukeren har "mistet kontrollen" over hva som er produsert.

## Beslutninger

### Formål: Inventar/oversikt
- Hovedsakelig **lesing** — se hva som finnes, med tellere og lenker
- Ikke redigering eller CMS-funksjonalitet i denne iterasjonen
- Analogt med `/admin/projects` for kundeprosjekter

### Navigasjon: Dashboard + dedikert side
- **Dashboard:** Ny "Offentlige sider"-seksjon med nøkkeltall (områder, kategorier, guider, landingssider)
- **Dedikert side:** `/admin/public` med full oversikt, gruppert per område

## Innholdstyper å vise

### 1. Områder (DB: `areas`)
- Navn, slug (NO + EN), aktiv-status
- POI-telling, kategori-telling
- Lenke til live-side

### 2. Kategorisider (DB: `categories` + `category_slugs`)
- Navn, slug, SEO-tittel
- POI-telling per kategori per område
- Om intro-tekst er satt
- Lenke til live-side

### 3. Kuraterte guider (`curated-lists.ts`)
- Tittel, slug, beskrivelse
- Filter-konfigurasjon (kategori, tier, bbox, limit)
- POI-telling (hentes dynamisk)
- Lenke til live-side

### 4. Landingssider (hardkodede routes)
- Visit Trondheim (NO + EN)
- Hovedside (NO + EN)
- Status: alle manuelt vedlikeholdt

## Nøkkeltall for Dashboard

- Antall områder (aktive)
- Antall kategorisider (med POIs)
- Antall kuraterte guider
- Antall landingssider
- Totalt antall offentlige POIs (trust-filtrert)
- Editorial coverage (% POIs med editorial_hook)

## Teknisk tilnærming

- Server component — hent data fra Supabase + les curated-lists
- Ingen ny DB-migrering nødvendig — all data finnes allerede
- Kuraterte guider og landingssider er hardkodet — vises som statisk liste

## Ikke i scope

- Redigering av innhold fra admin
- Opprettelse av nye områder/kategorier fra admin
- Migrering av hardkodet innhold til database
- EN-versjoner som separate innslag (vises som "har EN-versjon: ja/nei")
