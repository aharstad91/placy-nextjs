# POI-tier-skrivekontrakt + tier-klassifiserings-eierskap

> **Status:** Normativ. Forankrer skrivekontrakten i `@/lib/supabase/mutations.ts`
> (`updatePOITier` + `updatePOITrustScore`) og avklarer hvor tier-KLASSIFISERINGEN
> lever. PRD 4 (prd-trust-google-places) Unit 6. Lest av PRD 5 (board-data).

## 1. To distinkte akser — ALDRI konflater

Det finnes to uavhengige «tier»-begreper i Placy. De deler ord, men ikke verdimengde,
eier eller formål:

| Akse | Felt | Verdimengde | Eier | Formål |
|------|------|-------------|------|--------|
| **POI-klassifisering** | `pois.poi_tier` | `{1, 2, 3}` | build-time skill (denne kontrakten) | Rangerer enkelt-POIer (chain / local-gem / vanlig) for board-sortering/-filtrering |
| **Board-nivå** | `products.config.reportConfig.reportTier` | `{1, 2}` | PRD 2 (to-nivå-modell) | nivå 1 = autonom default, nivå 2 = kuratert redaksjonell |

`poi_tier`-rangen `{1,2,3}` er **uendret** av to-nivå-forenklingen i PRD 2. De skal
aldri mappes til hverandre, valideres mot hverandre, eller deles type. `updatePOITier`
validerer `poi_tier ∈ {1,2,3}`; board-`reportTier` valideres separat av
`ReportTierSchema` (`z.union([z.literal(1), z.literal(2)])`).

## 2. Skrivekontrakt — `updatePOITrustScore`

`updatePOITrustScore(poiId, trustScore, trustFlags)`:

- Validerer `trustScore ∈ [0, 1]` — kaster før noe DB-kall ved brudd.
- Validerer **hver** flag mot `VALID_TRUST_FLAGS` (avledet fra `ALL_TRUST_FLAGS`,
  single source of truth i `poi-trust.ts`) — kaster på ukjent flag.
- Setter `trust_score`, `trust_flags`, `trust_score_updated_at`.
- **Eksplisitt error-håndtering:** kaster med tydelig melding ved DB-feil. Ingen
  stille swallow.

## 3. Skrivekontrakt — `updatePOITier`

`updatePOITier(poiId, { poi_tier, tier_reason, is_chain, is_local_gem, poi_metadata, editorial_hook?, local_insight?, editorial_sources? })`:

- Validerer `poi_tier ∈ {1,2,3}` — kaster før DB-kall ved brudd.
- Skriver alltid: `poi_tier`, `tier_reason`, `is_chain`, `is_local_gem`,
  `poi_metadata`, `tier_evaluated_at`.
- **Editorial-overwrite-vern:** skriver `editorial_hook` / `local_insight` /
  `editorial_sources` KUN når eksisterende DB-verdi er `null` (streng null-sjekk —
  bevarer også tom streng). Tier-reklassifisering skal aldri klobbe hand-crafted
  kuratert innhold.
- **Existing-select error-sjekk (port-with-rewrite, PRD 4 Unit 6 AC2):** den
  innledende `SELECT editorial_hook, local_insight, editorial_sources`-spørringen
  sjekker `error` og kaster ved feil. Uten denne sjekken ville en select-feil gitt
  `existing === undefined`, `existing?.editorial_hook === null` ville blitt `false`,
  og editorial-vernet ville blitt hoppet over STILLE (i strid med «ingen stille
  swallow»). Dette er en bevisst kvalitetsforbedring av en eksisterende stille bug,
  ikke en 1:1-port.
- Kaster med tydelig melding ved DB-feil på selve update-en.

Kontrakt-testet i `lib/supabase/mutations.test.ts`.

## 4. Hvor lever tier-KLASSIFISERINGEN? (§11 Q3 — LØST)

**Dom: klassifiseringslogikken forblir skill-eid og build-time.** PRD 4 eier kun
SKRIVEKONTRAKTEN (§2–3), ikke logikken som bestemmer `poi_tier`/flags.

- **Layer 1+2** (deterministisk heuristikk) kjøres via admin-API-et
  (`enrichTrustSignals` + `calculateHeuristicTrust`) — ren, I/O-fri scoring, ingen LLM.
- **Layer 3** (chain-deteksjon, local-gem-vurdering, websøk-flagg som
  `found_on_tripadvisor` / `not_found_online`) kjøres av `/validate-poi-trust`-skillet
  (`.claude/commands/validate-poi-trust.md`) **build-time, ALDRI runtime** — i tråd med
  CLAUDE.md-regelen «ingen runtime-LLM-kall». Skillet bruker `WebSearch`-toolet per POI
  og persisterer via admin-update-endepunktet (som merger nye flags med Layer 1+2).
- **Q3-avklaring:** Ingen portbar `lib/poi-tier-classifier.ts` finnes i repoet
  (verifisert: ingen `updatePOITier`-kaller i `lib/`). En eventuell flytt av
  klassifiseringslogikken til en portbar `lib/`-modul er **deferred til egen
  avklaringstask** (PRD 4 §10). Default landet her: **forblir skill-eid build-time.**
  Dette notatet oppdateres hvis dommen endres.

## 5. Felt-konsum — for PRD 5 (board-data) (AC4)

Board-data-laget LESER følgende felt skrevet av denne kontrakten + seed/manuell-feltet
`facebook_url`. Skrivere her må holde feltene konsistente med leserne nedenfor:

| Felt | Skriver | Leser (PRD 5) |
|------|---------|---------------|
| `poi_tier` | `updatePOITier` (skill) | `public-queries.ts:265` (`poiTier`), + sortering `ORDER BY poi_tier` (290/408/446), nivå-1-filter `.eq("poi_tier", 1)` (351), eksplisitt tier-filter (394) |
| `tier_reason` | `updatePOITier` | `public-queries.ts:266` (`tierReason`) |
| `is_chain` | `updatePOITier` | `public-queries.ts:267` (`isChain`) |
| `is_local_gem` | `updatePOITier` | `public-queries.ts:268` (`isLocalGem`) |
| `editorial_hook` / `local_insight` / `editorial_sources` | `updatePOITier` (kun ved null) + GROUNDING (PRD 7) | board-rendring (PRD 9) |
| `facebook_url` | **manuelt/seed** (migration 033) + passthrough — **ALDRI enrichment** | `public-queries.ts:272` + `queries.ts:104` (`facebookUrl`), board + JSON-LD |

**`facebook_url` populeres ALDRI av enrichment** (PRD 4 Unit 2 AC5, dokumentert i
`trust-enrichment.ts`-headeren). Det er et manuelt/seed-felt + passthrough-mappinger
som kun videresender eksisterende verdi. Board + JSON-LD leser det; ingen
automatisk skriver fyller det.
