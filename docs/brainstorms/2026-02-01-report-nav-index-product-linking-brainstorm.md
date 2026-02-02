# Report: Sticky Nav, Tema-Index & Produktkobling

**Dato:** 2026-02-01
**Status:** Brainstorm
**Trigger:** Report er produktet som syr sammen Explorer, Guide og Report — trenger navigasjon som reflekterer dette.

## Hva vi bygger

### 1. Sticky produktnav (topp)

Fast navbar som alltid er synlig fra toppen av siden.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Quality Hotel Augustin    [Explore|Guides|Report]   🔗  │
│  ← venstre                  ← pill-nav midten     → høyre │
└──────────────────────────────────────────────────┘
```

- **Venstre:** Prosjektnavn (hotellnavn)
- **Midten:** Pill-nav med tre produkter — Explore, Guides, Report. Aktiv tab er uthevet (inspirert av Chat/Cowork/Code pill-toggle). Lenker til faktiske produktsider.
- **Høyre:** Delelenke (share/kopier URL)

**Viktig:** Denne nav-en er felles for alle tre produkter. Den vises også på Explorer og Guide. Aktiv tab endres basert på hvilken side du er på.

### 2. Tema-index med tags

Plasseres rett under hero-ingressen, over første temaseksjon.

```
[🍽 Spis & Drikk (13)] [🚌 Transport (6)] [🛒 Daglig (4)] [🏋️ Aktivitet (5)]
```

- Hver tag viser tema-ikonet, navn, og POI-count i parentes
- Klikk → smooth scroll til tema-seksjonen
- Visuelt som pills/chips i Report-designspråket

### 3. POI-lenker til Explorer med kontekstoverføring

Alle POI-klikk i Report (highlight-kort og compact-liste) navigerer til Explorer med:

1. **Fokusert POI** — den spesifikke POI-en er valgt/åpen
2. **Kategorifilter** — matcher tema-seksjonens kategorier (f.eks. "Spis & Drikk" → restaurant, cafe aktive)
3. **Google Maps** — beholdes som sekundær ikon-lenke på kortet

**URL-mønster:**
```
/strawberry/quality-hotel-augustin-explore?poi=credo-restaurant&categories=restaurant,cafe
```

Explorer leser query-params og:
- Setter aktive kategorifiltre
- Fokuserer/åpner POI-kortet
- Sentrerer kartet

### 4. Scroll-preservering mellom produkter

Navigasjon skjer i samme fane. Scroll-posisjon må bevares:

- **Nettleserens tilbake-knapp** etter Explorer → tilbake til Report på riktig scroll-posisjon
- **Sticky nav "Report"-tab** fra Explorer → tilbake til Report med bevart posisjon
- Implementering: Nettleseren håndterer dette naturlig med `history.back()`. For sticky nav kan vi bruke `sessionStorage` for å lagre scroll-posisjon per produktside, eller stole på `history.scrollRestoration`.

## Hvorfor denne tilnærmingen

- **Report som sammenbinder:** Report er ikke bare en artikkel — det er hub-en som knytter de tre produktene sammen. Sticky nav gjør dette eksplisitt.
- **Kontekstoverføring:** Når en bruker leser om restauranter og klikker på Credo, skal Explorer åpne i riktig kontekst — ikke en blank utforsk-alt-visning.
- **Affiliate-mulighet:** POI-kortene kan ha affiliate-lenker i tillegg til Explorer-lenken. Report → Explorer-flyten øker engasjement og tid på plattformen.
- **Skalerbart for tiers:** Basic tier = statiske kort uten Explorer-lenking. Standard/Premium = full produktkobling.

## Nøkkelbeslutninger

| Beslutning | Valg |
|---|---|
| Sticky nav synlighet | Alltid synlig fra toppen |
| Produktnav-lenker | Aktive lenker til andre produkter (separate prosjekter) |
| Produktkobling i data | Hardkodet URL-mønster for nå (`{slug}-explore`, `{slug}-guide`) |
| Tag-klikk oppførsel | Smooth scroll til seksjon |
| POI-klikk i Report | Navigerer til Explorer med POI-fokus + kategorifilter |
| Google Maps-lenke | Beholdes som sekundær ikon |
| Navigasjon mellom produkter | Samme fane, scroll-posisjon bevares |
| Sticky nav scope | Felles komponent som vises på alle tre produkter |

## Åpne spørsmål

1. **Guide-produktet:** Finnes det en Guide-variant for dette hotellet ennå? Hvis ikke, skal "Guides"-tab i nav-en være dimmet/disabled?
2. **Mobil:** Skal sticky nav komprimeres på mobil? Hotellnavnet kan ta mye plass.
3. **Admin-kobling:** Langsiktig trenger vi en måte å koble prosjekter i admin (groupId eller linkedProjects). Parkert for nå.
4. **Tag-scroll offset:** Sticky nav tar plass — smooth scroll må justere for nav-høyden (`scroll-margin-top`).

## Teknisk kontekst

- Portrait-varianten har allerede en sticky header med fade-in — kan gjenbrukes som utgangspunkt, men endres til alltid-synlig.
- ReportThemeSection mangler `id`-attributter — må legges til for anchor-linking.
- Explorer støtter allerede kategorifiltrering via Zustand store — trenger bare å lese query-params ved oppstart.
- `report-data.ts` har all data som trengs for tag-index (tema-id, navn, ikon, POI-count).
