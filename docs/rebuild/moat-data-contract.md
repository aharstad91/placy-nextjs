# Moat-data-kontrakt — Lokalkunnskap som Placy-eid IP

> **Status:** Eierskaps-/IP-notat for `v2`-baseline (PRD 1, Unit 01.4 / bead `r01.4`).
> **Hvorfor:** Lokalkunnskap-laget er term-sheet-relevant **eid IP** — lokale innsikter «ikke på
> Google» som eies av **Placy**, ikke kunden/megleren. Denne kontrakten forankrer hvilke
> skjema-objekter som ER moaten, hvem som eier dem, og hvor *gating*/system-koden hører hjemme.
> **Ikke en build-spec** — selve moat-systemet (staging, arv, kuratering) eies av PRD 8.

---

## Hva moat-dataen ER (skjema-objektene)

Forankret ferskt i `v2` av `supabase/migrations/070_baseline.sql` (verifisert live mot Postgres:
`place_knowledge` = 15 kol, `areas` = 17 kol):

| Objekt | Rolle i moaten |
|--------|----------------|
| `v2.place_knowledge` (15 kol) | Strukturerte lokale fakta per POI/område. Nøkkelfelt: `topic` (NN), `fact_text` (NN), `confidence` (NN), `structured_data` (jsonb), `source_url`/`source_name` (proveniens), `display_ready` (eksponerings-gate), `verified_at` (ferskhets-signal). |
| `v2.areas.report_editorial` (jsonb) | Per-strøk redaksjonelt editorial (city→bydel→strøk), arvet ned per skolekrets-polygon (PRD 8). |
| `v2.areas`-hierarki | `parent_id`, `level` (NN), `boundary` (jsonb), `postal_codes` (text[]) — geo-hierarkiet PRD 8 arver editorial langs. |

> **Avgrensning mot board-content-editorial.** Den redaksjonelle POI-teksten i `pois.editorial_hook`/
> `local_insight` og per-prosjekt bridgetext/hero i `products.config` (se kilde-auditen
> `moat-data-migration.md`) er **board-innhold**, ikke strøk-moat-laget. Strøk-moaten er
> `place_knowledge` + `areas.report_editorial`. Begge skjema-familiene bæres av `v2`-baseline.

---

## Eierskap: Placy, ikke kunde/megler

Lokalkunnskap-dataen er **Placy-eid IP**. Den genereres/kureres av Placy (Gemini henter → Fable
skriver → menneskelig kuratering, PRD 7/8/15) og akkumuleres på tvers av listings i et strøk —
den følger **ikke** den enkelte kunde/megler ut når et oppdrag avsluttes. Dette er en bevisst
moat-posisjon: verdien ligger i den voksende, Placy-eide lokalkunnskaps-databasen
(`docs/rebuild/moat-1-lokalkunnskap-build-input.md`), ikke i per-listing-leveransen.

Konsekvens for RLS (PRD 1 Unit 5 / `r01.5`): `v2.place_knowledge` eksponeres ikke rå for anon —
anon-lesing gates på `display_ready = true`, så ukuratert/rå moat-IP ikke lekker.

---

## System vs. skjema (manifest-tilsynelatende motsigelse, løst)

`CARRY-OVER-MANIFEST.md` ser selvmotsigende ut: linje 7 lister «place_knowledge-systemet» blant
cruft som ikke skal med; linje 149/735 holder `place_knowledge` som «skjema-IP keeper». Skillet er
reelt:

- **SYSTEMET (kode) = dødt, utenfor PRD 1s scope.** Den forlatte editorial-admin-koden rundt
  (`@/app/admin/knowledge/*`, `app/api/admin/knowledge/route.ts`, `scripts/backfill-knowledge.ts`,
  `getAllKnowledgeAdmin` i `queries.ts`) slettes — det er PRD 8s dead-code-sletting (Unit 7).
- **SKJEMAET + DATAEN = moat-IP keeper.** De 15 kolonnene + radene bevares verbatim. PRD 1 oppretter
  skjemaet ferskt i `v2`; dataen i `public` står urørt som kilde.

PRD 1 følger keeper-lesningen for skjema/data og rører ikke system-koden.

---

## Datavern: moot under v2-fersk-strategien

Den tidligere framingen (pre/post rad-antall-verifikasjon for å verne editorial-IP i en in-place
69→1-kollaps, jf. `moat-data-migration.md` §«Konsekvens for PRD 8 Unit 7» pkt. 1) er **erstattet**
av walkthrough-revisjonen 2026-06-27:

- `v2` opprettes **tomt**; `public` (test-rot, ingen reell prod-data) **røres ikke** og står intakt
  som kilde/fallback.
- Intet rad-antall-datavern er nødvendig — det vernet test-data.
- Skulle noe kuratert `public`-innhold vise seg verdt å beholde, kan det **re-seedes eksplisitt inn i
  `v2`** senere som et valgfritt steg. **Default er ferskt `v2`.** Referanse-strøkene
  re-provisjoneres uansett inn i `v2` via PRD 3 (ikke migreres).

Ingen IP går tapt: `public` er intakt til legacy decommissioneres (PRD 1 Unit 3, gated på
demo-paritet).

---

## Gating hører hjemme i PRD 8, ikke her

PRD 1 leverer **kun skjemaet** (forankret i `v2`) + (passivt) `public`-kildedataen. Alt det aktive
moat-arbeidet — `inherit-area-editorial` (arve-kjerne), `find-area-for-point`, area-staging,
`curate-area`, nivå-2-editorial-*gating*, net-ny `areas.report_editorial`-staging per Trondheim-strøk
— eies av **PRD 8** (`prd-lokalkunnskap-moat`). Denne kontrakten forankrer eierskap og skjema; den
implementerer ingen lese-/skrive-/gating-logikk.

---

### Referanser

- `docs/rebuild/moat-1-lokalkunnskap-build-input.md` — moat-1-strategi (build-input, fremtidig retning)
- `docs/rebuild/moat-data-migration.md` — kilde-audit: hvor editorial faktisk lever (PRD 8 Unit 7)
- `docs/rebuild/prd/01-datamodell-supabase.md` — Unit 4 (denne forankringen), Unit 5 (RLS-gating)
- `docs/rebuild/prd/08-lokalkunnskap-moat.md` — moat-systemet (arv, staging, gating, dead-code-sletting)
