# Placy — Prosjektkontekst

Placy er en lokasjonsbasert plattform med tre produkter: **Explorer** (utforsk fritt), **Guide** (kuraterte turer), og **Report** (redaksjonelle artikler med kart). Se `context/products.md` for full produktbeskrivelse.

## Kontekst-dokumenter

| Fil | Innhold |
|-----|---------|
| `context/products.md` | **De tre produktene** — Explorer, Guide, Report. Målgrupper, differensiering, oppsummering. |
| `context/placy-concept-spec.md` | Full teknisk/funksjonell spesifikasjon. Datamodell, UX, API-er, admin-verktøy. |
| `PRD.md` | Gjeldende oppgaveliste og status |
| `COMMANDS.md` | Alle kommandoer og scripts |

## Kjernekonsepter

**POI (Point of Interest):** Fysiske steder med koordinater, kategori, og valgfri Google-data/redaksjonelt innhold. Delt på tvers av alle tre produkter.

**Travel Mode:** walk/bike/car — påvirker reisetider og ruter.

**Time Budget:** 5/10/15 min — filtrerer/dimmer POI-er basert på avstand.

## Teknisk stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Zustand (state), Mapbox GL JS (kart), Lucide React (ikoner)
- Supabase (database, auth)

## Supabase CLI

Supabase CLI er konfigurert og linket til prosjektet. Bruk CLI for migrasjoner:

```bash
# Kjør nye migrasjoner
source .env.local && supabase db push --password "$DATABASE_PASSWORD"

# Sjekk migrasjonsstatus
source .env.local && supabase migration list --password "$DATABASE_PASSWORD"

# Marker migrasjoner som allerede kjørt (hvis nødvendig)
source .env.local && supabase migration repair 001 003 004 --status applied --password "$DATABASE_PASSWORD"
```

Migrasjoner ligger i `supabase/migrations/` med format `NNN_beskrivelse.sql`.

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
