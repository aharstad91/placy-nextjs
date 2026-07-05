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
| 3. Grounding-QA + manus-curering | Unit 3 | `placy-ralph-r15.3` | **FERDIG** (dette dokumentet) |
| 4. Overflate-fylling (ProjectAssetFlags + broker/pin) | Unit 4 | `placy-ralph-r15.4` | **FERDIG** (dette dokumentet) |
| 5. Reels/audio-regi | Unit 5 | `placy-ralph-r15.5` | **FERDIG** (dette dokumentet) |
| 6. Samlekart-klassifisering + scope-grense | Unit 6 | `placy-ralph-r15.6` | **FERDIG** (dette dokumentet) |
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

---

## 3. Grounding-QA + manus-curering — regi over PRD 7-output (Unit 3)

Den menneskelige godkjennings-/QA-dansen over PRD 7s grounding-output
(`grounding.narrative` → `curatedNarrative`), pluss manus-curatering utover grounding.
**PRD 15 bygger INGEN ny QA-infrastruktur** — den formaliserer det menneskelige
review-steget i den EKSISTERENDE prepare→skill→apply-dansen (PRD 7 Åpne spørsmål #5).
PRD 7 eier orkestrator-implementasjonen og grounding-genereringen (`07:90`,
`scripts/curate-narrative.ts`-raden i keeper-kartet); PRD 15 QA-er og godkjenner
OUTPUTEN (`07:190` — «Nivå-2 kuratering-ARBEIDSFLYT (redaksjonell QA, godkjenning,
manus-curatering utover grounding) → PRD 15»). Ingen del av denne seksjonen re-hjemler
grounding-generering eller story-text-/POI-linker-familien (`lib/curation/poi-linker` +
`lib/utils/story-text-linker`, PRD 7 Unit 5).

### 3.1 Dansen: prepare → skill skriver → operatør godkjenner → apply

Orkestratoren er `scripts/curate-narrative.ts` (PRD 7, «Steg 2.7 i /generate-rapport»,
`generate-rapport:211-223`). Claude kan ikke kalles som API her (ingen key) — scriptet
er derfor splittet i `prepare` + `apply` med skill-utført mellomsteg
(`curate-narrative.ts:6-7`, flyt-dokumentert `:9-13`). Alle linje-refs verifisert
2026-07-05.

| Steg | Hva | Kilde |
|---|---|---|
| 0. Forutsetning | Temaet har grounding (`groundingVersion: 1`) fra PRD 7s grounding-orkestrator. Uten grounding hopper prepare over temaet. | `gemini-grounding.ts` (r07.3); skip `:221-225` |
| 1. `prepare <pid>` | Skriver `.curation-staging/<pid>/<theme>.context.json` per tema: **sanitized** gemini-narrative (`sanitizeGeminiInput`, `:252` — prompt-injection-forsvar mellom LLM-ledd), source-domener, tema-filtrert `poi_set` (kun gyldige UUID-er, `:206/:243-249`), `target_length` 600–800 (`:266-267`), `fetchedAt`. Sletter evt. gammel `.curated.md` så skillet ser fresh state (`:273-275`). Idempotens: tema med `curatedAt >= fetchedAt` på v2 hoppes over uten `--force` (`:228-240`). | `curate-narrative.ts:188-294`; path-helpers `:171-181` |
| 2. Skill/operatør skriver | Claude Code (skill-utført mellomsteg) leser `.context.json` og skriver `.curated.md` per tema — 600–800 tegn kuratert narrativ i Placy-stemmen. Teksten skrives MOT kvalitets-porten i seksjon 1. | `generate-rapport:220/:233`; build-time |
| 3. **Operatør GODKJENNER** | **Det formaliserte PRD 15-steget:** operatøren LESER hver `.curated.md` mot QA-porten i 3.2 og godkjenner — først DA trigges `apply`. Beslutningen ligger ALLTID mellom generering og Supabase-patch (invariant 1.5). Avvist tekst: rediger `.curated.md` (eller re-kjør mellomsteget) og les på nytt. | menneskelig review — ingen tooling |
| 4. `apply <pid>` | Backup av hele produkt-raden FØR mutations (`backups/products-curate-*.json`, `:322-330`) → per tema: `validateCuratedNarrative` (`:359`) + `linkPoisInMarkdown` POI-UUID-whitelist (`:384`) + audit-logg av rå output (`backups/curation-audit-*.jsonl`, `:389-403`) → 0 vellykkede temaer ⇒ ABORT uten write (`:428-431`); feilede temaer BEHOLDER v1 (`:433-438`, v1/v2 coexist per tema `:447-459`) → ÉN samlet PATCH med `updated_at=eq`-optimistisk lås (`:464-467`), 0 rader ⇒ concurrent-write-abort (`:487-493`) → `revalidate product:<pid>` (`:497-510`). | `curate-narrative.ts:307-514` |

`.curation-staging/` og `backups/` er arbeidsflyt-ARTEFAKTER, ikke kode — begge
gitignored (`.gitignore:46-47`). `--theme <id>` avgrenser begge faser til ett tema.

### 3.2 QA-porten for grounding-output (hva operatøren faktisk sjekker)

Operatørens godkjenning (steg 3) er IKKE en ny sjekkliste — det er kvalitets-porten i
seksjon 1 anvendt på `.curated.md`, pluss grounding-spesifikke punkter:

1. **Stemme + 9-punkts sjekkliste + tidsregel** (seksjon 1.1) — inkl. presens-regelen
   for nabolagstekst (1.3 regel 1).
2. **Grounding-troskap** — teksten påstår ingenting grounding ikke støtter (samme
   prinsipp som `manus-curator:49`). Merk arbeidsdelingen mot maskinvernet: validatoren
   fanger proper nouns som ikke finnes i gemini-narrative ∪ `poi_set.name`
   (anti-hallusinering, `lib/curation/validator.ts` — `07:87`), men SEMANTISK troskap
   (antall, plassering, kausalitet) er operatørens ansvar.
3. **Lengde-mål vs bånd** (samme mål/bånd-mønster som 1.4): context-fila angir MÅLET
   600–800 tegn (`:266-267`); validatorens harde bånd er min 100 / max 1200 tegn
   (`07:87`). Operatøren sikter på målet; båndet avgjør maskinell aksept.
4. **POI-lenke-rimelighet i etterkant:** `apply`-outputen viser tegn + antall
   POI-lenker per tema (`:420`) — avvik (0 lenker på POI-tungt tema) er signal om å
   re-kjøre med justert tekst. Selve linkingen eies av PRD 7.

### 3.3 Manus-curatering utover grounding (manus-curator-skillen)

Manus (TTS-input for audio/reels) er en ANNEN teksttype enn curatedNarrative
(story-text) og har sin EGEN eksisterende dans — `manus-curator`-skillens Steg 1–7
(`manus-curator:83-116`): hent grounding fra Supabase → identifiser hva grounding
faktisk støtter → velg strukturmønster → skriv 5 setninger → sjekkliste mot hard rules
→ sammenlign mot ankereksempel → **lagre i staging** `.curation-staging/<prosjekt>/<spor>.md`
med frontmatter — «brukerens beslutning før patching til Supabase» (`manus-curator:115-116`).
Ingen ny pipeline; skillen ER arbeidsflyten.

Manus-QA-en bruker stemme-kontrakten (seksjon 1) som godkjennings-port: 9-punkts
sjekkliste (`curator:97-109`) + **tidsregelen som HOVEDPORT** (`manus-curator:48`) +
**grounding-troskap** (`manus-curator:49`). Ord-grensen konsumeres fra PRD 14
(mål 60–75 / bånd 35–90 — seksjon 1.4); nedstrøms TTS-bygg og reels-regi er
seksjon 5-stoff (PRD 14 eier pipelinen, `audio-manus-write.ts` → `validateManus`).

### 3.4 Eierskaps-grenser (respekteres, endres ikke her)

| Hva | Eier | PRD 15s rolle |
|---|---|---|
| Grounding-generering (`gemini-grounding.ts`) + orkestrator (`curate-narrative.ts`) | PRD 7 (`07:89-90`) | KJØRER scriptene; endrer dem aldri |
| POI-linker (`lib/curation/poi-linker`) + validator + sanitizer | PRD 7 (`07:85-87`) | Konsumerer via `apply`; re-hjemler aldri |
| Manus-domenet (`manus.ts`-båndet, TTS-kjernen) | PRD 14 | Skriver manus via skill; QA-er mot porten |
| Redaksjonell QA/godkjenning av output | **PRD 15** (`07:190`) | Steg 3 i 3.1 + 3.2/3.3-portene |

### 3.5 Build-time — ingen runtime-LLM (verifikasjon)

Hele dansen er build-time: Claude er skill-utført mellomsteg, aldri API-kall
(`curate-narrative.ts:6-7`); Gemini-kallet skjer i PRD 7s build-time
grounding-orkestrator. **Grep-verifikasjon (kjørt 2026-07-05)** av `app/` +
`components/` for LLM-/TTS-SDK-signaturer (`generativelanguage`, `api.anthropic`,
`anthropic-ai`, `GEMINI_API`, `x-goog-api-key`, `elevenlabs`): eneste LLM-treff er
`app/api/eiendom/tekst/route.ts:3` (`@anthropic-ai/sdk`) — en pre-eksisterende
LEGACY-rute på den døde `targetAudience`-modellen, UTENFOR kurerings-dansen, allerede
Andreas-gated i `docs/rebuild/DECISIONS-QUEUE.md` (r07.7-funn; slett-vs-port avgjøres
der, og bead `placy-ralph-03t` skal ESLint-håndheve regelen maskinelt). Kurerings-
arbeidsflytens sti har null runtime-LLM.

---

## 4. Overflate-fylling — ProjectAssetFlags + broker/pin-data (Unit 4)

Arbeidsflyten som fyller **PRD 9s nivå-2-overflate per prosjekt**: sette
`ProjectAssetFlags`-verdier + levere asset-filer, og erstatte demo-broker/pin-data med
ekte per-prosjekt-data. PRD 9 eier modellen (`lib/themes/project-brand.ts`) og
rendringen; PRD 1 eier typene (`ProjectAssetFlags`/`BrokerInfo`); PRD 15 fyller KUN
VERDIENE — reportConfig-verdier produseres via Supabase, ikke kode (PRD 15 Unit 4
«Filer»-noten). Alle linje-refs verifisert 2026-07-05.

**REF-DRIFT (dokumentert som i seksjon 5):** bead-/PRD-tekstens `project-brand.ts`-refs
har driftet konsistent ~4–6 linjer (header-kommentarer lagt til i porten): gate-refs
`:25/:51/:85` → faktisk `:28/:54/:91`; `PROJECT_BROKERS :60-71` → `:66-77`;
`getProjectBrokers :74` → `:80-82`; `PIN_THUMBNAILS :81-89` → `:19-21` (oppslaget) +
`:87-94` (getter). `lib/types.ts:445` (brokers) → faktisk `:461`.

### 4.1 De to aktiverings-aksene (begge capability-data-drevet, ulike felter)

**(a) Asset-flagg-gatede assets** — operatøren setter `ProjectAssetFlags`
(`lib/types.ts:433-444`, lagret i `reportConfig.assets`, `:454`) OG leverer filene etter
slug-konvensjonen. Modellen gater HVERT asset på sitt flagg og returnerer `undefined`
når flagget mangler:

| Flagg | Getter (gate) | Fil(er) operatøren leverer |
|---|---|---|
| `brand` | `getProjectLogoSrc` (`project-brand.ts:24`, gate `:28`) + `getProjectSplashImage` (`:35`, gate `:39`) | `/illustrations/{slug}-logo.svg` + `{slug}-splash.jpg` |
| `splashVideo` (eller `brand`) | `getProjectSplashVideo` (`:50`, gate `:54` — `splashVideo \|\| brand`) | `/illustrations/{slug}-splash-video.mp4` (+ `.jpg`-poster, avledes ved filendelse-bytte) |
| `customIllustrations` | `getCategoryIllustrationSrc` (`lib/themes/category-illustrations.ts:13`, gate `:18`) | `/illustrations/{slug}-{categoryId}.jpg` per bolig-tema |
| `pinThumbnail` | `getProjectPinThumbnail` (`:87`, gate `:91`) → slår opp i `PIN_THUMBNAILS` (`:19-21`) | Kvadratisk **data-URI** (rasteriseres til WebGL-tekstur på 3D-markøren — kan IKKE være fil-sti som de andre; `ProjectSitePin` faller tilbake til bygnings-glyph uten) |

`splashVideo`-flagget finnes nettopp for å gi et prosjekt levende splash UTEN å kreve
hele `brand`-pakken (logo + splash-hero) — dokumentert i både typen
(`lib/types.ts:436-439`) og getteren (`project-brand.ts:45-49`).

**(b) Broker-data-tilstedeværelse** — INGEN flagg. Operatøren erstatter
demo-`PROJECT_BROKERS` (`project-brand.ts:66-77`, i dag kun stasjonskvartalet/DNB) med
ekte per-prosjekt-data i `reportConfig.brokers` (`lib/types.ts:461`, type `BrokerInfo`
`:399-409`). `getProjectBrokers(slug)` (`:80-82`) tar KUN `slug` og er IKKE flagg-gated;
lese-stien er `board-data.ts:191-195`: **ekte `reportConfig.brokers` vinner alltid**
(`report.brokers?.length ? report.brokers : getProjectBrokers(...)`) — demo-tabellen er
fallback INNTIL ekte data finnes. Nedstrøms er megler-kortet i feeden gated på samme
data-tilstedeværelse (`reels-data.ts:365-369`: kort kun når `brokers.length > 0`) —
konsistent med PRD 2 §5.4s brokers-tilstedeværelses-sjekk.

### 4.2 Aktivering via capability, ALDRI tier (patch #4)

Assets aktiveres av flagg; brokers av data-tilstedeværelse. Begge er
capability-data-drevet — ALDRI en `if (reportTier)`-bryter. `undefined`-asset eller
tomme brokers → boardet faller tilbake til nivå-1-uttrykket UTEN tier-sjekk
(tekst-wordmark i stedet for logo, `home.heroImage` i stedet for splash-render/-video,
generiske tema-illustrasjoner, bygnings-glyph-pin, intet megler-kort).

**Grep-verifikasjon (kjørt 2026-07-05):** `grep -rn "reportTier"` over
`project-brand.ts` + `ReportReelsPage.tsx` + `BoardMap3D.tsx` + `board-data.ts` +
`reels-data.ts` → **0 treff**.

### 4.3 Arbeidsflyten per prosjekt (fylle-stegene)

| Steg | Hva | Grense |
|---|---|---|
| 1. Lever asset-filer | Filene over i `public/illustrations/` etter slug-konvensjonen. Kvalitet: stills produsert via `placy-illustrations`-skillen (Wesselsløkka-akvarell) der de er illustrasjoner. | PRD 15 leverer FILER |
| 2. Sett flaggene | Patch `products.config.reportConfig.assets` i Supabase (v2) — kun flaggene for filer som FAKTISK er levert. Ingen dedikert CLI; verdier produseres via Supabase (dashboard/SQL/REST med service-role), evt. ved provisjon (PRD 3). | Verdier via Supabase, ikke kode |
| 3. Ekte brokers | Skriv `reportConfig.brokers` (`BrokerInfo[]`) — koordinert med PRD 3-provisjon der relevant (`09:188`); megler-foto til `public/illustrations/`. | PRD 3 eier skrive-pathen ved oppsett |
| 4. Reels-video-valg | Se 4.4. | PRD 14 produserer filene |
| 5. Verifiser | Boardet i nettleser: flagget overflate synlig, uflagget faller tilbake. Fullføringskriteriet er Unit 7-validatoren (egen runbook-fil) — aldri en runtime-gate. | Unit 7 |

**Prototype-unntak (flagget, IKKE noe arbeidsflyten løser):** to fylle-punkter krever i
dag KODE-endring, begge markert `TODO(supabase)` av PRD 9-porten for flytting til
provisjon/Supabase: (1) `PIN_THUMBNAILS`-oppslaget (`project-brand.ts:16-18`) — nytt
prosjekt legger data-URI-en i tabellen + setter `assets.pinThumbnail`; (2)
demo-`PROJECT_BROKERS` (`:63-65`) — slettes når ekte brokers finnes i Supabase.
Migreringen er PRD 9-/PRD 3-domene; runbooken dokumenterer dagens faktiske dans.

### 4.4 Reels-video-asset-valget (splash-video + montasje-allowlist)

Arbeidsflyten BESLUTTER om et prosjekt får levende video-overflate; selve video-FILENE
produseres av **PRD 14 Unit 5-pipelinen** (seksjon 5.3: `animate-scene-veo.ts` /
`compose-reels-bg.ts` / `compose-video-crossfade.ts` / posters). To beslektede men
ULIKE mekanismer fylles:

- **`assets.splashVideo`-flagget** (akse (a)) gater splash-videoen
  `{slug}-splash-video.mp4` i velkomst-skjermen (`getProjectSplashVideo:50-54`).
- **`REELS_MONTAGE_PROJECTS`-allowlisten** (`reels-data.ts:252`, PRD-9-eid DATA-flagg —
  §5.4-kommentaren `:234`) gater de levende kort-bakgrunnene `welcomeVideoSrc` (`:257`)
  / `homeVideoSrc` (`:265`) → `/reels/{slug}/welcome.mp4` + `nabolaget.mp4`. Eksplisitt
  slug-gating fordi kortene avleder poster via `.mp4`→`.jpg` — en 404-poster ville gitt
  ødelagt bilde (kommentar `:245-251`). PRD 15 FYLLER allowlisten (legg til slug når
  montasjene er lastet opp under `/reels/<slug>/`); gating-mekanismen eies av PRD 9.

Uten montasje/video faller kortene tilbake til illustrasjonsbildet — delvis
video-dekning er gyldig regi, ikke en feil (samme fallback-prinsipp som
reels-VO-overriden i 5.2 lag 4).

### 4.5 Render-grensen: stills via next/image, modellen urørt

PRD 15 fyller DATAEN PRD 9 rendrer (`09:185`) — den porterer/endrer ALDRI
`project-brand.ts`, splash-clusteret eller pin-rendringen. Overflaten som konsumerer
verdiene (verifisert 2026-07-05): `ReportReelsPage.tsx:678-681` (logo/splash-hero/
splash-video → `DesktopReportSplash`/`MobileReportSplash`/`EmbedArrivalLoader`),
`BoardMap3D.tsx:438` (pin-thumbnail). Stills rendres via `next/image` i
render-komponentene (alle tre splash-/loader-komponentene importerer `next/image` —
CLAUDE.md-regelen håndheves der overflaten rendrer, PRD 9-grense); PRD 15 leverer
asset-FILER, aldri render-kode. Det bevisste unntaket fra fil-konvensjonen er
pin-thumbnailen (data-URI → WebGL-tekstur, 4.1-tabellen) — et render-teknisk krav
PRD 9 eier, ikke et arbeidsflyt-valg.

---

## 5. Reels/audio-regi — kjører PRD 14s pipeline + override-akse (Unit 5)

Regien av PRD 14s reels/audio-pipeline: operatøren beslutter **HVILKE reels** (hvilke
temaer får reels-VO) og **HVILKEN stemme**, og KJØRER pipelinen. PRD 14 eier byggeren,
TTS-kjernen, override-mekanismen og reels-video-pipelinen (`14:75` 15-prov-raden /
`14:209` deferred-raden: «Nivå-2 menneskelig kurerings-arbeidsflyt som KJØRER pipelinen
+ override-aksen» → PRD 15). Manus er pipeline-INPUT (PRD 14-domene), ikke story-text
(PRD 7) — skillet er banket i `14:206-209`-deferred-tabellen. Denne seksjonen re-hjemler
ingenting av det; den dokumenterer kjøringen. Alle linje-refs verifisert 2026-07-05.

### 5.1 Arbeidsflyten: manus → QA → bygg → verifiser

| Steg | Hva | Kilde |
|---|---|---|
| 1. Manus per tema | Operatør skriver reels-manus via **manus-curator-skillens Steg 1–7** (seksjon 3.3) mot kvalitets-porten i seksjon 1 — spesielt reels-reglene 1.3 #6–8 (ett tema per setning — cut-punkter ligger på setningsende; fakta-orientert; beboer-perspektiv) + ord-målet 60–75 (1.4). Staging-beslutning i `.curation-staging/<prosjekt>/<spor>.md` FØR noe bygges (invariant 1.5). | `manus-curator:83-116`; seksjon 1/3.3 |
| 2. Manus inn i prosjektet | Godkjent manus legges i `reportConfig.themes[].reelsAudio.manus` i prosjekt-JSON (`data/projects/<kunde>/<slug>.json`). Byggeren plukker KUN temaer med ikke-tomt `reelsAudio.manus` (`:82-92`) — tilstedeværelse av manus ER regi-beslutningen «dette temaet får reels-VO». | `reels-voiceover-build-local.ts:82-92` |
| 3. Kjør byggeren | `npx tsx scripts/reels-voiceover-build-local.ts data/projects/<kunde>/<slug>.json [--force]` (npm-alias `build:reels-vo-local`, `package.json:14`). Uten `--force` hoppes temaer med eksisterende `url` over (`:43/:113-117`); `PARALLEL_LIMIT=2` (ElevenLabs free-plan, `:38`); `MIN_BYTES=5000`-vern (`:39`). | PRD 14 Unit 4-porten (r14.4) |
| 4. Output committes som PAR | mp3 til `public/audio/<slug>/{themeId}-reels.mp3` + `reelsAudio`-objektet (url/voice/model/generatedAt/manus/timings) skrevet tilbake i prosjekt-JSON. **mp3 + timings committes ALLTID sammen** — TTS er stokastisk, en regenerert mp3 matcher aldri gamle timings; en regenerert mp3 som IKKE skal beholdes MÅ `git restore`-s (r14.8-runbooken `:63-66`). | `audio-reels-verifikasjon-runbook.md` |
| 5. Verifiser full pipeline | Se 5.4 — aldri snippet-validering. | memory `feedback_tts_validation` |

### 5.2 Override-disiplinen (karaoke-vernet) — respekteres, endres ALDRI her

`reelsAudio` er en **OVERRIDE-akse, ikke replacement** (memory
`reference_reels_audio_override`): reels-sporet overstyrer tour-sporet i feeden, men
tour-fila `{themeId}.mp3` skrives ALDRI over. Vernet er PRD 14s kontrakt (PRD 14
Unit 4-blokken `14:255-265`; beadens `14:252-258`-ref har driftet noen linjer) og består
av fire lag arbeidsflyten kjører INNENFOR:

1. **Egen filnøkkel:** trackKey er `{themeId}-reels` (`reels-voiceover-build-local.ts:86`)
   → `audioFilename` gir `{trackKey}.mp3` for alt ≠ "home" (`storage-paths.ts:11-12`),
   så reels-fila blir `{themeId}-reels.mp3` — kolliderer by-construction aldri med
   tour-`{themeId}.mp3`. Ingen endring i `storage-paths.ts` var nødvendig.
2. **Defensiv suffiks-abort:** byggeren kaster hvis trackKey mangler `-reels`-suffiks
   (`:130-132`) — defense-in-depth før disk-write (`:133`).
3. **Tour-bygget rører aldri `reelsAudio`:** speilvernet i søsterscriptet
   (`audio-tour-build-local.ts:14-15`) — de to aksene kan aldri skrive i hverandres filer.
4. **Feed-override med fallback:** `const audio = c.reelsAudio ?? c.audio`
   (`reels-data.ts:316`) + filter `!!c.reelsAudio || !!c.audio` (`:313`) — temaer uten
   reels-VO faller tilbake til tour-sporet per tema; delvis reels-dekning er gyldig
   regi, ikke en feil. (PRD 14-teksten siterer eldre `:277/:273-274` — linjene driftet
   etter r14.5.) Override-linjen er PRD 14s AUDIO-akse i den PRD 9-eide fila; testdekket
   i `reels-data.test.ts:76/:91/:106`.

Arbeidsflyten regisserer innenfor disiplinen — den endrer aldri filnøkkel-logikk,
abort eller override-linjen. Live-bevis for hele vernet (shasum før/etter: KUN
`{tema}-reels.mp3` endret, tour-mp3 + 15 andre byte-identiske) står i r14.8-runbooken.

### 5.3 Regi-beslutningene: hvilke reels, hvilken stemme

- **HVILKE reels:** per tema, via data-tilstedeværelse (`reelsAudio.manus` finnes) —
  ALDRI en `reportTier`-/`audioTourEnabled`-bryter (PRD 14 Unit 4 AC6; memory
  `reference_audio_tour_pipeline`: gating = spillbar lyd-tilstedeværelse). Alle
  bolig-temaer kan få reels-VO; regien velger fritt delmengde.
- **HVILKEN stemme:** default-regien er PRD 14s konstanter — Erik
  (`EpYEY8MWJrUGskHBoNMA`) / `eleven_turbo_v2_5` / `language_code "no"` / stability 0.75
  (`elevenlabs-client.ts:18-25`). `generateAudio` tar `voiceId`/`modelId`/`languageCode`
  per kall (`:66-68`), så en annen stemme-regi er et PARAMETERVALG i kjøringen — aldri
  en endring av klienten (PRD 14-eid). Memory-kontekst: ingen bedre ElevenLabs-modell
  for norsk finnes; `language_code` håndheves kun av turbo/flash
  (`feedback_norsk_tts_stedsnavn`).
- **Norske stedsnavn:** via PRD 14s alias-ordliste `scripts/tts/pronunciation-no.json`
  (lastes default av `generateAudio`, `elevenlabs-client.ts:73`) —
  `applyPronunciation` bytter KUN på TTS-input, `remapTimingsToOriginal` mapper
  karaoke-timings tilbake til ORIGINAL staving (`pronunciation.ts:67/:130/:188`).
  ALDRI ad-hoc respelling i selve manuset — alias-staving skal aldri nå DOM/karaoke
  (mismatch logges, `elevenlabs-client.ts:145`).
- **Reels-VIDEO (mp4 + poster):** produseres av PRD 14 Unit 5-pipelinen
  (`animate-scene-veo.ts` / `compose-reels-bg.ts` / `compose-video-crossfade.ts` /
  `generate-reels-posters.mjs`, npm `generate:reels-posters`) — PRD 15 KJØRER den,
  eier den ikke. Cut-punktene i `compose-reels-bg` aligneres mot setningsende i
  ElevenLabs-timings (Level B) — derfor manus-regelen «ett tema per setning» (1.3 #6).
  HVILKE prosjekter som får `splashVideo`/montage (`REELS_MONTAGE_PROJECTS`-allowlisten)
  er overflate-fyllings-stoff → seksjon 4 (Unit 4/r15.4), ikke denne seksjonen.

### 5.4 TTS-validering på FULL pipeline — aldri snippet

Modellen er **stokastisk per request** (memory `feedback_tts_validation`): et kort
test-snippet beviser ingenting om produksjons-manuset. Validering av ny reels-VO kjøres
derfor ALLTID som fullt produksjons-manus gjennom ekte `generateAudio` (samme sti som
bygget) før commit. Referanse-verifikasjonen med bevis-tabell er r14.8-runbooken
(`docs/rebuild/audio-reels-verifikasjon-runbook.md`): fullt manus → mp3 >
`MIN_BYTES` + alignment-lengder konsistente + timings remappet til original staving;
temp-JSON-kopi med ett tema + `--force` er det dokumenterte trikset for å validere ETT
spor uten å TTS-e alle temaene på nytt.

Merk arbeidsdelingen: maskinvernet i reels-byggeren er `MIN_BYTES` + suffiks-abort —
byggeren kjører IKKE `validateManus` (ord-båndet 35/90 håndheves i PRD 14s
manus-skrive-sti, `audio-manus-write.ts:383`). Kvalitets-porten i seksjon 1/3.3 er
derfor den reelle manus-porten FØR bygg; karaoke-korrekthet verifiseres i nettleser
som del av Unit 7-verifikasjonen (egen runbook-fil, se seksjonskartet).

### 5.5 Build-time, lagret output — ingen runtime-TTS (invariant)

Hele regien er **build-time** (invariant 1.5): TTS skjer i CLI-scriptet, output LAGRES
(mp3-filer i `public/audio/` + timings i prosjekt-JSON) og committes; boardet leser kun
lagrede filer ved render. Ingen ElevenLabs-/TTS-kall fra `app/`-runtime (grep-verifisert
i 3.5 — `elevenlabs`-signaturen var del av sveipet). Runtime-playbacken av sporene
(audio-tour-store + reels-orchestration + karaoke) er PRD 14s domene, video-UX-en
PRD 9s — begge utenfor kurerings-arbeidsflyten.

---

## 6. Samlekart-klassifisering + scope-grense — hold overflaten tynn (Unit 6)

Dette er en ren klassifiserings-beslutning (ingen kode endres): samlekart/multi-board er
**UT-AV-SCOPE** for nivå-2-kurerings-arbeidsflyten. Beslutningen finnes for å hindre at
død katalog-kode trekkes inn i arbeidsflyten og gjør segment-overflaten tykk — runbookens
seksjon 1–5 refererer ingen av artefaktene under, og det skal forbli slik.

### 6.1 De TO samlekart-artefaktene — begge døde spor, begge ut-av-scope

Det finnes to distinkte «samlekart»-artefakter i kodebasen. Ingen av dem er
rebuild-boardet, og ingen av dem kureres i denne arbeidsflyten:

**(a) Explorer/Guide-katalogen — `lib/curated-lists.ts`.** `CuratedList`/`CURATED_LISTS`
mater `/[area]/guide/[slug]`-SEO-micrositen (`app/(public)/` — 15 filer, manifest-status
`n/a`: «Explorer/Guide-katalog») pluss visit-trondheim-sidene og de gamle
admin-oversiktene (`app/admin/page.tsx:5`, `app/admin/public/page.tsx:13`). Dette er det
døde Explorer/Guide-sporet. Gjenopptak er en **separat Explorer/Guide-resume-task** —
IKKE nivå-2-kurering (PRD 15 §5 Deferred, rad «Samlekart/multi-board som AKTIV
funksjonalitet»).

**(b) Rapport-produktets eget «Samlekart» — overview-kartet i den GAMLE scroll-rapporten.**
`ReportPage.tsx:143` monterer `ReportOverviewMap` (dynamic import `:22`) via delt
`ReportMapPreviewCard` (`ReportMapPreviewCard.tsx:25` dokumenterer delingen). Manifest
klassifiserer hele den aktive scroll-komponent-familien `n/a` («kun /rapport») — dette er
IKKE rebuild-boardet. Eneste biten som keepes derfra er den DELTE `report-3d-config`-en
(`DEFAULT_CAMERA_LOCK`), som boardet allerede eier via PRD 9 — komponenten selv bæres
ikke inn.

**Grep-verifisert (2026-07-05):** `curated-lists`, `ReportOverviewMap`,
`ReportMapPreviewCard` og `ReportCuratedGrounded` har **null treff** i
`components/variants/report/reels/` og `components/variants/report/board/` —
rebuild-boardet (`ReportReelsPage`/`BoardMap3D`) konsumerer ingen av dem.

### 6.2 `ReportCuratedGrounded.tsx` — død renderer, ikke PRD-9-eid

`ReportCuratedGrounded.tsx` er en grounding-narrative-RENDERER hvis eneste konsument er
den gamle scroll-artikkelen (`ReportThemeSection.tsx:367`, dynamic import `:42` — «v1
bruker ReportGroundingInline, v2 bruker ReportCuratedGrounded»). Den rendres aldri av
rebuild-boardet, manifestet merker den `n/a` (samme rad som ReportOverviewMap), og PRD 9
verken porterer eller eier den (grep i `docs/rebuild/prd/09-*.md` = 0 treff).

Grensen mot seksjon 3 i denne runbooken: PRD 15 produserer og QA-er grounding-**DATAEN**
(`curatedNarrative` via `curate-narrative`-dansen, seksjon 3) — hvordan den dataen
RENDRES er PRD 9s domene, og denne døde komponenten er ikke en del av det domenet.

### 6.3 `ReportConfig.motiver` — board-data, ikke kurerings-arbeidsflyt

`ReportConfig.motiver` (`lib/types.ts:458–459`: «Tre nabolags-motiver fra
/generate-rapport. Vises i intro-kort ved samlekart.») er et **board-data-felt** —
PRD 5/9-concern. At feltets docstring nevner samlekart endrer ikke eierskapet:
kurerings-arbeidsflyten leser eller skriver det ikke, og ingen seksjon i denne runbooken
har et steg som rører det.

### 6.4 Scope-invarianten: tynn segment-overflate

Klassifiseringen håndhever rebuild-prinsippet om tynn/swappbar segment-overflate
(memory `project_summer_rebuild`): kurerings-arbeidsflyten består KUN av de fem
arbeidsflyt-aksene i seksjon 1–5, som alle konsumerer levende rebuild-kjerner
(PRD 7/8/9/14). Ingen død katalog-kode (curated-lists, scroll-rapport-komponenter,
døde renderere) er en del av arbeidsflyten — og en fremtidig Explorer/Guide-resume
endrer ikke DENNE runbooken; den får sin egen task med eget eierskap.
