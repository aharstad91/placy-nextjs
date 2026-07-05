# Nivå-2-kurerings-arbeidsflyt — runbook (PRD 15)

**Eier:** PRD 15 (`docs/rebuild/prd/15-nivaa-2-kuratering.md`) · **Opprettet:** 2026-07-05 (bead `placy-ralph-r15.1`)

Dette er arbeidsflyt-runbooken for den menneskelige nivå-2-KURERINGS-arbeidsflyten:
den tynne, retnings-agnostiske operatør-prosessen som orkestrerer PRD 7/8/9/14-systemene
til nivå-2-innhold. Runbooken dokumenterer ARBEIDSFLYTEN — den re-hjemler ingen av
systemene den kjører (se PRD 15 §3 for eierskaps-kartet).

## Seksjonskart (fylles per bead)

| Seksjon | Unit | Bead | Status |
|---|---|---|---|
| 1. Kvalitets-port (stemme-/kvalitets-kontrakt) | Unit 1 | `placy-ralph-r15.1` | **FERDIG** (dette dokumentet) |
| 2. Area-editorial-kurering | Unit 2 | `placy-ralph-r15.2` | **FERDIG** (dette dokumentet) |
| 3. Grounding-QA + manus-curering | Unit 3 | `placy-ralph-r15.3` | fylles av r15.3 |
| 4. Overflate-fylling (ProjectAssetFlags + broker/pin) | Unit 4 | `placy-ralph-r15.4` | fylles av r15.4 |
| 5. Reels/audio-regi | Unit 5 | `placy-ralph-r15.5` | fylles av r15.5 |
| 6. Samlekart-klassifisering + scope-grense | Unit 6 | `placy-ralph-r15.6` | fylles av r15.6 |
| Verifikasjons-runbook (validator-binding) | Unit 7 | `placy-ralph-r15.7` | egen fil: `nivaa-2-kurerings-verifikasjon-runbook.md` |

---

## 1. Kvalitets-port — stemme-/kvalitets-kontrakten som delt port (Unit 1)

Arbeidsflytens delte kvalitets-port er de to EKSISTERENDE build-time Claude Code-skillsene.
De er ikke kode — de er byggrekke-input: hver kuratert tekst (area-editorial, curatedNarrative-QA,
manus) skal passere denne porten før den lagres. Porten er identisk for alle segmenter og
alle kurerings-akser.

### 1.1 Kontraktens innhold (kilde-referanser, verifisert 2026-07-05)

**`.claude/skills/curator/SKILL.md`** — den kanoniske Placy-kurerings-STEMMEN:

| Kontrakt-del | Linje-ref | Innhold |
|---|---|---|
| 6 kjerneprinsipper | `curator:29-40` | A Navngi aldri generaliser · B Mal bevegelse · C Bruk kontraster · D Saklig entusiasme · E Mennesker og historier · F Sensorisk presisjon |
| Register-skala | `curator:42-52` | Én stemme, tilpasset kontekst: Michelin/finedining · håndverksbakeri/kafé · hverdagssted · nabolag/område · opplevelse/museum |
| Tidsregel | `curator:85-95` | Historisk tilknytning er trygg, nåværende er skjør — «kan dette bli feil om personen slutter i morgen?» |
| 9-punkts kvalitetssjekkliste | `curator:97-109` | Ingen forgjengelig info · ingen nåtidspåstander · ≥1 spesifikt navn · årstall hvis verifiserbart · første setning står alene · ingen generiske superlativer · WebSearch-verifisert · kontrast/bevegelse · fungerer om 6 mnd |

**`.claude/skills/manus-curator/SKILL.md`** — manus-format-TILLEGGSREGLENE (arver stemmen
fra curator, `manus-curator:44` — dupliserer den ikke):

| Kontrakt-del | Linje-ref | Innhold |
|---|---|---|
| Hard rules (kvantitative) | `manus-curator:26-41` | 0 POI-navn (unntak: skolekrets) · 5 setninger (cap) · 60–75 ord (`:34`) · 20–25 sek TTS · 0 em-dash-pauser · 0 parenteser · 0 banned-superlativer · områdenavn er trygge (ikke POIs) |
| Tidsregel som HOVEDPORT | `manus-curator:48` | I manus-format er tidsregelen FØRSTE sjekk, ikke ett av ni punkter |
| Grounding-troskap | `manus-curator:49` | Sier grounding «ett», skriv ikke «flere»; ingen plassering grounding ikke gir |
| Staging før patch | `manus-curator:115-116` | Steg 7: `.curation-staging/<prosjekt>/<spor>.md` med frontmatter — menneskets beslutning FØR Supabase-patch |

### 1.2 Retnings-agnostisk — RATIFISERT scope-invariant (grep-verifisert)

Segment-retningen (bruktmegler-først vs utbygger-først) er aktivt omstridt og avgjøres av
august-markedsinput. Kvalitets-porten er DERFOR identisk uansett segment — kun INNHOLDET
operatøren produserer varierer. Dette er en ratifisert scope-invariant (PRD 15 §3-NB),
ikke en kode-detalj: å holde porten segment-agnostisk er å implementere scopet riktig.

**Verifikasjon (kjørt 2026-07-05):**

```
grep -rniE 'bruktmegler|utbygger|segment|megler' \
  .claude/skills/curator/ .claude/skills/manus-curator/
```

Resultat: **ingen segment-betinget logikk, templates eller grener** i noen av skill-filene.
De eneste treffene er (a) «meglerspråk» brukt som ANTI-mønster-vokabular i
`manus-curator/references/anti-eksempler.md` (generisk meglerspråk er noe porten forbyr —
for alle segmenter) og (b) en scope-deferred note om fremtidig outro/kontakt-megler-CTA
(`manus-curator:138`) — en udekket teksttype, ikke en segment-gren. Ingen treff i
`curator/`-skillet overhodet.

### 1.3 Innholds-kvalitetsregler — forfatter-arbeidsflyt-porter (ikke kode-regler)

Disse reglene er porter operatøren/skillet håndhever under skriving og QA. De er IKKE
kode-regler og skal ikke bygges inn som runtime-validering utover det PRD 14 alt eier
(`validateManus`-båndet, se 1.4):

1. **Nabolags-editorial i PRESENS — ikke byggeår/historikk** (memory
   `feedback_editorial_no_years_history`). Beskriv hva som ER der. Dette OVERSTYRER
   curator-skillens historisk-form-default (tidsregelen `curator:85-95` og
   opplevelse/museum-registeret som vekter byggeår/tidsdybde) FOR nabolags-editorial:
   tidsregelens forbud mot skjøre nåtidspåstander om ansatte/meny/tilbud gjelder fortsatt,
   men løsningen for nabolagstekst er å beskrive det stabile nåværende tilbudet i presens —
   ikke å rygge inn i årstall og historikk.
2. **Manus: 0 POI-navn** — unntak: skolekrets (grunnskole + ungdomsskole + VGS = 3 navn er
   hele poenget) (`manus-curator:32`).
3. **Manus: 5 setninger (cap)** (`manus-curator:33`).
4. **Manus: ord-MÅL 60–75** (`manus-curator:34`) — den KANONISKE harde grensen eies av
   PRD 14 Unit 2 AC2, se 1.4.
5. **Manus: 20–25 sek TTS** (`manus-curator:35`; kalibrering 55 ord ≈ 21 sek på Erik
   turbo_v2_5 norsk).
6. **Ett tema per setning** (memory `feedback_reels_manus_struktur`) — cut-punkter i reels
   ligger på setningsende; to temaer i én setning gjør at bildet ikke bytter i takt med stemmen.
7. **Fakta-orientert, ikke poetisk** (memory `feedback_manus_fakta_orientert`) — fakta
   beskriver hva som ER, poesi hva det «kjennes som». Drop «lukten av …», «smaken av …».
8. **Beboer-perspektiv, ikke turist** (memory `feedback_reels_beboer_perspektiv`) —
   målgruppen er boligkjøperen som blir beboer; drop turist-/severdighet-vinkler.

### 1.4 Ord-grense-kontrakt (KONSUMERES fra PRD 14 — re-hjemles ikke her)

Den kanoniske ord-grense-avklaringen eies av **PRD 14 Unit 2 AC2**
(`docs/rebuild/prd/14-audio-tour-reels.md:238`, løst i bead `placy-ralph-r14.2`).
Avklaringen: **mål og bånd er to ortogonale roller, ikke konkurrerende grenser** —

- **MÅL (genererings-hint):** `TARGET_WORDS = 70` (`lib/audio-tour/manus-prompt.ts:26`,
  single-source) — det skribenten bes treffe per spor.
- **BÅND (aksept-guardrail):** `MIN_WORDS = 35` / `MAX_WORDS = 90`
  (`lib/audio-tour/manus.ts:31/33`) — post-hoc-validatoren `validateManus` avviser spor
  utenfor båndet. Båndet er bevisst sjenerøst rundt målet (70 ∈ [35, 90]).

PRD 15-arbeidsflyten KONSUMERER denne kontrakten: operatøren skriver mot manus-curator-målet
(60–75), og PRD 14s bånd avgjør aksept. Runbooken re-hjemler ikke grensen; endringer i
mål/bånd gjøres i PRD 14-domenet (drift-vakt: `manus.test.ts`).

### 1.5 Build-time — ALDRI runtime-LLM (invariant)

Hele kurerings-arbeidsflyten er **build-time**: skills (`curator`/`manus-curator`) og
CLI-scripts (`curate-area`/`curate-narrative`) kjøres i Claude Code-/CLI-kontekst, og
output LAGRES (Supabase-rader, `.curation-staging/`-artefakter, mp3-filer) før boardet
leser det ved render. Det gjøres INGEN Gemini-/Claude-/LLM-kall fra `app/`-runtime eller
klientkomponenter (CLAUDE.md-arkitekturregel; PRD 7 `07:54`; `curate-narrative.ts:6-7` —
Claude kan ikke kalles som API her, skillet er det utførte mellomsteget). Den menneskelige
beslutningen (staging-review → apply) ligger alltid mellom generering og Supabase-patch.

---

## 2. Area-editorial-kurering — staging → PRD 8s kjerne (Unit 2)

Arbeidsflyten som produserer `data/areas/<areaId>.staging.json` (body/highlightCandidates/
image per bolig-tema) og kjører den gjennom **PRD 8s `apply-area-staging`-kjerne**
(`lib/pipeline/apply-area-staging.ts`). Staging-JSON-filene er ARBEIDSFLYT-OUTPUT (data),
ikke kode. PRD 15 KONSUMERER kjernen — den re-implementerer den aldri (`08` G4 /
nedstrøms-kontrakt-kartet «PRD 15-prov»-raden).

### 2.1 Arbeidsflyten: prepare → skriv → beslutt → apply

| Steg | Hva | Verktøy / kilde |
|---|---|---|
| 1. Kandidat-meny (read-only) | List POI-kandidater per bolig-tema fra ett eller flere provisjonerte prosjekter (UNION, dedup), filtrert per temaets kategorier, sortert på avstand fra områdets senter. | `npx tsx scripts/curate-area.ts --list-pois <projectId>[,…] [--theme <temaId>] [--area <areaId>]` |
| 2. Kurator skriver staging-JSON | `data/areas/<areaId>.staging.json`: per bolig-tema `body` (PRESENS — kvalitets-porten i seksjon 1), `highlightCandidates` (heterogene POI-IDer fra menyen), valgfri `image`; pluss `boundary` (GeoJSON Polygon/MultiPolygon, `[lng, lat]`, lukkede ringer) og valgfri `meta` (KUN når raden skal OPPRETTES). Bruk en eksisterende fil som mal (f.eks. `data/areas/ranheim.staging.json`). | Curator-skill (stemme) + manuell redigering — build-time |
| 3. Valider + plan (dry-run) | Zod-validering (`parseAreaStaging`) + diff-plan mot DB-raden. INGEN writes. | `npx tsx scripts/curate-area.ts --file data/areas/<areaId>.staging.json --dry-run` |
| 4. Menneskelig beslutning | Operatør leser planen/diffen og godkjenner. Interaktiv bekreftelse er default; `--yes` hopper over den. Beslutningen ligger ALLTID mellom generering og Supabase-patch (invariant 1.5). | samme script uten `--dry-run` |
| 5. Kjernen skriver | `writeAreaStaging` (PRD 8-kjernen) → `v2.areas` (`Content-Profile: v2`): GET→branch INSERT/PATCH, se 2.3. Strukturert resultat (`ok:true/false`) — CLI-skallet oversetter `ok:false` til `process.exit(1)`. | `lib/pipeline/apply-area-staging.ts` |
| 6. Nedstrøms (til boardet) | Kuratert `areas.report_editorial` når boardet via ARVE-steget `inheritAreaEditorial` (PRD 3 Steg 7, `lib/pipeline/provision.ts:235`) inn i `products.config.reportConfig.themes[].editorial`. Gating er body ELLER ≥1 overlevende highlight (`inherit-area-editorial.ts:320-326`) — aldri en tier-bryter. Allerede-provisjonerte boards plukker opp innholdet ved neste arve-/provisjonskjøring (PRD 3-domenet). | PRD 3 / PRD 8 Unit 3 |

### 2.2 Staging-kontrakten — PRD 8s Zod (konsumeres, re-hjemles ikke)

Kontrakten eies av PRD 8 Unit 2 (`lib/pipeline/area-staging.ts`); arbeidsflyten produserer
filer som tilfredsstiller den:

| Felt | Kontrakt | Ref |
|---|---|---|
| `areaId` | Ikke-tom streng — slug-aktig (`ranheim`), matcher `areas.id`. IKKE UUID. | `area-staging.ts:150` |
| `boundary` | GeoJSON `Polygon`/`MultiPolygon` i WGS84 (`[lng, lat]`), alle ringer lukket, koordinater i gyldige ranger. | `area-staging.ts:75-78` |
| `report_editorial` | Record der nøklene MÅ være gyldige bolig-tema-IDer fra `VALID_THEME_IDS` = `REPORT_THEME_DEFAULTS` (bolig-6-tema: `hverdagsliv`, `barn-oppvekst`, `mat-drikke`, `natur-friluftsliv`, `transport`, `trening-aktivitet`). Ukjent tema → høylytt feil med temanavnet. | `area-staging.ts:21/100-112`, `report-defaults.ts` |
| Tema-entry | `{ body, highlightCandidates, image? }` — strict (ingen ekstra felt). | `area-staging.ts:84-98` |
| `highlightCandidates` | **Heterogene POI-IDer** (`google-ChIJ…`, `bus-…`, `entur-NSR-…`) — valideres KUN som ikke-tomme strenger, **ALDRI UUID-regex** (dokumentert gotcha: `docs/solutions/ui-bugs/poi-ids-heterogeneous-not-uuid-20260428.md`). | `area-staging.ts:88-95` |
| `meta` | Valgfri — KUN nødvendig for INSERT av ny rad (NOT NULL-feltene `name_no`/`name_en`/`slug_no`/`slug_en`/`center_lat`/`center_lng`). Ignoreres ved update. | `area-staging.ts:114-142` |
| `_instructions` | Fritekst i malen — ignoreres av pipelinen. | `area-staging.ts:148-149` |

**`naering`-tema er en dokumentert no-op, ikke en PRD-15-bug:** staging avviser et hvilket
som helst tema utenfor bolig-6-taksonomien som «Ukjent tema-id» (f.eks. naering-temaene
`hverdagstjenester`/`nabolaget`). Dette er PRD 8s STATERTE scope-grense (area-editorial-arv
er bolig-profil-skopet — `08` §3 scope-avgrensning); testdekket i
`area-staging.test.ts:176`. Naering-area-editorial er deferred i PRD 8, ikke noe denne
arbeidsflyten skal omgå.

**Verifikasjon (kjørt 2026-07-05, full dekning — ikke sampling):** alle eksisterende
staging-filer kjørt gjennom `parseAreaStaging` — **6 av 6 OK, 0 feil** (charlottenlund,
lade, malvik, ranheim, sentrum, tyholt — alle med 6 temaer). Malfila er i tillegg
permanent testdekket (`area-staging.test.ts:95`).

### 2.3 Ingen optimistisk lås på `areas` — arvet grense, endres IKKE her

`areas` MANGLER `updated_at`-kolonne (verifisert `prod-schema-snapshot.txt` linje 4-20;
`08` §5.4), så optimistisk lås à la `inherit-area-editorial` er UMULIG på denne skrive-stien.
Kjernen bruker derfor enkel **GET → branch** (`apply-area-staging.ts:6-14`):

- Raden finnes ikke → INSERT (POST) fra `meta` + boundary + report_editorial.
- Raden finnes → **klient-side spread-merge → PATCH på id.** Merge-semantikk: staging
  overskriver `boundary` og de `report_editorial`-temaene den har; eksisterende temaer
  som ikke er i staging BEHOLDES; `meta` ignoreres (endrer aldri identitet).
- 0-rader-PATCH/INSERT → `ok:false`-feil (aldri stille).

Én-operatør-PoC-en GODTAR dette (PRD 8 Beslutning 4): to samtidige kuratorer på samme
område kan overskrive hverandre, men arbeidsflyten har én operatør og menneskelig
review før hvert write. Kontrast: ARVE-skrivingen mot `products.config` (som HAR
`updated_at`) bruker optimistisk lås — asymmetrien er bevisst. **PRD 15 endrer ikke
dette**; en evt. `updated_at` på `areas` er PRD 1/8-domene.

### 2.4 Kjerne-konsum, ikke shell

Skrive-stien er den DELTE modulen `lib/pipeline/apply-area-staging.ts`
(`fetchAreaRow`/`writeAreaStaging`/`applyAreaStaging`) — hele poenget med PRD 8
Unit 4-ekstraksjonen (`08` G4). `scripts/curate-area.ts` er KUN CLI-skallet rundt kjernen
(arg-parsing, dry-run-plan/diff, interaktiv bekreftelse, `--list-pois`-meny) og importerer
modulen direkte (`curate-area.ts:49-53`). En fremtidig programmatisk PRD-15-overflate
(f.eks. server action) importerer `applyAreaStaging` — den spawner ALDRI
`curate-area`-scriptet som subprosess.

**Verifikasjon (kjørt 2026-07-05):** `grep -rn "curate-area" lib/ app/ components/` →
kun kommentar-referanser i `lib/pipeline/` (ingen kode-avhengighet inn i scriptet);
ingen `spawn`/`exec` av scriptet noe sted i kodebasen.

### 2.5 Build-time + presens (innholds-invariantene)

Alt area-editorial-innhold produseres **build-time/manuelt** gjennom stegene i 2.1 —
ALDRI runtime-generert (invariant 1.5). `body`-tekstene skal passere kvalitets-porten i
seksjon 1, spesielt: **nabolags-editorial i PRESENS** — beskriv hva som ER der, ikke
byggeår/historikk (1.3 regel 1, memory `feedback_editorial_no_years_history`).
