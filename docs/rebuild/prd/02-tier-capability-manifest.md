# PRD 2 — Nivå-modell + kondisjonell render + taksonomi

> **Dato:** 2026-06-26 (revidert 2026-06-27 — eier-besluttet forenkling fra 3-nivå-capability-matrise til 2-nivå-modell + ortogonale render-flagg, se walkthrough-revisjon etter §9)
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Phase 1 har ingen blokkerende åpne spørsmål; se §10.)
> **Tier:** delt (fundament)
> **Slug:** `prd-tier-capability-manifest`
> **Kontekst:** Andre fundament-PRD i sommer-rebuilden 2026. Definerer abstraksjonen «ÉN Placy, ett delt skall — nivå er et felt (1/2) + ortogonale render-flagg, IKKE forket kode». Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (lederparagraf + Kjerne-domene-seksjon + Kritiker-patch #2 og #4, lukket 2026-06-26) og `docs/brainstorms/2026-06-10-placy-tier-modell-requirements.md`. Konsumeres av nesten alle nedstrøms-PRD-er; blokkeres kun av `prd-datamodell-supabase` (PRD 1). Leser `products.config` + `projects.has_3d_addon` fra det nye `v2`-schemaet (PRD 1 walkthrough-revisjon 2026-06-27).

---

## 1. Produktvisjon / Formål

Placy har **to leveransenivåer**:

- **Nivå 1 = autonomt generert (default).** *Alle* board er nivå 1 med mindre noe annet eksplisitt bestilles. Workflowen er «skriv adresse → bam → rapport»: en webform på placy.no (provisjon-pipelinen, PRD 3) produserer et nivå-1-board automatisk.
- **Nivå 2 = eksplisitt «bestilt»/kuratert.** Settes eksplisitt (admin-only i starten — kun Andreas). Et nivå-2-board har kuratert editorial på alle temaer; resten av forskjellene (3D, VO, branding) er **ortogonale flagg**, ikke nivå-krav.

Den gamle kodebasen hadde fristelsen til å la dette bli flere kodeløyper. Rebuildens kanon er det motsatte:

> **Nivå er et felt (1/2) på ÉT delt skall — ikke forket kode.** Nivå 2 = nivå 1 + kuratert editorial. 3D, VO, camera-tours, brokers og brand-assets er **ortogonale akser** (boolean-flagg / data-presence) som driver kondisjonell rendering UAVHENGIG av nivå — ikke pass/fail-nivå-krav. Vi deler nedover stacken (logikk/data/infra/primitiver er ALLTID delt) og diverger oppover i UX (komposisjonen står fritt til å divergere bevisst). Synden er duplisert logikk/drift, ikke divergent UX.

Denne PRD-en eier **deklarasjonen** av hva som skiller nivå 2 fra nivå 1, **kontrakten** for hva som vises når (kondisjonell render på de ortogonale flaggene), og den **delte taksonomien** (tema→kategori-mapping) som alle board bygger på. Den eier IKKE skallet, board-dataen, provisjonen eller editorial-innholdet — den gir dem kontrakten de renderer/validerer mot.

**Alt nedenfor i stacken konsumerer dette.** `prd-provisjon` skriver nivå-feltet og leser taksonomien; `prd-board-data-state` eier VO-seleksjonen (`pickPlayableAudio`) som render-kontrakten refererer; `prd-lokalkunnskap-moat` leverer editorial-innholdet som nivå-2-readiness-sjekken sjekker; `prd-board-skall-ui` (9) implementerer den kondisjonelle renderingen; `prd-self-serve-admin` bruker nivå-feltet + flaggene som sannhetskilde i oppsett-formen.

---

## 2. Mål (Goals)

Hvert mål kobler til minst én konkret requirement (og dermed til en eller flere units i §7). Pekerne `(→ Gx)` i unitene refererer tilbake hit.

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Gjør nivå-deltaet eksplisitt: to nivåer (1 default, 2 kuratert) + en kondisjonell-render-kontrakt som definerer hva som vises når. | To-nivå-modell + kondisjonell-render-kontrakt-dokument (Unit 1); inkl. kjerne-vs-overflate-skillet og «ingen render-gating på nivå»-prinsippet. |
| **G2** | Etabler de ortogonale flaggene (3D/VO/camera/brokers/brand) som render-akser uavhengig av nivå, og en lett nivå-2-readiness-sjekk. | `report-tier-schema` (1\|2) + lett readiness-sjekk (Unit 2); render-flagg-tabellen med driver-kolonnen i kontrakt-dokumentet (Unit 1). |
| **G3** | Etabler én delt taksonomi-kilde (tema→kategori, per-by radius) som ALLE board (også nivå 1) bruker, med profil-akse ortogonal til nivå. | `report-defaults.ts` + `theme-definitions.ts` portet verbatim som single source of truth + kanonisk `THEME_IDS`-eksport (Unit 3). |
| **G4** | Hold kjernen segment-agnostisk: ingen segment-antakelser bakt inn i nivå-modell eller taksonomi-akser. | Profil≠segment-skille dokumentert (Unit 1, Unit 3); ingen segment-felt i nivå-modellen. |
| **G5** | Bevis at semantikken er bevart og at koden passerer alle mekaniske porter. | Test-port + readiness-sjekk-test + grønne lint/test/tsc/build (Unit 4). |

---

## 3. Arkitektur-kontekst

Plassering i mantraet **«del nedover stacken, diverger oppover i UX»**. Divergensen har **tre uavhengige akser**: nivå-aksen (1=autonomt / 2=kuratert editorial), de ortogonale render-flaggene (3D/VO/camera/brokers/brand — data-presence som driver kondisjonell rendering uansett nivå), og profil-aksen (`bolig`/`naering` — hvilke temaer/kategorier/radius gjelder). Taksonomien divergerer på **profil**; editorial-kuratering på **nivå**; render-features på sine **egne flagg**. Ingen av disse forker kode — de fyller samme delte skall betinget.

| Lag | Eierskap | Divergerer per nivå? | Divergerer per profil? |
|-----|----------|----------------------|------------------------|
| Datamodell (`products.config` JSONB, `projects.has_3d_addon` — leses fra `v2`) | PRD 1 | Nei — felt finnes alltid, fylles betinget | Nei |
| **Nivå-felt (1\|2) + kondisjonell-render-kontrakt** | **Denne PRD-en** | Nei — kontrakten *beskriver* divergensen, men er selv delt | Nei |
| **Taksonomi (`report-defaults` + `theme-definitions`)** | **Denne PRD-en** | **Nei** — identisk på alle board (også nivå 1) | **Ja** — `bolig`=6 temaer, `naering`=5 temaer + egne radier |
| Board-data / VO-seleksjon | PRD 5 | Nei — `pickPlayableAudio` velger spillbart spor uavhengig av nivå | Nei |
| 3D-motor, RSC-render, kontroller | PRD 6 / 9 | Nei — identisk skall, vises på `has_3d_addon` (ortogonalt flagg) | Nei |
| Kuratert editorial/hero | PRD 9 (nivå-2-overflate) | **Ja (nivå 2)** — bevisst divergens, fylles betinget | Nei |
| Render-features (VO, camera-tour, branding/reels-video, brokers) | PRD 9 | Nei — drives av **ortogonale flagg/data-presence**, ikke nivå | Nei |

> **Operasjonalisering av mantraet:** Nivå styrer om editorial er kuratert (nivå 2) eller ikke (nivå 1). De ortogonale flaggene styrer hvilke *render-features* som vises (`has_3d_addon`→3D, spillbart lydspor→VO, camera-tour→flythrough, brokers/brand→vis dem). Profil styrer hvilke *temaer/kategorier/radius* som gjelder. Alle er delte kontrakter; ingen forker kode.

Empirisk bevis at mantraet holder: `eventToBoardData`-adapteren mater SAMME board-skall via domene-data → `BoardData` → ett skall (CARRY-OVER-MANIFEST linje 7). Event-sporet er parkert, så dette brukes som **bevis, ikke aktiv port**.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer |
|---------------|--------------------|
| `prd-provisjon` (3) | `report-defaults.ts` (taksonomi) + `getThemeDefaults`/`getDiscoveryRadius`; skriver `reportTier` + `has_3d_addon` (til `v2`) |
| `prd-board-data-state` (5) | VO-seleksjonen render-kontrakten refererer (`pickPlayableAudio`) |
| `prd-grounding-curation` (7) | tema-taksonomi (`theme-definitions`) per tema |
| `prd-lokalkunnskap-moat` (8) | tema-IDer (kanonisk `THEME_IDS`-eksport for TS→Python-grensen; leverer editorial-innholdet nivå-2-readiness-sjekken sjekker) |
| `prd-board-skall-ui` (9) | kondisjonell-render-kontrakten (hva vises ved nivå 2 / hvert ortogonalt flagg); implementerer renderingen |
| `prd-self-serve-admin` (12) | nivå-feltet + flaggene som sannhetskilde for oppsett-formen |

---

## 4. Eksisterende kodebase

### Bæres over (keeper-core / port-with-rewrite)

| Fil (@/-sti) | Verdict | Akse-tag | Rolle |
|--------------|---------|----------|-------|
| `@/lib/validation/report-tier.ts` | port-with-rewrite (forenkles) | delt | Dagens `validateReportTier` (ren funksjon, 8 sjekk-ider) **forenkles til en lett nivå-2-readiness-sjekk** (kun `invalid-tier` + `highlight-poi` + `editorial`@nivå2; se §5.3). De 5 nivå-3-sjekkene (vo/camera-tours/has3d-addon/brokers/brand-assets) fjernes som nivå-gater — de blir ortogonale render-inputs (eies av PRD 9). Funn er fortsatt data, ingen throws, ingen render-gating. **NB: dagens fil importerer `getProjectBrokers` fra `@/lib/themes/project-brand` (linje 7) — den koblingen forsvinner når brokers slutter å være en nivå-sjekk.** |
| `@/lib/validation/report-tier-schema.ts` | port-with-rewrite (1\|2) | delt | Zod literal-union — **endres fra `z.union([literal(1),literal(2),literal(3)])` til `z.union([literal(1),literal(2)])`** + `OptionalReportTierSchema`. Parse-grunnmuren beholdes — fanger `"2"`/3/0 fra JSONB. |
| `@/lib/pipeline/report-defaults.ts` | keeper-core (port verbatim) | delt | TAKSONOMI-KILDE (eid av denne PRD-en, patch #4). 6 bolig-temaer + 5 nærings-temaer + per-by radius. Delt infrastruktur ALLE board trenger (også nivå 1). |
| `@/lib/themes/theme-definitions.ts` | keeper-core (port verbatim) | delt | Minimal delt `ThemeDefinition`-type (Report + Explorer). Ren kontrakt. |
| `@/lib/themes/category-illustrations.ts` | port-with-rewrite | delt | `getCategoryIllustrationSrc` — asset-flag-mønster for kategori-illustrasjoner. **Snu avhengigheten**: importerer i dag `THEME_SCENE_SRC` fra `@/components/variants/report/theme-icons` (verifisert linje 1). |
| `@/lib/themes/project-brand.ts` | keeper-core (port verbatim) | ortogonalt flagg (PRD 9 eier modellen) | `getProjectBrokers(slug)` — synkront in-memory-oppslag i `PROJECT_BROKERS`-tabell (ingen I/O). Brokers er nå et **ortogonalt render-flagg** (vises hvis data finnes), ikke en nivå-sjekk; konsumeres av PRD 9, ikke av readiness-sjekken. |

### Slettes / forlates (reference-only / dead)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `@/lib/pipeline/housing-categories.ts` | reference-only | Explorer self-service — `report-defaults` er autoritativ for rapport (CARRY-OVER linje 641). |
| (ingen render-gating på `reportTier`) | n/a | Verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`. Det finnes ingen render-gating-kode å bære over — og ingen skal bygges (patch #2). |
| (ingen `TIER_CAPABILITIES`-matrise bygges) | n/a | Eier-besluttet forenkling 2026-06-27: ingen 3-rads capability-matrise. Nivå-deltaet er én readiness-sjekk + en render-kontrakt, ikke et capability-rammeverk. |

---

## 5. Datakontrakt / Skjema

### 5.1 Hvor nivå deklareres (forankret i prod-skjema + kode)

`reportTier` er et **optional felt i `ReportConfig`** (`@/lib/types.ts`: `reportTier?: 1 | 2` etter forenklingen), lagret i `products.config` JSONB. Leses fra det nye `v2`-schemaet (PRD 1 walkthrough-revisjon 2026-06-27 — `supabase-js` med `.schema('v2')`). Verifisert mot `prod-schema-snapshot.txt`:

- `products.config` er `jsonb`, `NOT NULL` (linje 138) — **ingen dedikert `reportTier`-kolonne finnes**; feltet bor i JSONB.
- `projects.has_3d_addon` er `boolean`, `NOT NULL` (linje 184) — `has3dAddon` er et **ortogonalt render-flagg** på Project-nivå, BEVISST utenfor `reportConfig`. Det driver 3D-rendering uavhengig av nivå (vis 3D-motor hvis `has_3d_addon`), ikke en nivå-sjekk.

Feltet settes av produkteier ved oppsett via `buildReportConfig` (`create-report-project.ts`, CARRY-OVER linje 72). `undefined`/manglende = **nivå 1** (default). Nivå 2 settes eksplisitt (admin-only i starten — kun Andreas).

> **NB — `has_3d_addon` skrive-side:** Pipeline-SKRIVEREN `create-report-project.ts:217` hardkoder i dag `has_3d_addon: true` for alle board. Les-fallback er `false` (`queries.ts:604,896`); migrasjon `065:5` er `NOT NULL DEFAULT FALSE` (kolonnen reproduseres i `v2`). Å gjøre `has_3d_addon` CLI-input-styrt eies av `prd-provisjon` (PRD 3). Dette er ren skrive-side: det ortogonale flagget leses som-er av render-kontrakten — ingen nivå-logikk er involvert.

### 5.2 To-nivå-modellen + kondisjonell-render-kontrakten

**Nivå-modellen er minimal.** Det eneste nivå 2 *legger til* over nivå 1 er **kuratert editorial på alle temaer**. Alt annet (3D, VO, branding, camera-tours, brokers) er ortogonale akser som ikke avhenger av nivå.

```ts
// report-tier-schema.ts (forenklet)
export const ReportTierSchema = z.union([z.literal(1), z.literal(2)]);
export const OptionalReportTierSchema = ReportTierSchema.optional();
export type ReportTier = z.infer<typeof ReportTierSchema>; // 1 | 2
// undefined / manglende = nivå 1 (autonomt generert default)
```

**Kondisjonell-render-kontrakt (NY — dette er reglene provisjon (3) og render (9) er enige om).** Hver akse driver rendering UAVHENGIG av de andre. Selve renderingen implementeres i PRD 9; kontrakten (reglene) bor her:

| Akse | Driver (input) | Hva vises når den er sann |
|------|----------------|---------------------------|
| **Nivå 2** | `reportConfig.reportTier === 2` | Kuratert editorial/hero/branding-overflate (i stedet for autonomt generert nivå-1-innhold) |
| **3D** | `projects.has_3d_addon === true` | 3D-kart-motor (ellers 2D-skall) |
| **VO** | spillbart lydspor finnes (`pickPlayableAudio` — `reelsAudio ?? audio` med manus+url) | Voiceover-avspilling + karaoke |
| **Camera-tour** | `camera-tours`-entry finnes for sluggen | Flythrough/kino-kamera |
| **Brokers** | `reportConfig.brokers` ELLER `getProjectBrokers(slug)` gir treff | Ansvarlig-megler-blokk |
| **Brand-assets** | `reportConfig.assets.brand` finnes | Prosjekt-branding |

> **Disse aksene er ORTOGONALE.** Et nivå-1-board kan ha 3D (`has_3d_addon`) og VO (spillbart spor) uten å være nivå 2 — fordi 3D/VO er data-presence, ikke nivå-krav. Et nivå-2-board uten 3D-addon renderes i 2D. Ingen akse gater en annen.

> **NB — `pickPlayableAudio` her er en ren render-kontrakt-DRIVER, ikke en validator-import.** VO-raden refererer `pickPlayableAudio` (eid av PRD 5) kun for å navngi *inputet* som driver VO-rendering — denne PRD-en importerer den ikke og readiness-sjekken (§5.3) sjekker ikke VO. Konsumentene skal IKKE gjeninnføre VO-«speilingen» (den gamle `vo`-nivå-sjekken som «speilet render-gating 1:1», CARRY-OVER linje 270) inn i validator-/readiness-laget — VO er en ortogonal render-akse, ikke en nivå-gate.

> **Lazy-load-note:** De tunge ortogonale modulene — 3D, VO, reels/splash-video — `dynamic()`-importeres i skallet så nivå-1/uten-flagg ikke betaler bundle-kost. Selve `dynamic()`-wrappingen + bundle-beviset implementeres i PRD 9 (board-komponentene); kontrakten her sier bare at de SKAL lazy-lastes. Abstrahér ikke for innbilte fremtider — kun de tre verifiserte tunge modulene.

Nivå-modellen er IKKE en segment-akse: ingen `bolig`/`naering`/`bruktmegler`/`utbygger`-felt får finnes her. Profil (`bolig`/`naering`) er en separat akse (§5 taksonomi).

### 5.3 Lett nivå-2-readiness-sjekk (erstatter 8-check-validatoren)

Den gamle 8-check-validatoren er erstattet av en **lett readiness-sjekk** — ikke et capability-rammeverk. Den sjekker KUN det som faktisk definerer nivå 2 (kuratert editorial), pluss to trivielle data-validitets-sjekker. `validateReportTier(project): ReportTierFinding[]` forblir en **ren funksjon, funn er data (ingen throws), ingen render-gating**.

| Sjekk-id | Nivå | Level | Trigger |
|----------|------|-------|---------|
| `invalid-tier` | alle | error | `reportTier` parses ikke som 1/2 (fanger `"2"`/3/0) — **returnerer tidlig**, andre sjekker hoppes (behold) |
| `highlight-poi` | nivå-uavhengig | warning | `highlightPoiId` resolver ikke mot injisert `poiIds` (hoppes hvis `poiIds` utelatt) — triviell data-validitet |
| `editorial` | 2 | error | tom `themes`, eller tema uten editorial (ikke-tom body ELLER ≥1 highlight) |

Det er ALT. De gamle nivå-3-sjekkene (`vo`, `camera-tours`, `has3d-addon`, `brokers`, `brand-assets`) er **fjernet som nivå-gater** — de er nå ortogonale render-flagg (§5.2-tabellen), eid/brukt av PRD 9. De er ikke pass/fail-krav på et nivå.

> **Selv denne lette sjekken kan holdes minimal eller utsettes** i starten: kun Andreas setter nivå 2 manuelt (admin-only), så det er ingen selvbetjent flate som kan produsere et halv-kuratert nivå-2-board ennå. Prinsippet «funn er data, ingen throws; ingen render-gating» er det viktige og forblir riktig.

`audioTourEnabled` valideres **bevisst ikke** — dødt flagg, VO-tilstedeværelse avgjøres på spillbar lyd (`pickPlayableAudio`, PRD 5), ikke på flagget.

> **NB — terminologi:** CARRY-OVER linje 270 sier ordrett «speiler render-gating 1:1» om den gamle VO-sjekken. Den sjekken er nå fjernet fra readiness-laget; VO er en ortogonal render-akse (§5.2). Det finnes ingen render-gating å speile (patch #2, verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`).

### 5.4 Brokers som ortogonalt render-flagg

Brokers var tidligere en nivå-3-warning i validatoren (`report-tier.ts` importerte `getProjectBrokers` fra `@/lib/themes/project-brand`, linje 7). **Etter forenklingen er brokers et ortogonalt render-flagg** (§5.2-tabellen), ikke en nivå-sjekk: ansvarlig-megler-blokken vises hvis `reportConfig.brokers` ELLER `getProjectBrokers(slug)` gir treff — uavhengig av nivå.

Konsekvens for koden: readiness-sjekken (§5.3) importerer IKKE lenger `getProjectBrokers`, og den eneste lib→lib-koblingen som tidligere bandt readiness-laget til overflate-data forsvinner naturlig. `project-brand.ts` beholdes som-er (synkront in-memory-oppslag, ingen I/O) og konsumeres av PRD 9 (render-laget) der brokers-blokken faktisk rendres. Brokers-DATAEN (brand-asset-modellen) eies av PRD 9.

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. To-nivå-modellen (1=autonomt default, 2=eksplisitt kuratert) + kondisjonell-render-kontrakten (hva vises ved nivå 2 og ved hvert ortogonalt flagg).
2. `report-tier-schema` (1\|2) + lett nivå-2-readiness-sjekk (`invalid-tier` + `highlight-poi` + `editorial`@nivå2).
3. Delt taksonomi-kilde (`report-defaults.ts` + `theme-definitions.ts`) + kanonisk `THEME_IDS`-eksport for TS→Python-grensen.
4. Kontraktdokument for kjerne-vs-overflate-skillet (inkl. lazy-load-note for de tunge ortogonale modulene).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Skriving av `reportTier` + `has_3d_addon` i `buildReportConfig` (produksjons-siden av deklarasjonen) | `prd-provisjon` (PRD 3) |
| Editorial-SKJEMAET (`ReportThemeEditorial`-innhold, area-arv) som nivå-2-readiness-sjekken sjekker | `prd-lokalkunnskap-moat` (PRD 8) |
| `camera-tours.ts`-DATAEN (slug→`CategoryCameraConfig`) — ortogonalt render-flagg | `prd-board-skall-ui` (PRD 9) |
| Brand-asset-MODELLEN + `getProjectBrokers`-DATAEN (ortogonale render-flagg; PRD 9 eier modellen og rendringen) | `prd-board-skall-ui` (PRD 9) |
| Faktisk kobling av `has_3d_addon` til ekte addon-tilstand (pipeline-SKRIVEREN `create-report-project.ts:217` hardkoder `true` i dag) — fix = gjør `has_3d_addon` CLI-input-styrt | `prd-provisjon` (PRD 3) |
| **FAKTISK kondisjonell rendering + `dynamic()`-wrapping i board-komponentene** (denne PRD-en leverer kun render-KONTRAKTEN; komponentene eies av PRD 9) | `prd-board-skall-ui` (PRD 9) |
| TS→Python kode-generering for `THEME_IDS` (denne PRD-en eksporterer kanonisk konstant; konsumenten/kodegen bygges der) | `prd-lokalkunnskap-moat` (PRD 8) |
| `pickPlayableAudio`-implementasjonen render-kontrakten refererer | `prd-board-data-state` (PRD 5) |

**Eksplisitt ikke-scope (patch #2):** render-gating på `reportTier` som skjuler features. Render-laget gater IKKE på nivå (verifisert: ingen ref i `BoardMap3D`/`ReportReelsPage`). Features vises på sine egne ortogonale flagg, ikke på nivå. **Ingen unit bygger render-gating.** Heller ingen `TIER_CAPABILITIES`-matrise og ingen 8-check-validator (eier-besluttet forenkling 2026-06-27).

---

## 7. Implementation Units (4 av 4 dekket)

### Unit 1 — To-nivå-modell + kondisjonell-render-kontrakt-dokument
- **Mål (→ G1, G4):** Etabler de to nivåene, det normative kjerne-vs-overflate-skillet, og kondisjonell-render-kontrakten som provisjon (3) og render (9) er enige om.
- **Filer:** `@/docs/rebuild/tier-kjerne-vs-overflate.md` (nytt).
- **Akseptansekriterier:**
  - Dokumentet definerer de to nivåene: nivå 1 = autonomt generert default (alle board med mindre annet bestilles); nivå 2 = eksplisitt kuratert editorial (admin-only i starten).
  - Dokumentet lister DELT kjerne (3D-motor, RSC-render, taksonomi fra `report-defaults`, kamera-rammeverk, board-skall, Auto/Fri/Kart/3D-kontroller) eksplisitt som «alltid lastet, alltid identisk».
  - Dokumentet inneholder kondisjonell-render-kontrakt-tabellen fra §5.2 (nivå 2 + de fem ortogonale flaggene: 3D/VO/camera/brokers/brand) med driver + hva som vises — og slår fast at aksene er ortogonale (ingen akse gater en annen).
  - Dokumentet inneholder lazy-load-noten: de tre tunge ortogonale modulene (reels/splash-`<video>`, voiceover-orchestration, kuratert hero-asset) `dynamic()`-importeres så nivå-1/uten-flagg ikke betaler bundle-kost; faktisk wrapping + bundle-bevis eies av PRD 9. Abstrahér ikke for innbilte fremtider — kun de tre verifiserte modulene.
  - Dokumentet slår fast «ingen render-gating på `reportTier` som skjuler features» (patch #2), at nivå-modellen IKKE har segment-felt (segment-agnostisk), og at profil (`bolig`/`naering`) er en akse ORTOGONAL til nivå.
- **Avhengigheter:** ingen (gjøres først).

### Unit 2 — `report-tier-schema` (1\|2) + lett readiness-sjekk
- **Mål (→ G1, G2):** Forenkle nivå-skjemaet til 1\|2 og erstatt 8-check-validatoren med en lett nivå-2-readiness-sjekk.
- **Filer:** `@/lib/validation/report-tier-schema.ts` (endre union til 1\|2), `@/lib/validation/report-tier.ts` (forenkle til readiness-sjekk).
- **Akseptansekriterier:**
  - `ReportTierSchema = z.union([z.literal(1), z.literal(2)])`; `OptionalReportTierSchema.safeParse(3)`, `.safeParse("2")`, `.safeParse(0)` feiler, `.safeParse(2)` og `.safeParse(1)` lykkes; `undefined` = nivå 1.
  - `validateReportTier` produserer KUN `invalid-tier` (error, tidlig-retur), `highlight-poi` (warning, hoppes hvis `poiIds` utelatt) og `editorial` (error ved nivå 2 — tom `themes` eller tema uten editorial). Funn er data, ingen throws.
  - De fem fjernede sjekkene (`vo`/`camera-tours`/`has3d-addon`/`brokers`/`brand-assets`) finnes IKKE lenger i readiness-laget; `report-tier.ts` importerer ikke lenger `getProjectBrokers`.
  - Sjekken er ren I/O-fri (kun `poiIds` injiseres for `highlight-poi`); ingen render-lag-import. Nivå-modellen har null segment-felt.
- **Avhengigheter:** Unit 1, PRD 1 (`ReportTier` re-derives fra `v2`-baseline-typer).

### Unit 3 — Delt taksonomi-kilde + THEME_IDS + synk-kontrakt
- **Mål (→ G3, G4):** Etabler `report-defaults.ts` + `theme-definitions.ts` som single source of truth for tema→kategori — delt infrastruktur ALLE board (også nivå 1) bruker — med profil-akse ortogonal til nivå.
- **Filer:** `@/lib/pipeline/report-defaults.ts` (port verbatim), `@/lib/themes/theme-definitions.ts` (port verbatim), `@/lib/themes/category-illustrations.ts` (port + snu avhengigheten vekk fra `components/`), `@/lib/themes/theme-ids.ts` (nytt — kanonisk `THEME_IDS`-eksport).
- **Akseptansekriterier:**
  - `getThemeDefaults("bolig")` gir 6 temaer, `getThemeDefaults("naering")` gir 5 (Mat & Drikke først) — verifisert mot porten.
  - `getDiscoveryRadius("trondheim","bolig")` = 2000, `("trondheim","naering")` = 1500.
  - `category-illustrations.ts` importerer IKKE fra `components/` (avhengighet snudd: i dag importeres `THEME_SCENE_SRC` fra `@/components/variants/report/theme-icons` — verifisert linje 1; flytt asset-kartet til `lib/` eller injiser, så taksonomi/lib ikke avhenger av komponenter).
  - **`THEME_IDS` er en re-eksport, ikke en duplikatliste:** `theme-ids.ts` eksporterer `THEME_IDS = REPORT_THEME_DEFAULTS.map(t => t.id)` (avledet fra taksonomi-kilden), så det ikke oppstår et nytt drift-par på TS-siden.
  - **Synk-kontrakten gjelder KUN TS→Python-grensen:** TS-konsumenter (inkl. `area-staging.ts`) deriverer ALLEREDE fra `REPORT_THEME_DEFAULTS` (verifisert `area-staging.ts:21`: `VALID_THEME_IDS = REPORT_THEME_DEFAULTS.map(t => t.id)`) og trenger INGEN ny konstant. Den eneste reelle drift-flaten er `scripts/extract-skolekrets-boundary.py` (hardkodet tema-liste, linje ~37–39). `theme-ids.ts`-headeren dokumenterer at `THEME_IDS` er kilden for kodegen mot Python-scriptet (selve kodegen bygges i PRD 8); drift der brekker editorial-arv stille.
  - Profil (`bolig`/`naering`) er en `ReportProfile`-akse, helt adskilt fra `ReportTier`-aksen.
- **Avhengigheter:** PRD 1.

### Unit 4 — Tester + mekaniske porter
- **Mål (→ G5):** Bevis at den forenklede semantikken er korrekt og at koden passerer alle porter.
- **Filer:** `@/lib/validation/report-tier.test.ts` (port + trim til de tre sjekkene), `@/lib/themes/theme-ids.test.ts` (nytt — re-eksport-invariant).
- **Akseptansekriterier:**
  - Tester dekker readiness-sjekkens tre funn: `invalid-tier` (inkl. tidlig-retur og at `safeParse(3)` feiler), `highlight-poi`, og `editorial`@nivå2 (nivå-1-board uten editorial gir INGEN error).
  - Test bekrefter at `THEME_IDS` er identisk med `REPORT_THEME_DEFAULTS.map(t => t.id)` (re-eksport-invariant, ingen drift).
  - Tester for de fjernede nivå-3-sjekkene er slettet (ikke kommentert ut) — de er ikke lenger del av readiness-laget.
  - `npm run lint` (0 errors), `npm test`, `npx tsc --noEmit`, `npm run build` grønne.
- **Avhengigheter:** Unit 1–3.

---

## 8. Utviklingsløp (faser)

### Phase 1 — Nivå-modell + render-kontrakt
- **Mål:** To-nivå-modell + kondisjonell-render-kontrakt-dokument + forenklet skjema/readiness-sjekk + tester står. Ingen blokkerende åpne spørsmål (Q1/Q3/Q4 ratifisert i §9).
- **Leveranse:** Unit 1, 2, 4 (test-delen for readiness-sjekken).
- **Autonomi-nivå:** Høy — liten ren funksjon, godt dekket av (trimmede) eksisterende tester. Render-kontrakten er et dokument, ikke kode.

### Phase 2 — Taksonomi
- **Mål:** Delt taksonomi-kilde eid og synk-kontrakt etablert; `THEME_IDS` re-eksportert.
- **Leveranse:** Unit 3 (+ THEME_IDS-test fra Unit 4).
- **Autonomi-nivå:** Medium — `category-illustrations`-avhengighetsinversjon og THEME_IDS→Python-synk krever koordinering med PRD 8.

> Den faktiske kondisjonelle renderingen + `dynamic()`-wrappingen + bundle-beviset lever i PRD 9 (board-komponentene). Denne PRD-en leverer kun kontrakten/reglene de implementeres mot — derfor ingen egen lazy-load-fase her.

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | ÉN Placy, ett delt skall — nivå er et felt (1/2) + ortogonale flagg, ikke forket kode | Kanon (CARRY-OVER lederparagraf); del nedover, diverger oppover i UX |
| 2 | To nivåer: 1 = autonomt default (alle board), 2 = eksplisitt kuratert editorial (admin-only i starten) | Eier-besluttet 2026-06-27. Nivå 3 finnes ikke; det som var nivå-3-krav er nå ortogonale flagg |
| 3 | 3D/VO/camera/brokers/brand er ortogonale render-flagg (data-presence), IKKE nivå-krav | `has_3d_addon` er allerede egen boolean; VO er allerede «finnes spillbart spor» (`pickPlayableAudio`). Buntingen til «nivå 3» var det kunstige. Driver kondisjonell rendering uavhengig av nivå |
| 4 | Readiness-sjekken forblir ren I/O-fri; funn er data, ingen throws | Offline-testbar; «ren» = ingen sideeffekter/I/O. Den lette sjekken sjekker kun editorial@nivå2 + to trivielle data-validitets-funn |
| 5 | INGEN render-gating på `reportTier` som skjuler features | Patch #2, verifisert: ingen ref i `BoardMap3D`/`ReportReelsPage`. Features vises på egne ortogonale flagg |
| 6 | `report-defaults.ts` eies logisk av denne PRD-en (fysisk i `lib/pipeline/`); delt infra for ALLE board | Patch #4 — taksonomi-kilde; provisjon konsumerer. Også nivå 1 bruker den |
| 7 | `has_3d_addon` bor utenfor `reportConfig` (Project-nivå); ortogonalt render-flagg | Verifisert: `projects.has_3d_addon` er egen kolonne (snapshot linje 184), reproduseres i `v2` |
| 8 | `audioTourEnabled` valideres ikke | Dødt flagg på boardet; VO-tilstedeværelse = spillbar lyd (`pickPlayableAudio`) |
| 9 | Profil (bolig/næring) er egen akse ortogonal til nivå — IKKE segment-lås i kjernen | Segment er aktivt omstridt; hold nivå-2-overflaten tynn og swappbar. **(Ratifiserer tidligere Q3: profil modelleres eksplisitt som `ReportProfile`-akse.)** |
| 10 | `category-illustrations`-avhengigheten snus vekk fra `components/` | Taksonomi/lib skal ikke avhenge av komponenter (verifisert: importerer `THEME_SCENE_SRC` fra `components/` i dag) |
| 11 | `ReportConfig`-typen eies av PRD 1; denne PRD-en eier parsing/validering av `reportTier` (1\|2) | Readiness-sjekken importerer `ReportConfig` (kontrakten den parser); typen selv er baseline. **(Ratifiserer tidligere Q4.)** |
| 12 | `THEME_IDS` er en re-eksport fra `REPORT_THEME_DEFAULTS`, ikke en ny hardkodet liste | TS-siden har allerede single-source (`area-staging.ts:21`); unngå nytt drift-par. Synk-behovet gjelder kun TS→Python-grensen |
| 13 | Kondisjonell-render-kontrakten bor her; faktisk rendering + `dynamic()`-wrapping eies av PRD 9 | Provisjon (3) og render (9) trenger samme regler. Unngår fil-kollisjon på board-komponenter (Agent-Teams-regel) |
| 14 | Lesing av `products.config` + `has_3d_addon` skjer via `v2`-schemaet (`.schema('v2')`) | PRD 1 walkthrough-revisjon 2026-06-27 — fersk `v2`-baseline, ikke in-place i `public` |

### Kontroll-runde 2026-06-27

- **has3dAddon-presisering (NYANSERT):** Det er pipeline-SKRIVEREN `create-report-project.ts:217` (hardkoder `has_3d_addon: true` for alle board) som gjør at flagget alltid er `true` i dag. Etter forenklingen er `has_3d_addon` et **ortogonalt render-flagg** (vis 3D hvis sant), ikke en nivå-gate — så render-kontrakten leser det som-er. Les-fallback `false` i `queries.ts:604,896`; migrasjon `065:5` = `NOT NULL DEFAULT FALSE` (kolonnen reproduseres i `v2`). Kjernen i PRD 2 krever ingen endring; fix (gjør `has_3d_addon` CLI-input-styrt) eies av PRD 3. Lukker §10.1.

### Walkthrough-revisjon 2026-06-27

Eier-besluttet forenkling (Andreas, walkthrough 2026-06-27). Dette er en **forenkling av abstraksjonen, ikke et scope-kutt** — leveransen består fortsatt av «definer hva som skiller nivåene + delt taksonomi + kondisjonell-render-kontrakt». Det er kun overabstraksjonen som fjernes.

| Før (overabstraksjon) | Etter (forenklet) | Hvorfor |
|-----------------------|-------------------|---------|
| **3 nivåer** (1 Basic / 2 +Editorial / 3 Maks) | **2 nivåer** (1 autonomt default / 2 eksplisitt kuratert). Nivå 3 finnes ikke | Produktmodellen er to-delt: alt er nivå 1 med mindre nivå 2 bestilles eksplisitt (admin-only) |
| **3D/VO/camera/brokers/brand = nivå-3-krav** (buntet inn i «Maks») | **Ortogonale render-flagg** (data-presence) som driver kondisjonell rendering uavhengig av nivå | `has_3d_addon` er allerede egen boolean; VO er allerede «finnes spillbart spor». Buntingen var kunstig — disse er render-inputs, ikke pass/fail-nivå-krav |
| **`TIER_CAPABILITIES`-matrise** (3 rader × 6 felt) + **8-check validator** (vo/camera-tours/has3d-addon/brokers/brand-assets som nivå-gater) | **Lett nivå-2-readiness-sjekk** (3 funn: `invalid-tier` + `highlight-poi` + `editorial`@nivå2) + **kondisjonell-render-kontrakt** (tabell) | Ingen capability-rammeverk trengs. Det eneste nivå 2 legger til er kuratert editorial; resten er flagg. AI-overabstraksjon (eier husker det ble overkomplisert sist) |
| `report-tier-schema`: `z.union([1,2,3])` | `z.union([1,2])` | Følger to-nivå-modellen; fanger fortsatt `"2"`/3/0 som ugyldig |

**Beholdt uendret:** den delte taksonomien (`report-defaults` 6+5 temaer + per-by radius, `theme-definitions`, `THEME_IDS` re-eksport, profil-akse), `category-illustrations`-avhengighetsinversjonen, «ÉN Placy, ett delt skall»-prinsippet, «ingen render-gating på `reportTier`», og «funn er data, ingen throws». Disse var aldri overabstraksjonen.

---

## 10. Åpne spørsmål

*Q1, Q3, Q4 fra tidligere utkast er ratifisert til Beslutninger (se §9). Punkt 1 nedenfor er LØST i kontroll-runden 2026-06-27; punkt 2 er fortsatt genuint åpent. Begge er **ikke-blokkerende for Phase 1**:*

1. **(LØST 2026-06-27, ikke-blokkerende)** **Dom:** `has_3d_addon` er nå et ortogonalt render-flagg, ikke en nivå-gate. Pipeline-SKRIVEREN `create-report-project.ts:217` hardkoder `has_3d_addon: true` for ALLE pipeline-board i dag, så flagget er konstant `true`; render-kontrakten leser det som-er (vis 3D hvis sant). Les-fallback `false` i `queries.ts:604,896`; migrasjon `065:5` = `NOT NULL DEFAULT FALSE` (reproduseres i `v2`). Kjernen i denne PRD-en krever ingen endring. **Fix-eierskap:** `prd-provisjon` (PRD 3) gjør `has_3d_addon` CLI-input-styrt slik at skriveren slutter å hardkode `true`. Status: lukket — ansvaret er plassert. Påvirker ikke Phase 1.
2. **(ikke-blokkerende)** Eksakt lazy-load-terskel for de tre tunge ortogonale modulene må verifiseres mot faktisk bundle — gjøres i PRD 9 der `dynamic()`-wrappingen og bundle-analysen lever. Denne PRD-en leverer kontrakten/reglene, ikke målingen.

---

## 11. Avhengigheter (ASCII-graf)

```
                 prd-datamodell-supabase (PRD 1, v2-schema)
                          │ (reportTier i products.config JSONB,
                          │  has_3d_addon-kolonne, ReportConfig-type)
                          ▼
        ┌──────── prd-tier-capability-manifest (PRD 2 — DENNE) ────────┐
        │                        │                        │            │
        ▼                        ▼                        ▼            ▼
  prd-provisjon (3)     prd-board-data-state (5)   prd-grounding   prd-self-serve
  (taksonomi +          (VO-seleksjon                -curation (7)   -admin (12)
   nivå-skriving)        `pickPlayableAudio`)        (taksonomi)     (nivå + flagg)
        │                        │
        ▼                        ▼
  prd-lokalkunnskap-moat (8)   prd-board-skall-ui (9)
  (editorial-innhold +          (implementerer kondisjonell render mot
   THEME_IDS→Python-kodegen)     kontrakten; eier 3D/VO/camera/brokers/brand-
                                 rendringen + dynamic()-wrapping + bundle-bevis)
```

**Blokkeres av:** PRD 1.
**Blokkerer:** PRD 3, 5, 7, 8, 12 (og koordinerer med 9 via kondisjonell-render-kontrakten).
**Render-flagg-data eies av (ikke her):** `camera-tours.ts` + brokers/brand-data fra PRD 9; spillbart VO-spor fra PRD 5.

---

**Fullstendighet:** 4 av 4 implementation units spesifisert med akseptansekriterier; 5 av 5 mål (G1–G5) eksplisitt enumerert i §2 og koblet til ≥1 konkret requirement; alle units peker tilbake til ≥1 mål. Alle schema-påstander forankret i `prod-schema-snapshot.txt` (`products.config` jsonb linje 138, `projects.has_3d_addon` linje 184) + faktisk kode (`report-tier-schema.ts`, `report-tier.ts:7`, `report-defaults.ts`, `area-staging.ts:21`, `category-illustrations.ts:1`); leses fra `v2`-schemaet (PRD 1 walkthrough-revisjon). Ingen P0/P1/P2-tiers; deferred work plassert under Scope Boundaries med pekere; ingen render-gating spesifisert (patch #2); ingen `TIER_CAPABILITIES`-matrise / 8-check-validator (eier-besluttet forenkling 2026-06-27).
