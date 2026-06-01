# Brainstorm: Smartere POI-sortering i Report tema-seksjoner

**Dato:** 2026-03-04
**Kontekst:** Transport & Mobilitet-temaet i Report viser feil prioritering i første 6 POI-er

## Problemet

I Report-visningen sorteres POI-er per tema i to steg:
1. **Avstandssortering** (gangavstand/haversine) — nærmest først
2. **Re-sortering etter kvalitet** (`byTierThenScore`) — tier + Google-score

Steg 2 **overskriver** steg 1. Resultat: en godt-ratet togstasjon 1km unna vises i første batch, mens en bussholdeplass 200m unna gjemmes bak "Hent flere".

**Konkret eksempel (StasjonsKvartalet, Transport & Mobilitet):**
- Første 6: Lademoen stasjon, 3x bysykkel, Trondheim S, hurtigbåtterminalen
- Bak "Hent flere": Søndre gate Regionbuss (MYE nærmere), flere bysykkelstasjoner
- Blå togstasjon helt til høyre i kartet (Lademoen) tar plass fra nærere, nyttigere POI-er

## Rotårsak i koden

`report-data.ts:386`:
```typescript
const sorted = [...filtered].sort(byTierThenScore);
```

Etter avstandssortering og kategorifiltrering re-sorteres ALT etter tier+score. Avstandsinformasjonen går tapt.

## Tilnærminger

### A: Kategoridiversifisert utvalg (anbefalt)

**Idé:** Velg nærmeste POI fra hver kategori først, fyll deretter med nest nærmeste.

**Algoritme:**
1. Grupper filtrerte POI-er etter kategori (allerede avstandssortert)
2. Runde 1: Plukk nærmeste fra hver kategori (buss, tog, sykkel, trikk, etc.)
3. Runde 2+: Fyll opp til 6 med neste nærmeste, round-robin mellom kategorier
4. Resten → hiddenPOIs

**Fordeler:**
- Garanterer diversitet: én buss + én tog + én sykkel > 3x bysykkel
- Bevarer nærhet som primær sortering
- Enkel å forstå og debugge

**Ulemper:**
- Tier/score ignoreres helt — en tier-1 POI litt lenger unna kan bli slått av en tier-3 POI som er nærmere
- Kan gi uventet rekkefølge hvis mange kategorier i temaet

### B: Vektet kompositt-score

**Idé:** Kombiner avstand, tier og diversitet i én score.

```
score = distanceWeight × normalizedDistance + tierWeight × tier + diversityBonus
```

**Fordeler:**
- Fleksibelt — vekter kan justeres per tema
- Kan balansere alle tre faktorer

**Ulemper:**
- Vekter er vanskelige å kalibrere — "magiske tall"
- Vanskelig for brukeren å forstå hvorfor rekkefølgen er som den er
- Overengineered for problemet

### C: Avstandssortering for transport, tier+score for resten

**Idé:** Ulike sorteringsstrategier per tema-type.

**Fordeler:**
- Transport er det temaet der nærhet er klart viktigst
- Andre temaer (Mat & Drikke, Opplevelser) har nytte av kvalitetssortering

**Ulemper:**
- Inkonsistent brukeropplevelse mellom temaer
- Transport har også nytte av diversitet (ikke bare avstand)

### D: Diversifisert + tier-bevisst hybrid (anbefalt+)

**Idé:** Kombiner A og C. Kategoridiversifisert utvalg, men innen hver kategori: sorter etter tier først, deretter avstand.

**Algoritme:**
1. Grupper etter kategori
2. Innen hver kategori: sorter etter tier → avstand (ikke score)
3. Round-robin: plukk beste fra hver kategori
4. Fyll opp til initial visible count

**Fordeler:**
- Diversitet + tier-bevissthet + nærhet
- Tier-1 bussholdeplass slår tier-3 bussholdeplass, men konkurrerer ikke med sykkel
- Google-score (reviewCount × rating) er IKKE relevant for transport — en bussholdeplass med 0 reviews er like nyttig

**Ulemper:**
- Litt mer kompleks algoritme

## Beslutning

**Tilnærming D** — Diversifisert + tier-bevisst hybrid.

**Gjelder ALLE temaer**, ikke bare transport. Grunnen: også for Mat & Drikke er det bedre å vise 1 restaurant + 1 café + 1 bakeri enn 3 restauranter. Diversitet er universelt verdifullt.

**Unntak:** Temaer med sub-sections (≥15 POI-er i én kategori) — der er POI-ene allerede gruppert per kategori, så round-robin er irrelevant. Innen sub-sections: beholde tier → avstand sortering.

## Scope

1. **Ny sorteringsfunksjon** i `report-data.ts` — erstatter `byTierThenScore` for flat tema-visning
2. **Sub-sections** beholder nåværende logikk men bytter score → avstand som sekundær sortering
3. **Tester** for sorteringslogikken
4. **Ingen UI-endringer** — bare rekkefølgen på POI-ene endres

## Åpne spørsmål

1. Skal tier fortsatt påvirke rekkefølgen innen hver kategori, eller ren avstandssortering?
   → **Ja, tier først** — curator-tier er en bevisst prioritering
2. Hva om et tema bare har 1-2 kategorier? Da er round-robin irrelevant.
   → **Fallback til tier → avstand** når ≤2 kategorier
3. Skal "Hent flere"-batchen også diversifiseres, eller bare first load?
   → **Bare first load** — etter det er avstand god nok
