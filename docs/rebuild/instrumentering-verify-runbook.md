# Instrumentering — verifikasjons-runbook (PRD 13)

**Eier:** PRD 13 · **Bead:** `placy-ralph-xqb` (leverer r13.3s manglende artefakter)
**Opprettet:** 2026-07-06 · **Referanse-kjøring:** samme dato, alle sjekker grønne

Dette er den kjørbare verifikasjonen av instrumenterings-kjeden mot PROD
`v2.events` — en kontrollert én-rads rund-tur (samme mønster som
r01.7-verifikasjonen), IKKE en masse-operasjon.

## Kjøring

```bash
set -a; source .env.local; set +a; npx tsx scripts/verify-log-event.ts
```

(env MÅ eksporteres — uten `set -a` fail-softer logEvent stille; kjent
tsx-mot-prod-gotcha.)

## Hva scriptet beviser

| # | Sjekk | Bevis |
|---|---|---|
| 1 | Nøyaktig ÉN rad skrevet | select på unik `payload->>verify_run` |
| 2 | `event_type` korrekt | board_viewed gjennom DB-CHECK-en |
| 3 | `project_id` båret gjennom | verdien fra input står i raden |
| 4 | Klient-sessionId brukt VERBATIM | `isSessionIdShape`-stien — UUID v4 fra kalleren gjenbrukes, ikke erstattet av server-id |
| 5 | Test-merking | `payload.test=true` + unik `verify_run` — test-rader er alltid identifiserbare og skilles fra ekte engasjement |
| 6 | Kontekst-konvolutt komplett | `payload.context` = `{mode, has_3d_addon, categories_presented, locale}` (irreversibilitets-kravet fra PRD 13: events uten kontekst er tapt for alltid) |
| 7 | Egen rad slettet id-basert | delete `.eq("id", <egen id>)` — aldri bredere |
| 8 | Netto uendret | count før == count etter |

Exit 0 = alle grønne; exit 1 = minst én rød (detaljer i output).

## Referanse-kjøring (2026-07-06)

```
Baseline: 100 rader i v2.events
✓ alle 8 sjekker — ALLE SJEKKER GRØNNE
```

Merk: baseline var 19 rader ved Fable-auditen 2026-07-05 — veksten til 100 er
EKTE engasjement fra emit-sitene som gikk live samme dag (Moat 2 samler data).
De 19 pre-fiks-radene (payload uten `context`) er fortsatt Andreas-gated
(DECISIONS-QUEUE #1) og røres ikke av dette scriptet.

## Arkitekturen som verifiseres (post-audit-fiks a7737b3)

```
Board-mount (ReportReelsPage)
  └── useEngagementEmitter({projectId, envelope})   lib/instrumentation/engagement-scope.tsx
        · ÉN klient-generert session-UUID per mount (useRef — overlever envelope-endringer)
        · envelope = {mode, has_3d_addon, categories_presented, locale}
        └── EngagementProvider → useEngagement().emit(type, extras) på de 4 emit-sitene
              (board_viewed / category_opened / voiceover_played / poi_clicked)
              └── void logEvent({..., sessionId, payload: {...extras, context: envelope}})
                    .catch(() => {})                lib/instrumentation/log-event.ts
                    · fail-soft: velter ALDRI render
                    · isSessionIdShape: ugyldig klient-id → fersk server-id
                    · service-role INSERT → v2.events (anon har INGEN les/skriv — RLS)
```

Emit-site-detaljer: `docs/rebuild/instrumentering-emit-sites.md` (revidert
2026-07-05). Anonymitets-kontrakt: ingen PII i noen kolonne; session-id er
opak UUID per board-økt, aldri persistert på tvers av økter.

## Når kjøres den

- Etter endringer i `lib/instrumentation/**` (kjeden logEvent/engagement-scope)
- Etter RLS-/skjema-endringer på `v2.events`
- Som del av cutover-verifikasjon (r01.3)
