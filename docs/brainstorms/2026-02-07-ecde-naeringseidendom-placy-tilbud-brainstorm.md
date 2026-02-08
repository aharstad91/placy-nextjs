# Brainstorm: Placy Report for Næringseiendomer — ECDE Case

**Dato:** 2026-02-07
**Status:** Utforsket
**Trigger:** ECDE (E C Dahls Eiendom) som eksempel på næringseiendom-kunde i Trondheim

---

## Kontekst

**ECDE** er en av de største eiendomsforvalterne i Trondheim sentrum. De eier og leier ut 9+ eiendommer — kontor, handel, restaurant, hotell. Portefølje inkluderer Powerhouse, Pirsenteret, Toldboden, Kongens gate 18, m.fl.

**Problemet:** ECDEs eiendomssider mangler nabolagskontekst. Ingen kart, ingen "hva finnes rundt bygget", ingen transportinfo. Potensielle leietakere må selv finne ut hva som er i nærheten. Dette er en tapt mulighet for å selge beliggenhet.

**Placy Report** er allerede posisjonert mot eiendom (products.md: "Næringseiendom og privat eiendom — som vil markedsføre nabolag og beliggenhet").

---

## Hva vi bygger

**Placy Nabolagsrapport** — en embedbar, interaktiv nabolagsrapport per kontoreiendom.

ECDE legger inn en `<iframe>` på sine eiendomssider (f.eks. ecde.no/powerhouse). Potensielle kontorleietakere får en rik, visuell oversikt over hva som finnes rundt bygget.

### Innhold per Report

**Automatisk lag (data-drevet):**
- Interaktivt kart med POI-markører
- Reisetidsanalyse: Alt innen 5/10/15 min gange
- Kategorier: Lunsj, kaffe, treningssenter, kollektivtransport, parkering, dagligvare
- Sanntidsdata: Bysykkelstasjoner, buss/trikk-holdeplasser med avgangstider
- Fakta-kort: "12 lunsjsteder innen 5 min", "3 min til nærmeste bysykkel"

**Redaksjonelt lag (per eiendom):**
- Nabolagets karakter og profil (AI-generert, manuelt justert)
- Editorial hooks per POI: "Lokalfavoritt", "Perfekt for kundemøter", "Byens beste kaffe"
- Bygning-spesifikk vinkling (Powerhouse = bærekraft/premium, Pirsenteret = fjord/maritimt)

### Distribusjon

- **Primært:** Embed/iframe på ECDEs eiendomssider
- **Sekundært:** Placy-hosted link (placy.no/ecde/powerhouse) for deling i e-post/prospekter
- **Fremtidig:** PDF-eksport for trykte prospekter

---

## Hvorfor denne tilnærmingen

**Hybrid-modell** (automatisk data + redaksjonelt lag) valgt fordi:

1. **Skalerbart:** Samme genererings-pipeline for alle 9+ eiendommer
2. **Føles kuratert:** Redaksjonelt lag gjør at hver eiendom føles unik
3. **Unfair advantage:** Reisetidsanalyse + sanntids transport er noe ECDE ikke kan bygge selv
4. **Verdi-bevis:** Leietaker ser umiddelbart verdien av beliggenheten — "12 lunsjsteder innen 5 min gange"

---

## Forretningsmodell

- **Pris per eiendom, engangspris** — f.eks. 5-15k per nabolagsrapport
- ECDE betaler for produksjon, Placy hoster/vedlikeholder
- Mulig oppselg: Kvartalsvis oppdatering av data, nye POI-er, sesong-tilpasning

### Salgspitch til ECDE

> "Beliggenheten er det viktigste salgsargumentet for kontorlokaler. Men ecde.no sier ingenting om hva som finnes rundt bygget. Med Placy Nabolagsrapport får potensielle leietakere et interaktivt kart med alle lunsj-steder, kaffebarer, treningssenter og kollektivtransport — innen gangavstand. Embeddes rett på eiendomssiden."

### Skalerbarhet

Samme konsept fungerer for alle næringseiendomer i Norge:
- Andre forvaltere i Trondheim (Realinvest, Reitan Eiendom, Ivar Koteng)
- Nasjonale aktører (Entra, Norwegian Property, Mustad Eiendom)
- Eiendomsmeglere med næringssegment (DNB Næringsmegling, Cushman & Wakefield)

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|-----------|------|-------------|
| Målgruppe | Kontorleietakere | Størst volum, enklest å demonstrere verdi |
| Tilnærming | Hybrid (auto + redaksjonelt) | Skalerbart men føles kuratert |
| Distribusjon | Embed/iframe | Sømløs integrasjon på ECDEs eksisterende sider |
| Prismodell | Engangspris per eiendom | Enkelt å selge, lav terskel |
| Killer-feature | Reisetidsanalyse + redaksjonell storytelling | Data OG historie — det ECDE ikke kan gjøre selv |

---

## Åpne spørsmål

1. **Embed-design:** Hva er maks bredde/høyde for iframe på ECDEs WordPress-side? Responsivt design er kritisk.
2. **POI-dekning:** Har vi nok POI-data i Trondheim sentrum, eller trengs Google Places-berikelse per eiendom?
3. **Demo-strategi:** Bør vi bygge én gratis demo-rapport (f.eks. Powerhouse) for å vise ECDE, og ta betalt for resten?
4. **Konkurrenter:** Finnes det lignende tjenester for næringseiendom i Norge? (Datscha, Arealstatistikk har data men ikke interaktivt kart med nabolag.)
5. **White-label:** Bør Report-en ha Placy-branding eller white-label for ECDE?

---

## Neste steg

Kjør `/workflows:plan` for å definere teknisk implementering av embed-bar Report-mal for kontoreiendommer.
