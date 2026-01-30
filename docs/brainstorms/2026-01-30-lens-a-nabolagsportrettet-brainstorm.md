# Brainstorm: Lens A — Nabolagsportrettet

**Dato:** 2026-01-30
**Status:** Klar for implementering
**Neste steg:** `/workflows:plan`

---

## Hva vi bygger

En **longform redaksjonell prototype** for Lens A (Nabolagsportrettet). En sammenhengende scrollside som forteller nabolagets identitet — som en NRK-spesial eller NYT feature-artikkel.

Prototypen er en ny, selvstendig variant (`portrait`) som erstatter det mislykkede magazine-forsøket. Den tester hypotesen: **folk kjøper med følelser — narrativ og editorial dybde er verdien.**

### Hva det skal føles som

En longform feature-artikkel om et nabolag. Leseren scroller gjennom en sammenhengende fortelling der steder dukker opp naturlig som bevis på nabolagets identitet. Ingen grids, ingen kort-lister, ingen dashboard. Bare tekst, bilder, og steder vevd inn i fortellingen.

### Hva det IKKE er

- Ikke en POI-liste i pen innpakning (det var magazine)
- Ikke et interaktivt kart (det er Lens B)
- Ikke en rapport med tall (det er Lens C)

---

## Hvorfor denne tilnærmingen

### Lærdom fra magazine-varianten

Magazine-varianten (`components/variants/magazine/`) feilet på tre måter:

1. **For generisk** — Føltes som en template, manglet sjel. POI-kort i grid er et mønster alle har sett.
2. **For mye listing, for lite narrativ** — Ble en pen katalog, ikke et portrett. POI-ene var listeoppføringer, ikke karakterer.
3. **Feil estetisk retning** — Stone-paletten og grid-layouten støttet ikke følelsesbasert storytelling.

### Hva longform løser

Longform-formatet tvinger frem ekte narrativ. Du kan ikke scrolle gjennom en feature-artikkel og føle at det er en liste. Strukturen krever:
- En rød tråd (nabolagets identitet)
- Utvalg (10-20 POI-er, ikke 1200)
- Kontekst (hvorfor dette stedet hører hjemme i fortellingen)
- Sekvens (rekkefølgen betyr noe)

---

## Nøkkelbeslutninger

### 1. Narrativ struktur: Identitetstemaer

Fortellingens røde tråd er **nabolagets identitet** — hva gjør dette stedet til dette stedet?

Strukturen:
```
Hero (fullskjerm bilde + tittel)
  ↓
Intro: "Hva er dette nabolaget?"
  ↓
Kapittel 1: Identitetstema (f.eks. "Matbyen")
  → Tekst som forteller, 2-3 POI-er vevd inn
  → Kontekstkart
  ↓
Kapittel 2: Neste tema (f.eks. "Elvebredden")
  → Samme mønster
  ↓
... 3-5 kapitler totalt
  ↓
Avslutning: "Hvem passer dette for?"
```

### 2. Stram kurasjon: 10-20 POI-er

Kun de mest karakteristiske stedene. Hvert sted får plass, kontekst, og en tydelig rolle i fortellingen. Resten er usynlig.

Dette betyr at curation-pipelinen (`lib/lens/curate.ts`) brukes aggressivt — men utvalget handler like mye om narrativ rolle som om rating.

### 3. Kontekstkart mellom seksjoner

Små kartfragmenter mellom avsnitt som viser hvor du er i fortellingen. Ikke interaktive dashboards — subtile, støttende illustrasjoner. Kartet er underordnet teksten.

### 4. POI-er integrert i tekst, ikke i kort

POI-er dukker opp inline i fortellingen — med bilde, navn, og editorial hook — men som del av tekst-flyten. Ikke som et separat komponent-grid.

### 5. Isolert prototype

Følger implementation guide: ingen delte komponenter med default-story eller magazine. Ren, selvstendig prototype i `components/variants/portrait/`.

---

## Åpne spørsmål

1. **Innholdskvalitet:** Longform krever godt innhold. Nåværende editorial hooks er 1-2 setninger per POI. Trenger vi lengre tekst for at prototypen skal fungere? Hardkoder vi narrativ tekst for prototypen?
2. **Bildekvalitet:** Google Places-bilder er variable. Trenger vi placeholder-/fallback-strategi, eller aksepterer vi det for prototypen?
3. **Kapittelstruktur:** Mapper tema-kapitlene til eksisterende `themeStories` fra story-structure, eller definerer vi en egen narrativ struktur?

---

## Sammenligning med andre linser

| | Portrait (A) | Explorer (B) | Report (C) |
|---|---|---|---|
| **Kjerneverdi** | Følelse | Frihet | Bevis |
| **Primærflate** | Longform tekst | Fullskjerms kart | Dashboard |
| **Brukerens modus** | Lese, bli inspirert | Utforske, oppdage | Skanne, evaluere |
| **POI-synlighet** | 10-20 (stram kurasjon) | Alle (via filtre) | Alle (aggregert) |
| **Kartets rolle** | Kontekst mellom seksjoner | Hovedscene | Tetthetskart |
| **Minner om** | NYT/NRK longform | Google Maps + lokal venn | Meglerrapport |

---

*Neste: `/workflows:plan` for implementeringsplan.*
