# Brainstorm: URL-struktur og produktruting

**Dato:** 2026-02-01
**Trigger:** lens-log viser at vi har satt opp `/v/[produktnavn]` som variant-rute. Trenger vi `/v/` i URL? Trenger vi produktnavnet synlig? Hvordan ser hele URL-arkitekturen ut — fra admin til sluttbruker?

---

## Status quo

```
/                                    → redirect til demo
/:customer/:project                  → standard visning (portrait)
/:customer/:project/v/explorer       → explorer-variant
/:customer/:project/v/report         → report-variant
/:customer/:project/v/portrait       → portrait-variant
/admin/*                             → admin-panel
/api/*                               → API-ruter
```

Problemstillinger:
- `/v/` er et teknisk artefakt fra prototyping ("variant") — gir ingen mening for sluttbruker
- Produktnavnet i URL er forvirrende: sluttbrukeren vet ikke hva "explorer" eller "report" er
- Kunden (hotell, eiendomsselskap) bryr seg heller ikke om produktnavnet — de vil ha *sin* side

---

## Kjerneinnsikt

Sluttbrukeren ser aldri mer enn **ett produkt om gangen**. En hotellturtist får Explorer. En boligkjøper får Report. Produktvalget er en *admin-beslutning*, ikke en brukerhandling.

Derfor: **Produktnavnet hører hjemme i admin, ikke i URL-en sluttbrukeren ser.**

---

## Forslag A: Prosjektet *er* produktet — flat URL

```
/:customer/:project
```

Hvert prosjekt har en `productType` i databasen (`explorer` | `report` | `portrait` | `guide`). URL-en er ren. Riktig komponent rendres server-side basert på config.

**Eksempler:**
```
/britannia/trondheim-sentrum         → Explorer (hotell)
/klp-eiendom/ferjemannsveien-10      → Report (boligprosjekt)
/visit-trondheim/historisk-vandring   → Guide (turisme)
```

**Fordeler:**
- Reneste URL — ingen tekniske artefakter
- Sluttbruker ser bare merkevare + prosjektnavn
- Produkt kan byttes i admin uten å endre URL
- SEO-vennlig

**Ulemper:**
- Én kunde kan ikke ha *samme prosjekt* i flere produkttyper under samme URL
- Men: når ville det skje? Et hotell har Explorer, ikke Report.

---

## Forslag B: Valgfri sufiks for multi-produkt

```
/:customer/:project                  → standard (primært produkt)
/:customer/:project/utforsk          → Explorer (norsk slug)
/:customer/:project/rapport          → Report
/:customer/:project/guide            → Guide
```

Standard-URL rendrer primærproduktet (satt i admin). Suffikser er kun nødvendige hvis kunden har flere produkter for samme prosjekt.

**Fordeler:**
- Standard-casen er ren (`/:customer/:project`)
- Støtter edge case der ett prosjekt har flere produkter
- Norske slugs ("utforsk", "rapport") føles mer naturlige enn engelske

**Ulemper:**
- Introduserer kompleksitet for en edge case som kanskje aldri inntreffer
- Norske slugs låser oss til ett språk

---

## Forslag C: Produkttype som prefix

```
/utforsk/:customer/:project          → Explorer
/rapport/:customer/:project          → Report
/guide/:customer/:project            → Guide
```

**Fordeler:**
- Tydelig separasjon mellom produkter
- Enkelt å route

**Ulemper:**
- URL-en eksponerer produktstruktur til sluttbrukeren
- Kunden vil ha *sin* URL, ikke Placys produktnavn først
- Bryter med "kundens merkevare først"-prinsippet

---

## Forslag D: Subdomener per kunde (fremtid)

```
britannia.placy.no                   → Explorer for Britannia
ferjemannsveien10.klp.placy.no       → Report for KLP
```

**Fordeler:**
- Renest mulig for sluttbrukeren
- Kan white-label til kundens eget domene

**Ulemper:**
- Vesentlig mer infrastruktur (wildcard DNS, SSL, Vercel config)
- Overkill nå — men verdt å ha i bakhodet

---

## Admin-URL-struktur

Admin trenger uansett en tydelig struktur:

```
/admin                               → dashboard
/admin/kunder                        → kundeliste
/admin/kunder/:id                    → kundeprofil
/admin/prosjekter                    → alle prosjekter (på tvers av kunder)
/admin/prosjekter/:id                → prosjektredigering
/admin/prosjekter/:id/innhold        → innholdsredigering (story/editorial)
/admin/prosjekter/:id/poi            → POI-administrasjon
/admin/prosjekter/:id/forhåndsvis    → preview av sluttbruker-visning
/admin/poi                           → global POI-bank
/admin/kategorier                    → kategoriadministrasjon
```

Viktig: Admin-URL og sluttbruker-URL er helt separert. Admin bruker ID-er, sluttbruker bruker slugs.

---

## Anbefaling

**Forslag A** som standard. Enkelt, rent, kundevennlig.

Grunner:
1. Ett prosjekt = ett produkt er den naturlige modellen
2. `/v/` var et prototyping-artefakt, ikke en produktbeslutning
3. Produkttype er admin-config, ikke URL-state
4. Kunden vil dele `britannia.placy.no/trondheim-sentrum` — ikke `/v/explorer`
5. Forslag B kan legges til *senere* hvis multi-produkt per prosjekt blir reelt

**Migrasjon:**
- `productType` legges til i prosjekt-config (allerede implisitt — hvert prosjekt bruker bare én variant i dag)
- Server-side routing sjekker `productType` og rendrer riktig komponent
- `/v/[variant]` rutes kan beholdes midlertidig med redirect for backwards compat
- Admin-panel får "Produkttype"-dropdown per prosjekt

---

## Åpne spørsmål

1. **Custom domener:** Vil kunder ønske `utforsk.britannia.no` i stedet for `britannia.placy.no`? Vercel støtter custom domains per prosjekt — men dette er fase 2+.
2. **Forhåndsvisning:** Trenger admin en måte å se alle produkttyper for et prosjekt? Isåfall kan `/admin/prosjekter/:id/forhåndsvis?type=explorer` løse det uten å eksponere det i produksjons-URL.
3. **Collection-deling:** Explorer støtter `?c=<slug>` for delte collections. Denne mekanismen funker uavhengig av URL-struktur — query params er ortogonale.
4. **Språk:** Bør admin-URL-er være norske (`/admin/kunder`) eller engelske (`/admin/customers`)? Engelsk er konvensjonen i kode, men norsk matcher brukerspråket.

---

*Neste steg: Beslutt retning → plan for URL-migrering*
