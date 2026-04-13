# Plan: Placy-standardisert shell for rapport-ruten

**Dato:** 2026-04-13
**Basert på:** `docs/brainstorms/2026-04-13-placy-report-shell-brainstorm.md`
**Status:** Plan + Tech Audit → KLAR for /work
**Tech Audit verdict:** **YELLOW → GREEN** (alle mitigasjoner integrert)
**Relatert:** Wesselsløkka demo-opprydding (inkludert i denne planen)

## Tech Audit Summary

5 parallelle audit-agenter: architecture, data-integrity, spec-flow, pattern-recognition, learnings.

**Kritiske risikoer identifisert + mitigert:**
- **JSONB-overwrite (High)** — seed-script bruker nå `theme || '{...}'::jsonb`-merge, bevarer eksisterende theme-felter
- **XSS via homepage_url (High)** — CHECK-constraint på DB-nivå blokkerer javascript:/data:, + client-guard i displayDomain()
- **Broken links etter demo-sletting (Medium)** — 301-redirect i next.config.mjs før sletting
- **DB precedence mangler (Medium)** — auto-computed --primary-foreground brukes KUN hvis primaryForegroundColor er null
- **Migration transaksjon-sikkerhet (Low)** — BEGIN/COMMIT wrapper + rollback-kommentar
- **Pattern-avvik (Low)** — ShareButton som egen fil, shadcn DialogTrigger for cookies, seed-script følger seed-wesselslokka-summary.ts-malen

Alle mitigasjoner integrert i planen. Klar for implementering.

## Mål

Bygge et standardisert Placy-shell (header + footer) som wrapper rapport-ruten, slik at hver ny demo kan lages på ≤30 min branding-arbeid — bare ved å sette `homepage_url` + `primaryColor` i Supabase. Erstatte Wesselsløkka-custom-shellet (`/demo/wesselslokka`) med ny standardisert versjon for å levere Heimdal-demoen med riktig arkitektur.

## Kjerne-beslutninger (fra brainstorm)

- **Primary-farge = full kunde-farge i header** — krever auto-contrast
- **Én `--primary` til alt** — header-bg og CTA-knapper deler token
- **Wesselsløkka primary = teal `#204c4c`**
- **Footer er alltid nøytral Placy** — aldri kundens farge
- **Kun rapport-ruten** denne runden

## Arkitektur-oversikt

```
app/eiendom/[customer]/[project]/rapport/page.tsx
  └── <div style={themeVars} className="min-h-screen bg-background text-foreground flex flex-col">
        ├── <PlacyReportHeader project={projectData} />      ← NY
        ├── <main className="flex-1"><ReportPage .../></main>
        └── <PlacyReportFooter project={projectData} />      ← NY
```

**Theme-flyt (eksisterende, gjenbrukes):**
`projects.theme.primaryColor` → `hexToHslChannels()` → inline style `--primary` → brukes av header-bg, ReportPage CTA-knapper, osv.

**Ny theme-flyt (utvidelse):**
`projects.theme.primaryColor` → `computeLuminance()` → `--primary-foreground` (hvit eller near-black) → brukes av header-tekst.

## Komponent-spesifikasjoner

### `PlacyReportHeader`

**Filplassering:** `components/public/PlacyReportHeader.tsx`

**Props:**
```ts
interface PlacyReportHeaderProps {
  projectName: string;
  homepageUrl: string | null;
  shareTitle?: string; // default: "Nabolagsrapport for {projectName}"
}
```

**Hero-interaksjon (fra audit):**
- Eksisterende `ReportFloatingNav` bruker `z-40` (ReportFloatingNav.tsx:97) → header MÅ være `z-50`
- Hero viser prosjektnavnet som `<h1>` i 32px/48px/64px (mobile/tablet/desktop) — men hero scroller bort
- **Beslutning:** Header viser prosjektnavnet i senter på desktop (persistent kontekst når hero scroller bort), skjules på mobile (hero-tittel er allerede stor nok der og header-plass er trang)
- Hero har ingen logo, ingen tilbake-link — ingen redundans/klash
- Hero-bakgrunn er gradient hvit-til-hvit → teal-header ser bra ut mot hvit hero

**Struktur:**
```tsx
<header className="sticky top-0 z-50 h-14 bg-primary text-primary-foreground">
  <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
    {/* Venstre: tilbake-link */}
    {homepageUrl ? (
      <a href={homepageUrl} target="_blank" rel="noopener"
         className="flex items-center gap-1.5 text-sm opacity-90 hover:opacity-100">
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">{displayDomain(homepageUrl)}</span>
      </a>
    ) : <div /> }

    {/* Senter: prosjektnavn (skjules på mobile) */}
    <div className="hidden sm:block font-semibold text-base tracking-tight truncate">
      {projectName}
    </div>

    {/* Høyre: del-knapp */}
    <ShareButton title={shareTitle ?? `Nabolagsrapport for ${projectName}`} />
  </div>
</header>
```

**Helper — `displayDomain(url)`:**
Strippe protokoll og `www.` så URL-en blir lesbar: `https://www.wesselslokka.no/` → `wesselslokka.no`. Plasseres i `lib/utils/url.ts` eller inline.

**`ShareButton` (client component, EGEN fil):**

Plassering: `components/public/ShareButton.tsx` med `"use client"`-direktiv. IKKE inline i PlacyReportHeader-filen — følger etablert pattern i `components/public/` hvor interaktive leaf-komponenter (SaveButton, CollectionBar) har egne filer.

Gjenbruker `useCopyShare`-hook. Når to komponenter (header + eksisterende `ShareAction` i summary) nå bruker hooken, vurder å flytte den til `lib/hooks/useCopyShare.ts` som refactor — men **ikke blocker** for denne planen.

Viser `Share2`-ikon fra lucide, bytter til `Check`-ikon i 2 sek etter suksess.

**ShareData-payload (fra share-research):**
- Send `{ title: shareTitle, url: canonicalUrl }` — IKKE `text` (Android Chrome duplikerer URL hvis mottaker-app bruker text-feltet)
- `url` = `window.location.origin + window.location.pathname` (ikke full `href` med query params)
- `title` default = `"Nabolagsrapport for ${projectName}"`

**useCopyShare-utvidelse (må gjøres):**
Hooken må utvides med `execCommand('copy')`-fallback for tilfeller der `navigator.clipboard` er `undefined` (HTTP, eldre browsere). Legg til som 3. trinn etter clipboard-API. ~5 linjer kode.

**Accessibility (fra share-research):**
- `aria-label="Tilbake til kundens hjemmeside"` på venstre-link
- `aria-label`-swap på share-knapp: "Del rapport" → "Lenke kopiert" når `copied === true`
- Persistent `<span role="status" className="sr-only">` ved siden av knappen (MÅ mountes fra start, ikke betinget). Injiser "Lenke kopiert til utklippstavlen" når copied flipper
- Fokus-ring (`focus-visible:ring-2 ring-primary-foreground`)

**Kjent begrensning (dokumenteres):**
Hvis rapporten senere embeddes i iframe (f.eks. meglerens CMS), krever navigator.share() `allow="web-share"` i iframe-attributtet (Chrome 110+, Safari TP 160+). Ikke en blocker for egen origin.

### `PlacyReportFooter`

**Filplassering:** `components/public/PlacyReportFooter.tsx`

**Props:**
```ts
interface PlacyReportFooterProps {
  projectName: string;
  homepageUrl: string | null;
}
```

**Struktur:**
```tsx
<footer className="mt-16 bg-[#f7f4ec] border-t border-[#e5e0d5]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
    {/* Rad 1 */}
    <div className="flex items-center justify-between">
      <div className="font-semibold text-[#204c4c]">{projectName}</div>
      <div className="font-semibold text-[#204c4c]">Placy</div>
    </div>

    {/* Rad 2 */}
    <div className="mt-2 flex items-center justify-between text-sm text-[#6a6a6a]">
      {homepageUrl ? (
        <a href={homepageUrl} target="_blank" rel="noopener">
          Besøk {displayDomain(homepageUrl)}
        </a>
      ) : <span />}
      <a href="https://placy.no" target="_blank" rel="noopener">placy.no</a>
    </div>

    {/* Rad 3 — liten rad, sentrert */}
    <div className="mt-8 pt-4 border-t border-[#e5e0d5] text-xs text-[#8a8a8a] flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <span>© 2026 Placy</span>
      <span>·</span>
      <a href="https://placy.no/personvern" target="_blank" rel="noopener" className="hover:text-[#1a1a1a]">Personvern</a>
      <span>·</span>
      <CookiesLink />
      <span>·</span>
      <a href="mailto:hei@placy.no" className="hover:text-[#1a1a1a]">Kontakt</a>
    </div>
  </div>
</footer>
```

**Hardkodede farger i footeren** (cream `#f7f4ec`, ink `#204c4c` osv.) — bevisst. Footer er Placy-eid og skal ikke variere per kunde.

### `CookiesLink` + `CookiesModal`

**Filplassering:** `components/public/CookiesModal.tsx`

**Struktur:** Client component. Bruker shadcn `Dialog` + `DialogTrigger`-wrapper (ikke manuell `useState`) — følger shadcn-standard. CookiesLink blir bare en `DialogTrigger`-wrapper rundt lenke-teksten.

```tsx
<Dialog>
  <DialogTrigger asChild>
    <button className="hover:text-[#1a1a1a]">Informasjonskapsler</button>
  </DialogTrigger>
  <DialogContent>
    {/* modal-innhold */}
  </DialogContent>
</Dialog>
```

Footer selv (`PlacyReportFooter`) forblir server component — kun `CookiesModal` er client (leaf).

**Innhold:**
> ## Informasjonskapsler
>
> Vi bruker informasjonskapsler for å forstå bruken av siden og forbedre opplevelsen. Vi deler ikke persondata med tredjepart utover det som er nødvendig for analyse (Plausible).
>
> Ved å bruke Placy aksepterer du dette.
>
> [OK]

### `computeLuminance` + `pickContrastForeground`

**Filplassering:** `lib/theme-utils.ts` (utvide eksisterende fil)

**Oppdatert approach (fra luminance-research):** Bruk WCAG 2.1 sRGB-linearisering (ikke naive weighted sum — feil-klassifiserer mid-tones). Sammenlign kontrast-ratio mot SOFT_WHITE og SOFT_BLACK, ikke fast luminance-terskel. Soft-farger gir bedre UX enn rent svart/hvit.

```ts
const SOFT_WHITE = "0 0% 98%";   // #fafafa, luminance ≈ 0.955
const SOFT_BLACK = "0 0% 10%";   // #1a1a1a, luminance ≈ 0.008

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.1 relative luminance (0 = black, 1 = white).
 * Bruker ITU-R BT.709 koeffisienter og sRGB-linearisering.
 */
export function computeLuminance(hex: string): number | null {
  // Parse hex (3 eller 6 tegn) → RGB 0-1 → linearize → weighted sum
  // Returnerer null for ugyldig input
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Velger SOFT_WHITE eller SOFT_BLACK basert på hvilken gir høyest kontrast
 * mot bg-fargen. Returnerer HSL-channels-streng matchende hexToHslChannels-mønsteret.
 */
export function pickContrastForeground(bgHex: string): string | null {
  const L = computeLuminance(bgHex);
  if (L === null) return null;
  const whiteContrast = contrastRatio(0.955, L);
  const blackContrast = contrastRatio(L, 0.008);
  // Dev-warning hvis beste kontrast < 4.5:1 (WCAG AA for liten tekst)
  if (process.env.NODE_ENV === "development") {
    const best = Math.max(whiteContrast, blackContrast);
    if (best < 4.5) {
      console.warn(`[theme] Lav kontrast (${best.toFixed(2)}:1) for ${bgHex} — under WCAG AA for liten tekst`);
    }
  }
  return whiteContrast >= blackContrast ? SOFT_WHITE : SOFT_BLACK;
}
```

**Wesselsløkka-validering:** Teal `#204c4c` → luminance ≈ 0.044 → soft-white vinner (13:1 ratio). WCAG AAA ✓

**Integrert i page-wrapper — med precedence-regel:**

Eksisterende kode (page.tsx:66) mapper allerede `t.primaryForegroundColor` til `--primary-foreground`. Det betyr at en **eksplisitt DB-verdi må vinne over auto-computed**. Riktig logikk:

```ts
// I rapport/page.tsx
if (t.primaryColor) {
  const channels = hexToHslChannels(t.primaryColor);
  if (channels) themeStyle["--primary"] = channels;

  // Precedence: eksplisitt DB-verdi vinner, auto-compute kun som fallback
  if (t.primaryForegroundColor) {
    const fgChannels = hexToHslChannels(t.primaryForegroundColor);
    if (fgChannels) themeStyle["--primary-foreground"] = fgChannels;
  } else {
    const fg = pickContrastForeground(t.primaryColor);
    if (fg) themeStyle["--primary-foreground"] = fg;
  }
}
```

Dette lar kunder med spesifikke branding-krav overstyre auto-beregning (f.eks. hvis de insisterer på en spesifikk tekstfarge som ikke følger WCAG).

## Database-endring

### Migration 061

**Fil:** `supabase/migrations/061_projects_homepage_url.sql`

```sql
-- Legg til homepage_url for rapport-header "tilbake"-link
-- Wrappes i transaksjon for rollback-sikkerhet (matcher pattern fra 060)

BEGIN;

ALTER TABLE projects
ADD COLUMN homepage_url TEXT NULL
CONSTRAINT homepage_url_format CHECK (
  homepage_url IS NULL
  OR homepage_url ~* '^https?://'
);

COMMENT ON COLUMN projects.homepage_url IS
  'URL til kundens hjemmeside. Brukes i PlacyReportHeader som "tilbake"-link og i footer. Nullable — hvis ikke satt, skjules linken. CHECK-constraint sikrer http(s)-protokoll (blokkerer javascript:, data:, osv. — XSS-mitigasjon på DB-nivå).';

COMMIT;

-- Rollback (kjør manuelt ved behov):
-- BEGIN;
-- ALTER TABLE projects DROP CONSTRAINT homepage_url_format;
-- ALTER TABLE projects DROP COLUMN homepage_url;
-- COMMIT;
```

**Security: Defense in depth.** CHECK-constraint blokkerer farlige URL-schemes på DB-nivå (javascript:, data:, vbscript:). I tillegg skal `displayDomain()` i client-kode returnere `null` for ugyldige strenger (se Edge Cases). Både DB og client validerer — fanger data som smugles forbi én av dem.

**Kjøring (fra CLAUDE.md):**
```bash
source .env.local && /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  "postgresql://postgres.eolzjxkonfwbzjqqvbnj:${DATABASE_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/061_projects_homepage_url.sql
```

**Verifisering:**
```bash
source .env.local && curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?select=homepage_url&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

### Wesselsløkka data-migrering

**Fil:** `scripts/seed-wesselslokka-shell.ts`

**Følger etablert seed-mønster fra `scripts/seed-wesselslokka-summary.ts`:**
- Shebang `#!/usr/bin/env npx tsx`
- Dry-run som default
- `--apply`-flagg for faktisk skriving
- Backup til `backups/` før skriving (JSON av nåværende state)
- Whitelist-check på `customer_id` + `url_slug` (kun wesselslokka)
- Optimistic concurrency lock via `updated_at`-sjekk
- Post-write verifisering (data via SELECT + HTTP GET mot Supabase REST)

**KRITISK: JSONB-merge, ikke overwrite.** Naive `UPDATE theme = '{...}'::jsonb` overskriver hele JSONB-objektet og ødelegger eksisterende nøkler (f.eks. `backgroundColor`, `fontFamily` som kan være satt fra andre workflows). Riktig approach:

```sql
UPDATE projects
SET
  theme = COALESCE(theme, '{}'::jsonb) || '{"primaryColor": "#204c4c"}'::jsonb,
  homepage_url = 'https://www.wesselslokka.no/',
  updated_at = now()
WHERE customer_id = 'broset-utvikling-as'
  AND url_slug = 'wesselslokka'
  AND updated_at = $expected_updated_at;  -- concurrency lock
```

`||`-operatoren merger top-level keys; `COALESCE` håndterer NULL-theme. Idempotent — re-kjøring gir samme resultat. Halvveis-feil: scriptet logger BEFORE-state for manuell rollback, og transaksjon sikrer all-or-nothing for UPDATE-statements.

**Setter:**
- `homepage_url = 'https://www.wesselslokka.no/'`
- `theme.primaryColor = '#204c4c'` (teal — brainstorm-beslutning)
- Bevarer alle eksisterende theme-felter

Kjøres én gang lokalt mot prod-Supabase. BEFORE-state logges før skriving.

## TypeScript-endringer

### `lib/types.ts`

Utvide `Project`-interface med `homepageUrl?: string | null`:

```ts
export interface Project {
  // ... eksisterende felter
  homepageUrl?: string | null;
  // ...
}
```

### `lib/supabase/queries.ts` + `lib/data-server.ts`

**Fra query-audit (konkrete linjer):**

Kritisk sti — MÅ oppdateres:

1. **`lib/types.ts`** — legg til `homepageUrl?: string | null` i:
   - `ProjectContainer` (~linje 290)
   - `Project` (~linje 352)

2. **`lib/supabase/queries.ts`** — tre funksjoner:
   - `getProjectContainerFromSupabase()` (linje 733-897): SELECT * plukker automatisk opp nye kolonner ✓, men mapping til return-objektet må utvides (~linje 882)
   - `getProductFromSupabase()` (linje 906-995): kaller container-funksjonen; arver problem. Må plukke `homepageUrl` fra container og sende videre til legacy Project-objekt (~linje 990)
   - `getProjectFromSupabase()` (linje 528-604, fallback-sti): SELECT *, men mapping mangler homepageUrl (~linje 603)

3. **IKKE oppdater:** `getProjectPOIs`, `getProjectThemeStories`, andre hjelpe-queries — de trenger ikke homepageUrl.

Ingen `lib/supabase/transforms.ts` — mapping skjer inline i queries.ts.

Database-siden er allerede OK etter migrasjonen takket være SELECT *-mønster.

## Fase-oppdeling

### Fase 1: Infrastruktur (fundament)

1. **Migration 061** — Legg til `homepage_url`-kolonne
2. **TypeScript + queries** — Utvid `Project`-type, mapp `homepage_url` → `homepageUrl` i relevante queries
3. **Theme-utility** — Utvid `lib/theme-utils.ts` med `computeLuminance` + `pickContrastForeground`
4. **Verifiser:** `npx tsc --noEmit` + hent et prosjekt via SSR og sjekk at `homepageUrl` er tilgjengelig

### Fase 2: Komponenter

5. **`PlacyReportHeader`** — bygg komponenten (med `ShareButton` internt)
6. **`PlacyReportFooter`** — bygg komponenten
7. **`CookiesModal`** — bygg modal + link-komponent
8. **Verifiser:** Storybook-lignende test — lag en dummy-side som renderer komponentene med mock-data

### Fase 3: Integrasjon

9. **Update `app/eiendom/[customer]/[project]/rapport/page.tsx`** — injiser `--primary-foreground`, wrap med header/footer
10. **Test mot et eksisterende prosjekt** — f.eks. Leangen (som ikke har theme satt, skal fungere med defaults)
11. **Verifiser:** Chrome MCP-test — alle elementer rendrer, ingen console errors

### Fase 4: Wesselsløkka-migrering

12. **Kjør `scripts/seed-wesselslokka-shell.ts`** — sett theme + homepage_url i Supabase
13. **Test `/eiendom/broset-utvikling-as/wesselslokka/rapport`** — verifisere teal header, "← wesselslokka.no", prosjektnavn senter, Placy-footer
14. **Sammenlign med gammel `/demo/wesselslokka`** — er den nye versjonen profesjonell nok til Heimdal-levering?
15. **Fikse eventuelle problemer** som oppdages (f.eks. hero har sin egen logo, clash med header)

### Fase 5: Opprydding

16. **Legg til Next.js redirect i `next.config.mjs`** — FØR sletting:
    ```js
    async redirects() {
      return [
        {
          source: '/demo/wesselslokka',
          destination: '/eiendom/broset-utvikling-as/wesselslokka/rapport',
          permanent: true, // 301
        },
      ];
    }
    ```
    Beskytter delte lenker, bookmarks, Slack-referanser og eventuelle eksterne referanser.
17. **Slett `/app/demo/`-mappen** (inkludert wesselslokka-undermappe)
18. **Slett `/public/ws-demo/`-assets**
19. **Søk etter lenker** til `/demo/wesselslokka` — oppdater eller fjern
20. **Test redirect** — GET `/demo/wesselslokka` returnerer 301 → ny URL
21. **Commit + push**

## Edge Cases og manglende flyter

### Share-knapp

**Total feil (alle tre metoder feiler):** `useCopyShare` setter `error`-state, men `ShareButton` i planen spesifiserer ikke hva brukeren SER ved feil. Legg til: vis kort inline feilmelding ("Kunne ikke dele") i 3 sek via `error`-state, samme posisjon som "Lenke kopiert"-bekreftelse.

**Rapid-click / debounce:** Brukeren klikker Del-knappen flere ganger raskt. Native share sheet blokkerer seg selv (OS-nivaa), men clipboard-stien kan trigge flere timer-resets. Legg til: `ShareButton` disabler seg selv mens `copied === true` (2 sek cooldown), forhindrer dobbel-toast og timer-race.

**Private Browsing + iOS:** `navigator.clipboard.writeText()` kan kaste `NotAllowedError` i Safari Private Browsing. `useCopyShare` sin planlagte `execCommand('copy')`-fallback dekker dette, men fallbacken MÅ opprette et midlertidig `<textarea>` i DOM (SSR-safe). Legg til som eksplisitt krav i useCopyShare-utvidelsen.

### Cookies-modal

**Persistering:** Planen spesifiserer ikke om brukerens aksept lagres. Legg til: `localStorage.setItem('placy-cookies-ok', '1')` ved klikk OK. Ikke vis modalen proaktivt (den er link-trigget), men husk valget slik at fremtidig proaktiv banner slipper re-prompt.

**Keyboard-tilgjengelighet:** `CookiesModal` bruker shadcn `Dialog` som gir `Escape`-lukking og focus-trap automatisk. Bekreft at `CookiesLink` har `role="button"` og `tabIndex={0}` for tab-navigering i footer. Legg til som akseptansekriterium.

**Uten JavaScript:** Cookies-link gjor ingenting uten JS. Akseptabelt -- hele rapporten krever JS (Mapbox, interaktive elementer). Dokumenter som kjent begrensning.

### homepage_url

**Null/tom:** Planen dekker dette (`{homepageUrl ? <a> : <div />}`). Riktig -- link skjules helt.

**Ugyldig URL (manglende protokoll):** `displayDomain()` stripper protokoll, men `<a href="placy.no">` uten protokoll navigerer relativt. Legg til: `displayDomain` validerer og prepender `https://` hvis input mangler protokoll-prefix. Returner `null` for helt ugyldige strenger (ingen `.`). Null-output skjuler linken, samme som manglende homepage_url.

**`target="_blank"` uten `rel="noreferrer"`:** Planen har `rel="noopener"` men mangler `noreferrer`. Legg til `rel="noopener noreferrer"` pa begge steder (header + footer) for a unnga Referer-lekkasje til kundens side.

### Theme / primary-foreground

**Null primaryColor (ingen theme):** `pickContrastForeground` returnerer `null`, sa `--primary-foreground` settes ikke. Shadcn default fra globals.css gjelder. Sjekk at shadcn default `--primary-foreground` gir lesbar tekst mot shadcn default `--primary` i header. Legg til som eksplisitt test i Fase 3 steg 10.

**Ugyldig hex:** `computeLuminance` returnerer `null` ved ugyldig input. `pickContrastForeground` arver dette og returnerer `null`. Ingen CSS-variabel settes, shadcn defaults gjelder. Korrekt oppforsel -- ingen endring trengs, men legg til dev-warning (`console.warn`) i page.tsx nar `primaryColor` finnes men gir `null` fra `hexToHslChannels`.

### Header + Hero scroll-overlapp

**Lange prosjektnavn (40+ tegn):** Header bruker `truncate` (ellipsis) -- dekket. Men hero `<h1>` med responsive storrelser (32/48/64px) har ingen truncation spesifisert. Legg til: `line-clamp-2` pa hero-tittel for a unnga at tre-linjes titler dytter innhold ned.

**Mobile scroll-overgang:** Sticky header (z-50) + ReportFloatingNav (z-40) gir riktig stacking. Men under scroll-overgangen der hero forsvinner under header: bekreft at header har `bg-primary` (solid, ikke transparent) slik at hero-tekst ikke "skinner gjennom".

### Wesselsløkka seed-script

**Halvveis-feil:** Scriptet setter tre felter (`homepage_url`, `theme.primaryColor`, evt. andre). Hvis det feiler etter forste UPDATE men for andre: delvis tilstand. Legg til: wrap alle UPDATE-statements i en Supabase-transaksjon (RPC eller enkelt SQL med `BEGIN; ... COMMIT;`). Alternativt: scriptet er idempotent -- re-kjoring fikser delvis tilstand. Dokumenter re-kjoring som rollback-strategi.

**Rollback:** Ingen eksplisitt rollback-plan. Legg til: scriptet logger `BEFORE`-verdier for GET, slik at manuell revert er mulig. For MVP: rollback = sett `homepage_url = NULL` og fjern theme-felter manuelt.

## Risikomomenter

### Medium risk

- **Eksisterende prosjekter uten theme** — vil shellet se rart ut med default shadcn-farger? → Trenger test mot Leangen, KLP test-prosjekt. Default `--primary` i app er blå — shell blir blå header. Akseptabelt som fallback, men verdt å verifisere.
- **Hero i ReportPage kan ha egen logo/tittel** — kan clashe med header. → Sjekk om hero har stort prosjektnavn + logo. Hvis ja: header kan gi redundans. Mulig løsning: header prosjektnavn-sentrum skjules også på desktop hvis hero har tydelig tittel. Avklares i audit.
- **Sticky header + Mapbox-kart** — sticky header kan dekke kart-kontroller hvis kartet er i full-viewport. → Test nøye.

### Low risk

- **Footer-farger hardkodet** — hvis Placy noensinne endrer brand, må disse oppdateres. Akseptabelt for sandbox.
- **Cookies-modal er MVP** — hvis GDPR-myndigheter krever mer, må det utvides. Akseptabelt i sandbox-kontekst.

### Klebrig punkt

- **Query-oppdateringer** — `homepage_url` må selekteres i alle relevante queries. Glemmer vi én, får vi `undefined` i rapport-shellet. Audit-fasen må katalogisere alle queries som henter prosjekt-data for rapport-ruten.

## Akseptansekriterier

- [ ] `projects.homepage_url`-kolonne finnes i prod
- [ ] `homepageUrl` tilgjengelig i `Project`-type + returnert av `getProductAsync` + `getProjectAsync`
- [ ] `computeLuminance` + `pickContrastForeground` fungerer for både mørke og lyse farger (test med #204c4c → hvit, #f7f4ec → mørk)
- [ ] `PlacyReportHeader` viser `--primary` som bg, tekst med `--primary-foreground`, tilbake-link med korrekt domene-visning
- [ ] `PlacyReportHeader` mobile: senter skjult, venstre bare ikon
- [ ] `PlacyReportFooter` har nøytral cream bg, lenker fungerer
- [ ] Share-knapp på mobile bruker native share-sheet; desktop kopierer lenke til clipboard
- [ ] Cookies-modal åpner/lukker korrekt, tekst er tydelig
- [ ] CookiesLink er nåbar via Tab-navigasjon, modal lukkes med Escape
- [ ] Share-knapp viser feilmelding ved total share-feil, ikke stille feil
- [ ] Share-knapp debounces rapid clicks (disabled under 2 sek cooldown)
- [ ] `useCopyShare` har `execCommand('copy')`-fallback med midlertidig textarea
- [ ] `displayDomain` prepender `https://` for URL-er uten protokoll, returnerer null for ugyldige
- [ ] homepage_url-lenker bruker `rel="noopener noreferrer"`
- [ ] Seed-script logger BEFORE-verdier og er idempotent (re-kjorbar ved feil)
- [ ] `/eiendom/broset-utvikling-as/wesselslokka/rapport` viser teal header, riktig tilbake-link, profesjonell Placy-footer
- [ ] `/eiendom/[customer]/[project]/rapport` for et prosjekt UTEN theme (f.eks. KLP test-prosjekt) ser OK ut med defaults
- [ ] `/demo/wesselslokka/` + `app/demo/` + `public/ws-demo/` er slettet
- [ ] Ingen typefeil (`npx tsc --noEmit`), ingen nye lint errors
- [ ] Ingen console errors på Chrome MCP-test

## Out-of-scope (eksplisitt utsatt)

- Full cookie-consent-flyt (GDPR-compliant banner)
- Analytics-events på shell (share-click, footer-click)
- Ruter: `/event/*`, `/eiendom/*/story`, `/eiendom/*/explorer`
- Whitelabel-admin-UI
- Personvern + Kontakt-sider (bruker `https://placy.no/personvern` + `mailto:hei@placy.no` inntil videre)
- Auto-contrast for `--accent`, `--card`, osv. — kun `--primary-foreground` i denne runden

## Rekkefølge for implementering

**Kritisk sti:** Fase 1 → Fase 2 → Fase 3. Wesselsløkka-migrering (Fase 4) kan ikke starte før Fase 3 er ferdig. Opprydding (Fase 5) kan ikke starte før Wesselsløkka er verifisert levert.

Innen hver fase kan oppgaver kjøres delvis parallelt (f.eks. PlacyReportHeader og Footer kan bygges samtidig i Fase 2). Men for enkelhets skyld: sekvensiell innen fase, parallellisering kan håndteres av `/work`-orkestrer.

## Suksess-signal

Kan si "la oss kjøre Heimdal-demo" og gjøre det på under 30 minutter gitt at prosjekt-data eksisterer — bare sette `homepage_url` + `primaryColor` og publisere URL-en.
