# Rebuild — Decisions Queue

Beads som krever et EKTE produkt-/scope-/sekvenserings-valg (ikke en teknisk
avstemming utledbar fra PRD/kode) eller en xhigh-prod-kjøring. Den autonome
build-loopen køer dem her i stedet for å gjette, og velger en annen byggbar bead.

Format: `## <bead-id> — <kort tittel>` + kontekst + det åpne spørsmålet +
hvorfor loopen ikke kan avgjøre det selv.

---

## placy-ralph-r06.8 — Verifikasjon (nystartet Chrome) av 3D-motor: sekvensering + miljø

> **✅ LØST 2026-06-30 — r06.8 BYGD + LUKKET autonomt (commit `ede7e63`).** Begge de
> "koblede valgene" viste seg empirisk å ikke kreve Andreas-input:
> **(1) Sekvensering/chicken-and-egg = ikke-eksisterende.** Den EKSISTERENDE board-ruten
> `app/eiendom/[customer]/[project]/rapport-board/page.tsx` serverer ALLEREDE v2-motoren
> (motoren er verbatim-port ⇒ behaviorelt identisk) — verifisert mot `bane-nor-eiendom/
> stasjonskvartalet` (`has_3d_addon=true`), nøyaktig køens egen anbefaling (linje 42-44).
> r06.8→r09-blokken var KORREKT (ikke kunstig): lukking av r06.8 frigjorde r09.1/r09.3 ✓.
> **(2) Human-observasjon = løst via chrome-devtools MCP.** Nystartet Chrome (eget
> user-data-dir + remote-debugging :9222) mot fersk prod-bygg (`npm run build`→`start :3009`)
> ga GENUIN DevTools-observasjon, ikke falsk-lukk: 11 toggle-sykluser med node-identitets-
> sjekk (`gmp-map-3d`-stempel overlevde, count===1), console-skann (INGEN «Too many active
> WebGL contexts»), `?film=1`-pin-telling (0 kategori-pins, projectSite intakt), reveal-
> kaskade-marker-sampling (1→58 barn, ingen crash). Live Google Maps 3D bekreftet
> (`google.maps.maps3d.Map3DElement` definert, kamera orbiterte). Runbook:
> `docs/rebuild/3d-motor-verifikasjon-runbook.md`. **MØNSTER for fremtidige live-verif-beads:**
> chrome-devtools MCP + fersk prod-server + stemplet DOM-node-identitet gjør «nystartet Chrome»-
> verifikasjon kjørbar i autonom loop — ikke lenger en hard human-in-the-loop-blocker.

**Kategori:** ~~sekvenserings-valg + miljø-/human-observasjons-blocker~~ → LØST (se over).

**Kontekst.** r06.1–r06.7 er lukket (motor-porten verifisert mot AC + tester grønne).
r06.8 er Fase-3-verifikasjonen: «Bevis at motoren FUNGERER, ikke bare kompilerer» —
åpne et `has3dAddon`-board i nystartet Chrome, kjør ≥10 sykluser 3D↔2D-toggle +
kategori-nav + intro→outro, og bekreft via DevTools: ingen «Too many active WebGL
contexts», ingen `gmp-map-3d`-unmount, `?film=1` gir pin-løst kart, reveal-kaskade
uten WebGL-churn (full opacity, scale-bounce). PRD 06 §"Fase 3" / §"Utviklingsløp"
markerer autonomi-nivå **Middels**: «Krever live board-flate (`has3dAddon`) + Chrome
DevTools-observasjon — ikke ren mekanikk».

**Det åpne spørsmålet (2 koblede valg):**
1. **Sekvensering / chicken-and-egg.** r06.8 verifiserer mot «et `has3dAddon`-board».
   Men v2-board-skallet (PRD 9, r09.1/r09.3) som MONTERER motoren er i bead-grafen
   *blokkert av* r06.8 — det finnes altså ingen v2-board-rute å åpne ennå. Skal
   r06.8 i stedet verifiseres mot **eksisterende prod-board** (motoren er verbatim-port
   ⇒ behaviorelt identisk), eller skal r06.8 **flyttes til ETTER** at PRD 9 har montert
   et v2-board? Dette endrer dep-grafen og er et sekvenserings-valg, ikke en kode-avstemming.
2. **Human-observasjon.** AC krever visuell dom («markører full opacity», «bounce er
   scale-animasjon», WebGL-context-telling over 10+ sykluser) + et live Google Maps 3D-miljø
   (API-nøkkel + nett). Memory `project_3d_default_map_engine` rammer «nystartet Chrome»
   som et human-in-the-loop-ritual. Headless-loopen kan ikke avgi denne dommen pålitelig
   uten risiko for falsk-lukking av en P1-verifikasjons-bead.

**Hvorfor loopen ikke avgjør selv.** Begge ledd krever input loopen ikke har: (1) en
graf-/sekvenserings-beslutning som Andreas eier, og (2) en human-attendert fresh-Chrome-
sesjon mot et kjørende board. Bygges derfor IKKE autonomt; venter på avklaring/sesjon.

**Anbefaling (til avgjørelse).** Behold r06.8 som ekte port-with-verify, men kjør den i
en human-attendert sesjon mot eksisterende prod-board (verbatim-port ⇒ samme motor-atferd),
og fjern den kunstige r06.8→r09-blokkeringen slik at PRD 9-skallet kan porteres parallelt.
Ikke ratifisert — Andreas avgjør.

---

## OBS (funnet under r07.7 AC2-verifikasjon) — legacy `app/api/eiendom/tekst` runtime-LLM-rute

> **✅ LØST 2026-07-06 — Andreas valgte (a) slett.** Empirisk grunnlag: siden
> `/eiendom/tekst` var ulinket (`eiendomTekstUrl()` hadde null callers), modellen
> (family/young/senior) er død, og Gemini+Fable build-time-kuratering superseder.
> Slettet: API-ruten, TekstGeneratorForm, siden, urls-helperen — og
> `@anthropic-ai/sdk`-avhengigheten (ruten var eneste konsument). Runtime-LLM-
> unntaket i ESLint er dermed borte; `no-restricted-imports`-regelen står igjen
> uten unntak.

**Kategori:** scope-/produkt-valg (fjern vs. port en eksisterende feature-rute) — IKKE en r07.7-blocker.

**Kontekst.** r07.7 (kuraterings-orkestratoren) er bygget og verifisert: curate-narrative.ts
bruker build-time skill-dans, importerer IKKE `@anthropic-ai/sdk`, og har ingen runtime-LLM-
kall (AC2 holder for curation-flyten). MEN under AC2-sveipet («ingen Anthropic-runtime-kall
fra `app/`») dukket det opp ÉN pre-eksisterende runtime-LLM-rute som IKKE er en del av PRD 7:
`app/api/eiendom/tekst/route.ts` (`import Anthropic from "@anthropic-ai/sdk"` →
`anthropic.messages.create(...)` ved request-tid). Den genererer eiendoms-selvbetjent
nabolagstekst og er bygget på den DØDE `targetAudience: family|young|senior`-modellen
(jf. memory `project_report_tier_model` + r03.8-kommentaren «family/young/senior-modellen død»).

**Det åpne spørsmålet.** Ruten bryter den globale CLAUDE.md-regelen «ALDRI runtime LLM-kall —
build-time only» OG hviler på en utfaset datamodell. Skal den (a) **slettes** (kodebase-hygiene,
hvis eiendom-selvbetjent-tekst er erstattet av Gemini+Fable build-time-kuratering per Beslutning
13 / `project_editorial_gemini_fable`), eller (b) **portes/beholdes** fordi en live eiendoms-
flate fortsatt kaller den?

**Hvorfor loopen ikke avgjør selv.** Å slette en feature-rute er et destruktivt scope-valg
(mulig live forbruker) som ligger UTENFOR PRD 7. Det er ingen PRD/kode-avstemming loopen kan
utlede — det krever at Andreas vet om eiendoms-selvbetjent-tekst fortsatt er i bruk eller er
superseded. Flagges her; r07.7 ble IKKE blokkert på den (curation-AC2 er oppfylt på egne premisser).

---

## AUDIT 2026-07-05 — fire beslutninger Andreas eier (fra Fable-full-audit av build-loopen)

Full audit-kontekst: PROJECT-LOG.md-entry 2026-07-05. Kode-fiksene (P0-instrumentering,
Google-key-header-port, proxy-timeouts, secret-maskering) er ALLEREDE utført autonomt —
punktene under er de gjenværende valgene som krever eier-dom.

### 1. Wipe de 19 pre-fiks-eventene i v2.events (destruktiv prod-handling)

> **✅ LØST 2026-07-06 — Andreas godkjente wipe.** Kontrollert kjøring: count-verifisert
> 19 rader FØR (`payload IS NULL OR NOT payload ? 'context'`), DELETE returnerte
> nøyaktig 19, total 100→81, 0 pre-fiks-rader igjen. De 81 ekte engasjement-radene urørt.

**Kontekst.** Alle 19 rader i v2.events er test-/verifikasjonsartefakter fra r13.3,
logget FØR audit-fiksen: uten kontekst-konvolutt, 14 av dem uten project_id, alle med
unik session_id. De er ubrukelige som moat-data og forurenser fremtidig aggregering
(ingen `payload.context`-nøkkel å filtrere på er i seg selv filteret — men eksplisitt
wipe er renere). **Anbefaling:** slett alle rader eldre enn audit-fiks-deploy
(`DELETE FROM v2.events WHERE payload IS NULL OR NOT payload ? 'context'`) — men
DELETE i prod er Andreas-gated per regel.

### 2. Rate-limit/vern på de åpne transport-proxyene (infra-valg)

> **✅ LØST (autonomt, sesjon 2026-07-05) — anbefalingen ble fulgt:** per-IP-rate-limit
> (`lib/utils/rate-limit.ts`) er wired på `directions` + `travel-times` (de som koster penger).

**Kontekst.** De seks proxyene (entur/bysykkel/hyre/mobility/directions/travel-times) er
uautentiserte og uten rate-limit — hvem som helst kan bruke Placys Mapbox-kvote (Directions/
Matrix koster per kall). Timeout er fikset (8s); rate-limit krever et infra-valg (per-IP
in-memory à la eiendom/tekst-ruten, Vercel Firewall, eller Upstash). Prototype-volum gjør
dette tolerabelt NÅ, men det bør inn før salgs-trafikk. **Anbefaling:** gjenbruk
rate-limit-mønsteret fra `app/api/eiendom/tekst/route.ts` på directions + travel-times
(de som koster penger) som minste inngrep.

### 3. PRD 12 admin-auth før salg (sekvensering)

> **✅ LØST (sesjon 2026-07-05→06) — hele r12-epicen bygd (7/7 + 9ao):** delt
> `requireAdmin()`/`requireAdminApi()` på alle keeper-flater, noindex, død admin slettet,
> admin på v2 ende-til-ende.

**Kontekst.** PRD 12 er IKKE bygget (alle r12-beads åpne). Dagens admin-vern er kun
`ADMIN_ENABLED`-env — ingen per-bruker-auth, ingen noindex på admin-sider. Bevisst
MVP-valg i PRD-en, men «produksjonsmiljø vi selger på» endrer risikobildet.
**Spørsmål:** skal r12.1/r12.2 (requireAdmin + middleware-gate) prioriteres opp
i frontieren (foran r15-epicen)?

### 4. Test-beviskraft-uplift + ESLint-håndheving (kvalitetsinvestering)

> **✅ LØST (sesjon 2026-07-05→06):** (a) bead whp — PATCH-invariantene løftet til
> eksekverings-tester (`lib/pipeline/patch-product-config.test.ts`, call-order bevist);
> (b) bead 03t — ESLint `no-restricted-imports` for LLM-SDK-er i `app/` + `no-img-element`
> globalt.

**Kontekst.** Test-auditen fant at flere «AC-kontrakt-guards» er kildetekst-regex
(curate-narrative/audio-tour-build/flythrough-wiring) — anti-sletting-tripwires, ikke
atferdsbevis. Og kun 1 av 8 CLAUDE.md-kjerneregler håndheves maskinelt (det er slik
runtime-LLM-ruten og key-i-URL overlevde). **Forslag:** (a) løft de 3–4 bærende
invariantene (0-rad-abort, revalidate-rekkefølge, intro/outro-wiring) til
eksekverings-tester, (b) legg ESLint no-restricted-imports for `@anthropic-ai/sdk` i
`app/`-runtime + utvid key-i-URL-kontraktstesten (delvis gjort — skanner nå
lib/pipeline). Kan kjøres som egen bead-klynge; sett prioritet.
