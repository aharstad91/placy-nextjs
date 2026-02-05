# Brainstorm: Kategorigruppering i Produkter-fanen

**Dato:** 2026-02-05
**Kontekst:** Admin → Prosjekter → [prosjekt] → Produkter-fanen
**Problem:** 84 POI-er i en flat, alfabetisk liste er uoversiktlig for redaktører

## Nåværende situasjon

Når man utvider et produkt (f.eks. Explorer) i Produkter-fanen, vises alle POI-er som en flat liste med checkboxer. Hver POI viser navn, global kategori (grå tekst), og eventuelt Google-rating. Med 84 POI-er må man scrolle gjennom hele listen for å finne og velge relevante steder.

Kategorier som finnes i dette prosjektet:
- Restaurant (~15 stk)
- Kafé (~15 stk)
- Bysykkel (~30 stasjoner)
- Buss (~8 holdeplasser)
- Dagligvare (~3 stk)
- Tog (1 stk)

## Kjerneproblem

1. **Uoversiktlig:** 84 POI-er i flat liste — vanskelig å finne det man leter etter
2. **Ingen batch-operasjon per kategori:** Kan bare "Velg alle" eller "Fjern alle" for HELE produktet, ikke per kategori
3. **Ingen filtrering:** Kan ikke se bare kafeer eller bare restauranter

## Beslutning: Grupper POI-er etter kategori

### UX-design

**Grupperte seksjoner med kategori-header:**
Erstatt flat liste med kollapserbare kategorigrupper inne i hvert produkt.

```
Explorer                                    84/84 POI-er
├─ ☐ Restaurant (15)                        15/15 valgt
│  ├─ ☑ AiSuma Restaurant          ★ 4.5
│  ├─ ☑ Alma's                     ★ 4.1
│  └─ ...
├─ ☐ Kafé (15)                              14/15 valgt
│  ├─ ☑ Antikvariatet              ★ 4.6
│  └─ ...
├─ ☐ Bysykkel (30)                          30/30 valgt
│  └─ ...
├─ ☐ Buss (8)                               0/8 valgt
│  └─ ...
├─ ☐ Dagligvare (3)                         3/3 valgt
│  └─ ...
└─ ☐ Tog (1)                                1/1 valgt
   └─ ...
```

**Kategori-header med checkbox:**
- Klikk på kategori-checkbox → velg/fjern alle POI-er i den kategorien
- Viser "X/Y valgt" per kategori
- Kategori-header er alltid synlig (ikke kollapserbar — alle POI-er synlige under sin kategori)
- Ikonet og fargen fra kategorien brukes i headeren

**Toppnivå-kontroller bevares:**
- "Velg alle" / "Fjern alle" fungerer fortsatt på hele produktet
- "X av Y valgt" viser totalt antall

### Sortering

- Kategorier sortert etter antall POI-er (størst først), eller alfabetisk
- POI-er innenfor hver kategori sortert alfabetisk (som nå)

### Visuelt

- Kategori-header: litt større font, bold, med kategori-ikon og farge-dot
- POI-rader indent under sin kategori
- Separator mellom kategorier for klarhet

### Edge cases

- POI-er uten kategori → "Ukategorisert" gruppe nederst
- Kategori med bare 1 POI → vises normalt (ingen spesialbehandling)
- Alle POI-er i en kategori fjernet → viser "0/N valgt", visuelt dimmet

## Ikke i scope

- Søkefelt i POI-listen (kan legges til senere)
- Drag-and-drop rekkefølge
- Endre kategori fra denne visningen
- Kollapserbare kategorier (overkompliserer — vis alle)
