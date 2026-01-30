# Lens Log

*Systematisk oversikt over alle definerte linser. Oppdateres fortlopende.*

---

## Format

Hver linse registreres med:

| Felt | Beskrivelse |
|------|-------------|
| **ID** | Unik referanse for bruk pa tvers av sesjoner (f.eks. `A`, `B`, `portrait`) |
| **Navn** | Kort, beskrivende navn |
| **Hypotese** | En setning som forklarer hva linsen tester |
| **Status** | `defined` → `prototyped` → `evaluated` → `selected` / `discarded` / `parked` |
| **Runde** | Hvilken runde linsen tilhorer (Explore / Refine / Polish) |

Statuser:

| Status | Betydning |
|--------|-----------|
| `defined` | Hypotese formulert, ikke bygget ennaa |
| `prototyped` | Prototype bygget, klar for sammenligning |
| `evaluated` | Sett pa og vurdert, funn dokumentert |
| `selected` | Valgt som retning (eller del av hybrid) |
| `discarded` | Forkastet etter evaluering |
| `parked` | Interessant, men ikke aktuell na — kan gjenopptas |

---

## Runde 1: Explore

**Dato:** 2026-01-30
**Kjernesporsmal:** Hvordan presenterer vi 1200+ POI-er som en meningsfull nabolagsopplevelse for noen som vurderer en lokasjon?
**Fase:** Explore (radikalt forskjellige retninger)

### Lens A — Nabolagsportrettet

| | |
|---|---|
| **ID** | `portrait` |
| **Status** | `prototyped` → brainstormet + bygget 2026-01-30 |
| **Hypotese** | Folk kjoper med folelser. Narrativ og editorial dybde er verdien. |
| **Primaerflate** | Longform tekst og bilder. Kontekstkart mellom seksjoner. |
| **POI-ens rolle** | Karakterer i en fortelling — utvalgt og sekvensert for narrativ effekt. |
| **Brukerens modus** | Lese, bli inspirert. |
| **Foler seg som** | En NYT/NRK longform feature om nabolaget ditt. |
| **Kurasjon** | Stram: 10-20 POI-er. Kun de mest karakteristiske. |
| **Narrativ** | Nabolagets identitet som rod trad. 3-5 tematiske kapitler. |
| **Brainstorm** | `docs/brainstorms/2026-01-30-lens-a-nabolagsportrettet-brainstorm.md` |
| **Plan** | `docs/plans/2026-01-30-feat-lens-a-nabolagsportrettet-plan.md` |
| **Prototype** | `components/variants/portrait/` — 7 filer. URL: `/v/portrait` |
| **Laerdom** | Magazine-varianten var for generisk/template-aktig. For mye listing, for lite narrativ. Longform tvinger frem ekte fortelling. Hardkodet narrativt innhold fungerer godt for prototypen — 3 kapitler med 12 POI-er vevd inn i prosa. Statiske Mapbox-kart mellom kapitler gir kontekst uten interaktivitetskompleksitet. |

### Lens B — Utforskeren

| | |
|---|---|
| **ID** | `explorer` |
| **Status** | `prototyped` — brainstormet + bygget 2026-01-30 |
| **Hypotese** | Folk vil oppdage selv. Frihet og interaktivitet er verdien. |
| **Primaerflate** | 50/50 split: interaktivt kart + synkronisert POI-liste. |
| **POI-ens rolle** | Punkter aa oppdage — dukker opp progressivt ved zoom. |
| **Brukerens modus** | Klikke, filtrere, zoome, oppdage. |
| **Foler seg som** | Google Maps moter en lokal venn som hvisker tips. |
| **Kurasjon** | Alle POI-er (~1200), progressivt avslort via zoom/clustering. |
| **Editorial** | Bonus-lag: badge paa markorer med editorialHook. Sparkle-ikon + amber boks i kortet. |
| **Brainstorm** | `docs/brainstorms/2026-01-30-lens-b-utforskeren-brainstorm.md` |
| **Prototype** | `components/variants/explorer/` — 4 komponenter. URL: `/v/explorer` |
| **Laerdom** | 50/50 split gir balanse mellom kartfrihet og listeoversikt. "Lokal venn"-hints differensierer fra ren kartvisning. Mapbox native clustering haandterer 1200+ POI-er uten problemer. |

### Lens C — Nabolagsrapporten

| | |
|---|---|
| **ID** | `report` |
| **Status** | `prototyped` — brainstormet + bygget 2026-01-30 |
| **Hypotese** | Boligkjopere trenger bevis. Data og dekning slar narrativ. |
| **Primaerflate** | Tema-scorer med tetthetskart, highlight-kort, og kompakte lister. |
| **POI-ens rolle** | Datapunkter — aggregert per tema, med highlight-kort for topp 2-3. |
| **Brukerens modus** | Skanne, evaluere. |
| **Foler seg som** | Meglerrapport++ med varm Airbnb-tone. Profesjonell men tilgjengelig. |
| **Kurasjon** | Alle POI-er (aggregert), topp 2-3 per tema highlightet. |
| **Narrativ** | Sammendrag-tekst med nokkeltall inline. Tema-seksjoner med scorer. |
| **Brainstorm** | `docs/brainstorms/2026-01-30-lens-c-nabolagsrapporten-brainstorm.md` |
| **Plan** | `docs/plans/2026-01-30-feat-lens-c-nabolagsrapporten-plan.md` |
| **Prototype** | `components/variants/report/` — 9 filer. URL: `/v/report` |
| **Laerdom** | Datadrevet tilnaerming funker godt med 91 POI-er. 4 temaer passerer terskel (>=3 POI). Statiske Mapbox-kart per tema gir rask visuell oversikt uten interaktivitetskompleksitet. "Vis alle"-toggle holder kompaktlister haandterbare. Varm tone (amber aksent, off-white bakgrunn) balanserer data-tyngden. |

### Sammenligning

| | Portrait (A) | Explorer (B) | Report (C) |
|---|---|---|---|
| Kjerneverdi | Folelse | Frihet | Bevis |
| Primaerflate | Tekst/bilder | Kart | Dashboard |
| Brukerens modus | Lese | Utforske | Skanne |
| Kartets rolle | Stotte | Hovedscene | Visualisering |
| Editorial hooks | Helten | Bonus | Valgfri dybde |

### Funn

*Oppdateres etter evaluering.*

---

<!--
## Runde 2: Refine (mal for fremtidige runder)

**Dato:**
**Kjernesporsmal:**
**Fase:** Refine (varianter innenfor valgt retning)
**Bygger pa:** Runde 1, Lens [X]

### Lens D — [Navn]

| | |
|---|---|
| **ID** | `` |
| **Status** | `defined` |
| **Hypotese** | |
| **Bygger pa** | Lens [X] fra Runde 1 |
| **Hva som er nytt** | |
-->
