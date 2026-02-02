# POI Content Enrichment & Source Attribution

**Date:** 2026-01-31
**Status:** Decided

## What We're Building

Et system for å automatisk berike hver Google-basert POI med høykvalitets innhold fra flere kilder, og vise kildehenvisninger som små logoer i UI-et. Målet er at hvert POI-kort skal ha:

1. **Editorial hook** (gul boks) -- én setning om hva som gjør stedet unikt
2. **Sammendrag** -- 2-3 setninger som oppsummerer hva kildene skriver om stedet
3. **Kildelogoer** -- små sirkler med Google- og Foursquare-logoer under beskrivelsen, klikkbare til kildeside

## Why This Approach

### Kildestrategi: Google Deep + Foursquare

Vi undersøkte TripAdvisor, Yelp, Foursquare og Google Places API grundig. Konklusjonen:

- **TripAdvisor:** Har en eksklusivitetsklausul (ToS 3.5.1) som forbyr visning av deres data sammen med andre UGC-kilder. Dealbreaker for multi-source-konseptet.
- **Yelp:** Har tilsvarende "no-blending"-restriksjon, pluss dyr pricing ($9.99/1000 kall), 24-timers cache-limit, og aggressiv monetisering.
- **Google Places API (New):** Tilbyr 5 full-tekst anmeldelser, AI-generert `reviewSummary` (Gemini), `editorialSummary`, og atmosfære-data. 1000 gratis kall/mnd. Ingen eksklusivitetsklausul.
- **Foursquare:** Mest ToS-vennlig sekundærkilde. Tillater blending med andre kilder. Har "tips" (korte brukerkommentarer) og popularitetsscore.

### Teknisk utgangspunkt

Dagens kodebase har et godt fundament:
- `editorialHook`, `localInsight`, og `editorialSources` finnes i typedefinisjonen (`lib/types.ts`)
- `editorialSources` er plumbet gjennom types, DB-skjema, og merge-logikk -- men har **null UI og null data**
- Kun ~16 av ~80 POI-er har editorial hooks (manuelt generert)
- Google Places bruker legacy API som bør migreres uansett

## Key Decisions

### 1. Primærkilde: Google Places API (New)

**Beslutning:** Migrere fra legacy Google Places API til Places API (New) og hente utvidede felter.

**Nye felter å hente:**
- `reviews` -- opptil 5 full-tekst anmeldelser med forfatter, rating, tekst
- `reviewSummary` -- AI-generert oppsummering av alle anmeldelser (Gemini-drevet)
- `editorialSummary` -- Googles egen redaksjonelle beskrivelse
- Atmosfæredata: `dineIn`, `delivery`, `takeout`, `servesBeer`, `servesBreakfast`, etc.

**Kostnad:** Gratis opptil 1000 kall/mnd (Enterprise + Atmosphere SKU). Deretter $25/1000 kall.

### 2. Sekundærkilde: Foursquare

**Beslutning:** Bruke Foursquare som supplement for popularitetsscore og tips.

**Data tilgjengelig:**
- Popularitetsscore
- Tips (korte brukeranmeldelser)
- 10-punkts rating

**Kostnad:** Premium-felter koster $18.75/1000 kall. Ingen gratis tier for tips/ratings.

### 3. UI: Kildelogoer som små sirkler

**Beslutning:** Vise en rad med små, sirkulære kildelogoer under POI-beskrivelsen. Hver logo er klikkbar og åpner kildeside.

**Design:**
- Google-logo (sirkel) -- alltid synlig for Google-POI-er
- Foursquare-logo (sirkel) -- synlig når Foursquare-data finnes
- Placy-sparkle (sirkel) -- synlig når vi har egen kuratert tekst
- Logoer er ~20px, gråtonede som default, farget ved hover

### 4. Innholdsstruktur per POI

**Beslutning:** Hvert Google-POI skal ha to nivåer av innhold:

| Felt | Kilde | Beskrivelse |
|------|-------|-------------|
| `editorialHook` | AI-generert fra alle kilder | Én fengende setning om hva stedet er kjent for |
| `sourceSummary` | AI-generert fra alle kilder | 2-3 setninger som oppsummerer hva kildene skriver |
| `editorialSources` | Automatisk | Strukturert array med kilde-metadata |

### 5. Automatisert pipeline

**Beslutning:** Bygge en ny generator-modul (`poi-enrichment.ts`) som:

1. Henter utvidet Google Places-data (reviews, reviewSummary, editorialSummary)
2. Henter Foursquare-data (tips, popularity, rating)
3. Samler alle kilder i strukturert format
4. Bruker AI til å generere `editorialHook` + `sourceSummary` basert på alle kilder
5. Lagrer kildemetadata i `editorialSources`

**Omfang:** Kun Google-baserte POI-er. Transport-POI-er og manuelle POI-er berøres ikke.

### 6. Datamodell: Oppgradert `editorialSources`

**Beslutning:** Oppgradere `editorialSources` fra `string[]` til strukturert type:

```typescript
interface EditorialSource {
  name: string;           // "Google", "Foursquare"
  url: string;            // Lenke til kildeside
  logo: string;           // Logo-identifikator
  rating?: number;        // Kildespesifikk rating
  ratingScale?: number;   // F.eks. 5 for Google, 10 for Foursquare
  reviewCount?: number;   // Antall anmeldelser
  snippets?: string[];    // Utvalgte sitater/tips
  fetchedAt: string;      // ISO timestamp
}
```

### 7. Integrasjon med Story Generator

**Beslutning:** Enrichment bygges inn som nytt steg i Story Generator-flyten.

Dagens admin Story Generator (`/admin/generate`) har tre steg:
1. **Discovering** -- Finner POI-er fra Google, Entur, Bysykkel
2. **Structuring** -- Bygger temaer og seksjoner
3. **Writing** -- Ferdigstiller output

Ny flyt med enrichment:
1. **Discovering** -- Finner POI-er (som i dag)
2. **Enriching** -- Henter utvidede data fra Google Places (New) + Foursquare per POI
3. **Writing** -- AI genererer editorialHook + sourceSummary per POI basert på kilde-data
4. **Structuring** -- Bygger temaer og seksjoner (som i dag)

I tillegg: En egen "Berik på nytt"-knapp i admin for å re-kjøre enrichment på eksisterende prosjekter.

### 8. Innholdstone: Faktabasert sammendrag

**Beslutning:** AI-generert innhold skal være nøytralt og faktabasert.

**Editorial hook:** Én objektiv setning som oppsummerer hva stedet er kjent for.
- Eksempel: "Høyt vurdert restaurant kjent for burgere og stort ølutvalg."
- Ikke: "Du MÅ prøve burgerne her!" (for personlig)

**Source summary:** 2-3 setninger som nøytralt oppsummerer hva kildene skriver.
- Eksempel: "Google-anmeldere fremhever den store uteserveringen og 60-tallsatmosfæren. Foursquare-brukere anbefaler ølutvalget. 4.4 av 5 på Google basert på 312 anmeldelser."
- Ikke: "Et must for alle som elsker retro!" (for subjektivt)

**Rasjonale:** Faktabasert tone passer best med multi-source-konseptet -- vi presenterer hva kildene sier, ikke vår mening.

## Open Questions

1. **Foursquare-matching:** Hvordan matche Google Places POI-er med Foursquare-POI-er? Navnesøk + koordinater er ikke alltid nøyaktig.
2. **Cache-strategi:** Hvor lenge cacher vi kilde-data? Google tillater 30 dager, Foursquare har egne regler.
3. **AI-modell:** Bruke Claude eller OpenAI for innholdsgenerering i pipeline? Eller Googles reviewSummary direkte?
4. **Fallback-innhold:** Hva vises for POI-er der ingen kilder har meningsfull data?
5. **Bulk-kapasitet:** Enrichment for 80+ POI-er krever mange API-kall. Trenger vi rate limiting / batching i pipeline?

## Out of Scope

- TripAdvisor-integrasjon (eksklusivitetsklausul)
- Yelp-integrasjon (no-blending-restriksjon + dyr pricing)
- Innholdsberikelse for transport-POI-er (buss, bysykkel)
- Brukeranmeldelser (Placy-egne)

## Next Steps

1. Run `/workflows:plan` for implementasjonsplan
2. Migrere Google Places API til New-versjonen
3. Designe `EditorialSource`-typen og oppdatere datamodellen
4. Bygge enrichment-pipeline som nytt steg i Story Generator
5. Implementere kilde-logo-UI i ExplorerPOICard
6. Teste med ferjemannsveien-10-prosjektet
