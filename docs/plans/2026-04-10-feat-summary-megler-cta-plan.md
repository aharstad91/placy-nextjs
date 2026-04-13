# Plan: Oppsummeringsblokk + Megler-CTA

**Dato:** 2026-04-10
**Type:** feat
**Brainstorm:** `docs/brainstorms/2026-04-10-summary-megler-cta-brainstorm.md`
**Target:** `/eiendom/broset-utvikling-as/wesselslokka/rapport` (Wesselsløkka som første eksempel), men generalisert for alle rapporter
**Status:** Beriket etter /deepen-plan og /tech-audit (2026-04-10). YELLOW-verdict fra begge auditer — mitigasjoner inkorporert. Klar for Trello-kort-generering.

## Audit Findings — Kritiske Oppdagelser

Fra /tech-audit (architecture-strategist + data-integrity-guardian):

1. **BLOKKER: `app/globals.css` har dobbel `:root`-deklarasjon.** Linje 6-33 definerer shadcn-tokens som HSL-kanalverdier (`40 20% 98%`), linje 450-483 overstyrer med oklch-verdier (`oklch(1 0 0)`). Cascade vinner for oklch → `hsl(var(--background))` i tailwind.config blir `hsl(oklch(...))` = ugyldig CSS. Semantiske Tailwind-klasser (`bg-background`, `text-foreground`, `bg-primary` etc.) fungerer IKKE som forventet. **Dette må fikses i Kort 0 før noen annen kode skrives**, ellers blir Kort 2-5 feilsøking uten ende. Verifisert via grep: `--sidebar-*` tokens referes kun i globals.css (dead code, trygg å slette).

2. **`closingTitle`/`closingText` brukes på 5 steder**, ikke kun `lib/types.ts`. Kort 1 utvides til å rydde alle.
   - `lib/types.ts:189-190`
   - `components/variants/report/ReportPage.tsx:199-200`
   - `components/variants/report/report-data.ts:91-92, 507-508`
   - `lib/i18n/apply-translations.ts:37-42`
   - `components/variants/report/ReportClosing.tsx` (hele fila slettes)

3. **`window.plausible` er ikke TypeScript-deklarert** noe sted i repoet. `window.plausible?.(...)` vil gi TS-feil. Ny Kort 0.5 legger til `types/plausible.d.ts`.

4. **Supabase seed-script (Kort 6) mangler produksjonsgrade-safeguards**: backup, dry-run-flag, whitelist-check, concurrency guard, deep-merge semantikk, post-write HTTP-verifikasjon, rollback-script. Alle lagt inn som eksplisitte akseptansekriterier i revidert Kort 6.

5. **Scope-begrensning for Wesselsløkka-brandet parallell-worktree**: Inline-style theming påvirker KUN nye komponenter som bruker semantiske tokens. Hero, tema-seksjoner, highlight-cards og kart bruker fortsatt hardkodede hex-verdier og vil IKKE tematiseres av den brandede varianten. Dette må kommuniseres tydelig til den parallelle worktreen.

Alle mitigasjoner er inkorporert i kortene nedenfor. Revidert dependency-rekkefølge: **Kort 0 → 0.5 → 1 → (2, 3, 3b parallelt) → 4 → 5 → 6**.

## Sammendrag

Erstatte dagens `ReportClosing`-komponent med en ny `ReportSummarySection` som består av fem elementer (justert fra 4 etter research):
1. Syntese-overskrift (én skarp setning)
2. 3–5 kondenserte innsikter
3. **Kontekstuell megler-invitasjon** (varm setning som refererer til det brukeren har lest — ny, fra megler-research)
4. Megler-kort (1..n) — foto 96×96 sirkulær, tel: og mailto: direkte synlig
5. Primær-CTA "Meld interesse" (knapp) + tel:-link under (sekundær)
6. Tertiær "Del"-knapp som liten ikon-handling (plassert diskret)

Utvide `ReportConfig`-schemaet med `summary`, `brokers` og `cta` felter. Refaktorere styling til å bruke de **eksisterende shadcn-semantiske tokens** (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`) som allerede er definert med kanalverdier i `app/globals.css`. Wesselsløkka-brandet variant overstyrer disse på en wrapper via inline `style`-prop.

**Tracking**: Plausible er allerede satt opp i `app/eiendom/layout.tsx` men ingen custom events er sendt i dag. Denne planen legger inn `window.plausible?.()` for CTA-klikk, megler-telefon/e-post-klikk, og share-handling.

## Nøkkelbeslutninger

### Arkitektur

**1. Én ny seksjonskomponent med sub-komponenter**
```
components/variants/report/
  ReportSummarySection.tsx         # wrapper, erstatter ReportClosing
  summary/
    SummaryHeadline.tsx            # syntese-setning
    SummaryInsights.tsx            # 3-5 bullets
    BrokerInvite.tsx               # varm kontekstuell invitasjon (ny fra research)
    BrokerCard.tsx                 # enkeltmegler-kort med tel:/mailto: synlig
    PrimaryCTA.tsx                 # "Meld interesse"-knapp med Plausible-tracking
    ShareAction.tsx                # tertiær ikon-knapp for del-handling
  hooks/
    useCopyShare.ts                # custom hook for navigator.share + clipboard fallback
```

Rasjonale: Sub-komponenter gjør hver del gjenbrukbar og testbar. Wrapping sikrer konsistent spacing og grid-plassering. `ShareAction` er skilt ut fra hoved-CTA-raden fordi research viste at del-handling bør være visuelt underordnet megler-kontakt.

**2. Erstatte, ikke utvide, `ReportClosing`**
- Slett `components/variants/report/ReportClosing.tsx` og `DEFAULT_CLOSING`-konstanten
- Oppdater `ReportPage.tsx:195-201` til å rendre `ReportSummarySection` i stedet
- Fjern `closingTitle` og `closingText` fra `ReportConfig` (`lib/types.ts:185-193`)
- Backward compat: ingen. Dette er prototype-stadie, vi endrer schemaet hardt. Oppdater alle eksisterende prosjekt-JSON-er manuelt.

**3. Datamodell i `ReportConfig`**

```typescript
// lib/types.ts — utvidelse
export interface BrokerInfo {
  name: string;                    // fullt navn
  firstName?: string;              // brukes i varm tone ("Jørgen kjenner Brøset")
  title: string;                   // "Eiendomsmegler MNEF" etc
  phone: string;                   // display format, tel: normaliseres i komponent
  email: string;
  photoUrl: string;                // kvadratisk foto — rendres som sirkel
  officeName: string;              // "Heimdal Eiendomsmegling"
  officeLogoUrl?: string;          // valgfri
  bio?: string;                    // kort kontekst ("bor og jobber i nabolaget")
}

export interface ReportSummary {
  headline: string;                // én syntese-setning
  insights: string[];              // 3-5 bullets (valider lengde i render)
  brokerInviteText?: string;       // varm kontekstuell setning før megler-kort
                                    // default: bygges fra template hvis utelatt
}

export interface ReportCTA {
  leadUrl?: string;                // primær: lenke til "Meld interesse"-side
  primaryLabel?: string;           // default "Meld interesse"
  primarySubject?: string;         // for mailto fallback
  shareTitle?: string;             // for navigator.share()
}

export interface ReportConfig {
  label?: string;
  heroIntro?: string;
  themes?: ReportThemeConfig[];
  summary?: ReportSummary;    // NY
  brokers?: BrokerInfo[];     // NY
  cta?: ReportCTA;            // NY
  mapStyle?: string;
  trails?: TrailCollection;
  // FJERNES: closingTitle, closingText
}
```

**4. CTA-logikk (oppdatert etter research)**

CTA-hierarki, basert på norsk meglerkonvensjon + research-funn:

- **Primær (knapp)**: `cta.leadUrl` hvis satt → `<a href={leadUrl} target="_blank" rel="noopener">`. Hvis `leadUrl` mangler men minst én megler finnes → fallback til `mailto:{broker.email}?subject={cta.primarySubject}`. Hvis ingen av delene → knapp skjules.
- **Sekundær (tel:-link, ikke knapp)**: Under primær-knapp, synlig telefonnummer "Eller ring direkte: 73 87 15 00" som `<a href="tel:+4773871500">`. Dette er norsk meglerkonvensjon — telefon er alltid umiddelbart tilgjengelig, ikke bak et klikk. Vises kun hvis første megler har `phone`.
- **Tertiær (ikonknapp)**: Liten `Share2`-ikon (fra lucide) øverst til høyre i seksjonen, ikke i hoved-CTA-raden. Bruker `useCopyShare` hook (se Kort 3b). Ingen tekst-label som default — kun ikon med `aria-label="Del rapporten"`. Ved klikk: ikon-swap til `Check` i 2s + aria-live bekreftelse.

Research-begrunnelse: En primær-CTA per skjerm slår flere. Del-handling er ikke primær for en megler-rapport — den er tertiær verdi ("jeg vil sende denne til partner"). Tidligere plan hadde del som "sekundær-knapp" ved siden av primær, som skapte choice paralysis.

**5. Theming via eksisterende shadcn-tokens (revidert etter research)**

**Viktig oppdagelse under research**: Shadcn-mønsteret er **allerede på plass** i `app/globals.css`. `:root` har `--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`, `--accent` osv. som **kanalverdier** (`40 20% 98%`), og `tailwind.config.ts` mapper dem korrekt via `hsl(var(--x))`. Dette betyr at `bg-background`, `text-foreground`, `bg-primary` etc. er tilgjengelige klasser som **allerede** fungerer med opacity-modifiers (`bg-primary/50`).

De eksisterende `--placy-primary`, `--placy-bg`, `--placy-font` variablene i `globals.css` og den tilhørende `dangerouslySetInnerHTML` style-injection i `rapport/page.tsx:55-62` er **feil formatert** (ferdige farger, ikke kanalverdier) og brukes ikke av noen komponenter. De er **dead code** og skal fjernes som del av denne planen.

**Ny theming-strategi:**

1. **Nye komponenter bruker eksisterende shadcn-tokens utelukkende**: `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-card`, `text-muted-foreground`, `border-border`. Ingen hardkodede hex-verdier i nye komponenter.

2. **Rapport-rute-wrapper overstyrer semantiske tokens via inline `style`-prop** (ikke `<style dangerouslySetInnerHTML>`):
   ```tsx
   // app/eiendom/[customer]/[project]/rapport/page.tsx
   const themeOverrides = projectData.theme ? {
     '--background': hslChannelString(projectData.theme.backgroundColor),
     '--foreground': hslChannelString(projectData.theme.textColor),
     '--primary': hslChannelString(projectData.theme.primaryColor),
     // ... øvrige tokens projektet vil overstyre
   } as React.CSSProperties : {};

   return (
     <div style={themeOverrides} className="min-h-screen bg-background text-foreground">
       <ReportPage ... />
     </div>
   );
   ```
   
   CSS custom properties arves nedover og er scopet til subtreet — ingen lekkasje til andre ruter. Ingen hydration-issues fordi React serialiserer inline `style` i SSR.

3. **Utility for konvertering av hex → HSL-kanaler**: Lag `lib/theme-utils.ts` med `hslChannelString(hex: string): string`. Tar "#3b82f6" og returnerer "217 91% 60%". Bruker standard hex→HSL-matematikk, ingen dependencies.

4. **Fallback-strategi**: Hvis prosjekt-tema mangler eller har ugyldig hex, ikke sett variabelen — la `:root`-defaultene gjelde. Aldri throw, aldri vis feil.

5. **Scope-begrensning**: Vi refaktorerer KUN nye komponenter og `rapport/page.tsx` wrapper-laget. Eksisterende komponenter (hero, tema-seksjoner, highlight-cards) som bruker hardkodede hex forblir uendret. Wesselsløkka-brandet variant kan fortsatt overstyre via wrapper, men vil bare påvirke komponenter som bruker de semantiske tokens. Hvis brandet variant trenger å overstyre mer, er det egen oppgave senere.

6. **Fjerning av dead code**:
   - Fjern `--placy-primary`, `--placy-bg`, `--placy-font` fra `app/globals.css:28-31`
   - Fjern tilsvarende `dangerouslySetInnerHTML` style-injection fra `rapport/page.tsx:55-62`
   - Fjern `primaryColor`, `backgroundColor`, `fontFamily` fra `ProjectTheme` interface hvis de ikke brukes noe annet sted, og erstatt med `textColor?`, `backgroundColor?`, `primaryColor?`, `cardColor?`, `mutedColor?`, `borderColor?`, `accentColor?` (alle hex-strenger, alle valgfrie).

### Copy for Wesselsløkka (første eksempel)

**Summary headline:**
> "Brøset er for de som vil ha natur rett utenfor døren uten å gi opp bysentrum."

**Insights (draft — skal kurateres før demo):**
1. "Halvparten av området er grøntareal, med 7 parker og tursystem innen gangavstand."
2. "Valentinlyst Senter dekker hverdagsbehovene på 8 minutter — dagligvare, apotek, frisør, vinmonopol."
3. "Skolekretsen har Eberg barneskole, Blussuvoll ungdomsskole og Strinda VGS — alle innen 18 minutter."
4. "Buss-linje 12 går hvert 15. minutt til sentrum, og nærmeste stopp er rett utenfor døren."
5. "95 tilbud innen gangavstand, snitt 4.2 stjerner — et helhetlig tilbud, ikke enkeltsteder."

**Broker invite text (ny, varm tone fra research):**
> "Du har sett syv temaer om Brøset. [Fornavn] kjenner nabolaget og kan svare på det rapporten ikke dekker — skolevalg, fellesgjeld, innflytting."

**Megler (plassholder-data — hentes fra Heimdal team-side før demo):**
```json
{
  "name": "[Fylles ut]",
  "firstName": "[Fylles ut]",
  "title": "Eiendomsmegler MNEF",
  "phone": "+47 73 87 15 00",
  "email": "...",
  "photoUrl": "...",
  "officeName": "Heimdal Eiendomsmegling",
  "officeLogoUrl": "https://.../heimdal-logo.svg",
  "bio": "Bor og jobber i nabolaget"
}
```

**CTA:**
```json
{
  "leadUrl": "https://www.wesselslokka.no/kontakt",
  "primaryLabel": "Meld interesse",
  "primarySubject": "Interesse for Wesselsløkka",
  "shareTitle": "Wesselsløkka — Nabolagsrapport"
}
```

## Faser / Arbeidspakker

### Kort 0: BLOKKER — Rydd opp `globals.css` dobbel `:root`

**Mål:** Fjerne dead code i `app/globals.css` som gjør at alle shadcn semantic tokens er effektivt ødelagt. Dette blokkerer alle andre kort og MÅ gjøres først.

**Filer:**
- `app/globals.css:445-516` — slett andre `:root`-blokk (oklch) og `.dark`-blokk, samt `.theme`-wrapper rundt linje 446-449 hvis den ikke brukes

**Endring:**
```css
/* BEVAR (linje 5-34):
@layer base {
  :root {
    --background: 40 20% 98%;    ← HSL kanalverdier, dette mønsteret skal beholdes
    ...
    --placy-primary: #3b82f6;    ← dette slettes i Kort 5, la stå foreløpig
    --placy-bg: #ffffff;
    --placy-font: system-ui;
  }
}
*/

/* SLETT (linje 445-516):
@layer base {
  .theme { --font-heading: ...; }
  :root {
    --background: oklch(1 0 0);  ← dead code fra shadcn CLI, overstyrer første :root
    ...
  }
  .dark { ... }                   ← dead code, dark mode brukes ikke
  * { @apply border-border outline-ring/50; }  ← sjekk om denne MÅ bevares (styler alle elementer)
}
*/
```

**Kritisk sjekk før sletting:** Linje 517-519 har `* { @apply border-border outline-ring/50; }`. Dette er en global base-style som påvirker alle elementer. Verifiser at sletting av den ikke bryter eksisterende komponenter. Hvis den må beholdes, flytt den til en egen `@layer base`-blokk utenfor slettingen.

**Akseptansekriterier:**
- [ ] Kun én `:root`-blokk i `globals.css` (grep for `^\s*:root\s*{` gir ett treff)
- [ ] `--sidebar-*` tokens er slettet (grep gir null treff i `globals.css`, bekreftet at ingen andre filer bruker dem)
- [ ] `oklch(` er slettet fra `globals.css` (grep gir null treff)
- [ ] `.dark`-blokken er slettet (dark mode er ikke i bruk i Placy)
- [ ] `* { @apply border-border outline-ring/50; }` bevart hvis nødvendig, eller slettet med visuell regression-sjekk
- [ ] `npm run dev` starter uten CSS-feil
- [ ] Besøk rapport-siden og verifiser at den ser identisk ut før og etter (eksisterende komponenter bruker hardkodede hex, så ingen visuell forskjell forventes)
- [ ] Verifiser at `<div className="bg-background text-foreground p-4">test</div>` rendrer med riktig farge (cream background + dark text) i en midlertidig test-komponent

**Avhengigheter:** ingen

**Estimert kompleksitet:** Lav (ren sletting), høy risiko hvis ikke verifisert visuelt

---

### Kort 0.5: TypeScript-deklarasjon for Plausible

**Mål:** Legge til typedeklarasjon for `window.plausible` slik at event-tracking-koden i senere kort ikke gir TypeScript-feil.

**Filer:**
- `types/plausible.d.ts` (ny) — eller `lib/types/plausible.d.ts`, avhengig av hvor andre `.d.ts`-filer i repoet ligger

**Innhold:**
```typescript
declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: {
        props?: Record<string, string | number | boolean>;
        callback?: () => void;
      }
    ) => void;
  }
}

export {};
```

**Sjekk `tsconfig.json`:** Verifiser at `include` fanger opp `.d.ts`-filer i mappen du legger den i. Hvis ikke, legg til eksplisitt.

**Akseptansekriterier:**
- [ ] `window.plausible?.('test_event')` gir ingen TypeScript-feil
- [ ] `window.plausible?.('test_event', { props: { foo: 'bar' } })` gir ingen TypeScript-feil
- [ ] `npm run typecheck` passerer

**Avhengigheter:** ingen

---

### Kort 1: Datamodell — utvid `ReportConfig` og rydd `closingTitle`/`closingText` overalt

**Mål:** Legge til `summary`, `brokers`, `cta` felter i `ReportConfig`. Fjerne `closingTitle`/`closingText` fra ALLE steder i kodebasen (audit avdekket 5 steder, ikke bare types.ts).

**Filer som MÅ oppdateres:**
1. `lib/types.ts:185-193` — oppdater `ReportConfig` interface, legg til `BrokerInfo`, `ReportSummary`, `ReportCTA` interfaces, fjern `closingTitle` og `closingText`
2. `components/variants/report/report-data.ts:91-92, 507-508` — fjern referanser til `closingTitle`/`closingText`
3. `lib/i18n/apply-translations.ts:37-42` — fjern referanser til `closingTitle`/`closingText` (oversettelses-logikk)
4. `components/variants/report/ReportPage.tsx:199-200` — fjern prop-passing til `ReportClosing` (midlertidig, frem til Kort 4 erstatter komponenten)
5. `components/variants/report/ReportClosing.tsx` — IKKE slett enda, den erstattes i Kort 4. For nå: enten la stå uendret (men uten data-input siden props fjernes), eller kommenter ut hele fila. Foretrukket: kommenter ut i Kort 1, slett endelig i Kort 4.

**Håndtering av DB-data:** Eksisterende rader i `products.config` har fortsatt `closingTitle`/`closingText` som JSONB-nøkler. Vi rører dem ikke — JSONB tolererer ekstra nøkler, og når TS-typen ikke lenger har feltet, leses de bare ikke. Datadrift, ikke databrudd. Dokumenteres i Kort 6 som "deprecated, not deleted".

**Akseptansekriterier:**
- [ ] `BrokerInfo`, `ReportSummary`, `ReportCTA` interfaces eksportert fra `lib/types.ts`
- [ ] `ReportConfig` inkluderer `summary?`, `brokers?`, `cta?`
- [ ] `closingTitle` og `closingText` er fjernet fra `ReportConfig` i `lib/types.ts`
- [ ] `grep -rn "closingTitle\|closingText" lib/ components/ app/` gir null treff (bortsett fra evt. kommenterte-ut `ReportClosing.tsx`)
- [ ] `npm run typecheck` passerer uten feil
- [ ] `npm run lint` passerer
- [ ] Eksisterende rapport-rute `/eiendom/broset-utvikling-as/wesselslokka/rapport` laster uten runtime-feil (seksjonen vises bare ikke)
- [ ] Andre rapporter (scandic-nidelven) laster uten feil

**Avhengigheter:** Kort 0, 0.5

---

### Kort 2: Komponent — `BrokerCard`

**Mål:** Enkeltmegler-kort med sirkulært foto (96×96), navn, tittel + kontor, direkte synlig telefon og e-post, evt. kontorlogo. Varm i tonen, ikke korporat.

**Filer:**
- `components/variants/report/summary/BrokerCard.tsx` (ny)

**Props:**
```typescript
interface BrokerCardProps {
  broker: BrokerInfo;
}
```

**Layout og styling (fra megler-research):**
- Foto: 96×96px sirkulær (`rounded-full object-cover`) — ikke firkantet, mer personlig. Fallback til Lucide `User`-ikon i sirkel hvis `photoUrl` mangler eller feiler.
- Navn: 18–20px, semibold, `text-foreground`
- Tittel-linje: 14px, `text-muted-foreground`, format "`${title}, ${officeName}`" (f.eks. "Eiendomsmegler MNEF, Heimdal Eiendomsmegling")
- Bio (hvis satt): 13px, italic, `text-muted-foreground`
- Telefon: `tel:`-link, 16px, `text-foreground`, med `Phone`-ikon 16px fra lucide foran. Normaliser telefon til e.164 for `href` (f.eks. "+47 73 87 15 00" → `tel:+4773871500`).
- E-post: `mailto:`-link, 14px, `text-muted-foreground`, med `Mail`-ikon 16px foran. `href={mailto:${email}?subject=${encodeURIComponent(subject)}}` hvor subject bygges fra prosjekt-tittel.
- Office-logo: valgfri, 32px høy, venstre-justert under kontakt-info
- Container: `bg-card border border-border rounded-2xl p-6`
- Responsiv: foto stables vertikalt over tekst på `<640px`, side ved side på `≥640px`

**Tracking-attributter:**
- `data-event="broker_phone_click"` på telefon-link
- `data-event="broker_email_click"` på e-post-link
- Klikk-handlere som sender til Plausible: `onClick={() => window.plausible?.('broker_phone_click', { props: { broker: broker.name } })}`

**Akseptansekriterier:**
- [ ] Rendrer alle felter fra `BrokerInfo`
- [ ] Telefon-klikk åpner `tel:`-link (verifiser på iOS Safari og desktop Chrome)
- [ ] E-post-klikk åpner `mailto:`-link med forhåndsutfylt subject
- [ ] Håndterer manglende `photoUrl`, `bio`, `officeLogoUrl` uten layout-brudd
- [ ] Kun shadcn-tokens i styling (grep for `#` i fila — ingen treff)
- [ ] Responsiv: 96×96 foto, stables vertikalt på mobil
- [ ] Plausible-events sendes ved klikk (verifiser i network tab eller Plausible dashboard hvis tilgjengelig)
- [ ] `aria-label` på ikonbare lenker (f.eks. "Ring Jørgen Hansen, 73 87 15 00")

**Avhengigheter:** Kort 1

---

### Kort 3: Sub-komponenter — Headline, Insights, BrokerInvite, PrimaryCTA, ShareAction

**Mål:** Alle sub-komponenter utenom `BrokerCard` (Kort 2).

**Filer:**
- `components/variants/report/summary/SummaryHeadline.tsx`
- `components/variants/report/summary/SummaryInsights.tsx`
- `components/variants/report/summary/BrokerInvite.tsx` (ny fra research)
- `components/variants/report/summary/PrimaryCTA.tsx`
- `components/variants/report/summary/ShareAction.tsx`

---

**`SummaryHeadline`:**
- Rendrer syntese-setningen som `<h2>` eller `<p>` avhengig av visuell vekt (vurderes i implementasjon — research sier "stor og tydelig, ikke korporat")
- Props: `{ text: string }`
- Styling: Serif eller semibold sans, 28–32px, `text-foreground`, max-width for lesbarhet

**`SummaryInsights`:**
- Rendrer liste med 3–5 bullets. Hver bullet har et lite `Sparkles`-ikon i `text-primary` foran
- Props: `{ items: string[] }`
- Validering: dev-warning hvis `items.length < 3 || items.length > 5` (ikke crash)
- Styling: `space-y-3`, 16px tekst, `text-foreground`

**`BrokerInvite`:**
- Ny komponent fra research-funnet om varm kontekstuell tone
- Rendrer en kort, varm setning over megler-kortet som refererer til det brukeren har lest
- Props: `{ text?: string; fallbackBroker?: BrokerInfo; themesCount?: number; projectName: string }`
- Logikk:
  - Hvis `text` er satt → bruk den direkte (fra `summary.brokerInviteText`)
  - Ellers → bygg default template: `"Du har sett ${themesCount} temaer om ${projectName}. ${fallbackBroker.firstName ?? 'Megleren'} kan svare på det rapporten ikke dekker."`
- Styling: 16–18px, `text-foreground`, 1–2 linjer, max-width for lesbarhet

**`PrimaryCTA`:**
- Primær "Meld interesse"-knapp + tel:-link under
- Props: `{ cta: ReportCTA; primaryBroker?: BrokerInfo; projectTitle: string }`
- Logikk:
  - Primær href: `cta.leadUrl ?? (primaryBroker ? mailto:${primaryBroker.email}?subject=${encodeURIComponent(cta.primarySubject ?? `Interesse for ${projectTitle}`)} : null)`
  - Hvis ingen href → ikke render knappen, kun tel:-link hvis tilgjengelig
  - Tel:-link: rendrer "Eller ring direkte: [telefonnummer]" som `<a href="tel:...">` under knappen, kun hvis `primaryBroker.phone` finnes
- Styling (fra research):
  - Knapp: full-width på `<640px`, max-width 320px på `≥640px`, 48px høy, `rounded-xl`, `bg-primary text-primary-foreground`, `font-semibold`, `hover:shadow-lg transition-shadow` (ikke fargeendring)
  - Tel:-link: 14px, `text-muted-foreground`, sentrert under knapp
- Tracking:
  - `onClick` på primær-knapp: `window.plausible?.('cta_primary_click', { props: { destination: href, project: projectTitle } })`
  - `onClick` på tel:-link: `window.plausible?.('cta_phone_click', { props: { broker: broker.name } })`
- Accessibility:
  - `aria-label` på knapp med tydelig intensjon
  - `rel="noopener"` på eksterne lenker

**`ShareAction`:**
- Tertiær ikonknapp for del-handling
- Props: `{ shareTitle?: string }`
- Bruker `useCopyShare` hook (se Kort 3b)
- Plassering: absolut posisjonert øverst til høyre i `ReportSummarySection` container, ikke i CTA-raden
- Styling: 40×40 ikonknapp, `Share2`-ikon 20px, `text-muted-foreground`, hover `text-foreground`
- Ved klikk: ikon bytter til `Check` i 2s, `aria-live="polite"` span oppdateres til "Lenke kopiert"
- Tracking: `window.plausible?.('cta_share_click')` ved klikk

**Akseptansekriterier:**
- [ ] Alle fem komponenter rendrer fra props uten sideeffekter
- [ ] `PrimaryCTA` håndterer alle tre tilstander (leadUrl / mailto fallback / skjult)
- [ ] `PrimaryCTA` viser tel:-link under knapp kun når første megler har telefon
- [ ] `BrokerInvite` bygger default template når `text` mangler
- [ ] `SummaryInsights` advarer (dev) hvis antall items er utenfor 3–5
- [ ] Kun shadcn-tokens i styling (grep for hex-farger — ingen treff)
- [ ] Plausible-events sendes fra `PrimaryCTA`, `ShareAction` (og `BrokerCard` fra Kort 2)
- [ ] `ShareAction` har `aria-label` og `aria-live` bekreftelse

**Avhengigheter:** Kort 1, 3b

---

### Kort 3b: Hook — `useCopyShare`

**Mål:** Gjenbrukbar React hook som håndterer navigator.share + clipboard fallback med ikon-swap state.

**Filer:**
- `components/variants/report/summary/hooks/useCopyShare.ts` (ny)

**API:**
```typescript
type UseCopyShareResult = {
  share: (options?: { title?: string; url?: string }) => Promise<void>;
  copied: boolean;  // true i 2s etter suksess
  error: string | null;
};

export function useCopyShare(): UseCopyShareResult;
```

**Logikk (fra clipboard-research):**
1. Hvis `navigator.share` finnes OG `navigator.canShare?.({ url })` returnerer true OG brukeren er på mobil (user-agent sniff) → `navigator.share({ title, url })`
2. Ellers → `navigator.clipboard.writeText(url)`
3. Ved suksess: `setCopied(true)`, `setTimeout` 2000ms til `setCopied(false)` med cleanup i `useEffect`
4. Catch `AbortError` (bruker kansellerte share sheet) — ignorer stille
5. Catch andre feil → `setError(msg)`, ikke crash

**Default url**: `window.location.href` hvis ikke angitt

**Akseptansekriterier:**
- [ ] Hook returnerer stabilt API selv på SSR (check for `typeof window`)
- [ ] `copied`-state resetter etter 2000ms
- [ ] Timer-cleanup kjører ved unmount
- [ ] Håndterer AbortError stille
- [ ] Fungerer på desktop Chrome (clipboard), iOS Safari (share sheet), eldre browsere (fallback)

**Avhengigheter:** ingen

---

### Kort 4: Orkestrator — `ReportSummarySection`

**Mål:** Wrapping-komponent som komponerer alle sub-komponentene og plasseres der `ReportClosing` var.

**Filer:**
- `components/variants/report/ReportSummarySection.tsx` (ny)
- `components/variants/report/ReportPage.tsx:195-201` (oppdater)
- `components/variants/report/ReportClosing.tsx` (slett)

**Logikk:**
```tsx
interface ReportSummarySectionProps {
  report: ReportConfig;
  projectTitle: string;
  themesCount: number;
}

export function ReportSummarySection({ report, projectTitle, themesCount }: Props) {
  const summary = report.summary;
  const brokers = report.brokers ?? [];
  const cta = report.cta ?? {};
  const primaryBroker = brokers[0];

  if (!summary && brokers.length === 0) return null;

  return (
    <section className="relative col-span-12 max-w-3xl mx-auto py-16 space-y-8">
      {/* Tertiær share-handling, absolutt posisjonert */}
      <ShareAction shareTitle={cta.shareTitle ?? projectTitle} />

      {summary?.headline && <SummaryHeadline text={summary.headline} />}
      {summary?.insights && summary.insights.length > 0 && (
        <SummaryInsights items={summary.insights} />
      )}

      {brokers.length > 0 && (
        <div className="pt-8 space-y-6">
          <BrokerInvite
            text={summary?.brokerInviteText}
            fallbackBroker={primaryBroker}
            themesCount={themesCount}
            projectName={projectTitle}
          />
          <div className="grid gap-4">
            {brokers.map((b) => (
              <BrokerCard key={b.email} broker={b} />
            ))}
          </div>
        </div>
      )}

      <PrimaryCTA cta={cta} primaryBroker={primaryBroker} projectTitle={projectTitle} />
    </section>
  );
}
```

**Akseptansekriterier:**
- [ ] Rendrer graceful når noen felter mangler (null hvis både `summary` og `brokers` er tomme)
- [ ] Plassert der `ReportClosing` var tidligere (`ReportPage.tsx:195-201`)
- [ ] Mottar `projectTitle` og `themesCount` fra parent
- [ ] `ReportClosing.tsx` er slettet og ikke lenger importert noe sted
- [ ] Seksjonen er siste innhold før footer i rapporten
- [ ] `themesCount` hentes fra `report.themes?.length ?? 0` i parent

**Avhengigheter:** Kort 1, 2, 3, 3b

---

### Kort 5: Theming — rydd opp `--placy-*` dead code og etabler shadcn-token-mønster

**Mål:** Fjerne feilformaterte `--placy-*` variabler (dead code), etablere et konsistent mønster der nye komponenter bruker eksisterende shadcn semantic tokens, og gi rapport-ruten muligheten til å overstyre tokens via inline style-prop på wrapper.

**Filer:**
- `app/globals.css:28-31` — fjern `--placy-primary`, `--placy-bg`, `--placy-font` fra `:root`
- `app/eiendom/[customer]/[project]/rapport/page.tsx:55-67` — fjern `<style dangerouslySetInnerHTML>`, legg til inline `style`-prop på wrapper-element
- `lib/types.ts` — oppdater `ProjectTheme` interface med nye, semantisk navngitte felter
- `lib/theme-utils.ts` (ny) — `hexToHslChannels(hex: string): string | null` utility
- Alle nye komponenter fra Kort 2, 3, 4 — verifiser at kun shadcn-tokens brukes

**Oppdater `ProjectTheme` interface:**
```typescript
// lib/types.ts
export interface ProjectTheme {
  // Semantiske farger — overstyrer shadcn-tokens i :root
  backgroundColor?: string;       // hex — mappes til --background
  foregroundColor?: string;       // hex — mappes til --foreground
  primaryColor?: string;          // hex — mappes til --primary
  primaryForegroundColor?: string; // hex — mappes til --primary-foreground
  cardColor?: string;             // hex — mappes til --card
  mutedColor?: string;            // hex — mappes til --muted
  mutedForegroundColor?: string;  // hex — mappes til --muted-foreground
  borderColor?: string;           // hex — mappes til --border
  // Typografi
  fontFamily?: string;            // CSS font-family string
  // Branding
  logoUrl?: string;
}
```

**`hexToHslChannels` utility:**
```typescript
// lib/theme-utils.ts
export function hexToHslChannels(hex: string): string | null {
  // Parser "#3b82f6" eller "3b82f6" → "217 91% 60%"
  // Returnerer null for ugyldig input (skal ikke kaste)
  // Implementasjon: standard hex→RGB→HSL-matematikk, ingen dependencies
}
```

**Ny wrapper-logikk i `rapport/page.tsx`:**
```tsx
const themeStyle: React.CSSProperties = {};
const t = projectData.theme;
if (t) {
  const setIf = (cssVar: string, hex?: string) => {
    if (hex) {
      const channels = hexToHslChannels(hex);
      if (channels) (themeStyle as Record<string, string>)[cssVar] = channels;
    }
  };
  setIf('--background', t.backgroundColor);
  setIf('--foreground', t.foregroundColor);
  setIf('--primary', t.primaryColor);
  setIf('--primary-foreground', t.primaryForegroundColor);
  setIf('--card', t.cardColor);
  setIf('--muted', t.mutedColor);
  setIf('--muted-foreground', t.mutedForegroundColor);
  setIf('--border', t.borderColor);
  if (t.fontFamily) (themeStyle as Record<string, string>)['--font-family'] = t.fontFamily;
}

return (
  <div style={themeStyle} className="min-h-screen bg-background text-foreground">
    <ReportPage ... />
  </div>
);
```

**Akseptansekriterier:**
- [ ] `--placy-*` variablene er fjernet fra `globals.css`
- [ ] `<style dangerouslySetInnerHTML>` er fjernet fra `rapport/page.tsx`
- [ ] Nye komponenter bruker kun shadcn-tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, `bg-card` osv.)
- [ ] `hexToHslChannels` er enhetstestet manuelt (gi et par kjente hex-verdier og verifiser output)
- [ ] `ProjectTheme` interface er oppdatert med semantisk-navngitte felter
- [ ] Ingen hardkodede hex-verdier i filene som er opprettet/endret i Kort 2-4 (grep-sjekk)
- [ ] Wesselsløkka-rapporten ser identisk ut før og etter refaktor (default `:root`-tokens brukes)
- [ ] `npm run typecheck` og `npm run lint` passerer

**Ikke-mål:** Refaktorere eksisterende komponenter utenfor denne planen (hero, tema-seksjoner, highlight-cards, kart-kort). De fortsetter å bruke sine hardkodede hex. Wesselsløkka-brandet variant kan legge på en egen oppgave hvis de trenger å bli theme-bare.

**Avhengigheter:** Kort 2, 3, 3b, 4

---

### Kort 6: Data — seed Wesselsløkka via Supabase REST API (med produksjonsgrade-safeguards)

**Mål:** Skrive Wesselsløkka-innhold (summary, brokers, cta) inn i `products.config` JSONB via Supabase REST API, med full backup/dry-run/verifikasjon. Rapporten er Supabase-only — det finnes ingen lokal JSON-fil. Live på placy.no, så all change management gjelder.

**Filer:**
- `scripts/seed-wesselslokka-summary.ts` (ny) — hovedscript, følger `scripts/seed-trails-to-project.ts`-mønsteret
- `scripts/restore-product-config.ts` (ny) — rollback-script, tar backup-fil som argument og PATCH-er tilbake
- `data/wesselslokka-summary.ts` (ny) — TypeScript-konstant med summary + brokers + cta (type-safe)
- `backups/` (ny mappe) — legges til i `.gitignore`

**Seed-script arkitektur:**

```typescript
// scripts/seed-wesselslokka-summary.ts

const DRY_RUN = !process.argv.includes('--apply');  // default trygg
const ALLOWED_REPORTCONFIG_KEYS = new Set([
  'label', 'heroIntro', 'themes', 'summary', 'brokers', 'cta',
  'mapStyle', 'trails', 'closingTitle', 'closingText'  // siste to: deprecated men tolerert
]);

// Steg 1: Validering av miljø
assertEnv('NEXT_PUBLIC_SUPABASE_URL');
assertEnv('SUPABASE_SERVICE_ROLE_KEY');
console.log('Target Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Mode:', DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY (will write)');

// Steg 2: Finn målet (GET project container + product)
const container = await fetchProjectContainer('broset-utvikling-as', 'wesselslokka');
const product = await fetchProduct(container.id, 'report');
console.log('Found product:', { id: product.id, slug: container.url_slug, updated_at: product.updated_at });

// Steg 3: Backup
const backupPath = `backups/products-${product.id}-${Date.now()}.json`;
fs.mkdirSync('backups', { recursive: true });
fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
console.log(`Backup written: ${backupPath}`);
console.log(`To rollback: npx tsx scripts/restore-product-config.ts ${backupPath}`);

// Steg 4: Whitelist-sjekk
const existingKeys = Object.keys(product.config?.reportConfig ?? {});
const unknownKeys = existingKeys.filter(k => !ALLOWED_REPORTCONFIG_KEYS.has(k));
if (unknownKeys.length > 0) {
  console.error('Unknown reportConfig keys found:', unknownKeys);
  console.error('Abort: refusing to write without understanding all existing keys.');
  process.exit(1);
}

// Steg 5: Deep-merge (shallow spread av reportConfig, ikke erstatt)
const newConfig = {
  ...product.config,
  reportConfig: {
    ...(product.config?.reportConfig ?? {}),
    summary: WESSELSLOKKA_SUMMARY,    // erstatter hele summary
    brokers: WESSELSLOKKA_BROKERS,    // erstatter hele brokers-array
    cta: WESSELSLOKKA_CTA,            // erstatter hele cta
    // themes, trails, label, heroIntro, mapStyle bevares via spread
  }
};

// Steg 6: Diff-log
console.log('\n--- DIFF ---');
console.log('Before:', JSON.stringify(product.config.reportConfig, null, 2));
console.log('After:', JSON.stringify(newConfig.reportConfig, null, 2));

if (DRY_RUN) {
  console.log('\nDRY RUN complete. Re-run with --apply to write.');
  process.exit(0);
}

// Steg 7: Concurrency guard (optimistic lock via updated_at)
const patchUrl = `${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}&updated_at=eq.${encodeURIComponent(product.updated_at)}`;
const patchResponse = await fetch(patchUrl, {
  method: 'PATCH',
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ config: newConfig })
});

const patchResult = await patchResponse.json();
if (!Array.isArray(patchResult) || patchResult.length === 0) {
  console.error('PATCH affected 0 rows — possible concurrent write. Re-fetch and retry manually.');
  console.error(`Backup at: ${backupPath}`);
  process.exit(1);
}

// Steg 8: Post-write verifikasjon (data)
const verified = await fetchProduct(container.id, 'report');
const verifiedReportConfig = verified.config?.reportConfig ?? {};

// Assert: nye felter er til stede
assert(verifiedReportConfig.summary?.headline === WESSELSLOKKA_SUMMARY.headline, 'summary.headline ikke persistert');
assert(verifiedReportConfig.brokers?.length === WESSELSLOKKA_BROKERS.length, 'brokers ikke persistert');
assert(verifiedReportConfig.cta?.leadUrl === WESSELSLOKKA_CTA.leadUrl, 'cta.leadUrl ikke persistert');

// Assert: eksisterende felter bevart (deep-equal mot backup)
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
const preservedKeys = ['label', 'heroIntro', 'themes', 'trails', 'mapStyle'];
for (const key of preservedKeys) {
  const before = backup.config?.reportConfig?.[key];
  const after = verifiedReportConfig[key];
  assert(
    JSON.stringify(before) === JSON.stringify(after),
    `${key} ble endret! Ruller tilbake. Backup: ${backupPath}`
  );
}

// Steg 9: Post-write verifikasjon (HTTP render)
const reportUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/eiendom/broset-utvikling-as/wesselslokka/rapport`;
const reportResponse = await fetch(reportUrl);
assert(reportResponse.status === 200, `Rapport rendret ikke: HTTP ${reportResponse.status}`);
const html = await reportResponse.text();
assert(html.includes(WESSELSLOKKA_SUMMARY.headline.slice(0, 50)), 'Headline ikke i rendret HTML');

console.log('\n✓ Seed complete and verified');
console.log(`  Backup: ${backupPath}`);
console.log(`  Rollback: npx tsx scripts/restore-product-config.ts ${backupPath}`);
```

**Rollback-script (`scripts/restore-product-config.ts`):**

```typescript
// Tar en backup-fil, PATCH-er products.config tilbake til pre-seed tilstand
// Usage: npx tsx scripts/restore-product-config.ts backups/products-{id}-{ts}.json

const backupPath = process.argv[2];
assert(backupPath, 'Usage: restore-product-config.ts <backup-path>');

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
const productId = backup.id;

console.log(`Restoring product ${productId} from ${backupPath}`);

const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
  method: 'PATCH',
  headers: { /* same as seed */ },
  body: JSON.stringify({ config: backup.config })
});

if (!response.ok) { /* error handling */ }
console.log('✓ Restored');
```

**Innhold som skal seedes:**
- `summary.headline`, `summary.insights[]`, `summary.brokerInviteText` — se copy-seksjonen tidligere
- `brokers[]` — 1 megler fra Heimdal Eiendomsmegling (manuell innhenting før demo)
- `cta.leadUrl`, `cta.primaryLabel`, `cta.primarySubject`, `cta.shareTitle`

**Megler-data (manuell innhenting før demo):**
- Besøk https://www.wesselslokka.no/kontakt og identifiser ansvarlig megler for prosjektet
- Hent navn, tittel, telefon, e-post, foto-URL (eller last ned og rehost hvis foto-URL ikke er stabil)
- Hvis offisiell info ikke er tilgjengelig: bruk placeholder med `firstName: "Megleren"` og "DEMO"-merking synlig i visuell rendering

**Akseptansekriterier (utvidet fra audit):**
- [ ] `scripts/seed-wesselslokka-summary.ts` er opprettet og følger mønsteret over
- [ ] Script default er `--dry-run`, krever eksplisitt `--apply` for å skrive
- [ ] Pre-write backup skrives til `backups/products-{id}-{ts}.json`
- [ ] `.gitignore` inkluderer `backups/`
- [ ] Whitelist-sjekk avbryter hvis ukjente `reportConfig`-nøkler finnes
- [ ] Concurrency guard via `updated_at=eq.{value}` i PATCH-URL
- [ ] Post-write data-verifikasjon: nye felter til stede, eksisterende felter uendret (deep-equal mot backup)
- [ ] Post-write HTTP-verifikasjon: GET rapport-URL, assert 200 + headline i HTML
- [ ] Rollback-script `scripts/restore-product-config.ts` er opprettet og testet med en dummy backup
- [ ] Dry-run kjørt mot produksjons-Supabase, diff inspisert manuelt
- [ ] Apply-run kjørt etter dry-run er godkjent
- [ ] Rapporten på `/eiendom/broset-utvikling-as/wesselslokka/rapport` viser alle fem blokk-elementer
- [ ] "Meld interesse" åpner wesselslokka.no/kontakt i ny fane
- [ ] Telefon-link under CTA er klikkbar
- [ ] Del-knapp (share-ikon) kopierer URL og viser ikon-swap bekreftelse
- [ ] Plausible-events sendes ved CTA-klikk (verifiser i Plausible dashboard hvis tilgjengelig)
- [ ] Screenshot tatt som bevis på ferdig visuell tilstand (før + etter for sammenligning)

**Avhengigheter:** Kort 1, 2, 3, 3b, 4, 5

---

## Ikke-mål (denne iterasjonen)

- Refaktorere eksisterende komponenter (hero, tema-seksjoner, highlight-cards) til CSS-variabler — egen oppgave
- Analytics / event-tracking — data-attributter legges inn nå, men ingen tracking-pipeline
- PDF-eksport — utsatt
- Pipeline LLM-generering av summary-innhold — fremtidig
- Backend form-handler for lead-innsending — bruker eksisterende lead_url
- Sticky CTA i bunn/side — senere iterasjon
- Næring/hotell-variant — bolig først

## Risikoer og åpne spørsmål

**Risiko 1: Wesselsløkka har ikke offentlig megler-info**
- Mitigering: Manuelt kontakte Brøset Utvikling eller Heimdal for offisiell foto og kontaktinfo. Ellers bruk stock/placeholder for demo og gjør det tydelig.

**Risiko 2: wesselslokka.no har ikke en dedikert "Meld interesse"-side**
- Mitigering: Fallback til wesselslokka.no/kontakt eller bruk mailto til megler. Sjekk faktisk URL i Kort 6.

**Risiko 3: Default CSS-variabler matcher ikke dagens look nøyaktig**
- Mitigering: Før-og-etter-screenshot på Wesselsløkka-rapporten. Juster defaults hvis regression.

**Åpent spørsmål 1: Hvor ligger Wesselsløkka-config i dag — Supabase eller JSON-fil?**
- Undersøkes i Kort 6 som første steg.

**Åpent spørsmål 2: Skal megler-data være del av `ReportConfig` eller på øvre `Project`-nivå?**
- Beslutning: `ReportConfig` for nå. Grunn: rapporten er der det vises, og vi unngår å røre `Project`-typen som brukes av andre varianter.

## Verifikasjon

Etter at alle kort er ferdig:
1. `npm run typecheck` — grønn
2. `npm run lint` — grønn
3. Besøk `/eiendom/broset-utvikling-as/wesselslokka/rapport` — ny seksjon vises nederst
4. Klikk "Meld interesse" — åpner wesselslokka.no/kontakt i ny fane
5. Klikk share-ikonet øverst i seksjonen — URL kopieres, ikon bytter til Check i 2s
6. Klikk telefonlink under primær-CTA — åpner telefon-dialog
7. Klikk telefon/e-post på megler-kort — åpner respektive dialoger
8. Sjekk at ingen andre rapporter brekker (f.eks. scandic-nidelven-guide) fordi `closingTitle`/`closingText` er fjernet fra typen
9. Ta before/after screenshots av Wesselsløkka-rapporten for å verifisere at øvrige seksjoner ser identiske ut (shadcn-token-refactor skal ikke endre visuelt utseende med default-tokens)
10. Åpne en ikke-rapport-rute (f.eks. /eiendom-oversikt eller explorer) og verifiser at det ikke er visuell lekkasje fra theme-overrides
11. Verifiser i Plausible dashboard (hvis tilgjengelig) at custom events registreres: `cta_primary_click`, `cta_phone_click`, `cta_share_click`, `broker_phone_click`, `broker_email_click`
12. iOS Safari + desktop Chrome smoke test på delings-handling

## Research Findings Appendix

Denne seksjonen oppsummerer de fire research-agentene som ble kjørt under /deepen-plan. Kildene er verdifulle som kontekst for /tech-audit og fremtidige iterasjoner.

### A. Megler-kort og lead-CTA patterns (norsk + internasjonal)

**Nøkkelfunn:**
- Norsk meglerkonvensjon: telefon + e-post er **alltid direkte synlig** — ingen "vis kontakt"-klikk. Dette er en tillitsmarkør og må respekteres.
- Dominant primær-CTA for norske nybygg/prosjekt: **"Meld interesse"** (Wesselsløkka, Oslo House, Høisethlia bruker alle denne). "Book visning" er feil verb for forsalgsstadie. "Kontakt megler" er en seksjonstittel, ikke en knappetekst.
- Én primær-CTA per skjerm — flere skaper choice paralysis. Sekundær handling bør være en annen modalitet (tel:-link, ikke annen knapp).
- Foto-anbefaling: 96×96 sirkulær slår kvadratisk. Ikke LinkedIn-headshot — naturlig lys, semi-smil, business casual.
- Kontekstuell varme: Refererer til det brukeren har lest ("Du har sett 7 temaer om Brøset. Jørgen kan svare på det rapporten ikke dekker") slår generisk megler-intro.
- **Ikke sticky CTA** for Placy-konteksten — rapporten er et verktøy brukeren aktivt leser, sticky blir støy.
- Form-felter minimum: Navn + telefon + e-post + 1 consent. Under 4 felter. Ingen budsjett, ingen ønskeliste.
- Microcopy adresserer angst: "Vi svarer innen 24 timer. Ingen forpliktelser."

**Kilder**: oslohouse.no, wesselslokka.no, hoisethlia.no, luxurypresence.com/blogs/call-to-action-real-estate-cta, propphy.com, agentimage.com, abtasty.com/blog/mobile-stick-to-scroll, realtrends.com (Realogics Sotheby's case study)

### B. CSS-variabel theming i Next.js 14 + Tailwind 3.4

**Nøkkelfunn:**
- Idiomatisk mønster: inline `style`-prop på wrapper-element i server component, **ikke** `<style dangerouslySetInnerHTML>`. React serialiserer inline style i SSR → ingen hydration mismatch, ingen FOUC.
- CSS custom properties arves automatisk nedover i subtreet — scoping er gratis. Søsken-ruter ser aldri variablene.
- Tailwind 3.4 syntaks: `bg-[var(--x)]` er portabel mellom v3/v4. Shorthand `bg-[--x]` er kun v3. `bg-(--x)` er kun v4.
- **Opacity-modifier-fellen**: `bg-[var(--primary)]/50` fungerer IKKE hvis variabelen er en ferdig farge. Løsning: lagre som kanalverdier (`217 91% 60%`) og wrap i `hsl(var(--primary) / <alpha-value>)` i tailwind.config. **Dette mønsteret er allerede på plass i Placy** for semantiske tokens.
- shadcn/ui er referansimplementasjonen og Placy følger allerede dette mønsteret for base tokens.
- Fallback-strategi: definér defaults i `:root` i globals.css, la rute-wrapperen overstyre.
- Ingen `'use client'` eller `useEffect` for theme — alt i server component for å unngå FOUC.

**Kilder**: Next.js 14 docs, Tailwind 3.3/3.4 blog, tailwindcss issues #7575 og #12622, shadcn/ui theming docs, protailwind.com workshop

### C. Placy-repo kartlegging

**Nøkkelfunn:**
- Wesselsløkka finnes **kun i Supabase**, ingen lokal JSON. `data/projects/` inneholder kun `scandic-nidelven-guide.json`.
- Oppdateringsmønster: REST API PATCH på `products.config` JSONB, følger `scripts/seed-trails-to-project.ts`.
- Plausible er satt opp i `app/(public)/layout.tsx:19-26` og `app/eiendom/layout.tsx:19-27`, initialisert kun hvis `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` er satt.
- Ingen custom events sendes i dag — `window.plausible('event_name')` er tilgjengelig men ubrukt. Kan legges til uten teknisk gjeld.
- Ingen eksisterende megler/broker/contact-felter i `lib/types.ts` eller noen prosjektdata. Bygges fra scratch.
- `ReportConfig` er flat, optional — nye felter krever bare typedef + evt. cast i `lib/supabase/queries.ts`. Ingen DB-migrasjon.
- `ProjectTheme` er definert i `lib/types.ts:209-214` men brukes kun i rapport-ruten som dead code.
- **shadcn-tokens finnes allerede**: `app/globals.css` har `--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border` etc. i kanalverdier. `tailwind.config.ts` mapper dem korrekt. Nye komponenter kan bruke `bg-background`, `text-foreground` umiddelbart.

**Filer/linjer**: `lib/types.ts:185-193` (ReportConfig), `lib/data-server.ts:255-281` (getProductAsync), `lib/supabase/queries.ts:~1650-1700` (Supabase→Project mapping), `components/variants/report/ReportClosing.tsx:35-61` (dagens closing), `tailwind.config.ts:1-109`, `app/globals.css:1-35`

### D. Clipboard og Web Share API

**Nøkkelfunn:**
- 2026 hybrid-mønster: prøv `navigator.share()` på mobil, fallback til `navigator.clipboard.writeText()` på desktop. `navigator.canShare()` verifiserer før kall.
- Browser support: `clipboard.writeText` ~98%, `share` ~95% mobil. Chrome/Firefox desktop mangler `share`.
- Dominant UX-mønster (shadcn, Vercel, Stripe): **ikon-swap direkte på knapp** (Copy → Check i 2s), ikke toast-bibliotek. Null dependencies.
- Accessibility: `aria-live="polite"` span med bekreftelsestekst, `aria-label` på ikon-knapp.
- Feilhåndtering: `AbortError` (bruker kansellerte share sheet) skal ignoreres stille. Andre feil: degrader stille, aldri throw til bruker.
- Timer-cleanup i `useEffect` for å unngå memory leaks hvis komponent unmountes under 2s-vinduet.

**Implementert som**: `useCopyShare`-hook i Kort 3b, konsumert av `ShareAction` i Kort 3.

**Kilder**: MDN Web Share API + Clipboard API, shadcn/ui CopyButton source

## Implementation Notes (fra tech-audit)

Disse spesifikasjonene kom fra audit-fasen og er lagt til her for referanse under implementering. De er ikke egne kort, men skal respekteres i relevante kort.

### Telefon-normalisering (Kort 2 — BrokerCard)
- Input-format: "+47 73 87 15 00" (med mellomrom, for visning)
- `href`-format: `tel:+4773871500` (e.164, strippet mellomrom)
- Implementering: `phone.replace(/\s+/g, '')` — ingen ny dep nødvendig
- Display-format beholdes som-er i DOM, kun `href` normaliseres

### Foto-fallback med onError (Kort 2 — BrokerCard)
- Bruk `<img>` tag, **ikke `next/image`**, for å unngå `next.config.js`-endringer for eksterne megler-foto-domener
- Strategi: `onError`-handler setter lokal `imageFailed`-state, rendrer `User`-ikon (Lucide) i sirkel med samme dimensjoner (96×96)
- Implementasjonsmønster:
  ```tsx
  const [imageFailed, setImageFailed] = useState(false);
  return imageFailed || !broker.photoUrl ? (
    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
      <User className="w-12 h-12 text-muted-foreground" />
    </div>
  ) : (
    <img
      src={broker.photoUrl}
      alt={broker.name}
      width={96}
      height={96}
      className="w-24 h-24 rounded-full object-cover"
      onError={() => setImageFailed(true)}
    />
  );
  ```

### Mobile-detection i useCopyShare (Kort 3b)
- Enten stol på `navigator.canShare?.({ url })` uten UA-sniff (bredere støtte, mer fremtidssikker)
- Eller kombinasjon: `navigator.share && navigator.canShare?.({ url }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)`
- Anbefalt: start uten UA-sniff — `canShare()` er bra nok

### `mailto:` subject-encoding (Kort 2, Kort 3)
- Bruk `encodeURIComponent()` for subject
- Norske tegn (æøå) kan få tegnsett-problemer i enkelte e-postklienter
- Akseptabel for demo — dokumenter i kode-kommentar hvis Outlook-problem dukker opp senere

### React key på brokers (Kort 4 — ReportSummarySection)
- Dagens plan bruker `key={b.email}`
- Trygt hvis og bare hvis e-post er unik per megler-kort
- Alternativ hvis duplikater blir et problem: bruk array-index (`key={i}`) siden listen er stabil i en enkelt rapport-render
- Anbefaling: behold `key={b.email}`, React vil uansett advare om duplikater i dev mode

### Container positioning (Kort 4 — ReportSummarySection)
- `ShareAction` er absolutt posisjonert — container MÅ ha `position: relative`
- Eksplisitt i Kort 4-koden: `className="relative col-span-12 max-w-3xl mx-auto py-16 space-y-8"` ✓
- Verifiser visuelt etter implementering at share-ikonet er synlig på desktop og mobil

### useCopyShare hook-plassering (Kort 3b)
- Audit foreslo `lib/hooks/useCopyShare.ts` hvis hook-en kan gjenbrukes andre steder
- Beslutning: plasser i `components/variants/report/summary/hooks/useCopyShare.ts` for nå — spesifikk til denne feature. Flyttes til `lib/hooks/` når/hvis andre komponenter trenger samme hook.

## Oppsummert dependency-rekkefølge etter audit

```
Kort 0 (globals.css fix) ─── BLOKKER
  └─> Kort 0.5 (plausible.d.ts)
      └─> Kort 1 (types + cleanup closingTitle/Text i 5 filer)
          ├─> Kort 2 (BrokerCard) ────┐
          ├─> Kort 3 (sub-komponenter) ─┤
          └─> Kort 3b (useCopyShare) ──┘
              └─> Kort 4 (ReportSummarySection orkestrator)
                  └─> Kort 5 (theming wrapper + ProjectTheme)
                      └─> Kort 6 (Supabase seed med safeguards)
```

Kort 2, 3, 3b kan parallelliseres etter Kort 1 er ferdig. Alle andre må være sekvensielle.

## Audit-oppsummering (for referanse)

**Architecture Strategist (YELLOW → GREEN etter mitigasjoner):**
- Kritisk: globals.css dobbel :root må fikses først
- Kritisk: Kort 1 må utvides til 5 filer
- Kritisk: plausible TypeScript-deklarasjon mangler
- Mindre: useCopyShare plassering, telefon-normalisering, foto-fallback, mailto-encoding, relative positioning

**Data Integrity Guardian (YELLOW → GREEN etter mitigasjoner):**
- Kritisk: Backup-strategi mangler i Kort 6
- Kritisk: Concurrency guard mangler (lost update)
- Kritisk: Whitelist-sjekk mangler for ukjente config-nøkler
- Kritisk: Post-write HTTP-verifikasjon mangler
- Kritisk: Rollback-script mangler
- Mindre: Dry-run default, closingTitle/closingText deprecation-dokumentasjon

Alle mitigasjoner er inkorporert i de respektive kortene over.

## Parallel workstream

Wesselsløkka-brandet variant bygges i separat worktree (`placy-ralph-wesselslokka-demo`). Den varianten **trenger denne planen ferdig** for å kunne bruke `ReportSummarySection` med egne farger. Integrasjonen gjøres på tvers av de to worktreene etter begge er ferdig — sannsynligvis ved at branded variant cherry-picker eller merger inn `feat/summary-megler-cta`.

## Neste steg

1. `/deepen-plan` for å berike med forskning (megler-card patterns, lead-CTA best practices, CSS-variable theming i Next.js 14)
2. `/tech-audit` for å validere teknisk gjennomførbarhet
3. Generer Trello-kort fra kort 1-6 ovenfor
