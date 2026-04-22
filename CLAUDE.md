# Placy — Prosjektkontekst

klientmappe: /Users/andreasharstad/klienter/placy

Placy er en lokasjonsbasert plattform med tre produkter: **Explorer** (utforsk fritt), **Guide** (kuraterte turer), og **Report** (redaksjonelle artikler med kart). Se `context/products.md` for full produktbeskrivelse.

## Kontekst-dokumenter

| Fil | Innhold |
|-----|---------|
| `context/products.md` | **De tre produktene** — Explorer, Guide, Report. Målgrupper, differensiering, oppsummering. |
| `context/placy-concept-spec.md` | Full teknisk/funksjonell spesifikasjon. Datamodell, UX, API-er, admin-verktøy. |
| `PROJECT-LOG.md` | **Prosjektdagbok** — beslutninger, retning, åpne spørsmål. Les ved sesjonstart. |
| `PRD.md` | Gjeldende oppgaveliste og status |
| `COMMANDS.md` | Alle kommandoer og scripts |
| `docs/solutions/` | Dokumenterte løsninger på tidligere problemer (bugs, arkitektur-mønstre, konvensjoner), organisert per kategori med YAML-frontmatter (`module`, `tags`, `problem_type`). Relevant når du implementerer eller debugger i et dokumentert område. |

**Når bruker sier "sjekk loggen":** Les `PROJECT-LOG.md` — spesielt siste sesjon. Bruk den som kontekst for sparring og beslutninger.

## Kjernekonsepter

**POI (Point of Interest):** Fysiske steder med koordinater, kategori, og valgfri Google-data/redaksjonelt innhold. Delt på tvers av alle tre produkter.

**Travel Mode:** walk/bike/car — påvirker reisetider og ruter.

**Time Budget:** 5/10/15 min — filtrerer/dimmer POI-er basert på avstand.

## Teknisk stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Zustand (state), Mapbox GL JS (kart), Lucide React (ikoner)
- Supabase (database, auth)

## Supabase Migrasjoner

Migrasjoner ligger i `supabase/migrations/` med format `NNN_beskrivelse.sql`.

**OBS: `supabase db push` fungerer IKKE med vår nummerering** (krever `<timestamp>_name.sql`). Bruk psql direkte:

```bash
# Kjør migrasjon direkte via psql
source .env.local && /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  "postgresql://postgres.eolzjxkonfwbzjqqvbnj:${DATABASE_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/NNN_name.sql

# Verifiser at kolonne/tabell eksisterer etter migrasjon
source .env.local && curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pois?select=new_column&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

**Migrasjoner er en del av /work-fasen.** Jobben er ikke ferdig før migrasjonen er kjørt og verifisert mot produksjonsdatabasen.

**Worktree-gotcha:** `.supabase/`-mappen kopieres ikke. Kopier migrasjonsfilen til hovedrepo eller kjør psql direkte med full sti.

## Viktige kodefiler

| Fil | Beskrivelse |
|-----|-------------|
| `lib/types.ts` | Alle TypeScript-typer |
| `lib/store.ts` | Zustand global state |
| `lib/generators/` | Story-generering moduler |
| `data/projects/klp-eiendom/ferjemannsveien-10.json` | Demo-data |
| `data/templates/input.template.json` | Mal for nye prosjekter |

## API-er

- **Mapbox Directions:** `/api/directions` — ruteberegning
- **Mapbox Matrix:** `/api/travel-times` — reisetidsberegning
- **Entur:** `/api/entur` — sanntids kollektivtransport
- **Bysykkel GBFS:** `/api/bysykkel` — ledige sykler
- **Google Places:** `/api/places` — POI-detaljer og bilder

## Story Generator

```bash
npm run generate:story data/projects/kunde/prosjekt.input.json -- --skip-travel-times
```

Se `COMMANDS.md` for full dokumentasjon.

## Editorial Hooks (Claude Code)

```
Generer editorial hooks for POI-ene i data/projects/kunde/prosjekt.json
```

Genererer `editorialHook` og `localInsight` per POI basert på nettsøk.

## Arkitekturregler (ufravikelige)

Disse reglene håndheves av ESLint og pre-commit hooks der mulig, men gjelder ALLTID — også når verktøy ikke fanger det.

### Data-henting
- ALDRI bruk `useEffect` for data-fetching — bruk server components eller server actions
- ALDRI query Supabase direkte fra klientkomponenter — all data går via server (API routes eller server components)
- ALLTID håndter error-tilstand ved Supabase-kall

### Komponenter
- ALDRI bruk `<img>` — bruk `next/image` (håndheves av ESLint)
- ALLTID eksporter `metadata` fra `page.tsx` for SEO
- ALDRI legg forretningslogikk i komponenter — flytt til `lib/`

### State
- ALDRI lagre sensitiv data i Zustand store (tokens, passord, API-nøkler)
- ALLTID bruk Zustand selectors, aldri hele store (`useStore(s => s.field)`, ikke `useStore()`)

### Imports
- ALDRI importer fra `@supabase/supabase-js` direkte — bruk `@/lib/supabase` wrappers (håndheves av ESLint)
- ALLTID bruk `@/`-prefix for imports (aldri relative `../../`)

### Kodebase-hygiene
- Når du bygger noe nytt som erstatter noe gammelt: SLETT det gamle umiddelbart
- ALDRI la dead code ligge — det er støy som degraderer agentens kontekst
- ALDRI kommenter ut kode "for sikkerhets skyld" — git har historikk

### LLM-integrasjon
- ALDRI runtime LLM-kall — build-time only (skill/script eller lagret output)
- ALLTID API-nøkkel i `x-goog-api-key`/`Authorization`-header, aldri URL-querystring (leker i logs)
- Gemini-grounding: `scripts/gemini-grounding.ts` + `lib/gemini/`. Lagret per tema i `products.config.reportConfig.themes[].grounding`.
- Cache bustes via `groundingVersion`-bump (Zod `z.literal(1)`) eller `revalidateTag("product:${customer}_${slug}")` — ikke auto-TTL
- Google ToS: `searchEntryPointHtml` må rendres verbatim med DOMPurify-sanering før lagring
- SSRF-guard ved URL-resolve av Gemini redirect-URLer: DNS pre-resolve + `ipaddr.js`-`range() === "unicast"`-sjekk
- Mønster: `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`

### Output-fokus
- Verifiser at features FUNGERER (screenshots, tester, manuell sjekk) — ikke bare at koden "ser riktig ut"
- Definer akseptansekriterier FØR implementering — test mot dem etterpå

### Mekaniske sjekker (kjøres automatisk av pre-commit hook, men kjør også manuelt)
```bash
npm run lint         # ESLint — 0 errors
npm test             # Vitest — alle tester passerer
npx tsc --noEmit     # TypeScript — ingen typefeil
npm run build        # Next.js — bygger uten feil (før PR)
```

---

## Compound Engineering Plugin — Placy-policies

Vi bruker `compound-engineering`-pluginen (skills med prefix `ce-*`). To regler må følges uansett hvilket skill eller kommando som trigger dem:

### Scope is Sacred

Scope blir ratifisert i brainstorming-fasen — ikke forhandlet i plan- eller review-fasene. Derfor:

- **`ce-scope-guardian-reviewer` skal aldri føre til at features fjernes fra planen.** Den er bygget for Every/Cora (YAGNI-maximalist, stabilt produkt, scope er forhandlingsbart). Det er motsatt av Placy-virkeligheten hvor scope er bestilt av klient eller produkteier.
- **Hvis `ce-doc-review` aktiverer `ce-scope-guardian-reviewer` automatisk** (trigges når planen har >8 units, P0/P1/P2-tiers, stretch goals, eller misaligned scope-språk), **skal alle scope-guardian-funn automatisk "Skip"-es** med begrunnelsen `"Scope is Sacred — scope ratified in brainstorm phase"`. Dette logges i decision primer slik at det ikke re-surfacer i senere runder.
- **Andre persona-reviewers respekteres normalt** — `ce-feasibility-reviewer`, `ce-coherence-reviewer`, `ce-security-lens-reviewer`, `ce-design-lens-reviewer`, `ce-product-lens-reviewer`, `ce-adversarial-document-reviewer`. Disse vurderer *hvordan* vi bygger, ikke *hva*.
- **Code-review-fasen kan aldri kutte feature-scope** — bare forbedre kvaliteten på eksisterende implementasjon. Funn som foreslår "fjern denne funksjonaliteten" skal oversettes til "implementer denne funksjonaliteten riktig".

### Unngå scope-guardian-triggere når du skriver planer

Når `ce-plan` kalles (direkte eller via `/full`), formuler planen slik at `ce-doc-review`s auto-aktivering ikke fyrer scope-guardian:

- **Ingen P0/P1/P2-tiers** i plan-dokumentet — bruk i stedet fasinndeling (Phase 1/2/3) eller rekkefølge basert på avhengigheter
- **≤8 implementation units per plan-fil** — del store planer i flere plan-filer (f.eks. `plan-A.md`, `plan-B.md`) koblet via felles brainstorm
- **Ingen "Future Work"- eller "Stretch Goals"-seksjon** — deferred work hører hjemme i `### Deferred to Separate Tasks` under Scope Boundaries, med tydelig peker til hvor det tas opp igjen
- **Goals må tydelig kobles til requirements** — hvert mål skal peke til minst én konkret requirement som leveres

Hvis planen *må* ha >8 units eller prioritets-tiers (f.eks. for å representere klientens faktiske krav), la scope-guardian fyre, men Skip-funnene automatisk per regelen over.

---

## Kvalitetsstandard — "Ferdig betyr ferdig"

Brukeren er vibe coder og har ikke kapasitet til å kvalitetssikre arbeidet i etterkant. Når en oppgave gjøres, skal den gjøres **100% komplett**. Ingen snarveier, ingen "good enough".

### Regler

1. **Definer "ferdig" før du starter.** Si eksplisitt hva som er scope og fullføringskriterier. "Reklassifiser fakta" betyr "vurder HVERT fakta og bekreft eller flytt" — ikke "plukk de åpenbare".

2. **Full dekning, aldri sampling.** Når oppgaven er å gjennomgå data, kode, eller innhold: gå gjennom ALT. Ikke stopp etter de lette tilfellene. De vanskelige er der verdien ligger.

3. **Multi-pass for dataarbeid:**
   - Pass 1: Gå gjennom alt, fatt beslutninger
   - Pass 2: Gå gjennom det som ble igjen — er det riktig plassert?
   - Pass 3: Stikkprøve av egne beslutninger

4. **Rapporter fullstendighet.** Si alltid: "X av Y gjennomgått, Z endret, W bekreftet riktig." Aldri bare "Z endret" — det skjuler at Y-Z ikke ble sjekket.

5. **Bruk kapasiteten.** Vi har 20x Claude Pro. Grundighet > hastighet. Ikke optimer for å bli fort ferdig — optimer for at resultatet er riktig.

6. **Når du er usikker, gjør mer, ikke mindre.** Hellre en time ekstra arbeid enn at brukeren oppdager hull i etterkant.

## Arbeidsmodus og Agent Teams

Agent Teams er aktivert (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Velg riktig modus basert på oppgavens størrelse:

| Oppgave | Modus | Eksempel |
|---------|-------|---------|
| Bugfix, liten tweak | Direkte — gi oppgaven rett til Claude | "Fiks at POI-markøren ikke vises" |
| Enkeltfeature | `/full` eller direkte med plan | "Legg til filter i Explorer" |
| Stor feature med uavhengige deler | **Agent Teams** — spawn teammates per modul | "Bygg Guide-produkt med backend + frontend + tester" |
| Research / code review | **Agent Teams** — parallelle perspektiver | "Review PR med sikkerhet, ytelse, UX" |

**Retningslinjer for Agent Teams:**
- Bruk kun når arbeidet kan deles i **uavhengige deler som berører ulike filer**
- Unngå teams for oppgaver der stegene er strengt sekvensielle
- Hver teammate bør eie sine egne filer — unngå at to teammates redigerer samme fil
- Foretrekk 2-4 teammates. Flere øker token-kostnad uten tilsvarende gevinst
- Bruk delegate mode (Shift+Tab) for rene orkestreringsoppgaver

## Git og parallelle sesjoner

**Flere Claude Code-sesjoner kjører ofte parallelt.** Filer kan bli committed fra en annen sesjon. Før du committer: kjør `git status` og verifiser at endringene ikke allerede er committed.

## Git Worktrees (parallelle sesjoner)

Flere Claude Code-sesjoner i samme mappe ødelegger hverandres arbeid. **Bruk alltid worktrees for parallelt arbeid.**

### Opprette ny worktree

```bash
git worktree add ../placy-ralph-<feature> -b feat/<feature-name>
cd ../placy-ralph-<feature>
../placy-ralph/scripts/setup-worktree.sh
```

Setup-scriptet gjør tre ting:
1. Symlinker `.env.local` fra hovedrepoet (delt config, én kilde)
2. Installerer `node_modules` hvis mangler
3. Sletter `.next`-cache (unngår korrupte webpack-moduler)

### Regler
- **Én sesjon per working directory** — aldri to i samme mappe
- **Sjekk** `git worktree list` før ny sesjon
- **Port-konflikter**: Hovedrepo bruker `:3000`. Worktrees bruker `PORT=3001 npm run dev` etc.
- **Rydde opp**: `git worktree remove ../placy-ralph-<feature>` når ferdig

## Kjør dev server

```bash
npm run dev
```

## Trello

**Default board for Placy:** "Utvikling" (`onb3nsLD`) i Placy-workspace.

Alle nye Trello-kort (utviklingsoppgaver, bugs, features) skal legges til her med mindre brukeren eksplisitt ber om et annet board. Ikke spør — bare bruk Utvikling.

| Board | ID | Bruk |
|-------|----|------|
| Utvikling | `69e1df1d66ff1ec38987a5d2` (short: `onb3nsLD`) | **Default** — all utvikling |
| Demo Pipeline | `69dcb71daff7e8044a29680e` (short: `HA0cmZhp`) | Salgspipeline per boligprosjekt/kunde |

URL: https://trello.com/b/onb3nsLD/utvikling

