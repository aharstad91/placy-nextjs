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
| 2. Area-editorial-kurering | Unit 2 | `placy-ralph-r15.2` | fylles av r15.2 |
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
