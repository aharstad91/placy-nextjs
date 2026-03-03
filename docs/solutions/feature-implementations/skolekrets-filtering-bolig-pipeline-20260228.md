---
title: "Skolekrets-filtrering i generate-bolig pipeline"
category: feature-implementations
tags: [generate-bolig, skolekrets, school-district, nsr, websearch, quality-pipeline, suburban, editorial-hooks]
module: .claude/commands/generate-bolig.md
symptom: "19 skoler vises i Brøset Explorer-demo — altfor mange for en boligkjøper. Alle skoler innenfor 2.5km radius ble inkludert uten skolekrets-filtrering."
root_cause: "NSR API returnerer alle skoler innenfor radius uten hensyn til skolekrets. Boligkjøpere trenger kun nærskolen (barneskolekrets), ungdomsskolen den sogner til, og nærmeste VGS."
date: 2026-02-28
---

# Skolekrets-filtrering i generate-bolig pipeline

## Problem

Brøset-demoen viste **19 skoler** i Explorer — inkludert skoler fra helt andre skolekretser (Charlottenlund, Rosenborg, Nardo, Lilleby, etc.). En boligkjøper som vurderer Brøset trenger kun å vite:

1. Hvilken barneskole barna vil gå på (bestemt av skolekrets)
2. Hvilken ungdomsskole barneskolen sogner til
3. Nærmeste videregående skole
4. Eventuelle private alternativer (montessori, internasjonal)

**Rotårsak:** Steg 5.5 i generate-bolig hentet alle skoler fra NSR API innenfor 2.5km radius og linket dem til prosjektet uten filtrering. I bykjerner (hotel-pipeline) er dette OK fordi radius er 800m. I forsteder (2500m) gir det 15-20 skoler.

## Undersøkelse

### GeoInnsyn API (ikke tilgjengelig)

Trondheim kommune har et kartverktøy for skolekretser: https://geoinnsyn.no/?application=trondheim&project=finn%20din%20skole

- Sjekket WFS-endepunkt på `kart5.nois.no/trondheim/api/wfs` — over 400 lag, men **ingen skolekretslag**
- GeoInnsyn er en Angular SPA (ISYMap) — skolekretsdataen lastes fra en intern kilde som ikke er eksponert via standard WFS
- Ingen åpent GeoJSON-API for programmatisk oppslag
- Trondheim publiserer ikke skolekretser på Geonorge

### WebSearch-tilnærming (fungerer)

WebSearch + LLM-vurdering gir korrekt skolekrets uten API-avhengighet:

1. **Søk 1:** `"Brøset skolekrets barneskole Trondheim"` → Fant at Brøset ligger i Eberg barneskolekrets
2. **Søk 2:** `"Blussuvoll ungdomsskole mottar elever fra"` → Bekreftet: Blussuvoll mottar fra Åsvang, Eberg, Strindheim, Berg
3. **Kommune-nettsider og skolenes egne sider** er de beste kildene

## Løsning

### Del 1: Fikset Brøset-demoen (manuelt)

**Fjernet 14 skoler, beholdt 5:**

| Beholdt | Type | Begrunnelse |
|---------|------|-------------|
| Eberg skole | Barneskole 1-7 | Nærskole — Brøset er i Eberg barneskolekrets |
| Blussuvoll skole | Ungdomsskole 8-10 | Eberg sogner til Blussuvoll |
| Strinda videregående | VGS | Nærmeste videregående |
| Trondheim montessoriskole | Privat | Privat alternativ innenfor radius |
| Trondheim International School | Privat | Internasjonalt alternativ |

**Steg utført:**
1. Slettet `product_pois` for 14 skoler (28 rader — Explorer + Report)
2. Slettet `project_pois` for 14 skoler (14 rader)
3. Erstattet Åsvang (featured) med Eberg som featured
4. Oppdaterte editorial hooks med skolekrets-kontekst
5. Lagret engelske oversettelser for de 3 oppdaterte skolene
6. Revaliderte cache

### Del 2: Oppdaterte generate-bolig kommandoen (833 → 908 linjer)

Steg 5.5 ble omstrukturert fra ett steg til fire understeg:

#### 5.5a: Hent alle skoler fra NSR (som før)
Uendret — hent alt innenfor radius, opprett POI-er i `pois`-tabellen.

#### 5.5b: Finn skolekrets via WebSearch (NYTT)
```
Søk 1: "{bydel} skolekrets barneskole {kommunenavn}"
Søk 2: "{nærmeste barneskole} ungdomsskole mottar elever fra"
Søk 3: "{prosjektadresse} nærskole skoletilhørighet" (fallback)
```

Bestem: nærskole, ungdomsskole, nærmeste VGS, private alternativer.

#### 5.5c: Filtrer — link kun relevante skoler (NYTT)
Link 4-6 skoler til prosjektet. Resten forblir i `pois`-tabellen for andre prosjekter.

#### 5.5d: Generer skolekretsbevisste editorial hooks (NYTT)
Maler som reflekterer skolekrets-tilhørighet:
- Nærskole: "Nærskolen for {prosjekt} — barneskole for 1.–7. trinn..."
- Ungdomsskole: "Ungdomsskolen for {prosjekt} — elever fra {barneskoler} starter her..."
- VGS: "Nærmeste videregående — {studietilbud}..."

## Nøkkeldesignbeslutninger

### WebSearch over API for skolekrets
GeoInnsyn-API-et er ikke åpent. WebSearch er:
- **Universelt:** Fungerer for alle norske byer, ikke bare Trondheim
- **Oppdatert:** Fanger endringer i skolekretser (som skjer regelmessig)
- **Robust:** Flere kilder (kommune-sider, skolesider, lokalaviser)
- **Nøyaktig nok:** Vi trenger 1 barneskole + 1 ungdomsskole — ikke polygon-presisjon

### POI-er opprettes, men linkes ikke
Alle NSR-skoler opprettes i `pois`-tabellen (for gjenbruk av andre prosjekter), men kun de relevante linkes til `project_pois`/`product_pois`. Dette følger eksisterende mønster: "Slett ALDRI fra pois-tabellen."

### Skolekretsbevisste hooks > generiske hooks
"Nærskolen for Brøset" er mye mer verdifullt for en boligkjøper enn "Grunnskole i nabolaget." Hooksene kommuniserer at dette er DERES skole — det er en kjøpsfaktor.

## Gotchas

- **Skolekretser endres:** Trondheim reviderte kretsgrensene i juni 2024. WebSearch fanger alltid siste versjon.
- **Åsvang var featured, Eberg var ikke:** Fjerne skoler kan fjerne featured-markering. Sjekk og erstatt alltid.
- **GeoInnsyn "GeoJson"-knapp:** Ser ut som den eksporterer data, men er en Angular-komponent som krever interaksjon — ikke et REST-endepunkt.
- **Barneskole vs. 1-10 skole:** Noen skoler er 1-10 (kombinert barne- og ungdomsskole). Disse fungerer som BÅDE nærskole og ungdomsskole.

## Filer

| Fil | Endring |
|-----|---------|
| `.claude/commands/generate-bolig.md` | Steg 5.5 omstrukturert (5.5a-d), gotcha #11, QA-sjekk oppdatert |

## Relatert

- `docs/solutions/feature-implementations/generate-bolig-quality-pipeline-rewrite-20260228.md` — Forrige rewrite av generate-bolig
- `docs/solutions/feature-implementations/generate-bolig-infrastructure-20260227.md` — DB migration, kategorier
- `docs/solutions/feature-implementations/poi-quality-pipeline-bolig-20260227.md` — Grovfilter-implementering
- [Finn din skolekrets — Trondheim kommune](https://www.trondheim.kommune.no/tema/skole/praktisk-informasjon-skole/finn-din-skolekrets/)
- [Forskrift om skolekretsgrenser](https://lovdata.no/dokument/LF/forskrift/2024-06-12-1680)
