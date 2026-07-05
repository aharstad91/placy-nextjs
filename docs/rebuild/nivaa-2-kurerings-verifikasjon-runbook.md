# Nivå-2-kurering — verifikasjons-runbook (PRD 15 Unit 7)

**Eier:** PRD 15 (`docs/rebuild/prd/15-nivaa-2-kuratering.md` Unit 7) · **Bead:** `placy-ralph-r15.7`
**Opprettet:** 2026-07-05 · **Referanse-kjøring:** samme dato, alle porter grønne (bevis under)

Dette er FULLFØRINGSKRITERIET for nivå-2-kurerings-arbeidsflyten
(`docs/rebuild/nivaa-2-kurerings-runbook.md`, seksjon 1–6): etter at operatøren har
kurert et board, kjøres DENNE runbooken for å bevise at boardet faktisk oppfyller
nivå 2 — «ferdig betyr ferdig» (CLAUDE.md kvalitetsstandard). Runbooken har to porter:
en maskinell (validator-driveren) og en menneskelig (nettleser-verifikasjon).

---

## Port 1 — Validator-driveren som maskinell fullføringsport

### Hva operatøren kjører

```bash
npm run validate:tier                  # begge kilder (lokal JSON + Supabase)
npm run validate:tier -- --local-only  # offline-variant (skipper Supabase)
```

Driveren er `scripts/validate-report-tier.ts` (PRD 2 Unit 4). Den:

1. henter boards fra BEGGE datakilder — `data/projects/*/*.json` (prototyper) og
   Supabase-products med `product_type=report` (kunde-boards),
2. injiserer board-dataen den lette readiness-sjekken trenger (`editorial`-tilstedeværelse
   + `highlight-poi`),
3. kaller den rene, I/O-frie kjernefunksjonen
   `validateReportTier(...): ReportTierFinding[]` (`lib/validation/report-tier.ts` —
   funn er DATA, ingen throws; PRD 2 §5.3),
4. oversetter funn til tabell + exit-koder: **exit 1 ved errors (under-levert nivå),
   exit 0 ved kun warnings/grønt**.

**Operatøren kjører DRIVEREN, aldri den rene funksjonen direkte** — driveren eier
I/O-en og exit-kode-kontrakten som gjør porten skriptbar (CI, pre-commit, runbooks).

Utveier ved avvik (fra driverens egen doc): fullfør manglene, ELLER re-deklarer ned
(`reportTier` via read-modify-write). Ingen waiver-liste finnes — porten kan ikke
skrus av per prosjekt.

### Referanse-kjøring (2026-07-05)

```
46 prosjekter validert (2 lokale, 44 supabase). 0 under-levert.  → exit 0
```

16 boards deklarerte nivå 2 (bl.a. `saxe-viks-veg-33`, `asbjornsens-gate-41`,
`ranheimsvegen-13a`, `beddingen-14`, lokal `byggetrinn-4`) — alle ✓ OK.

---

## Port 2 — Ingen render-gating (invariant, grep-verifisert)

Validatoren sjekker **TILSTEDEVÆRELSE** (deklarasjon + validering, PRD 2) — den er
ALDRI en runtime-render-bryter (patch #4). Ingen unit i PRD 15 (eller noe annet sted i
overflaten) skal introdusere `if (reportTier)` i render-kode.

**Verifikasjon (kjørt 2026-07-05):**

```bash
grep -rn "if (reportTier\|if(reportTier" components/ app/ lib/ \
  --include="*.tsx" --include="*.ts" | grep -v test
# → 0 treff
```

Eneste `reportTier`-omtaler i board-katalogen er doc-kommentaren i
`use-board-marker-set.ts:51-52` som EKSPLISITT sier «Data-drevet (VO-innhold finnes),
IKKE tier-gating (PRD 6 §9 Beslutning #5). Speiler pickPlayableAudio-seleksjonen, ikke
reportTier» — invarianten er altså dokumentert i koden selv, ikke bare her.

---

## Port 3 — Nettleser-verifikasjon: output FUNGERER, ikke bare «ser riktig ut»

Kjøres i **nystartet Chrome** med eget user-data-dir (memory
`project_3d_default_map_engine` — WebGL-context-tilstand fra gamle faner kan maskere
eller fabrikkere feil):

```bash
PORT=3010 npm run dev   # (eller port som er ledig — sjekk lsof først)
open -na "Google Chrome" --args --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-nivaa2-verify --no-first-run --no-default-browser-check
# chrome-devtools MCP kobler seg på :9222
```

Naviger til det kurerte boardet
(`/eiendom/<kunde>/<prosjekt>/rapport-reels`) og verifiser ALLE fire:

| # | Sjekk | Hvordan |
|---|---|---|
| 1 | **Kuratert editorial vises** | Åpne en kategori — den kuraterte teksten (ikke placeholder) skal stå der |
| 2 | **Branding vises** | Prosjekt-logo/hero fra `project-brand`-fyllingen synlig i velkomst + sidebar |
| 3 | **Reels-audio spiller fra OVERRIDE-fila** | Start opplevelsen; sjekk `document.querySelector("audio").currentSrc` — temaer med `reelsAudio` skal spille `…-reels.mp3`, ALDRI tour-fila |
| 4 | **Karaoke er korrekt synket** | Ord-highlighting følger avspillingsposisjonen (leste ord lyser, uleste er dimmet) |

**Override-disiplinen (memory `reference_reels_audio_override`):** sjekk 3 beviser at
override-AKSEN er i effekt — og at tour-karaoken er UBERØRT bekreftes ved at begge
filsett ligger side ved side (`tema.mp3` + `tema-reels.mp3`) og at spor UTEN override
faller tilbake til base-fila. Fallbacken er korrekt oppførsel, ikke en feil.

### Referanse-verifikasjon (2026-07-05, byggetrinn-4 = nivå 2)

Kjørt mot `http://localhost:3010/eiendom/grilstad-marina/byggetrinn-4/rapport-reels`
i nystartet Chrome (`/tmp/chrome-r157-verify`):

1. **Editorial ✓** — Nabolaget-kategorien viser kuratert tekst: «Her bor du med sjøen
   på alle kanter, en badestrand med dansk sand, og en marina med plass til over fem
   hundre båter.» (spesifikk, presens, kontraster — passerer kvalitets-porten i
   runbook-seksjon 1).
2. **Branding ✓** — `illustrations/byggetrinn-4-logo.svg` rendret i velkomst-overlay,
   prosjektnavn + strøk i sidebar.
3. **Override-fila ✓** — `audio.currentSrc = /audio/byggetrinn-4/marina-batliv-reels.mp3`
   under avspilling (`-reels`-suffiks = override-aksen). Nabolaget (uten
   `reelsAudio`-entry) spilte base-fila `hjem.mp3` — korrekt fallback. Tour-filene
   (`marina-batliv.mp3` osv.) urørt på disk.
4. **Karaoke ✓** — ved posisjon 12.7/13.7 s lyste «Herfra padler du rundt båthavna
   eller rett» (opacity 1) mens «ut i fjorden.» var dimmet (opacity 0.4) — highlighting
   følger avspillingen midt i setningen.

Konsoll: ingen funksjonelle feil (kun `favicon.ico` 404 — sporet i bead
`placy-ralph-rik` — + en aria-hidden-advarsel fra velkomst-overlayet og en
next/image `sizes`-advarsel). Screenshot-bevis:
`docs/rebuild/assets/r15-7-nivaa2-board-verify.png`.

---

## Retnings-agnostisk (invariant)

Verifikasjonen er identisk uansett segment: samme validator-kommando, samme
grep, samme fire nettleser-sjekker for et bruktmegler-prosjekt
(`asbjornsens-gate-41`) som for et utbygger-prosjekt (`byggetrinn-4`). Kun INNHOLDET
varierer. Segment-retningen er omstridt (memory `project_markus_bruktmegler_spor`) —
denne runbooken tar ikke stilling og trenger ikke endres når retningen lander.

---

## Full-dekning-rapportering (påkrevd, aldri sampling)

Etter verifikasjon rapporterer operatøren fullstendighet **per kurerings-akse** —
CLAUDE.md kvalitetsstandard punkt 4 («X av Y gjennomgått», aldri bare «Z endret»):

| Akse | Rapportform |
|---|---|
| Area-editorial (runbook §2) | X av Y strøk-felter kurert |
| Grounding-QA/manus (§3) | X av Y temaer QA-et + kurert |
| Overflate-fylling (§4) | Z av N asset-felter fylt (logo, hero, broker, pins) |
| Reels/audio-regi (§5) | X av Y temaer med bygget + verifisert reels-spor |

Eksempel (byggetrinn-4, referanse-kjøringen): 7 av 7 temaer med editorial, 7 av 7
temaer med reels-override, logo + hero + megler-kort fylt (megler = placeholder,
bevisst), validator ✓, nettleser-verifikasjon ✓ 4 av 4 sjekker.

Sampling («jeg sjekket de tre første temaene») er IKKE en gyldig rapport — de
vanskelige tilfellene ligger i halen, og operatøren vet ikke hvilke som er vanskelige
før alle er sjekket.
