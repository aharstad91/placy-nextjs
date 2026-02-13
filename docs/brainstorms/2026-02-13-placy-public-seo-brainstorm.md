# Brainstorm: Placy Offentlig Nettsted (placy.no) — SEO + Monetisering

**Dato:** 2026-02-13
**Kontekst:** Placy har 1000+ POIs i Trondheim med tiers, editorial hooks, og scores. Alle UI-komponenter finnes. Mål: eksponere dette innholdet via offentlige, SEO-optimaliserte sider for å bygge organisk trafikk som grunnlag for fremtidig monetisering via promoterte steder.

---

## Strategisk bakgrunn

### Konkurranseanalyse: "restauranter trondheim"

| Pos | Side | Type | Kvalitet |
|-----|------|------|----------|
| 1 | TripAdvisor | Global plattform | Uslåelig domain authority |
| 2 | Google Places-karusell | Google egen | Ikke en konkurrent |
| 3 | Visit Trondheim | Offisiell turisme | Generisk, men god DA |
| 4 | helleskitchen.org | Blogg-post (aug 2025) | Enkel listicle, aldri oppdatert |
| 5 | midtbyen.no | Bydels-side | Begrenset innhold |
| 6 | truestory.no | Listicle-blogg | 12 restauranter, ingen dybde |
| 7 | Le Bistro | Enkelt-restaurant | Ranker fordi konkurransen er svak |
| 8 | Visit Norway | Nasjonal turisme | Generisk |
| 9 | Vinpuls | Vin-blogg | 5 restauranter |

**Konklusjon:** Etter TripAdvisor og Visit Trondheim er konkurransen svak. Placy har allerede mer innhold (99 mat-steder, tier-rangert, med editorial hooks) enn alt som ranker på posisjon 3-9. Posisjon 3-5 er realistisk med god teknisk SEO og rikt innhold.

### To-benet forretningsmodell

1. **B2B (nå):** Hoteller og eiendom betaler for Report/Explorer/Trips
2. **B2C-til-B2B (fremtidig):** Placy bygger publikum via SEO → selger synlighet til lokale bedrifter

Disse forsterker hverandre: hver B2B-klient genererer POI-data som beriker de offentlige sidene.

---

## Hva vi bygger

### Offentlige sider i eksisterende Next.js-app

Nye ruter som gjenbruker eksisterende komponenter og data, optimalisert for PageSpeed 100 og SEO 100.

### URL-struktur

```
placy.no/                                    → By-oversikt (landingsside)
placy.no/trondheim                           → By-side med kategorier
placy.no/trondheim/restauranter              → Kategori-side (Report-stil)
placy.no/trondheim/steder/britannia-hotel    → POI-side (rik profil)
placy.no/trondheim/guide/historisk-byvandring → Guide-side
```

### B2B-ruter flyttes til /for/ prefix

```
placy.no/for/scandic/scandic-lerkendal/report    (tidl. /scandic/...)
placy.no/for/scandic/scandic-lerkendal/explore
```

Redirect fra gamle URLer til nye. B2B trenger ikke SEO — deles via QR/direkte lenker.

---

## Nøkkelbeslutninger

### 1. Samme app, nye ruter
Offentlige sider lever i samme Next.js-app som B2B. Deler komponenter, data-lag, Supabase-klient. Ingen separat repo.

### 2. By-oversikt som hjemmeside
Landingsside med byer Placy dekker. Starter med Trondheim. Skalerbar når flere byer kommer.

### 3. Kategori-sider i Report-stil
Gjenbruk Report-komponentene: featured highlights øverst, kompakt liste under, kart. Innholdet finnes allerede — det er bare å eksponere det via nye ruter.

### 4. Rike POI-sider
Individuell side per POI med: navn, kategori, rating, editorial hook, local insight, bilder, kart, åpningstider, "lignende steder", og lenker til guider/rapporter stedet dukker opp i.

### 5. Egen Placy-header + footer
Offentlige sider får Placy-logo i header, navigasjon mellom byer/kategorier, og footer med "Om Placy", kontakt etc. B2B beholder sin eksisterende header.

### 6. AI-generert innhold + manuell review
Intro-tekster for by- og kategori-sider genereres av Claude basert på POI-data. Manuell review og justering. Raskest å skalere med god kvalitet.

### 7. Promotert-lag: design nå, bygg senere
Datamodell og UI-plassering designes inn fra start. Men ingen funksjonalitet før trafikk finnes. Tydelig separasjon mellom "Anbefalt" (redaksjonell kvalitet, Tier 1) og "Promotert" (betalt plassering, merket som annonse).

---

## Teknisk: PageSpeed 100 + SEO 100

### Kart-strategi: Statisk bilde → Lazy interaktivt

Mapbox GL JS er ~200KB+ og tanker PageSpeed. Løsning:

1. **Server-render:** Fast-størrelse container med Mapbox Static API-bilde (vanlig `<img>`, null JS)
2. **Etter load:** IntersectionObserver/requestIdleCallback trigger → bytt til interaktivt Mapbox
3. **Resultat:** Google ser et optimalisert kartbilde. Bruker får interaktivt kart etter 1-2s.

Hvorfor det fungerer:
- **LCP:** Tekst/bilder rendrer først, kartet er ikke LCP-element
- **CLS = 0:** Container har fast størrelse fra start
- **TBT:** Mapbox laster etter målevinduet
- **FCP:** HTML og CSS rendrer umiddelbart

### Rendering: ISR med 24t revalidation

Sider genereres statisk ved første besøk, regenereres i bakgrunnen hvert døgn. POI-data endres sjelden — perfekt for ISR.

### Bilder: Next/Image med proxy

- `next/image` for automatisk resizing, WebP/AVIF-konvertering, lazy loading
- Proxy Google Places-bilder via /api/image-endepunkt som cacher og optimaliserer
- Riktig `sizes`-attributt for responsive images uten overdimensjonering

### Structured Data: Full JSON-LD schema

| Side-type | Schema |
|-----------|--------|
| POI-side | Restaurant, Cafe, Hotel, TouristAttraction, LocalBusiness + AggregateRating |
| Kategori-side | ItemList + BreadcrumbList |
| Guide-side | TouristTrip + ItemList |
| By-side | City + BreadcrumbList |

Rich snippets (stjerner, bilder, åpningstider) i Google-resultater.

### SEO-grunnlag

- `generateMetadata` per side med unike title/description
- Canonical URLs
- Open Graph + Twitter Cards for sosial deling
- `sitemap.xml` generert fra POI-database
- `robots.txt`
- Proper heading-hierarki (h1 → h2 → h3)
- Alt-tekster på alle bilder
- Breadcrumb-navigasjon

---

## Sidetyper og innhold

### By-side (/trondheim)

- Hero med by-navn og intro-tekst (AI-generert)
- Kategori-grid (Restaurant, Kafé, Bar, Aktiviteter...) med antall steder og snitt-rating
- Topp-highlights (Tier 1 POIs) på tvers av kategorier
- Utvalgte guider/turer
- Statisk kartbilde med alle Tier 1-markører

### Kategori-side (/trondheim/restauranter)

- Intro-tekst (AI-generert, SEO-optimalisert)
- Featured highlights (Tier 1, Report-stil kort)
- Kompakt liste med alle steder, sortert by tier → score
- Sticky kart med markører (statisk → lazy interaktivt)
- Sub-kategorier som seksjoner (Fine Dining, Casual, etc.)
- Breadcrumb: Placy → Trondheim → Restauranter

### POI-side (/trondheim/steder/britannia-hotel)

- Heltebilde + navn + kategori + rating
- Editorial hook (Placy sin unike tekst)
- Local insight
- Kart med pin (statisk bilde)
- Åpningstider
- Google-bilder (carousel)
- "Lignende steder i nærheten" (andre POIs i samme kategori/nærhet)
- "Finnes i disse guidene/rapportene" (intern lenking)
- JSON-LD med full LocalBusiness/Restaurant schema

### Guide-side (/trondheim/guide/historisk-byvandring)

- Gjenbruk Trip-komponentene
- Rute-kart (statisk → interaktivt)
- Stoppesteder med editorial innhold
- Estimert tid og avstand

---

## Monetisering: Promotert-lag (fremtidig)

### Konsept

| Type | Betydning | Bestemt av |
|------|-----------|------------|
| **Anbefalt** | Redaksjonell kvalitet (Tier 1) | Placy sin kuratering |
| **Promotert** | Betalt plassering med tilbud | Bedriften betaler |

Disse skal **aldri blandes**. Anbefalt er troverdighet. Promotert er tydelig merket.

### Plassering per produkt

- **Kategori-side:** "Tilbud i nærheten"-seksjon, eller promoted kort i listen
- **POI-side:** "Tilbud fra dette stedet" — direkte deal
- **Guide-side:** Promoted "bonus-stopp" med deal
- **Explorer:** Promoted pin/kort i sidepanelet

### Datamodell (designes nå, bygges senere)

- `promotions`-tabell: poi_id, title, description, deal_text, start_date, end_date, active
- Relasjon til `pois`-tabellen
- Separate fra tier-systemet — en Tier 3 POI kan ha en promotion, en Tier 1 trenger ingen

---

## Faser

### Fase 1: Fundament
- Flytt B2B til /for/ med redirects
- Placy-header/footer-komponent
- By-side (/trondheim)
- Kategori-sider (gjenbruk Report-komponenter)
- POI-sider (rik profil)
- SEO: metadata, JSON-LD, sitemap, robots.txt
- Statisk kartbilde → lazy Mapbox
- Next/Image proxy for bilder
- ISR med 24t revalidation

### Fase 2: Innhold + Polish
- AI-genererte intro-tekster (by, kategori)
- Guide-sider
- OG-bilder for sosial deling
- PageSpeed-optimalisering til 100
- SEO-audit og finjustering

### Fase 3: Promotert-lag (etter trafikk)
- Promotions-datamodell
- Visuell plassering i UI
- Admin-verktøy for å opprette promotions

---

## Avklarte spørsmål

- **Slug-strategi:** Uten by-navn — `/trondheim/steder/britannia-hotel`. By-konteksten kommer fra URL-hierarkiet.
- **Flerspråklig:** Norsk + engelsk fra start. Dobler indexerbare sider. Claude genererer begge språk. `hreflang`-tags for å fortelle Google riktig versjon.
- **Brukerinteraksjon:** "Min samling"-funksjonen (allerede bygget i Explorer) på alle offentlige sider. Lagre steder → opprett samling → valgfri e-post. Ingen innlogging nødvendig. Skaper engagement + e-post-leads.
- **Analytics:** Plausible (~1KB, GDPR-vennlig, ingen cookie-banner) + Google Search Console (gratis, søkeord-data). Null PageSpeed-påvirkning.
- **Domain:** placy.no er live, koblet til repo via Vercel. Klar for bruk.

## Ytterligere avklarte spørsmål

- **Google Business Profile:** Ikke nå — fokus på å bygge sidene først. Kan legges til når som helst.
- **Samling-deling som SEO:** Avvent — bygg deling først, beslutt indexering basert på kvaliteten på samlinger som faktisk lages.
- **Engelske kategori-slugs:** `/en/trondheim/restaurants` — engelsk prefix + engelske kategori-navn. By-navn forblir norsk (Trondheim er universelt). Matcher engelske søkeord.

---

## Beslutning

**Tilnærming:** Offentlige SEO-sider i samme Next.js-app, med by-oversikt som landingsside, kategori-sider i Report-stil, rike POI-profiler, og full teknisk SEO-optimalisering (PageSpeed 100, JSON-LD, ISR). Norsk + engelsk fra start for dobbel SEO-overflate. Kart løses med statisk bilde → lazy interaktivt Mapbox. B2B flyttes til /for/ prefix. "Min samling" på alle sider for engagement og e-post-capture. Plausible + Search Console for analytics. Promotert-lag designes inn men bygges når trafikk finnes.

**Neste steg:** Plan → implementering (Fase 1 først).
