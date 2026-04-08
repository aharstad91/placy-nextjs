# Event Explorer — Forretningsplan

**Dato:** 2026-03-09
**Status:** Strategisk retning, ikke startet

## Visjon

Placy Event Explorer blir standardverktøyet for festivaler og arrangementer i Norge som trenger interaktivt kart. Vi løser et reelt problem som nesten alle multi-venue arrangementer har: besøkere trenger å navigere mellom steder, men arrangøren har bare råd til en liste og en PDF.

## Markedet

### Problemet
- Festivaler/arrangementer med mange venues bruker listevisning + PDF-kart eller Google My Maps
- Custom kartløsning koster 100k+ via byrå — utenfor budsjettet til de fleste
- Resultatet: dårlig besøkeropplevelse, folk finner ikke frem, folk går glipp av ting

### Målgruppe (prioritert)
1. **Åpne hus / atelierer** — Open House, Oslo Open, Trondheim Open, B-Open
2. **Kulturnetter** — Oslo Kulturnatt, Kulturnatt Trondheim
3. **Multi-venue musikkfestivaler** — by:Larm, Trondheim Calling
4. **Kunsthelger** — Oslo Art Weekend
5. **Mat/kultur-festivaler** — Gladmat, Matstreif, Arendalsuka
6. **Design/arkitektur** — Designers' Saturday, Oslo Arkitekturtriennale

### Markedsstørrelse Norge
- 60+ arrangementer identifisert (se `docs/research/festivals-events-norway-explorer-prospects.md`)
- Konservativt 100+ med grundigere søk
- Nordisk: 500+
- Open House Worldwide: 50+ byer globalt

## Verdiproporsjon

| For arrangøren | For besøkeren |
|----------------|---------------|
| Interaktivt kart uten byrå-kostnad | "Hva er nærmest meg nå?" |
| Oppsett på timer, ikke uker | Dagsfilter: "Vis bare lørdag" |
| Fungerer på mobil | Lagre favoritter → personlig agenda |
| Besøksdata og analytics | Ruteoptimert rekkefølge |
| Årlig oppdatering er triviell | Fungerer offline (stretch) |

## Forretningsmodell

### Prising (forslag)
| Tier | Pris | Inkluderer |
|------|------|------------|
| **Starter** | 10-15k/år | Explorer med kart, dagsfilter, opptil 100 POIs |
| **Pro** | 20-30k/år | + Agenda-visning, lagring, analytics, white-label |
| **Enterprise** | 40-60k/år | + Custom domene, API-integrasjon, dedicated support |

### Enhetsmarginer
- Marginkostnad per ny kunde: ~0 (plattformen er bygget)
- Oppsett-tid per arrangement: 2-4 timer (import + QA)
- Mapbox-kostnad: neglisjerbar ved <1000 daglige brukere per event

### Inntektspotensial
- 10 kunder à 15k = 150k/år
- 30 kunder à 20k = 600k/år
- 50 kunder à 25k = 1.25M/år

## Go-to-Market

### Fase 1: Referanser (mars-mai 2026)
1. **Mail Frida Rusnak** (Open House Oslo) — vis eksisterende demo
2. **Følg opp Nadja** (Open House Trondheim) — via foreningen
3. **Mål:** 1-2 gratis/billige pilotprosjekter som referanse
4. **Levere:** Fungerende Event Explorer for deres arrangement

### Fase 2: Landingsside + case (juni-august 2026)
1. **placy.no/events** — landingsside med verdiproposisjon + cases
2. Dokumenter pilot-resultatene (screenshots, besøkstall, testimonial)
3. Pris offentlig synlig (eller "fra X kr/år")

### Fase 3: Oppsøkende salg (august-desember 2026)
1. Generisk Event Explorer pitch til topp 100 arrangementer i Norge
2. Personalisert mail med: "Vi laget dette for [referanse], se hvordan det kan se ut for [deres arrangement]"
3. Timing: 2-4 måneder før arrangementets dato

### Fase 4: Skalering (2027)
1. Nordiske arrangementer
2. Open House Worldwide-nettverket
3. Selvbetjent onboarding ("last opp CSV med steder")
4. Partnere: kommuner, destinasjonsselskaper

## Traction-loop

```
Arrangement bruker Placy
    → Besøkere ser Placy-branding
    → Andre arrangører ser det fungerer
    → Flere kunder
    → Bedre produkt (feedback)
    → Repeat
```

Festivaler er ferskvare — hvert arrangement er en ny eksponering. 50 arrangementer = 50 lanseringer per år med tusenvis av besøkere som ser Placy i aksjon.

## Risiko

| Risiko | Mitigering |
|--------|-----------|
| Arrangører har ikke budsjett | Lav pris + gratis pilot for de første |
| Google My Maps er "godt nok" | Agenda-visning og mobil UX er differensiatoren |
| Sesongbasert (arrangementer er korte) | Mange arrangementer = jevn pipeline |
| Noen bygger det selv | De fleste har ikke tech-kompetanse — byrå er for dyrt |

## Neste steg

- [ ] Skriv mail til Frida Rusnak (Open House Oslo)
- [ ] Følg opp Nadja (Open House Trondheim)
- [ ] Bygg Event Explorer features (se teknisk plan)
- [ ] Lag placy.no/events landingsside
- [ ] Identifiser Trondheim Open, B-Open kontaktpersoner
