---
title: "feat: Hverdagsliv — Kjøpesenter som anker, bredere kategorier, S&J-narrativ"
type: feat
date: 2026-04-10
deepened: 2026-04-10
brainstorm: docs/brainstorms/2026-04-10-hverdagsliv-redesign-brainstorm.md
---

# feat: Hverdagsliv — Redesign

## Enhancement Summary

**Deepened:** 2026-04-10
**Research agents:** architecture-strategist, code-simplicity-reviewer, performance-oracle, security-sentinel, kieran-typescript-reviewer, best-practices-researcher

### Key Improvements fra deepen
1. **Inline rendering, ikke named components** — KjøpesenterCard og HverdagsRow erstattes med inline JSX og en `renderRow()` inner function. Brukes kun én gang; named components er overkill.
2. **Atomisk endring: Steg 4+5 MÅ landes i én commit** — TIER1_EXTRACTORS og HVERDAGS-konstantene kan aldri diverge midt i en PR.
3. **`hverdagstjenester`-guard** — den nye `if (!anchor && primaryRows.length < 2)` er MER restriktiv enn nåværende `if (rows.length < 2)`. Næring-prosjekter med 1 primær-POI og ingen anchor vil miste kortet. Guard justert til `if (primaryRows.length < 1) return null` for å matche original terskel.
4. **`data-google-ai-target` sikkerhetsfix** — bruk `poi.googlePlaceId` UTEN `?? poi.name` fallback. Poi.name er ukontrollert input og er en latent XSS-vektor hvis downstream bruker attributtet i innerHTML.
5. **`satisfies`-pattern for TS-konstantene** — bevarer tuple-inferens og catcher shape-feil ved definisjon.
6. **Separer config-type fra render-type** — `catIds` skal ikke lekke inn i render-raden.
7. **`liquor_store` er Google Places Table A** — trygt å bruke som søkefilter i Nearby Search.
8. **Explorer-cap** — legg merknad om at cap=25 kan trenge revisjon nå som 2 nye kategorier legges til.

### Nye risiko oppdaget
- `isSafeUrl()` i `lib/utils/url.ts` MÅ verifiseres å bruke `new URL()` + protocol allowlist, IKKE regex. Se Steg 4.
- `hverdagstjenester` (Næring) bruker samme komponent — guard-endring påvirker dem. Eksplisitt adressert i Steg 4.

## Overview

Hverdagsliv er tema nr. 2 i megler-dekning (~95% av alle annonser), men er implementert som et sekundært tema i Placy. Redesignet løfter det til å matche sin faktiske viktighet:

- **Kjøpesenter/lokalsenter som visuelt anker** — vises alltid øverst, med nettstedslenke og Google AI-hook
- **Tre-tier hierarki** — kjøpesenter → dagligvare/apotek/lege → vinmonopol/post/bank/frisør
- **To nye kategorier** — `shopping` (allerede i poi-discovery, ikke i tema) og `liquor_store` (Vinmonopol, ny)
- **Ny bridge text** — S&J-kvalitet, løfter senteret som narrativt knutepunkt

Scope: **kun Report-visningen**. Explorer berøres ikke.

---

## Teknisk bakgrunn

### Kritiske funn fra research

| Fil | Linje | Funn |
|-----|-------|------|
| `lib/themes/bransjeprofiler.ts` | 53–68 | `"shopping"` mangler i hverdagsliv `categories[]` |
| `lib/generators/poi-discovery.ts` | 60, 96 | `shopping_mall` hentes og lagres som `"shopping"` — men vises ikke i tema |
| `lib/generators/poi-discovery.ts` | — | `liquor_store` finnes **ikke** — trenger full ny kategori-entry |
| `components/variants/report/ReportHeroInsight.tsx` | 311–316 | `HVERDAGS_TYPES` har kun 4 typer, ingen kjøpesenter |
| `components/variants/report/ReportHeroInsight.tsx` | 1121–1138 | `TIER1_EXTRACTORS` styrer bridge text exclude-liste — **må oppdateres** |
| `lib/generators/bridge-text-generator.ts` | 177–212 | Ingen kjøpesenter-logikk i `hverdagsliv()` |
| `lib/utils/url.ts` | — | `isSafeUrl()` — bruk denne som guard for `googleWebsite`-lenker |
| `lib/generators/rating-categories.ts` | 19 | `"shopping"` er i `CATEGORIES_WITH_RATING` — `"liquor_store"` må evt. legges til |

### Viktige gotchas (fra institutional learnings)

1. **`shopping_mall` ≠ `"shopping"`**: Google-nøkkelen er `shopping_mall`, Placy category id er `"shopping"`. Legg `"shopping"` (ikke `"shopping_mall"`) til bransjeprofiler-arrayet.
2. **TIER1_EXTRACTORS er kritisk**: Bridge text bruker excludePOIIds basert på TIER1_EXTRACTORS. Når kjøpesenter legges til hero, **må** extractor oppdateres — ellers havner kjøpesenteret i bridge text også.
3. **`hverdagstjenester` deler HverdagslivInsight**: Næring-prosjekter bruker samme komponent. Endringer skal ikke bryte Næring-visningen.
4. **Dynamiske farger**: Bruk `style={{ color: theme.color }}`, aldri Tailwind arbitrary `text-[${theme.color}]`.
5. **Vinmonopol-data mangler**: `liquor_store` finnes ikke i poi-discovery. Eksisterende prosjekter (Wesselsløkka, Brøset) har ingen Vinmonopol-POI-er. Re-import nødvendig for å se dem.
6. **`googleWebsite` i report**: Ingen eksisterende lenke-rendering i report-komponenter. Bruk `POIDetailSidebar.tsx:59–69` som mal.

---

## Implementasjonsplan

### Steg 0.5 — Verifiser kategori-ID for `post_office` (pre-flight)

Kjør grep FØR implementasjon for å verifisere hva POI-er faktisk lagrer:

```bash
grep -n '"post"' lib/generators/poi-discovery.ts
grep -n 'post_office\|"post"' lib/themes/bransjeprofiler.ts
```

Forventet funn: enten `id: "post"` eller `id: "post_office"`. Bruk denne ID-en konsekvent i HVERDAGS_SECONDARY catIds. Hvis `id: "post"`, bruk `catIds: ["post"]` — ikke `"post_office"`.

---

### Steg 1 — Legg til `"shopping"` i hverdagsliv-tema → TC-01, TC-12

**Fil:** `lib/themes/bransjeprofiler.ts` (linje 53–68)

Legg `"shopping"` til `categories[]`-arrayet for hverdagsliv-temaet. Plasser det øverst (viktigste kategori skal discovery-logikken prioritere).

```typescript
// Før
categories: ["supermarket", "pharmacy", "convenience", "doctor", ...]

// Etter
categories: ["shopping", "supermarket", "pharmacy", "convenience", "doctor", ...]
```

---

### Steg 2 — Legg til `liquor_store`-kategori i poi-discovery → TC-09

**Fil:** `lib/generators/poi-discovery.ts`

Legg til i to steder:

```typescript
// GOOGLE_CATEGORY_MAP (rundt linje 60)
liquor_store: { id: "liquor_store", name: "Vinmonopol", icon: "Wine", color: "#7c3aed" },

// VALID_TYPES_FOR_CATEGORY (rundt linje 96)
liquor_store: new Set(["liquor_store"]),
```

**Ikon-valg**: `Wine` fra Lucide React. Farge: lilla (`#7c3aed`) for å skille seg fra de grønne hverdagsikonene.

---

### Steg 3 — Legg `"liquor_store"` til hverdagsliv-tema + rating → TC-09, TC-10

**Fil 1:** `lib/themes/bransjeprofiler.ts`

Legg `"liquor_store"` til hverdagsliv `categories[]` — etter `"convenience"`, før `"doctor"`:

```typescript
categories: ["shopping", "supermarket", "pharmacy", "convenience", "liquor_store", "doctor", ...]
```

**Fil 2:** `lib/generators/rating-categories.ts`

Legg `"liquor_store"` til arrayet (Vinmonopol har Google-rating):

```typescript
export const CATEGORIES_WITH_RATING = new Set([
  "shopping",
  "liquor_store",   // ← legg til
  // ...
]);
```

---

### Steg 4 — Redesign `HverdagslivInsight` med tre-tier layout → TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-11

**MERK:** Steg 4 og Steg 5 (TIER1_EXTRACTORS) **MÅ landes i samme commit** — de kan aldri diverge.

**Fil:** `components/variants/report/ReportHeroInsight.tsx`

#### 4a. Typer og konstantdefinisjoner

Separer config-type (med catIds) fra render-type (uten catIds). Bruk `satisfies` for compile-time shape-checking:

```typescript
// Config-type — kun brukt for konstantdefinisjoner
type HverdagsConfig = { catIds: string[]; label: string };
// Render-type — sendes til renderRow(), ingen catIds
type HverdagsRow = { label: string; poi: POI };

const HVERDAGS_ANCHOR = { catIds: ["shopping"], label: "Kjøpesenter" } satisfies HverdagsConfig;

const HVERDAGS_PRIMARY = [
  { catIds: ["supermarket", "convenience"], label: "Dagligvare" },
  { catIds: ["pharmacy"], label: "Apotek" },
  { catIds: ["doctor", "dentist", "hospital"], label: "Lege" },
] satisfies HverdagsConfig[];

const HVERDAGS_SECONDARY = [
  { catIds: ["liquor_store"], label: "Vinmonopol" },
  { catIds: ["post_office"], label: "Post" },
  { catIds: ["bank"], label: "Bank" },
  { catIds: ["haircare"], label: "Frisør" },
] satisfies HverdagsConfig[];
```

#### 4b. `isSafeUrl` — verifiser implementasjon FØR bruk

Sjekk `lib/utils/url.ts` at funksjonen bruker `new URL()` + protocol allowlist. Riktig mønster:

```typescript
// Forventet implementasjon (verifiser at dette er nåværende kode)
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
// IKKE: return url.startsWith("https://") — fanger ikke alle edge cases
```

Hvis `isSafeUrl` bruker regex eller string-prefix: fiks den FØR du kaller den.

#### 4c. Oppdatert `HverdagslivInsight` — tre soner med inline rendering

**Ingen named subkomponenter** — bruk inner function `renderRow()` for radene. KjøpesenterCard inlines direkte.

```tsx
function HverdagslivInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const anchor = nearestOf(pois, center, ...HVERDAGS_ANCHOR.catIds) ?? null;

  const primaryRows: HverdagsRow[] = HVERDAGS_PRIMARY.map((t) => {
    const poi = nearestOf(pois, center, ...t.catIds);
    return poi ? { label: t.label, poi } : null;
  }).filter((r): r is HverdagsRow => r !== null);

  const secondaryRows: HverdagsRow[] = HVERDAGS_SECONDARY.map((t) => {
    const poi = nearestOf(pois, center, ...t.catIds);
    return poi ? { label: t.label, poi } : null;
  }).filter((r): r is HverdagsRow => r !== null);

  // Guard: match original terskel — vis kort hvis minst 1 primær-POI (eller anchor)
  if (!anchor && primaryRows.length < 1) return null;

  const within10 = pois.filter((p) => estimateWalkMin(p, center) <= 10).length;

  // Inner function — ikke named component (brukes kun her)
  function renderRow(row: HverdagsRow, compact: boolean) {
    const Icon = getIcon(row.poi.category.icon);
    const walk = fmtWalk(row.poi, center);
    return (
      <div key={row.label} className={`flex items-center gap-3 ${compact ? "py-1" : "py-1.5"}`}>
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
          style={{ backgroundColor: row.poi.category.color + "15" }}
        >
          <Icon
            className={compact ? "w-3 h-3" : "w-3.5 h-3.5"}
            style={{ color: row.poi.category.color }}
          />
        </div>
        <span className={`font-medium text-[#1a1a1a] flex-1 min-w-0 truncate ${compact ? "text-[13px]" : "text-[15px]"}`}>
          {row.poi.name}
        </span>
        <span className={`text-[#8a8a8a] shrink-0 hidden sm:inline ${compact ? "text-xs" : "text-sm"}`}>
          {row.label}
        </span>
        {walk && (
          <span className={`text-[#8a8a8a] shrink-0 w-12 text-right ${compact ? "text-xs" : "text-sm"}`}>
            {walk}
          </span>
        )}
      </div>
    );
  }

  return (
    <InsightCard
      title="Hverdagen i gangavstand"
      footer={within10 > 0 ? `${within10} hverdagstjenester innen 10 min` : undefined}
    >
      {/* Tier 1 — Kjøpesenter-anker (inline, brukes én gang) */}
      {anchor && (() => {
        const walk = fmtWalk(anchor, center);
        const hasWebsite = anchor.googleWebsite && isSafeUrl(anchor.googleWebsite);
        return (
          <div
            className="rounded-lg p-3 mb-3"
            style={{ backgroundColor: "#22c55e12" }}
            // Hook for fremtidig Google AI mode — utelat attributtet hvis googlePlaceId er null
            {...(anchor.googlePlaceId ? { "data-google-ai-target": anchor.googlePlaceId } : {})}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" style={{ color: "#22c55e" }} />
                <span className="font-semibold text-[#1a1a1a] text-[15px]">{anchor.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {walk && <span className="text-sm text-[#8a8a8a]">{walk}</span>}
                {hasWebsite && (
                  <a
                    href={anchor.googleWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tier 2 — Primærtjenester (standard størrelse) */}
      <div className="space-y-1">
        {primaryRows.map((row) => renderRow(row, false))}
      </div>

      {/* Tier 3 — Sekundærtjenester (kompakt, kun hvis data finnes) */}
      {secondaryRows.length > 0 && (
        <div className="space-y-0.5 mt-2 pt-2 border-t border-[#f0f0f0]">
          {secondaryRows.map((row) => renderRow(row, true))}
        </div>
      )}
    </InsightCard>
  );
}
```

**Sikkerhetsnotat:** `data-google-ai-target={anchor.googlePlaceId}` — bruk KUN `googlePlaceId`, aldri `?? poi.name`. `poi.name` er ukontrollert input fra Google Places og kan brukes som XSS-vektor hvis downstream-konsumenter putter attributtverdien i `innerHTML`.

**`hverdagstjenester`-notat:** Næring bruker samme komponent. Siden `shopping` ikke er i Næring-temaets categories[], vil `anchor` alltid være `null` for Næring — komponenten faller rett til Tier 2 + Tier 3, som visuelt er nær det nåværende. Guard `if (!anchor && primaryRows.length < 1)` matcher original terskel.

---

### Steg 5 — Oppdater `TIER1_EXTRACTORS` → TC-13

**Fil:** `components/variants/report/ReportHeroInsight.tsx` (linje 1121–1138)

Legg kjøpesenter-POI til extractor slik at bridge text ikke repeterer det:

```typescript
hverdagsliv: (theme, center) => {
  const pois = theme.allPOIs;
  // Anchor
  const anchor = nearestOf(pois, center, "shopping");
  // Tier 2
  const dagligvare = nearestOf(pois, center, "supermarket", "convenience");
  const apotek = nearestOf(pois, center, "pharmacy");
  const lege = nearestOf(pois, center, "doctor", "dentist", "hospital");
  return [anchor, dagligvare, apotek, lege].filter(Boolean) as POI[];
},
```

---

### Steg 6 — Ny bridge text for hverdagsliv → TC-07, TC-08

**Fil:** `lib/generators/bridge-text-generator.ts` (linje 177–212)

Reskriv `hverdagsliv()` funksjonen:

```typescript
function hverdagsliv(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const tier2 = byDistance(pois.filter((p) => !exclude.has(p.id)), c);

  // Finn kjøpesenter (kan allerede være excluded av hero — da nevn det ikke)
  const kjøpesenter = pois.find((p) => p.category.id === "shopping" && exclude.has(p.id));

  // Sekundære butikker (ikke i hero)
  const butikker = tier2.filter((p) =>
    ["supermarket", "convenience"].includes(p.category.id)
  );

  const parts: string[] = [];

  if (kjøpesenter) {
    // Kjøpesenter er i hero — bridge text komplementerer med hva som er i tillegg
    if (butikker.length >= 1) {
      parts.push(
        `I tillegg til ${clean(kjøpesenter)} finnes ${clean(butikker[0])} ${prox(butikker[0], c)} for daglig handel.`
      );
    } else {
      const walkable = countWithin(pois, c, 15);
      if (walkable >= 5) {
        parts.push(
          `${clean(kjøpesenter)} samler det meste under ett tak — hverdagen ordnes uten bil.`
        );
      }
    }
  } else if (butikker.length >= 2) {
    parts.push(
      `${clean(butikker[0])} og ${clean(butikker[1])} ${prox(butikker[0], c)} gir godt utvalg i gangavstand.`
    );
  } else if (butikker[0]) {
    parts.push(`${clean(butikker[0])} ${prox(butikker[0], c)}.`);
  } else {
    const walkable = countWithin(pois, c, 15);
    if (walkable >= 5) {
      parts.push("De viktigste hverdagstjenestene er samlet i gangavstand — alt ordnes uten bil.");
    } else {
      parts.push("De viktigste hverdagstjenestene i nabolaget.");
    }
  }

  // Avslutte med "uten bil" hvis ikke allerede sagt
  if (parts.length > 0 && !parts[0].includes("uten bil")) {
    const walkable = countWithin(pois, c, 15);
    if (walkable >= 6) {
      parts.push("Det meste ordnes uten bil.");
    }
  }

  return parts.join(" ");
}
```

---

### Steg 6.5 — Sjekk explorer-cap etter ny kategori → TC-12

**Fil:** `lib/themes/bransjeprofiler.ts`

Explorer-cap for hverdagsliv er satt til 25. Med 2 nye kategorier (`shopping` + `liquor_store`) øker POI-overflaten. Sjekk om cap bør justeres — f.eks. til 30. Ikke prioritert endring, men logg funnet.

---

### Steg 7 — Sjekk Vinmonopol-data + dokumenter status → TC-09

Kjør søk mot Supabase pois-tabellen for å verifisere om noen eksisterende prosjekter har `liquor_store`-POI-er. Dokumenter funnet i plan-filen.

```sql
SELECT p.name, p.category_id, pr.name as project
FROM pois p
JOIN product_pois pp ON pp.poi_id = p.id
JOIN products pr ON pr.id = pp.product_id
WHERE p.category_id = 'liquor_store'
LIMIT 10;
```

Forventet svar: 0 rader (ingen liquor_store-data ennå). **Dette er OK** — UI-en er klar, data kommer ved neste import-kjøring.

---

## Test Cases

```
TC-01 | Functional | P1
Requirement: shopping_mall vises som Tier 1 anker
Given: HverdagslivInsight med POI category.id = "shopping" innen 15 min gange
When: Komponenten rendres
Then: KjøpesenterCard vises øverst, over Tier 2-radene

TC-02 | Edge-case | P1
Requirement: Fallback når ingen kjøpesenter
Given: HverdagslivInsight uten noen "shopping" POI
When: Komponenten rendres
Then: Tier 2-radene vises øverst (Dagligvare som første rad), ingen tom KjøpesenterCard

TC-03 | Functional | P1
Requirement: Tier 2 primærtjenester vises
Given: POI-er av type supermarket, pharmacy, doctor
When: Komponenten rendres
Then: 3 rader vises med standard størrelse (py-1.5, text-[15px])

TC-04 | Edge-case | P2
Requirement: Tier 3 vises kun når data finnes
Given: Ingen liquor_store/post_office/bank/haircare POI-er
When: Komponenten rendres
Then: Tier 3-seksjonen (separator + rader) er ikke synlig

TC-05 | Functional | P1
Requirement: googleWebsite-lenke vises for kjøpesenter
Given: Kjøpesenter-POI har googleWebsite = "https://valentinlyst.no"
When: KjøpesenterCard rendres
Then: ExternalLink-ikon er synlig og href="https://valentinlyst.no"

TC-06 | Functional | P2
Requirement: Google AI mode hook er på plass
Given: KjøpesenterCard rendres
Then: Elementet har data-google-ai-target attributt med POI-id eller navn

TC-07 | Functional | P1
Requirement: Bridge text løfter kjøpesenter
Given: Kjøpesenter finnes og er i hero card (excluded fra bridge text)
When: bridge-text-generator kjøres
Then: Teksten refererer til kjøpesenteret og kompletterer med sekundær info

TC-08 | Edge-case | P1
Requirement: Bridge text fallback uten kjøpesenter
Given: Ingen kjøpesenter-POI i temaet
When: bridge-text-generator kjøres
Then: Fallback til butikk-narrativ eller gangavstand-konklusjon — ingen tom streng

TC-09 | Functional | P2
Requirement: liquor_store-kategori finnes i poi-discovery
Given: poi-discovery.ts er oppdatert
When: TypeScript kompilerer
Then: `GOOGLE_CATEGORY_MAP.liquor_store` og `VALID_TYPES_FOR_CATEGORY.liquor_store` finnes uten TS-feil

TC-10 | Functional | P2
Requirement: Vinmonopol vises korrekt i Tier 3
Given: POI med category.id = "liquor_store" og navn "Vinmonopol Trondheim"
When: Komponenten rendres
Then: Vises i Tier 3 med label "Vinmonopol", kompakt størrelse

TC-11 | Regression | P1
Requirement: hverdagstjenester (Næring) er ikke ødelagt
Given: Næring-prosjekt bruker hverdagstjenester-tema
When: HverdagslivInsight rendres for dette prosjektet
Then: Tier 2 og Tier 3 vises korrekt; ingen runtime-feil

TC-12 | Regression | P1
Requirement: Explorer-visningen er ikke berørt
Given: ExplorerThemeChips rendres for hverdagsliv
When: Bruker ser Explorer-visningen
Then: Ingen visuelle endringer fra dagens tilstand

TC-13 | Functional | P1
Requirement: TIER1_EXTRACTORS ekskluderer kjøpesenter
Given: Kjøpesenter-POI er i hero card
When: bridge-text-generator kjøres med excludePOIIds
Then: Kjøpesenteret nevnes ikke dobbelt i bridge text

TC-14 | Quality | P1
Requirement: TypeScript kompilerer
Given: Alle endringer er gjort
When: npx tsc --noEmit kjøres
Then: 0 type-feil
```

---

## Implementasjonssteg → TC-mapping

| Steg | Beskrivelse | TC-er |
|------|-------------|-------|
| 1 | Legg til `"shopping"` i bransjeprofiler | TC-01, TC-12 |
| 2 | Legg til `liquor_store` i poi-discovery | TC-09 |
| 3 | Legg `"liquor_store"` til hverdagsliv + rating | TC-09, TC-10 |
| 4 | Redesign HverdagslivInsight (KjøpesenterCard, tiers, HverdagsRow) | TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-11 |
| 5 | Oppdater TIER1_EXTRACTORS | TC-13 |
| 6 | Ny bridge text | TC-07, TC-08 |
| 7 | Sjekk Vinmonopol-data (SQL) | TC-09 |
| 8 | tsc --noEmit + lint + build | TC-14 |

---

## Acceptance Criteria

### Funksjonelle krav

- [ ] Kjøpesenter-POI vises alltid øverst i HverdagslivInsight når det finnes innen 15 min gange
- [ ] KjøpesenterCard har nettstedslenke (via `googleWebsite`) med `isSafeUrl`-guard
- [ ] KjøpesenterCard har `data-google-ai-target`-attributt
- [ ] Tier 2 (Dagligvare, Apotek, Lege) vises i standard størrelse under kjøpesenteret
- [ ] Tier 3 (Vinmonopol, Post, Bank, Frisør) vises kompakt, med visuell separator, kun når POI-er finnes
- [ ] Bridge text refererer til kjøpesenter når det er present i hero
- [ ] `"shopping"`-kategorien er inkludert i hverdagsliv-temaets `categories[]` i bransjeprofiler.ts
- [ ] `liquor_store`-kategorien er lagt til i poi-discovery.ts og bransjeprofiler.ts

### Regresjons-krav

- [ ] Explorer-visningen er uendret
- [ ] `hverdagstjenester`-temaet (Næring) fungerer uten feil
- [ ] `npx tsc --noEmit` passerer
- [ ] `npm run lint` passerer
- [ ] `npm run build` passerer

---

## Dependencies & Risks

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| `liquor_store`-data mangler i prod | Høy | Lav — UI skjuler Tier 3 hvis ingen data | Vis kun Tier 3 hvis POI-er finnes (allerede i design) |
| `hverdagstjenester` brytes | Lav | Høy | Guard er justert til `< 1` (ikke `< 2`). Næring mangler anchor → Tier 2 + Tier 3 = visuelt likt nå. |
| TIER1_EXTRACTOR + HVERDAGS divergerer | Medium | Høy | Steg 4+5 **MÅ** landes i same commit — eksplisitt notert i planen |
| `googleWebsite` mangler på kjøpesenter-POI | Medium | Lav | `isSafeUrl`-guard skjuler lenken gracefully |
| `isSafeUrl` bruker regex, ikke `new URL()` | Medium | Medium | Verifiser + fiks i Steg 4b FØR bruk |
| Explorer-cap (25) treffer grense | Lav | Lav | Sjekk i Steg 6.5, juster til 30 ved behov |
| `poi.name` i `data-google-ai-target` | N/A | Medium | Bruker KUN `googlePlaceId` — aldri `?? poi.name` |

---

## References

### Interne referanser

- `lib/themes/bransjeprofiler.ts:53` — hverdagsliv tema-definisjon
- `lib/generators/poi-discovery.ts:60` — shopping_mall kategori
- `components/variants/report/ReportHeroInsight.tsx:311` — HverdagslivInsight
- `lib/generators/bridge-text-generator.ts:177` — hverdagsliv() bridge text
- `components/public/POIDetailSidebar.tsx:59` — googleWebsite-lenkemønster
- `lib/utils/url.ts` — isSafeUrl()
- `lib/generators/rating-categories.ts:19` — CATEGORIES_WITH_RATING

### Forskning

- `docs/research/2026-04-08-beliggenhetstekst-moensteranalyse.md` — S&J-analyse
- `docs/brainstorms/2026-04-10-hverdagsliv-redesign-brainstorm.md` — brainstorm
- `docs/solutions/architecture-patterns/bransjeprofil-eiendom-bolig-20260303.md` — bransjeprofil-arkitektur
