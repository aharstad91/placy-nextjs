---
title: "feat: Eiendom URL-arkitektur — porte Placy til /eiendom/"
type: feat
date: 2026-03-07
deepened: 2026-03-07
tech-audit: 2026-03-07
tech-audit-verdict: YELLOW
---

# feat: Eiendom URL-arkitektur

## Enhancement Summary

**Deepened on:** 2026-03-07
**Research agents used:** 4 (Next.js redirect patterns, Visningsassistent UI, LLM text generation, Institutional learnings)

### Key Improvements from Research
1. **Route group `(tools)/`** for `/eiendom/generer` og `/eiendom/tekst` — forhindrer slug-konflikt med `[customer]` uten middleware-hack
2. **ProductNav trenger INGEN endring** — allerede generisk, bare ny `basePath` i layout
3. **ReportCompactList** er perfekt base for Visningsassistent — 48px rader, mobilvennlig, bevist mønster
4. **qrcode.react v4.2.0 allerede installert** — brukt i CollectionDrawer
5. **`metadataBase`** bør innføres i root layout for renere canonical URLs
6. **Anthropic SDK** mangler i package.json — må legges til for tekst-generator runtime API
7. **Curator voice principles** bør styre LLM-prompten for beliggenhetstekst
8. **`/kart/` redirect via thin server component** er bedre enn middleware DB-lookup (caching, enklere)

### Institutional Learnings Applied
- `api-route-security-hardening` → Input-validering med regex + bounds i `/api/eiendom/tekst`
- `cross-product-component-reuse` → Gjenbruk ReportCompactList via type-kompatibilitet
- `sitemap-robots-404-production` → Test robots.txt + sitemap etter deploy
- `supabase-client-fetch-caching` → Verifiser `cache: "no-store"` i Supabase-klient
- `verifisert-tekstgenerering-brainstorm` → Kun fakta som kan verifiseres

---

## Overview

Placy pivoterer til eiendom som vertikal. All funksjonalitet samles under `/eiendom/`-prefikset med konsistent `{kunde}/{slug}`-struktur. Guide/turisme/hotell fryses. Tre moduser per prosjekt (Explorer, Rapport, Visning), selvbetjent inngang, og gratis lead-gen tekst-generator.

## Problem Statement

Nåværende URL-struktur reflekterer en plattform som betjener mange bransjer:
- `/for/{kunde}/{prosjekt}/explore` — B2B Explorer
- `/for/{kunde}/{prosjekt}/report` — Report
- `/kart/{slug}` — Selvbetjent Explorer (hardkodet til customer "selvbetjent")
- `/(public)/generer` — Bestillingsskjema

Problemene:
1. **Ingen vertikal-identitet.** URL-ene sier ikke "eiendom" — de er generiske.
2. **Selvbetjent-bøtta.** Alle selvbetjente prosjekter havner under én dummy-kunde. Ingen kobling til meglerkontor.
3. **Ingen visningsassistent.** Meglere har kun Explorer (kart) og Report (artikkel) — mangler mobil-optimert liste for visninger.
4. **Ingen lead-gen.** Beliggenhetstekst-generatoren (gratis inngang til 999 kr-pakken) eksisterer ikke.
5. **Spredt routing.** Paths bygges inline i 15+ filer uten sentralisert helper.

## Proposed Solution

Ny URL-struktur under `/eiendom/`:

```
placy.no/eiendom/
├── generer                                  — Selvbetjent bestillingsskjema
├── tekst                                    — Gratis beliggenhetstekst-generator
│
│   Per prosjekt (alltid med kunde):
├── {kunde}/{slug}                           — Explorer (default)
├── {kunde}/{slug}/rapport                   — Report
├── {kunde}/{slug}/visning                   — Visningsassistent
```

301-redirects fra alle gamle URL-er. "Selvbetjent"-kunden erstattes med faktisk meglerkjede.

## Technical Approach

### Architecture

```
app/
├── eiendom/
│   ├── layout.tsx                           — Mapbox CSS, eiendom-spesifikk layout
│   ├── (tools)/                             — Route group: statiske verktøy (usynlig i URL)
│   │   ├── generer/
│   │   │   └── page.tsx                     — Selvbetjent bestillingsskjema
│   │   └── tekst/
│   │       └── page.tsx                     — Beliggenhetstekst-generator
│   └── [customer]/
│       └── [project]/
│           ├── layout.tsx                   — ProductNav (Explorer/Rapport/Visning)
│           ├── page.tsx                     — Explorer (default)
│           ├── rapport/
│           │   └── page.tsx                 — Report
│           └── visning/
│               └── page.tsx                 — Visningsassistent (ny)
├── for/                                     — 301 → /eiendom/ (beholdes for redirects)
├── kart/                                    — Thin redirect server component
└── (public)/
    ├── generer/                             — 301 → /eiendom/generer
    └── ...                                  — SEO-sider (uendret)
```

**Hvorfor route group `(tools)/`:** Next.js resolves statiske ruter før dynamiske segmenter. Parentesene gjør mappen usynlig i URL, men forhindrer at "generer" og "tekst" fanges av `[customer]`-segmentet. Samme mønster som eksisterende `(public)/` route group. Ingen middleware-hack nødvendig.

### Sentralisert URL-helper

```typescript
// lib/urls.ts (ny fil)
export function eiendomUrl(customer: string, slug: string, mode?: "rapport" | "visning") {
  const base = `/eiendom/${customer}/${slug}`;
  return mode ? `${base}/${mode}` : base;
}

export function eiendomGenererUrl() {
  return "/eiendom/generer";
}

export function eiendomTekstUrl() {
  return "/eiendom/tekst";
}
```

### Implementation Phases

#### Phase 1: Route Foundation + URL Helper

Oppretter den nye route-strukturen og sentralisert URL-helper. Ingen funksjonalitet ennå — bare skjelettet.

**Oppgaver:**

- [ ] Opprett `lib/urls.ts` med `eiendomUrl()`, `eiendomGenererUrl()`, `eiendomTekstUrl()`
- [ ] Opprett `app/eiendom/layout.tsx` — Mapbox CSS (kopier mønster fra `app/for/layout.tsx`)
- [ ] Opprett `app/eiendom/(tools)/` route group (tom mappe, for Phase 3 og 5)
- [ ] Opprett `app/eiendom/[customer]/[project]/layout.tsx` — ProductNav med dynamiske tabs
  - Hent prosjektdata via `getProjectContainerAsync(customer, slug)`
  - Render `ProductNav` med `basePath = eiendomUrl(customer, slug)`
  - **Bygg tabs dynamisk** fra prosjektets tilgjengelige produkter (ikke hardkod 3 tabs):
    ```typescript
    const products: ProductLink[] = [
      { label: "Explorer", href: basePath },
      { label: "Rapport", href: `${basePath}/rapport` },
      // Visning legges til i Phase 4 når den eksisterer
    ];
    ```
  - **Fix active-tab matching:** Explorer er root path (`/eiendom/X/Y`) som matcher alt via `.startsWith()`. Bruk exact match for Explorer-tab:
    ```typescript
    // I ProductNav eller layout: Explorer = pathname === basePath (exact match)
    // Andre tabs = pathname.startsWith(href) (prefix match)
    ```
- [ ] Oppdater middleware.ts: legg til `/eiendom/` i passthrough-listen (ved siden av `/for/`, `/admin/`)
- [ ] Flytt Plausible analytics-script til `app/eiendom/layout.tsx` (eller root layout) slik at `/eiendom/`-sider trackes
- [ ] Oppdater `app/robots.ts`: tillat `/eiendom/` (IKKE disallow som `/for/`)
- [ ] Legg til `metadataBase` i `app/layout.tsx`:
  ```typescript
  export const metadata = {
    metadataBase: new URL('https://placy.no'),
    // ... eksisterende metadata
  };
  ```
  Gjør at canonical URLs kan bruke relative paths i alle page-filer.

**Akseptansekriterier:**
- `npm run build` passerer med tomme page-filer
- Middleware lar `/eiendom/`-requests passere uten redirect
- Layout-hierarkiet er riktig (Mapbox CSS laster, ProductNav rendrer)
- `robots.txt` inkluderer ikke `/eiendom/` i disallow
- Verifiser at `sitemap.xml` og `robots.txt` fortsatt fungerer etter middleware-endring (kjent gotcha fra `sitemap-robots-404-production`)

**Filer som opprettes:**
- `lib/urls.ts`
- `app/eiendom/layout.tsx`
- `app/eiendom/[customer]/[project]/layout.tsx`

**Filer som endres:**
- `middleware.ts`
- `app/robots.ts`
- `app/layout.tsx` (metadataBase)

---

#### Phase 2: Explorer + Report Migration

Flytter Explorer og Report til nye ruter. Gjenbruker eksisterende komponenter og datafetching.

**Oppgaver:**

- [ ] Opprett `app/eiendom/[customer]/[project]/page.tsx` — Explorer som default
  - Kopier logikk fra `app/for/[customer]/[project]/explore/page.tsx`
  - Oppdater canonical URL til relativ path: `alternates: { canonical: eiendomUrl(customer, slug) }`
  - Oppdater metadata (title, description, og)
  - Bruk `eiendomUrl()` for alle path-referanser
  - Behold `force-dynamic` eksport
- [ ] Opprett `app/eiendom/[customer]/[project]/rapport/page.tsx` — Report
  - Kopier logikk fra `app/for/[customer]/[project]/report/page.tsx`
  - Oppdater canonical URL til relativ path: `alternates: { canonical: eiendomUrl(customer, slug, "rapport") }`
  - Oppdater metadata
  - Bruk `eiendomUrl()` for alle path-referanser
- [ ] Verifiser at ProductNav highlighter riktig tab
  - ProductNav bruker `usePathname()` + `.startsWith()` — bekreftet at det fungerer automatisk med nye paths

**Research Insight — ProductNav trenger INGEN kodeendring:**
Komponenten er allerede generisk (aksepterer `products: ProductLink[]` med `label` + `href`). `usePathname()` matcher automatisk mot nye URL-er. Eneste endring er i layout-filen som sender inn produktlisten.

**Research Insight — metadataBase:**
Med `metadataBase` satt i Phase 1 kan canonical URLs bruke relative paths:
```typescript
// Før (hardkodet):
alternates: { canonical: `https://placy.no/for/${customer}/${slug}/explore` }
// Etter (relativ):
alternates: { canonical: `/eiendom/${customer}/${slug}` }
```

**Akseptansekriterier:**
- `/eiendom/klp-eiendom/ferjemannsveien-10` rendrer Explorer med riktig data
- `/eiendom/klp-eiendom/ferjemannsveien-10/rapport` rendrer Report med riktig data
- ProductNav viser tre tabs og highlighter aktiv side
- Canonical URLs peker til nye `/eiendom/`-paths (verifiser med `view-source:`)
- Metadata (title, og:image, description) er korrekt

**Filer som opprettes:**
- `app/eiendom/[customer]/[project]/page.tsx`
- `app/eiendom/[customer]/[project]/rapport/page.tsx`

---

#### Phase 3: KartExplorer Merge + Selvbetjent → Meglerkjede

Slår sammen `/kart/[slug]` med `/eiendom/[customer]/[slug]`. Erstatter "Selvbetjent"-kunden med faktisk meglerkjede.

**Oppgaver:**

- [ ] Legg til "Meglerkontor"-felt i bestillingsskjemaet (`GenererForm`)
  - Dropdown/autocomplete med eksisterende kunder fra `customers`-tabellen
  - Fritekst-mulighet for nye meglerkontor (opprettes automatisk)
  - Feltet er påkrevd
- [ ] Oppdater `POST /api/generation-requests`:
  - Aksepter `brokerage` (meglerkontornavn) i request body
  - Oppslag/opprett kunde i `customers`-tabellen med **upsert-mønster** (race condition fix):
    ```sql
    INSERT INTO customers (name, slug) VALUES ($1, $2)
    ON CONFLICT (slug) DO NOTHING;
    -- Deretter SELECT for å få ID (RETURNING virker ikke med DO NOTHING)
    SELECT id FROM customers WHERE slug = $2;
    ```
  - **Reservert slug denied-list** — valider at kunde-slug ikke kolliderer med statiske ruter:
    ```typescript
    const RESERVED_SLUGS = ["generer", "tekst", "admin", "api"];
    if (RESERVED_SLUGS.includes(customerSlug)) throw new Error("Reserved slug");
    ```
  - Knytt `generation_requests.customer_id` til faktisk meglerkunde (ikke "selvbetjent")
  - Returner `url: eiendomUrl(customerSlug, addressSlug)` (ikke `/kart/`)
  - **Security:** Valider inputs med Zod + regex bounds (maks 200 tegn for brokerage, NFC-normalisering)
  - **Security:** Eksplisitt `process.env.SUPABASE_SERVICE_ROLE_KEY`-sjekk før DB-kall
- [ ] Migrasjon `048_generation_requests_customer.sql`:
  - Legg til `customer_id` kolonne i `generation_requests` (nullable, FK til customers)
  - `ON DELETE SET NULL` (bevarer audit trail)
  - Existing rows beholder NULL (legacy)
- [ ] Opprett `app/eiendom/(tools)/generer/page.tsx`
  - Flytt logikk fra `app/(public)/generer/page.tsx`
  - Oppdater redirect URL etter generering: `/eiendom/{kunde}/{slug}`
  - Beholder public layout (header/footer) — `(tools)/` route group arver fra `eiendom/layout.tsx`
- [ ] Oppdater `/eiendom/[customer]/[project]/page.tsx` til å håndtere status-visning
  - Sjekk `generation_requests`-status for prosjektet
  - Vis "Genererer..." / "Feilet" / Explorer basert på status
  - Gjenbruk statusvisning fra `app/kart/[slug]/page.tsx`
- [ ] Migrer eksisterende "selvbetjent"-prosjekter:
  - SQL-migrasjon som oppdaterer `projects.customer_id` fra "selvbetjent" til riktig meglerkjede
  - Manuell mapping for eksisterende prosjekter (få stykker)

**Research Insight — NFC-normalisering for norsk adresser:**
Slug-generering bruker NFC (ikke NFD) for å bevare æ/ø/å. NFD + strip diacritics gjør "Åsane" → "Asane". Allerede implementert i `lib/utils/slugify.ts` — aldri inline.

**Research Insight — Supabase error-håndtering:**
Supabase JS client kaster IKKE exceptions — returnerer `{ data, error }`. Try/catch er ubrukelig. Alltid destrukturer begge og sjekk `error` før bruk av `data`.

**Akseptansekriterier:**
- Bestillingsskjemaet krever meglerkontor
- Nye genereringer oppretter prosjekt under riktig meglerkunde
- `/eiendom/{meglerkontor}/{adresse}` fungerer for både nye og gamle prosjekter
- Statusvisning (pending/failed/completed) fungerer på nye URL-er
- API returnerer ny URL-struktur
- Migrasjon kjørt og verifisert mot prod

**Filer som opprettes:**
- `app/eiendom/(tools)/generer/page.tsx`
- `supabase/migrations/048_generation_requests_customer.sql`

**Filer som endres:**
- `app/api/generation-requests/route.ts`
- `lib/supabase/types.ts` (oppdater etter migrasjon)
- `components/generer/GenererForm.tsx` (legg til meglerkontor-felt)

---

#### Phase 4: Visningsassistent (Nytt View)

Mobiloptimert liste-view for meglere på visning. Grupperer POI-er etter tema med navn, avstand og gåtid. Ingen kart — ren informasjon.

**Oppgaver:**

- [ ] Opprett `app/eiendom/[customer]/[project]/visning/page.tsx`
  - Server component med `force-dynamic`
  - Hent data via `getProductAsync(customer, slug, "explorer")`
  - Hent bransjeprofil via `getBransjeprofil(project.tags)` fra `lib/themes/bransjeprofiler.ts`
  - Grupper POI-er etter tema med algoritmen fra `report-data.ts:300-459`
  - Metadata: "Visningsassistent — {prosjektnavn}"
- [ ] Opprett `components/variants/visning/VisningPage.tsx` (client component)
  - Mobiloptimert layout (`max-w-lg mx-auto`)
  - Per tema-seksjon:
    - Header med tema-ikon, navn og antall steder
    - Collapsible (åpne de første 3 som default)
  - Per POI — basert på ReportCompactList-mønsteret:
    ```tsx
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: poi.category.color }} />
      <span className="flex-1 text-sm font-medium text-gray-900 truncate">
        {poi.name}
      </span>
      <span className="flex-shrink-0 text-xs text-gray-500">
        {walkMinutes} min
      </span>
    </div>
    ```
  - Sorter POI-er innenfor hvert tema etter avstand (nærmeste først)
  - Ingen kart, ingen bilder — ren tekst/liste for rask oppslag
- [ ] Vis adresse og prosjektnavn øverst
- [ ] QR-kode med `QRCodeSVG` fra `qrcode.react` (allerede installert v4.2.0):
  ```tsx
  import { QRCodeSVG } from "qrcode.react";
  <QRCodeSVG value={`https://placy.no${eiendomUrl(customer, slug)}`}
             size={160} level="H" includeMargin />
  ```
  Megler kan vise QR-koden til kjøper: "Skann for å utforske nabolaget"

**Research Insight — ReportCompactList som base:**
`components/variants/report/ReportCompactList.tsx:41-140` er et bevist mobiloptimert mønster: `flex items-center gap-3 px-4 py-3` gir 48px rader (touch-friendly), `truncate` håndterer lange navn, `flex-shrink-0` forhindrer squishing av metadata. Gjenbruk dette mønsteret direkte.

**Research Insight — Tema-gruppering allerede løst:**
`report-data.ts:300-459` har komplett algoritme for å gruppere POI-er etter bransjeprofil-temaer. Bruker `buildCategoryToTheme()` fra `bransjeprofiler.ts:249-257` for reverse lookup. Gjenbruk — ikke reimplementer.

**Research Insight — Gåtider er pre-kalkulert:**
POI-er har `travelTime.walk` (minutter) pre-populert via Mapbox Matrix API. Ingen async-fetching nødvendig i Visningsassistenten. Fallback: `calculateDistance()` fra `lib/utils/geo.ts:14-30` (Haversine, konverter til minutter med 80m/min).

**Research Insight — Dynamiske farger:**
Bruk ALLTID inline `style` for tema-farger, aldri Tailwind arbitrary values:
```tsx
// ✅ Riktig:
style={{ borderColor: theme.color, backgroundColor: theme.color + "1a" }}
// ❌ Feil (Tailwind trenger statiske verdier):
className={`border-[${theme.color}]`}
```

**Akseptansekriterier:**
- `/eiendom/{kunde}/{slug}/visning` rendrer mobiloptimert liste
- POI-er er gruppert etter 7 bolig-temaer med riktig sortering
- Hver POI viser navn, fargeprikk, gåtid
- QR-kode peker til Explorer-URL
- Siden er lesbar på 375px bredde (iPhone SE) uten zoom
- ProductNav highlighter "Visning"-tab

**Filer som opprettes:**
- `app/eiendom/[customer]/[project]/visning/page.tsx`
- `components/variants/visning/VisningPage.tsx`

---

#### Phase 5: Beliggenhetstekst-generator (Ny Feature — Lead-gen)

Gratis verktøy: megler skriver adresse + velger målgruppe → får ferdig beliggenhetstekst å lime inn i FINN/salgsoppgave. Lead-gen for 999 kr-pakken.

**Oppgaver:**

- [ ] Installer `@anthropic-ai/sdk` (runtime LLM-kall, ikke Claude Code command)
  - Verifiser at `ANTHROPIC_API_KEY` finnes i `.env.local`
- [ ] Opprett `app/eiendom/(tools)/tekst/page.tsx`
  - Server component med metadata for SEO
  - Title: "Beliggenhetstekst-generator for meglere — Placy"
  - Description: "Generer profesjonell beliggenhetstekst med konkrete stedsnavn og avstander. Gratis."
  - Ingen autentisering — offentlig tilgjengelig
- [ ] Opprett `components/eiendom/TekstGeneratorForm.tsx` (client component)
  - Adressefelt: Gjenbruk `AddressAutocomplete` fra `components/inputs/AddressAutocomplete.tsx`
    - Returnerer `{ address, lat, lng, city }` — eksakt det vi trenger
    - 300ms debounce, abort controller, keyboard nav allerede implementert
  - Målgruppe-velger: Familie / Ung / Senior (radio buttons)
  - "Generer tekst"-knapp
  - Loading-state med skeleton
- [ ] Opprett `POST /api/eiendom/tekst` (server route)
  - **`export const maxDuration = 30;`** — Anthropic API-kall tar 5-15s, Vercel default er 10s
  - **Rate limiting:** IP-basert, maks 5 requests/time per IP. Bruk in-memory Map med TTL:
    ```typescript
    const rateLimit = new Map<string, { count: number; resetAt: number }>();
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const entry = rateLimit.get(ip);
    if (entry && entry.count >= 5 && Date.now() < entry.resetAt) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    ```
  - **Input-validering (Zod) med norske bounds:**
    ```typescript
    const schema = z.object({
      lat: z.number().min(57.5).max(71.5),   // Norge-bounds
      lng: z.number().min(4.0).max(31.5),     // Norge-bounds
      address: z.string().min(3).max(300),
      targetAudience: z.enum(["family", "young", "senior"]),
    });
    ```
  - **Steg 1:** Hent nærliggende POI-er
    - Gjenbruk `discoverGooglePlaces()` fra `lib/generators/poi-discovery.ts:120-257`
    - Radius: 2000m (standard for bolig, fra `bransjeprofiler.ts:162`)
    - Kategorier basert på målgruppe:
      - Family: alle 7 temaer, vekt på barn-oppvekst + hverdagsliv
      - Young: mat-drikke + opplevelser + trening + transport
      - Senior: hverdagsliv + transport + natur + trening
  - **Steg 2:** Filtrer med `evaluateGooglePlaceQuality()` fra `lib/generators/poi-quality.ts`
  - **Steg 3:** Beregn gangavstander: `calculateDistance()` / 80 = minutter
  - **Steg 4:** Send til Claude API med Curator-styrt prompt (se under)
  - Returner generert tekst
- [ ] Opprett `components/eiendom/TekstResult.tsx`
  - Vis generert tekst med formattering
  - "Kopier til utklippstavle"-knapp (`navigator.clipboard.writeText()`)
  - "Generer på nytt"-knapp
  - CTA: "Vil du ha interaktivt kart og rapport? Bestill nabolagskart for 999 kr" → lenke til `/eiendom/generer`
- [ ] Valgfritt: E-post-felt (for lead-tracking, ikke påkrevd for å bruke)

**Research Insight — LLM-prompt basert på Curator voice principles:**

Prompten bør følge Curator-prinsippene fra `.claude/skills/curator/SKILL.md`:
```
Du er en tekstforfatter for eiendomsmeglere. Skriv en beliggenhetstekst for en bolig.

REGLER (ufravikelige):
1. Navngi, aldri generaliser — bruk konkrete stedsnavn, ikke "fine restauranter"
2. Mal bevegelse — beskriv en mental reise gjennom nabolaget
3. Bruk kontraster — "Rolig villastrøk, men bare 3 minutters gange til Bybanen"
4. Saklig entusiasme — fakta > adjektiver, ALDRI utropstegn
5. Sensorisk presisjon — material, sesong, lyd, lukt der relevant
6. Kun VERIFISERTE fakta — avstandene under er beregnet, bruk dem eksakt

ALDRI bruk: "Fantastisk", "Utrolig", "Du vil elske", "koselig", "hidden gem"
ALLTID bruk: konkrete stedsnavn, eksakte gangavstander, grunnlegger/årstall hvis kjent

ADRESSE: {address}
MÅLGRUPPE: {targetAudience}

NÆRLIGGENDE STEDER (med gangavstand):
{groupedPOIs}

Skriv 3-4 avsnitt. Første setning skal fungere alene. Teksten skal passe i en FINN-annonse.
```

**Research Insight — Verifisert tekstgenerering (fra brainstorm 2026-03-03):**
Hard rules: gangavstand = `distanceMeters / 80`, aldri gjettet. Hvert stedsnavn = bekreftet via POI-data. "I gangavstand" = under 15 min. Over det = "kort sykkeltur" / "i nærheten". Ingen fakta uten kilde.

**Research Insight — Ingen eksisterende LLM SDK:**
Prosjektet bruker pt. ikke `@anthropic-ai/sdk`. Det må installeres. Story-generering (`app/api/story-writer/route.ts`) bruker en annen arkitektur (Claude Code commands), men for en brukervendt realtime-feature trengs runtime API-kall.

**Akseptansekriterier:**
- `/eiendom/tekst` viser skjema med adresse + målgruppe
- Generert tekst inneholder konkrete stedsnavn og beregnede avstander (ikke generisk)
- Teksten er 3-4 avsnitt lang, passende for FINN/salgsoppgave
- Teksten følger Curator-prinsipper (ingen "fantastisk", ingen utropstegn)
- Kopier-til-utklippstavle fungerer
- CTA til `/eiendom/generer` er synlig
- Generering tar under 15 sekunder
- API-rute validerer input med Zod (lat/lng bounds, address lengde)

**Filer som opprettes:**
- `app/eiendom/(tools)/tekst/page.tsx`
- `components/eiendom/TekstGeneratorForm.tsx`
- `components/eiendom/TekstResult.tsx`
- `app/api/eiendom/tekst/route.ts`

**Filer som gjenbrukes:**
- `components/inputs/AddressAutocomplete.tsx` (direkte import)
- `lib/generators/poi-discovery.ts` (`discoverGooglePlaces()`)
- `lib/generators/poi-quality.ts` (`evaluateGooglePlaceQuality()`)
- `lib/utils/geo.ts` (`calculateDistance()`)
- `lib/themes/bransjeprofiler.ts` (kategori-mapping per målgruppe)

---

#### Phase 6: Redirects + Cleanup

301-redirects fra alle gamle URL-er. Opprydding av dead code.

**Oppgaver:**

- [ ] **FJERN `/for/` passthrough i middleware.ts** — linje 43 (`if (firstSegment === "for") return NextResponse.next()`) kortsluitter alle redirects. Må fjernes.
- [ ] Oppdater `middleware.ts` med 301-redirects (bruk `NextResponse.redirect(url, 301)`):
  - `/for/{kunde}/{prosjekt}` → `/eiendom/{kunde}/{prosjekt}` (root/WelcomeScreen → Explorer)
  - `/for/{kunde}/{prosjekt}/explore` → `/eiendom/{kunde}/{prosjekt}`
  - `/for/{kunde}/{prosjekt}/report` → `/eiendom/{kunde}/{prosjekt}/rapport`
  - `/for/{kunde}/{prosjekt}/landing` → `/eiendom/{kunde}/{prosjekt}`
  - `/generer` → `/eiendom/generer`
  - **Eksplisitt exclude for trips:** `/for/{kunde}/{prosjekt}/trips/*` → `NextResponse.next()` (fryses, ikke redirect)
  - **Eksplisitt exclude for trip:** `/for/{kunde}/{prosjekt}/trip/*` → `NextResponse.next()`
- [ ] Håndter `/kart/{slug}` redirect spesielt — **via thin server component** (ikke middleware):
  - Behold `app/kart/[slug]/page.tsx` som redirect-page med **`permanentRedirect()`** (ikke `redirect()`):
    ```typescript
    import { permanentRedirect } from "next/navigation";
    // app/kart/[slug]/page.tsx (redusert til redirect)
    export default async function KartRedirect({ params }) {
      const { slug } = await params;
      const request = await fetchGenerationRequest(slug);
      if (!request) notFound();
      const customer = request.customer_id ?? "selvbetjent";
      permanentRedirect(`/eiendom/${customer}/${slug}`);
    }
    ```
  - **Fordel over middleware:** Unngår DB-lookup på HVER request, kun for `/kart/`-trafikk. Caching via Next.js route cache.
  - **Bruk `permanentRedirect()`** (ikke `redirect()`) — gir HTTP 308/301 som Google forstår som permanent flytt
- [ ] Opprett `app/(public)/generer/page.tsx` som 301-redirect til `/eiendom/generer`
- [ ] Oppdater alle hardkodede path-referanser til `eiendomUrl()`:
  - `app/admin/projects/projects-admin-client.tsx:375` — lenke til prosjekt
  - `app/for/page.tsx:74,83` — prosjektoversikt
  - `app/api/generation-requests/route.ts:65,104` — resultat-URL
  - `app/api/admin/retry-request/route.ts` — retry URL
- [ ] Oppdater admin-sider:
  - Prosjektliste: lenker peker til `/eiendom/`
  - Requests-dashboard: status-URL peker til `/eiendom/`
- [ ] Slett gamle route-filer (etter redirects er verifisert):
  - `app/for/[customer]/[project]/explore/page.tsx`
  - `app/for/[customer]/[project]/report/page.tsx`
  - `app/for/[customer]/[project]/page.tsx` (WelcomeScreen)
  - `app/for/[customer]/[project]/layout.tsx`
  - `app/for/[customer]/[project]/landing/page.tsx`
  - `app/for/[customer]/[project]/v/[variant]/page.tsx`
  - `app/for/[customer]/trips/page.tsx`
  - `app/for/page.tsx`
  - `app/for/layout.tsx`
  - `components/variants/kart/KartExplorer.tsx` (funksjonalitet merget inn i Explorer)
  - `components/variants/kart/useKartBookmarks.ts` (hvis ikke gjenbrukt)
- [ ] IKKE slett trips-relaterte filer ennå — de fryses men kan reaktiveres
  - Behold: `app/for/[customer]/[project]/trips/`
  - Behold: `app/for/[customer]/[project]/trip/page.tsx`
  - Behold: `app/trips/[slug]/page.tsx`
- [ ] Oppdater `robots.ts`: fjern `/for/` disallow (den er nå en redirect)
- [ ] **Post-deploy sjekkliste:**
  - Verifiser `curl -I https://placy.no/robots.txt` returnerer 200 (ikke HTML 404)
  - Verifiser `curl -I https://placy.no/sitemap.xml` returnerer 200
  - Verifiser `curl -I https://placy.no/for/klp-eiendom/ferjemannsveien-10` returnerer 301
  - Verifiser `curl -I https://placy.no/kart/test-slug` returnerer 301
  - Verifiser ingen 404-er i Plausible analytics etter 24 timer

**Research Insight — Middleware vs thin redirect page:**
Middleware kjører på HVER request. DB-lookup i middleware for `/kart/` ville treffe Supabase for alle requests som matcher. En thin server component kjører bare for `/kart/`-trafikk og kan caches av Next.js route cache. Mye bedre ytelse.

**Research Insight — Post-deploy testing:**
Fra `sitemap-robots-404-production` learning: middleware kan stille intercepte root-level routes (`/sitemap.xml`, `/robots.txt`). Etter endring i middleware: ALLTID test at disse returnerer riktig content-type, ikke HTML 404.

**Akseptansekriterier:**
- Alle gamle URL-er returnerer 301 til nye `/eiendom/`-URL-er
- Admin-lenker peker til nye URL-er
- API returnerer nye URL-er
- Ingen 404-er for eksisterende lenker/bokmerker
- `npm run build` passerer etter sletting av gamle filer
- Dead code er fjernet
- `robots.txt` og `sitemap.xml` fungerer etter deploy

**Filer som endres:**
- `middleware.ts`
- `app/robots.ts`
- `app/admin/projects/projects-admin-client.tsx`
- `app/api/generation-requests/route.ts`
- `app/kart/[slug]/page.tsx` (redusert til redirect)

**Filer som slettes:**
- Se liste over

---

## Alternative Approaches Considered

### 1. Gradvis migrering med dual routing
Beholde `/for/` og `/eiendom/` parallelt over tid. **Avvist:** Dobbelt vedlikehold, forvirrende for meglere, ingen gevinst.

### 2. Abstrahere KartExplorer og ExplorerPage
Lage én generalisert Explorer-komponent. **Avvist:** Fork-strategien fungerer (dokumentert i compound docs). State-håndtering er fundamentalt ulik (collections vs localStorage bookmarks). Abstraksjon ville økt kompleksiteten.

### 3. Beholde "Selvbetjent" som kunde
La selvbetjente prosjekter forbli under én bøtte. **Avvist:** Umuliggjør megler-dashboard, fakturering, tone-of-voice per kontor.

### 4. Generer/tekst utenfor /eiendom/-prefikset
Beholde `/generer` og `/tekst` som top-level routes. **Avvist:** Bryter UX-koherens. Verktøyene hører til eiendomsvertikalen.

### 5. Middleware for /kart/-redirects
DB-lookup i middleware for å resolere kunde fra slug. **Avvist:** Middleware kjører på alle requests, DB-lookup gir unødvendig latens. Thin server component er mer målrettet.

## Acceptance Criteria

### Functional Requirements

- [ ] `/eiendom/{kunde}/{slug}` rendrer Explorer med riktig prosjektdata
- [ ] `/eiendom/{kunde}/{slug}/rapport` rendrer Report
- [ ] `/eiendom/{kunde}/{slug}/visning` rendrer mobiloptimert Visningsassistent
- [ ] `/eiendom/generer` viser bestillingsskjema med meglerkontor-felt
- [ ] `/eiendom/tekst` genererer beliggenhetstekst fra adresse + målgruppe
- [ ] Nye genereringer knyttes til meglerkontor (ikke "Selvbetjent")
- [ ] Alle gamle URL-er (/for/, /kart/, /generer) 301-redirecter til /eiendom/
- [ ] ProductNav viser Explorer / Rapport / Visning tabs
- [ ] QR-kode til Explorer vises i Visningsassistenten

### Non-Functional Requirements

- [ ] Ingen økt LCP — Explorer og Report laster like raskt som før
- [ ] Beliggenhetstekst genereres innen 15 sekunder
- [ ] Visningsassistenten er lesbar på 375px bredde (iPhone SE)
- [ ] SEO: `/eiendom/` er indexerbar (ikke disallowed i robots.txt)
- [ ] Canonical URLs er korrekte for alle sider (verifiser med view-source)
- [ ] API-ruter validerer input med Zod (ingen injection-vectors)

### Quality Gates

- [ ] `npm test` — alle tester passerer
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — ingen typefeil
- [ ] `npm run build` — bygger uten feil
- [ ] Migrasjon kjørt og verifisert mot prod-database
- [ ] Screenshots av alle sider (Explorer, Rapport, Visning, Generer, Tekst)
- [ ] Post-deploy: robots.txt, sitemap.xml, 301-redirects verifisert

## Dependencies & Prerequisites

- **Supabase:** Migrasjon for `generation_requests.customer_id`
- **Anthropic SDK:** `@anthropic-ai/sdk` — ny dependency for tekst-generator
- **ANTHROPIC_API_KEY:** Må finnes i `.env.local`
- **QR-kode:** `qrcode.react` v4.2.0 — allerede installert
- **Eksisterende data:** KLP, Overvik, Brøset-demoer eksisterer allerede i DB

## Risk Analysis & Mitigation

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Broken external links til /for/ | Høy | Medium | 301-redirects med full path-mapping i middleware |
| /kart/-redirect trenger DB-oppslag | Høy | Lav | Thin server component (ikke middleware), route cache |
| Beliggenhetstekst-kvalitet varierer | Medium | Medium | Curator-prompt med strenge regler, verifisert-tekstgenerering pipeline |
| Meglerkontor-felt øker friksjon | Lav | Medium | Autocomplete med eksisterende kunder, fritekst fallback |
| robots.txt/sitemap brytes etter middleware-endring | Medium | Høy | Post-deploy sjekkliste med curl-verifisering |
| Supabase cache serverer stale data | Medium | Medium | Verifiser `cache: "no-store"` i klient, `force-dynamic` på pages |
| Anthropic API rate limit | Lav | Medium | Brukes kun for tekst-generering (lav volum), error handling med retry |
| LLM endpoint uten rate limiting | Høy | Høy | IP-basert rate limiting (5 req/time), in-memory Map |
| Race condition på kunde-opprettelse | Medium | Medium | Upsert med ON CONFLICT DO NOTHING |
| Slug-kollisjon med reserverte paths | Lav | Høy | Denied-list validering ved opprettelse |
| ProductNav double-highlight bug | Høy | Lav | Exact match for Explorer root path |
| Plausible analytics mangler på /eiendom/ | Høy | Medium | Flytt script til eiendom layout |
| Middleware passthrough blokkerer redirects | Høy | Høy | Fjern /for/ passthrough, erstatt med redirect-logikk |

## Scope Exclusions (Explicit)

Disse er IKKE i scope og skal IKKE implementeres:
- Guide/Trips-funksjonalitet
- Hotell-demoer
- Kulturnatt/kommune-prosjekter
- SEO-sider som ikke er eiendom (/(public)/[area]/)
- Tone-of-voice per meglerkontor (fase 2)
- Stripe/betalingsintegrasjon
- Isochron-kart
- Nabolagssammenligning
- WebSearch-verifisering i tekst-generator (fase 2 — starter med POI-data alene)

## References & Research

### Internal References
- `app/for/[customer]/[project]/explore/page.tsx:151-170` — Nåværende Explorer metadata
- `app/for/[customer]/[project]/report/page.tsx:78-97` — Nåværende Report metadata
- `app/kart/[slug]/page.tsx:19-30` — Generation request lookup
- `app/(public)/generer/page.tsx` — Bestillingsskjema
- `lib/data-server.ts:255-281` — `getProductAsync()` data fetching
- `middleware.ts:34-89` — Legacy redirect patterns
- `components/shared/ProductNav.tsx:1-148` — Navigation (generisk, trenger ingen endring)
- `components/inputs/AddressAutocomplete.tsx:1-220` — Adresse-autocomplete (gjenbrukbar)
- `components/variants/report/ReportCompactList.tsx:41-140` — Mobiloptimert POI-liste (base for Visningsassistent)
- `components/variants/report/report-data.ts:300-459` — Tema-gruppering algoritme
- `lib/themes/bransjeprofiler.ts:31-100` — 7 bolig-temaer med kategori-mapping
- `lib/generators/poi-discovery.ts:120-257` — Google Places POI-søk
- `lib/generators/poi-quality.ts` — Kvalitetsfiltrering av POI-data
- `lib/utils/geo.ts:14-30` — Haversine-avstand
- `.claude/skills/curator/SKILL.md:42-109` — Curator voice principles & quality checklist

### Institutional Learnings (docs/solutions/)
- `selvbetjent-megler-pipeline-20260306.md` — Pipeline-arkitektur, fork-strategi, NFC normalisering
- `norwegian-slugify-nfd-ordering-20260206.md` — NFC for norsk slugify
- `vercel-data-cache-stale-across-deployments-20260215.md` — Cache tag pattern
- `public-seo-site-route-architecture-20260213.md` — Route group patterns
- `api-route-security-hardening-20260216.md` — Input-validering med regex + bounds
- `cross-product-component-reuse-guide-report-20260213.md` — Gjenbruk via type-kompatibilitet
- `sitemap-robots-404-production-PublicSite-20260213.md` — Middleware whitelist for root routes
- `supabase-client-fetch-caching-nextjs-20260209.md` — `cache: "no-store"` for fersk data
- `supabase-graceful-column-fallback-20260206.md` — Destrukturer alltid `{ data, error }`

### Brainstorm Context
- `verifisert-tekstgenerering-brainstorm-20260303.md` — Kun fakta som kan verifiseres, gangavstand = distance/80

### PROJECT-LOG Context
- 2026-03-06 sesjon 2 — Prisresearch, 999 kr prispunkt, produktpakke
- 2026-03-06 sesjon 3 — 14/15 annonser med generisk beliggenhet
- 2026-03-06 sesjon 4 — FINN/Hjem.no konkurranseanalyse, Placys moat
- 2026-03-07 — Vertikal-beslutning, URL-arkitektur, migrasjonsstrategi
