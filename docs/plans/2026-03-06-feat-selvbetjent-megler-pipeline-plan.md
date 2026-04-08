# Plan: Selvbetjent megler-pipeline

**Dato:** 2026-03-06
**Deepened:** 2026-03-06
**Brainstorm:** docs/brainstorms/2026-03-06-selvbetjent-megler-pipeline-brainstorm.md
**Type:** feat
**Branch:** feat/selvbetjent-megler

## Enhancement Summary

**Research agents:** 4 (learnings scan, geocoding patterns, Explorer architecture, security/edge cases)
**Key learnings applied:** 10 documented solutions from docs/solutions/

### Key Improvements from Research
1. **Zod validation** pa API-route (monsteret fra import-route)
2. **Fork ExplorerPage** i stedet for wrapper — renere, 18% mindre kode
3. **Reusable AddressAutocomplete** ekstrahert fra ReportAddressInput
4. **Duplikat-deteksjon** med address_normalized kolonne
5. **Norwegian slugify gotcha** — bruk `lib/utils/slugify.ts` (ae/oe/aa FOR NFD)
6. **`force-dynamic`** pa admin-side (caching-felle fra docs/solutions)
7. **GDPR samtykke-checkbox** for epost-lagring
8. **Race condition-monstre** fra ReportAddressInput bevares i autocomplete
9. **Heart-ikon bokmerke** erstatter "Lagre"-knapp fra collection-UI

---

## Oversikt

Bygg en selvbetjent pipeline der eiendomsmeglere skriver inn en adresse pa placy.no/generer og far et forenklet nabolagskart (Explorer) pa placy.no/kart/{slug}. Pipeline kjores av Claude Code via slash-command.

## User Story

> Som eiendomsmegler vil jeg skrive inn adressen til en bolig jeg skal selge, og fa et interaktivt nabolagskart jeg kan dele med potensielle kjopere — uten a trenge teknisk kompetanse.

---

## Fase 1: Database — generation_requests + selvbetjent-kunde

### 1.1 Migrasjon: generation_requests-tabell

**Fil:** `supabase/migrations/046_generation_requests.sql`

```sql
-- Selvbetjent-kunde
INSERT INTO customers (id, name) VALUES ('selvbetjent', 'Selvbetjent')
ON CONFLICT (id) DO NOTHING;

-- Generation requests
CREATE TABLE generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  address_normalized TEXT NOT NULL,
  email TEXT NOT NULL,
  housing_type TEXT NOT NULL DEFAULT 'family'
    CHECK (housing_type IN ('family', 'young', 'senior')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  geocoded_lat DOUBLE PRECISION,
  geocoded_lng DOUBLE PRECISION,
  geocoded_city TEXT,
  address_slug TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  result_url TEXT,
  error_message TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_generation_requests_status ON generation_requests(status);
CREATE INDEX idx_generation_requests_created ON generation_requests(created_at DESC);
CREATE UNIQUE INDEX idx_generation_requests_slug ON generation_requests(address_slug);

-- RLS: Prevent accidental anon access
ALTER TABLE generation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON generation_requests
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read by slug" ON generation_requests
  FOR SELECT USING (true);
```

### Research Insights

**Duplikat-deteksjon:** `address_normalized` lagrer normalisert versjon for dedup-sjekk. Bruk `normalizeAddress()` som stripper diakritikk og normaliserer whitespace. Unik index pa `address_slug` forhindrer kollisjoner.

**Fra docs/solutions/database-issues/schema-mismatch:** Etter migrasjon, oppdater TypeScript-typer i `lib/supabase/types.ts` og kjor `npx tsc --noEmit` for a fange mismatches.

### 1.2 TypeScript-typer

**Fil:** `lib/supabase/types.ts` — legg til:

```typescript
interface GenerationRequest {
  id: string;
  address: string;
  address_normalized: string;
  email: string;
  housing_type: 'family' | 'young' | 'senior';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  geocoded_lat: number | null;
  geocoded_lng: number | null;
  geocoded_city: string | null;
  address_slug: string;
  project_id: string | null;
  result_url: string | null;
  error_message: string | null;
  consent_given: boolean;
  created_at: string;
  completed_at: string | null;
}
```

### Akseptansekriterier fase 1
- [ ] Migrasjon kjort mot prod via psql
- [ ] `generation_requests`-tabell eksisterer med alle kolonner
- [ ] "Selvbetjent"-kunde finnes i customers-tabellen
- [ ] TypeScript-typer oppdatert og `tsc --noEmit` passer

---

## Fase 2: Landing page — placy.no/generer

### 2.1 Server page

**Fil:** `app/(public)/generer/page.tsx`

```typescript
export const metadata = {
  title: "Lag nabolagskart | Placy",
  description: "Skriv inn en adresse og fa et interaktivt nabolagskart",
  robots: { index: false, follow: false },
};
```

Server component som rendrer `GenererClient`.

### 2.2 Reusable AddressAutocomplete

**Fil:** `components/inputs/AddressAutocomplete.tsx`

Ekstrahert fra `ReportAddressInput.tsx` (components/variants/report/ReportAddressInput.tsx). Kun adresse-sok + valg — ingen travel time-beregning.

**Monstre a bevare fra ReportAddressInput:**

| Monster | Kilde | Hvorfor |
|---------|-------|---------|
| 300ms debounce | `use-debounce` | Balanserer UX vs API-load |
| Min 3 tegn | Linje 73 | Mapbox krever 3+ for presise resultater |
| Dual AbortController | Linje 46-48 | Avbryt gammel request nar ny starter |
| Request ID counter | Linje 48, 81, 93 | Guard mot race conditions etter resolve |
| Keyboard navigation | Linje 186-209 | Pil opp/ned, Enter for valg, Escape for lukk |
| Cleanup on unmount | Linje 54-59 | Abort pending requests |

**Props:**
```typescript
interface AddressAutocompleteProps {
  onSelect: (result: { address: string; lat: number; lng: number; city: string }) => void;
  placeholder?: string;
  className?: string;
}
```

**Ingen ny npm-pakke.** Bruker eksisterende `/api/geocode` (Mapbox v5, country=NO, language=no).

**Edge cases for norske adresser:** Mapbox handler AeOeAa-varianter, "vei" vs "veien", og postnummer automatisk. Ingen spesialhandtering nodvendig.

### 2.3 Klient-komponent

**Fil:** `app/(public)/generer/generer-client.tsx`

**Layout:** Minimalistisk — sentrert skjema pa hvit bakgrunn.

**Felter:**
1. **Adresse** — `<AddressAutocomplete>` med norske forslag
2. **Boligtype** — Radio buttons: Familie (default) / Ung / Senior
3. **Epost** — Standard email input
4. **Samtykke** — Checkbox: "Jeg godtar at e-postadressen lagres" (GDPR)
5. **Submit-knapp** — "Lag nabolagskart"

**Submit-flyt:**
1. Generer slug fra adresse via `slugify()` fra `lib/utils/slugify.ts`
   - **VIKTIG:** Denne funksjonen replacer ae/oe/aa FOR NFD-normalisering (docs/solutions/logic-errors/norwegian-slugify)
2. POST til `/api/generation-requests`
3. Vis bekreftelsesside med fremtidig URL

### 2.4 API-route for submit

**Fil:** `app/api/generation-requests/route.ts`

**Folger monsteret fra `app/api/admin/import/route.ts`** — Zod-validering, strukturert feilhandtering.

```typescript
import { z } from "zod";

const GenerationRequestSchema = z.object({
  address: z.string().min(5).max(200).trim(),
  email: z.string().email().max(254),
  housingType: z.enum(["family", "young", "senior"]),
  lat: z.number().min(57).max(72),    // Norge bounding box
  lng: z.number().min(4).max(32),
  city: z.string().max(100),
  slug: z.string().min(3).max(100),
  consentGiven: z.literal(true),
});
```

**Steg:**
1. Parse + valider med Zod
2. Normaliser adresse for dedup-sjekk
3. Sjekk om slug allerede finnes — legg til nanoid(4) suffix hvis kollisjon
4. Insert i `generation_requests`
5. Returner `{ slug, url: "/kart/{slug}" }`

### Research Insights

**Fra docs/solutions/best-practices/api-route-security-hardening:**
- Valider ALLE inputs med Zod (regex for slug, bounds for lat/lng)
- Wrap `request.json()` i try/catch
- Aldri inkluder sensitive data i response

**Duplikat-sjekk:**
```typescript
// Sjekk om adresse allerede er requested siste 7 dager
const existing = await supabase
  .from("generation_requests")
  .select("address_slug, status")
  .eq("address_normalized", normalizeAddress(body.address))
  .gte("created_at", sevenDaysAgo)
  .limit(1);

if (existing.data?.length) {
  return NextResponse.json({
    slug: existing.data[0].address_slug,
    message: "Denne adressen er allerede generert",
    existing: true,
  });
}
```

### Akseptansekriterier fase 2
- [ ] AC1: placy.no/generer viser minimalistisk skjema
- [ ] AC2: Adressefelt har autocomplete med norske adresser (debounce + keyboard nav)
- [ ] AC3: Boligtype-velger med tre valg (Familie default)
- [ ] AC4: Epost-felt med Zod-validering
- [ ] AC5: GDPR samtykke-checkbox (required)
- [ ] AC6: Submit lagrer request i Supabase med status 'pending'
- [ ] AC7: Duplikat-adresser returnerer eksisterende slug
- [ ] AC8: Bekreftelsesside viser fremtidig URL placy.no/kart/{slug}
- [ ] AC9: Siden er noindex

---

## Fase 3: Forenklet Explorer — placy.no/kart/{slug}

### 3.1 Ny rute

**Fil:** `app/kart/[slug]/page.tsx`

Server component som:
1. Slar opp `generation_requests` via `address_slug`
2. Hvis ikke funnet: 404
3. Hvis status != 'completed': vis venteside
4. Hvis completed: hent prosjektdata via `project_id` med `getProjectContainerAsync`
5. Resolv bransjeprofil-temaer fra prosjektets tags
6. Apply explorer caps fra `lib/themes/explorer-caps.ts`
7. Render `KartExplorer`

**Metadata (dynamisk):**
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const request = await fetchGenerationRequest(slug);
  return {
    title: request ? `Nabolaget rundt ${request.address}` : "Kart genereres...",
    robots: { index: false, follow: false },
  };
}
```

### 3.2 KartExplorer — FORK av ExplorerPage

**Fil:** `components/variants/kart/KartExplorer.tsx`

**Tilnaerming: Fork, ikke wrapper.** Research viser at Collection/Admin/GeoWidget-kode er for dypt flettet inn i ExplorerPage til at conditional props gir ren kode. En fork gir ~587 linjer (vs 712), 18% reduksjon.

**Fjernes fra fork (ca 130 linjer):**

| Kode | Linjer i ExplorerPage | Beskrivelse |
|------|----------------------|-------------|
| Collection store | 11, 50-52 | Import + scoping |
| CollectionData interface | 30-35 | Type definition |
| Collection state | 53-56 | Drawer + flash state |
| handleToggleCollection | 290-297 | Collection toggle callback |
| Flash animation effect | 389-397 | Visual feedback |
| Collection POIs i props | 490-495 | Conditional data |
| Desktop collection footer | 596-633 | Footer button |
| Mobile collection footer | 657-695 | Footer button |
| CollectionDrawer | 699-708 | Drawer component |
| GeoWidget logic | 101-109, 535-537 | Enable/disable |

**Beholder alt annet:**
- Kart + markorer + ruter
- Tema-sidebar (ExplorerThemeChips — 100% reusable)
- POI-liste med sorting
- Travel times + opening hours
- Desktop/mobil layout (flex split)

**Legger til:**
- Heart-ikon bokmerke via `showBookmarkHeartOnly` flag pa ExplorerPOICard

### 3.3 ExplorerPOICard — heart-ikon

Eksisterende ExplorerPOICard har allerede en "Lagre/Lagret"-knapp (linje 214-245 collapsed, 547-575 expanded). Legg til `showBookmarkHeartOnly` prop som erstatter med heart-ikon:

```typescript
// I ExplorerPOICard.tsx — ny conditional
{onToggleCollection && (
  showBookmarkHeartOnly ? (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleCollection(poi.id); }}
      className={cn("p-2 transition-colors",
        isInCollection ? "text-red-500" : "text-gray-400 hover:text-red-400"
      )}
    >
      <Heart className="w-5 h-5" fill={isInCollection ? "currentColor" : "none"} />
    </button>
  ) : (
    // Eksisterende "Lagre"-knapp
  )
)}
```

### 3.4 Bokmerke-store

**Fil:** `lib/kart-bookmarks-store.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface KartBookmarksState {
  bookmarkedPOIs: string[];
  toggleBookmark: (poiId: string) => void;
}

export const useKartBookmarks = create<KartBookmarksState>()(
  persist(
    (set) => ({
      bookmarkedPOIs: [],
      toggleBookmark: (poiId) =>
        set((state) => ({
          bookmarkedPOIs: state.bookmarkedPOIs.includes(poiId)
            ? state.bookmarkedPOIs.filter((id) => id !== poiId)
            : [...state.bookmarkedPOIs, poiId],
        })),
    }),
    { name: "placy-kart-bookmarks" }
  )
);
```

### 3.5 Venteside og feiltilstand

**Nar `status = 'pending'` eller `'processing'`:**
- "Nabolagskartet for {adresse} genereres..."
- "Prosessen tar vanligvis 5-10 minutter"
- "Sjekk igjen"-knapp (manuell refresh)
- Vis adressen pa et lite statisk kart (via Mapbox Static Images — `lib/mapbox-static.ts`)

**Nar `status = 'failed'`:**
- "Noe gikk galt under genereringen"
- "Prov igjen med en annen adresse, eller kontakt oss"
- Vis error_message KUN i console.log (ikke til bruker)

**Nar slug ikke finnes:** 404-side

### 3.6 Tom-tilstand (0 POI-er)

Hvis prosjektet har 0 POI-er (svart ruralt omrade):
- Vis kart med adresse-marker (ingen POI-markorer)
- Melding: "Vi fant dessverre ingen steder i naerheten av denne adressen"
- Ikke krasj — KartExplorer ma handle `pois.length === 0` gracefully

### Research Insights

**Fra docs/solutions/ui-patterns/explorer-desktop-layout-pattern:**
- Flex split layout: kart tar gjenstaende bredde, sidebar er 40%
- 60px uniform padding pa kartet
- `fitBounds` pa rute-koordinater etter POI-klikk, IKKE `flyTo` zoom
- `maxZoom: currentZoom` forhindrer zoom-in forbi brukerens visning

**Fra docs/solutions/ux-loading/skeleton-loading-explorer:**
- Bruk skeleton loading mens data hentes — ExplorerPage har dette allerede

### Akseptansekriterier fase 3
- [ ] AC10: placy.no/kart/{slug} viser forenklet Explorer nar ferdig
- [ ] AC11: Ingen WelcomeScreen, admin-toolbar, redigeringsknapper
- [ ] AC12: Bokmerke-funksjon per POI (heart-ikon, lokal liste)
- [ ] AC13: Ingen Placy-branding synlig
- [ ] AC14: noindex
- [ ] AC15: Alt pa norsk
- [ ] AC16: Venteside med statisk kart nar status = pending/processing
- [ ] AC17: Feilside nar status = failed (ikke vis "genereres...")
- [ ] AC18: 404 nar slug ikke finnes
- [ ] AC19: Tom-tilstand nar prosjekt har 0 POI-er (ikke krasj)

---

## Fase 4: Admin — requests-oversikt

### 4.1 Ny admin-side

**Fil:** `app/admin/requests/page.tsx` + `app/admin/requests/requests-admin-client.tsx`

**Monstre fra docs/solutions:**
- `export const dynamic = "force-dynamic"` — forhindrer Next.js caching (docs/solutions/nextjs-server-component-caching)
- Admin-check: `if (process.env.ADMIN_ENABLED !== "true") redirect("/")` (docs/solutions/nextjs-admin-interface-pattern)

Enkel tabell med alle generation_requests:
- Kolonner: Adresse, Epost, Boligtype, Status, Feil, Opprettet, URL
- Fargekoding: pending (gul), processing (bla), completed (gronn), failed (rod)
- Klikk pa completed -> apne kart-URL i ny fane
- Failed-rader: vis error_message som tooltip ved hover
- **Retry-knapp** pa failed-rader: setter status tilbake til 'pending', nullstiller error_message

### 4.2 Legg til i admin-nav

**Fil:** `app/admin/layout.tsx` — legg til "Requests" lenke

### Akseptansekriterier fase 4
- [ ] AC20: /admin/requests viser alle requests med status og fargekoding
- [ ] AC21: Viser result-URL for ferdige requests (klikkbar)
- [ ] AC22: Viser error_message for failed requests (tooltip)
- [ ] AC23: Retry-knapp pa failed-rader (setter status til pending)
- [ ] AC24: Siden bruker `force-dynamic` og viser ferske data
- [ ] AC25: Admin-nav har "Requests"-lenke

---

## Fase 5: Pipeline slash-command — /generate-adresse

### 5.1 Slash-command

**Fil:** `.claude/commands/generate-adresse.md`

Forenklet versjon av `/generate-bolig` for singulare eiendommer:

```
/generate-adresse
```

Ingen argumenter — kommandoen poller Supabase selv.

### 5.2 Pipeline-steg

1. **Cleanup stale processing** (forhindrer stuck requests)
   - Kjor forst: `UPDATE generation_requests SET status = 'pending', updated_at = now() WHERE status = 'processing' AND updated_at < now() - interval '30 minutes'`
   - Logger antall resettede requests

2. **Poll pending requests** (atomisk for a unnga race conditions)
   - Bruk `UPDATE ... SET status = 'processing', updated_at = now() WHERE id = (SELECT id FROM generation_requests WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`
   - Hvis ingen: "Ingen ventende requests. Ferdig."
   - `FOR UPDATE SKIP LOCKED` sikrer at to samtidige sessions ikke plukker samme request

3. **Verifiser geocoding**
   - Koordinater er allerede lagret fra web-UI
   - Dobbeltsjekk mot `/api/geocode` hvis lat/lng mangler

4. **Bestem boligtype-profil**
   - `family` -> Standard bolig-profil (7 temaer, alle kategorier)
   - `young` -> Mat & Drikke, Transport, Trening, Hverdagsliv, Opplevelser
   - `senior` -> Hverdagsliv, Natur, Transport, Trening (ekstra vekt pa lege/apotek)

5. **Opprett prosjekt**
   - Kunde: `selvbetjent`
   - Prosjektnavn: adressen
   - URL slug: `address_slug` fra requesten
   - Container ID: `selvbetjent_{slug}`
   - venue_type: `residential`
   - tags: `["Eiendom - Bolig"]`
   - discovery_circles: koordinater + by-spesifikk radius (Trondheim 2500m, Oslo/Bergen 2000m, default 2500m)

6. **Opprett Explorer-produkt**
   - product_type: `explorer`
   - config: boligtype-tilpassede temaer

7. **Google Places POI Discovery**
   - POST til `/api/admin/import` med bolig-kategorier
   - minRating: 0, maxResultsPerCategory: 20
   - Grovfiltre fra `poi-quality.ts` kjorer automatisk:
     - business_status: avvis permanent stengte
     - distance: per-kategori gangavstandsgrenser (WALK_METERS_PER_MINUTE = 80)
     - quality: rating ELLER reviews >= 1 (unntak for park, bus, skole)
     - name_mismatch: avvis feilkategoriserte (multi-word)

8. **Skoler via NSR/Udir** (hvis family/senior)
   - Hent skoler innenfor radius
   - Filtrer pa skoletrinn (barneskole, ungdomsskole, VGS)

9. **Barnehager via Barnehagefakta** (hvis family)
   - Hent barnehager innenfor radius

10. **Idrettsanlegg via Overpass/OSM**
   - Hent idrettsanlegg innenfor radius

11. **Oppdater request**
    - Status: 'completed'
    - project_id: den opprettede prosjekt-IDen
    - result_url: `/kart/{slug}`
    - completed_at: now()
    - updated_at: now()

12. **Ved feil** (fail-soft per steg)
    - Hvis skoler/barnehager/idrett-import feiler: fortsett med andre POI-kilder (ikke avbryt)
    - Logg hvilke steg som feilet
    - Kun sett status 'failed' hvis Google Places-import feiler (kjernen)
    - error_message: spesifikk feilbeskrivelse
    - Ikke slett halvferdige prosjekter — la dem ligge for debugging

### 5.3 Boligtype-tema-mapping

```typescript
const HOUSING_THEMES = {
  family: [
    "barn-oppvekst", "hverdagsliv", "mat-drikke",
    "opplevelser", "natur-friluftsliv", "trening-aktivitet", "transport-mobilitet"
  ],
  young: [
    "mat-drikke", "transport-mobilitet", "trening-aktivitet",
    "hverdagsliv", "opplevelser"
  ],
  senior: [
    "hverdagsliv", "natur-friluftsliv", "transport-mobilitet", "trening-aktivitet"
  ],
};
```

### Research Insights

**Fra docs/solutions/feature-implementations/poi-quality-pipeline-bolig:**
- Grovfiltre kjorer ved import-tid (poi-quality.ts) — ikke lag nye
- QUALITY_EXEMPT_CATEGORIES: park, bus, skole, barnehage, idrett
- Aldri slett fra `pois`-tabellen — bare fjern `product_pois`-koblinger

**Fra docs/solutions/feature-implementations/generate-bolig-infrastructure:**
- 7 steder i koden har radius-maks — sjekk alle ved behov
- generate-bolig.md er gitignored (.claude/*)
- Supabase types.ts ma oppdateres manuelt

### Akseptansekriterier fase 5
- [ ] AC26: Cleanup av stale processing-requests (> 30 min) ved oppstart
- [ ] AC27: Atomisk polling med FOR UPDATE SKIP LOCKED (ingen race conditions)
- [ ] AC28: Oppretter prosjekt under "Selvbetjent"-kunde med riktig venue_type og tags
- [ ] AC29: POI-discovery med riktige kategorier for valgt boligtype
- [ ] AC30: Skoler/barnehager/idrett importeres for family-profil
- [ ] AC31: Oppdaterer request-status og result_url nar ferdig
- [ ] AC32: Fail-soft: skoler/barnehager feiler -> fortsett med andre kilder
- [ ] AC33: Ved total feil: status 'failed' med error_message, halvferdige prosjekter bevares

---

## Filstruktur — nye filer

```
supabase/migrations/
  046_generation_requests.sql          # DB migrasjon + selvbetjent-kunde + RLS

app/(public)/generer/
  page.tsx                              # Landing page (server)
  generer-client.tsx                    # Skjema-komponent

app/kart/[slug]/
  page.tsx                              # Forenklet Explorer (server)

app/admin/requests/
  page.tsx                              # Admin requests (server)
  requests-admin-client.tsx             # Requests-tabell

app/api/generation-requests/
  route.ts                              # POST: submit request (Zod-validert)

components/inputs/
  AddressAutocomplete.tsx               # Reusable adresse-autocomplete

components/variants/kart/
  KartExplorer.tsx                      # Fork av ExplorerPage (~587 linjer)

lib/
  kart-bookmarks-store.ts              # Bokmerke-store (Zustand + localStorage)

.claude/commands/
  generate-adresse.md                   # Pipeline slash-command
```

## Filer som endres

```
app/admin/layout.tsx                    # Legg til "Requests" i nav
lib/supabase/types.ts                   # Legg til GenerationRequest type
components/variants/explorer/
  ExplorerPOICard.tsx                   # Legg til showBookmarkHeartOnly prop
```

## Implementeringsrekkefolge

```
Fase 1 (DB)  ->  Fase 2 (Landing) + Fase 3 (Explorer) + Fase 4 (Admin)  ->  Fase 5 (Pipeline)
     |                  |                    |                  |                    |
  Migrasjon       AddressAutocomplete  KartExplorer fork   Request-tabell     Slash-command
  Selvbetjent     GenererClient        Heart-ikon bokmerke force-dynamic      Full pipeline
  TS-typer        API route (Zod)      Venteside           Admin-nav          Feilhandtering
                  Bekreftelsesside     Bokmerke-store
```

Fase 2, 3, 4 kan bygges parallelt etter at fase 1 er ferdig.
Fase 5 krever at alt annet er pa plass.

## Avhengigheter

- Mapbox token allerede konfigurert (`NEXT_PUBLIC_MAPBOX_TOKEN`)
- `/api/geocode` eksisterer allerede (Mapbox Geocoding v5, country=NO)
- `use-debounce` allerede installert (brukt av ReportAddressInput)
- `zod` allerede installert (brukt av import-route)
- Eksisterende Explorer-komponenter gjenbrukes (fork)
- Bransjeprofil "Eiendom - Bolig" allerede definert i `lib/themes/bransjeprofiler.ts`
- `poi-quality.ts` grovfiltre allerede implementert
- NSR/Barnehagefakta/Overpass-integrasjoner fra generate-bolig
- `lib/utils/slugify.ts` med korrekt norsk handtering

## Ny npm-pakke

Ingen.

## Gotchas (fra documented learnings + tech audit)

1. **Migrasjonsnummer:** Bruk 046, IKKE 045 (045_project_theme.sql eksisterer allerede)
2. **ON DELETE CASCADE:** project_id FK MA ha CASCADE — ellers gar orphaned requests
3. **Slugify-rekkefolge:** ae/oe/aa MA erstattes FOR NFD-normalisering — bruk `lib/utils/slugify.ts`
4. **force-dynamic:** Admin-sider OG /kart/[slug] MA ha `export const dynamic = "force-dynamic"`
5. **Radius 7 steder:** Hvis maks-radius endres, sjekk alle 7 steder (inkl. `app/api/admin/projects/[id]/route.ts`)
6. **generate-adresse.md er gitignored:** `.claude/*` i `.gitignore`
7. **Aldri slett POIs:** Fjern `product_pois`-koblinger, ikke `pois`-rader
8. **request.json() try/catch:** Wrap JSON-parsing i API-ruten
9. **revalidatePath etter mutations:** Ellers viser admin-siden stale data
10. **Stuck processing:** Slash-command MA resette stale 'processing' requests (> 30 min) ved oppstart
11. **Race condition:** Bruk `FOR UPDATE SKIP LOCKED` ved polling — to sessions kan kjore samtidig
12. **RLS:** generation_requests MA ha RLS enabled — service_role for write, public for read
13. **Fail-soft pipeline:** Skoler/barnehager-import kan feile uten a avbryte hele pipelinen
