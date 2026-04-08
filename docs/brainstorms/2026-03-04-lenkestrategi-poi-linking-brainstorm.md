# Brainstorm: Lenkestrategi — POI-linking og eksterne kilder

**Dato:** 2026-03-04
**Status:** Besluttet, klar for plan

## Hva vi bygger

En konsistent lenkestrategi for Placy der alle POI-kort på tvers av produkter (Report, Explorer, Guide) lenker til POI-detaljsider, og detaljsidene berikes med kuraterte eksterne kilder ("Kilder & les mer").

## Hvorfor denne tilnærmingen

Placy refererer mye innhold og tekst om steder, men lenker sjelden videre. Det er et tap for:
- **Brukeren** — som vil lese mer om f.eks. Stiftsgårdsparken
- **SEO** — outbound links gir troverdighet, intern linking gir crawlbarhet
- **Plattformen** — POI-detaljsidene eksisterer allerede, men får lite trafikk fordi ingenting lenker dit

### Eksisterende infrastruktur (viktig kontekst)

Placy har ALLEREDE:
- POI-detaljsider for alle POI-er med slug: `/{area}/steder/{slug}`
- Editorial hooks, place knowledge, Google-data på detaljsidene
- Sidebar med Google Maps, offisiell nettside, åpningstider
- MapPopupCard i Report har allerede en "Les mer"-knapp som lenker til detaljsiden

Men MANGLER:
- ReportPOICard lenker IKKE til detaljsider
- ReportHighlightCard lenker til Explorer eller Google Maps, ikke detaljsider
- Explorer-kort lenker ikke til detaljsider
- Ingen "Kilder & les mer"-seksjon på detaljsidene
- Ingen datamodell for redaksjonelle eksterne lenker

## Nøkkelbeslutninger

### 1. Lenke overalt — alle produkter
Konsistent linking fra POI-kort til detaljsider i Report, Explorer, og Guide. Ikke bare Report.

### 2. Alltid lenke — ingen terskel
Alle POI-er får lenke til sin detaljside, uavhengig av om de har kuratert innhold. Noen sider er rike (Stiftsgården med place knowledge), andre er tynne (Rema 1000 med bare Google-data) — men alle har en side.

### 3. Redaksjonelle kilder — håndplukkede
Eksterne lenker (Wikipedia, kommunesider, lokale blogger) kurateres manuelt per POI. Ikke automatisk. Kvalitet > kvantitet.

### 4. Kilder på detaljsiden
En "Kilder & les mer"-seksjon på POI-detaljsiden. Ikke inline-lenker i brødtekst.

### 5. Prioritering — tre faser

**Fase 1: POI-kort → detaljsider (lavthengende frukt)**
- ReportPOICard, ReportHighlightCard, Explorer-kort lenker til `/{area}/steder/{slug}`
- Ingen ny datamodell. Bare UI-endringer.
- Umiddelbar verdi: intern linking, bedre brukeropplevelse.

**Fase 2: Redaksjonelle kilder på detaljsiden**
- Ny datamodell: `poi_external_links`-tabell (poi_id, url, label, source_type, display_order)
- "Kilder & les mer"-seksjon i POIDetailBody eller POIDetailSidebar
- Manuell kuratering via admin eller direkte i database

**Fase 3: POI-katalog/indeksside**
- `/{area}/steder/` — indeksside som lister POI-er per kategori
- Long-tail SEO-verdi ("restauranter Bakklandet Trondheim")
- Kan filtreres på tema (Natur & Friluftsliv, Mat & Drikke, etc.)

## Åpne spørsmål (for planfasen)

- Skal POI-kort åpne detaljsiden i ny fane eller samme fane?
- Hvor i POI-detaljsiden plasseres "Kilder & les mer" — sidebar eller hovedinnhold?
- Trenger vi en admin-flate for å legge til eksterne lenker, eller holder direkte DB-manipulering i starten?
- Skal fase 3 (katalogside) grupperes etter bransjeprofil-temaer (Barn & Oppvekst, Hverdagsliv, etc.)?

## SEO-gevinst (samlet)

| Fase | SEO-effekt |
|------|------------|
| Fase 1 | Intern linking — detaljsider crawles og indekseres bedre |
| Fase 2 | Outbound links — troverdighet, topical authority |
| Fase 3 | Long-tail søketrafikk — kategorisider indekseres |
