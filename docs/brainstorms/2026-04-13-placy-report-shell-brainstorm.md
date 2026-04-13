# Brainstorm: Standardisert Placy-shell for rapport-ruten

**Dato:** 2026-04-13
**Deltakere:** Andreas + Claude
**Output:** Beslutninger for plan-fase

## Kontekst og motivasjon

Placy har begynt å lande et salgbart produkt i **Report v2** — skalerbar nabolagsrapport med gjenbrukbart format. Første demo-kunder er i kø (Wesselsløkka → Heimdal Eiendomsmegling, flere i pipeline).

Brandings-strategien har kommet til en brytningsmoment:

**Dagens tilstand:** Wesselsløkka-demoen (`/demo/wesselslokka`) har full custom shell — eget CSS-tema (`.ws-theme`, 442 linjer), wordmark, Squarespace-lignende nav, pink CTA. Demoen **gjenskaper wesselslokka.no**.

**Problemet:** Dette skalerer ikke. Hver demo blir et håndverksjob på 4-8 timer "branding". Og det gir feil signal — Placy er et verktøy, ikke kundens nettside. Hvis vi later som om vi er kunden, mister vi Placy-brand og gjør hver demo til en 1-av-1.

**Ny retning:** Placy eier shellet. Header og footer er Placy sitt. Kunden får *noen få design-tokens* (primary color, prosjektnavn, hjemmeside-link) som farger shellet uten å overta det.

## Strategisk beslutning (allerede tatt)

Fra forrige diskusjon:
- **placy-ralph = sandbox.** Demo-produksjon + eksperimenter. Modne produkter → PRD → ny prod-kodebase.
- Report v2 er første kandidat for modning. Denne saken er en del av å skjerpe Report v2 til salgbar kjerne.
- Whitelabel som Wesselsløkka var **overengineering for demo**. Fremover: standardisert shell + tokens.

## Design-beslutninger (fra feature-spec)

### Header (56px, sticky)
- **Venstre:** `← [project].no` — tilbake-link til kundens hjemmeside. Ny kolonne `projects.homepage_url`.
- **Senter:** Prosjektnavn, semi-bold 16-18px
- **Høyre:** Del-knapp (Web Share API på mobil, clipboard på desktop, toast-bekreftelse)
- **Bakgrunn:** Kundens `--primary` fra `ProjectTheme`
- **Mobile:** Senter skjules (står i hero rett under), venstre blir bare ← ikon

### Footer (minimalistisk, nøytral)
- Rad 1: Prosjektnavn (venstre) + Placy-logo (høyre), lik vekt
- Rad 2: "Besøk [project].no" + "placy.no"
- Rad 3: "© 2026 Placy · Personvern · Informasjonskapsler · Kontakt" — liten tekst
- **Bakgrunn:** Nøytral cream/lys grå. ALDRI kundens farge. Footer er Placy-domene.

### Teknisk approach
- Nye komponenter: `components/public/PlacyReportHeader.tsx` + `PlacyReportFooter.tsx`
- **IKKE** blande med eksisterende `PlacyHeader` (brukes på `/trondheim`-ruten — helt annen kontekst)
- Migration: `projects.homepage_url TEXT NULL`
- Wrap i `app/eiendom/[customer]/[project]/rapport/page.tsx` — mellom theme-wrapper-div og `<ReportPage>`
- Del-knapp gjenbruker `useCopyShare`-hooken fra `components/variants/report/summary/hooks/`
- Cookies-modal: enkel shadcn Dialog, ikke full consent-flyt

## Beslutninger fra brainstorm-checkpoint (2026-04-13)

1. **Wesselsløkka `--primary` = teal #204c4c** — brukes både i header og på CTA-knapper.
2. **Header-stil = full kunde-farge (primary som bakgrunn)** — sterkest brand-touch. Krever auto-contrast-tekst.
3. **Token-semantikk = én `--primary` til alt** — header-bg og CTA-knapper bruker samme token. `--primary-foreground` computes fra luminance.

Implikasjon: Vi MÅ ha auto-contrast-logikk (luminance-basert) i `theme-utils.ts`. Teal #204c4c er mørk → hvit tekst. Men for fremtidige kunder med lys primary må logikken fungere automatisk.

## Åpne spørsmål og foreslåtte svar

### 1. Wesselsløkka primærfarge: pink eller teal?

**Wesselsløkka-paletten:** teal `#204c4c` (ink), pink `#e32d7a` (CTA), grønn `#a0e885` (accent), cream `#f7f4ec` (bg).

**Alternativer:**
- **A) Pink (`#e32d7a`)** — CTA-fargen. Sterkest visuell identitet. Matcher "Meld interesse"-knappen. Signaler: ung, energisk, Wesselsløkka-distinktivt.
- **B) Teal (`#204c4c`)** — ink-fargen. Mer sofistikert/dempet. Matcher wesselslokka.no sin overordnede look. Signaler: solid, seriøs, boligkjøper-tillit.

**Foreslått:** **Teal (#204c4c).** Header er *sticky og alltid synlig* — pink som bakgrunn blir overveldende over tid. Teal er mer behagelig i perifert syn. Pink kan heller brukes på CTA-knapper inne i rapporten (allerede slik det fungerer med `--primary` overstyring).

**Avveining:** Dette reiser et generelt spørsmål om hvilken kunde-farge som mapper til `--primary`. Kanskje vi trenger en egen `--placy-header-bg` som overrides `--primary` for shellet, så `--primary` forblir CTA-fargen. **Beslutning trenger spec-avklaring.**

### 2. Header-bakgrunn: full kunde-farge eller dempet?

**Alternativer:**
- **A) Full `--primary`** — som spec-et. Enkel implementering. Men kan konflikte med CTA-knapper som også er primary (visuell støy).
- **B) Dempet — `--primary` med 10% opacity på nøytral hvit bg** — subtil farge-hint. Placy-feel beholdes.
- **C) Nøytral bg, `--primary` som farget border-bottom** — minimal. Kundens farge som markør, ikke dominans.

**Foreslått:** **C) Nøytral hvit/cream bg med 3-4px `--primary` border-bottom.** Mest Placy-eid, tydeligst kundens farge uten å overta. Del-knapp og tilbake-link får primary-farge på hover. Renere.

### 3. Auto-contrast tekst på kundens primærfarge

Hvis A eller B velges, trenger vi contrast-utility.

**Alternativer:**
- WCAG-compliant algoritme (luminance-basert) i `theme-utils.ts`
- Enkel heuristikk: dark bg → hvit tekst, light bg → mørk tekst
- Tailwind `text-foreground` med smart CSS-variabel som byttes basert på primary

**Foreslått:** Hvis vi velger C (border-bottom), unngås problemet helt. Hvis A/B: enkel luminance-heuristikk i `theme-utils.ts`, toleranse i kanten er OK for MVP.

### 4. Share-knapp — hva deles?

**Spec:** Lenken til rapport-siden. Men hva mer?

**Foreslått:**
- `title`: `Nabolagsrapport for ${project.name}`
- `text`: kort teaser — `Utforsk nabolaget rundt ${project.name} — kart, steder, gangtider` (no) / engelsk ekvivalent
- `url`: canonical URL (ikke gjeldende URL med query params)

### 5. Cookies-modal innhold

MVP — ikke full consent-flyt. Foreslått tekst:
> "Vi bruker informasjonskapsler for å forstå bruken av siden. Vi deler ikke persondata. Ved å bruke Placy aksepterer du dette. [OK]"

Enkel shadcn Dialog, ikke en banner. Åpnes kun når brukeren klikker "Informasjonskapsler"-linken i footeren.

### 6. Oppdatering av eksisterende lenker (personvern/kontakt)

**Spec:** Footer inkluderer "Personvern" og "Kontakt" lenker. Eksisterer de allerede?

**Svar:** Må sjekkes i plan-fase. Hvis ikke: enten (a) dummy-linker som `#` med tooltip, (b) send til `placy.no/personvern`, (c) lag enkle placeholder-sider. MVP = (a) eller (b).

### 7. Wesselsløkka opprydding — rekkefølge

**Spec:** Slett `/demo/wesselslokka/`-ruten + `app/demo/`-mappen + `public/ws-demo/`-assetsne når ny versjon fungerer.

**Rekkefølge:**
1. Bygg ny Placy-shell + migration
2. Apply til `/eiendom/*/rapport`
3. Migrer Wesselsløkka-prosjekt-data i Supabase (sett `homepage_url`, `theme.primaryColor`)
4. Verifiser at `/eiendom/broset-utvikling-as/wesselslokka/rapport` ser profesjonell ut
5. Slett `/demo/wesselslokka/` + `app/demo/` + `public/ws-demo/`
6. Oppdater alle lenker (hvis noen) som peker på den gamle URL-en

**Risiko:** Wesselsløkka-prosjektet finnes allerede i Supabase for `broset-utvikling-as/wesselslokka`. Trenger å verifisere at data er der og koble `homepage_url` + farge.

### 8. Hvilke ruter får shellet nå?

**Spec:** Kun rapport-ruten denne runden. Out-of-scope: `/event/*`, `/eiendom/*/story`, `/eiendom/*/explorer`.

**Rasjonell:** Rapport er det som sendes til megler/salgs. Story og Explorer er sekundære produkter (og Story v2 er ferskt, trenger ikke shell ennå). Event er eget spor (Coachella-POC).

**Fremtidig:** Når shellet modnes, kan det også brukes på Story og Explorer. Ikke nå.

## Avviste alternativer

- **Placy-logo kun (ikke prosjektnavn sentralt)** — Avvist fordi rapporten er *om* prosjektet, prosjektnavnet må være umiddelbart synlig.
- **Powered by Placy-modell (kundens logo dominerer)** — Avvist fordi det inviterer scope-creep ("kan vi få vår farge på footer også?") og undergraver Placy som produkt.
- **Full token-system-refactor nå** — Avvist fordi tokens allerede er bygget (ProjectTheme + hexToHslChannels). Bare shellet mangler.

## Akseptansekriterier (fra feature-spec)

- [ ] Header viser kundens primærfarge (valgt mekanisme fra åpne spørsmål)
- [ ] Footer er alltid nøytral Placy
- [ ] Tokens flyter fra `projects.theme` til CSS-variabler
- [ ] Del-knapp fungerer på iOS Safari + Android Chrome + desktop
- [ ] Wesselsløkka-demoen på `/eiendom/broset-utvikling-as/wesselslokka/rapport` ser profesjonell ut
- [ ] `/demo/wesselslokka/` + assets er slettet etter verifisering
- [ ] `projects.homepage_url` migration kjørt i prod

## Utenfor scope

- Full cookie-consent-flyt (GDPR-compliant banner med preferanser)
- Analytics-events på shell-interaksjoner (share-klikk, footer-klikk)
- Andre ruter: `/event/*`, `/eiendom/*/story`, `/eiendom/*/explorer`
- Whitelabel-admin-UI (kunde legger inn farge/logo selv) — senere
- Theme-migration til helhetlig token-refactor — venter til Report v2 prod-build

## Suksess-kriterium

Neste demo (f.eks. for en ny bolig-megler) skal kunne lages på **≤30 min branding-arbeid** — bare sett `homepage_url` + `primaryColor` i Supabase. Ingen ny CSS, ingen nye React-komponenter.
