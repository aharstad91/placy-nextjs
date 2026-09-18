# Leangenbukta lokal demo — baseline (U1)

Dato: 2026-09-18. Plan: `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md`.

## Arbeidsgrunnlag

| | |
|---|---|
| Baseline-commit | `fc83a56` på `main` (`fix(nyhavna): logomerket i prosjektpinnen i riktig blå`) |
| Arbeidsgren | `feat/leangenbukta-board` i worktree `../placy-leangenbukta`, basert på `fc83a56` |
| Andre aktive grener | `feat/nyhavna-mobil-paritet` (`../placy-nyhavna-mobil`, `3052daa`) og `feat/voice-infrastructure` (`../placy-voice-infrastructure`, `ed2328a`). **Ikke merget inn.** Implementasjonen bygger på `main` alene. |
| Nettsidekopi | Var ucommittet i hovedrepo. Kopiert uendret inn i arbeidsgrenen og committet som `7b8f20b` (`app/demo/leangenbukta-nettside/`, `public/demo/leangenbukta-nettside/`, `scripts/demo/`, `docs/demos/leangenbukta-nettside.md`, begge Leangenbukta-planene). |
| Ikke tatt med | `PROJECT-LOG.md`- og `docs/strategy/`-endringer i hovedrepo (andres arbeid i gang). |
| Opus-research | Ikke lokalisert ved oppstart. Ingen rapportsti er registrert; U5–U6 venter. |

## Testutfall på baseline

`npx vitest run` i arbeidsgrenen før noen kodeendring: **274 testfiler, 4 384 tester, alle grønne.** Ingen kjente feil å skille fra nye.

## Kartlegging: hva som er Nyhavna-spesifikt i den lokale demo-kjeden

### Delt kode som importerer `lib/demo/nyhavna-lokal/` (skal peke på den felles kjernen etter U2)

| Fil | Importerer |
|---|---|
| `components/variants/report/board/board-state.tsx` | `reserve` (`visibleReserveBoard`) |
| `components/variants/report/board/BoardMap.tsx`, `BoardMap3D.tsx` | `radius` (`discoveryGeometry`) |
| `components/variants/report/board/board-data.ts` | typen `RadiusPlace` fra `radius` |
| `components/variants/report/board/voice/board-voice.tsx` | `reveal-transition`, `radius`, `voice-instructions` (`LOCAL_VOICE_PACING`), `use-narration-focus`, `use-faq-progress` |
| `lib/live/demos.ts` | `board`, `dataset`, `voice`, `presentation`, `voice-instructions` |
| `lib/live/route.test.ts` | `voice-instructions` |
| `app/demo/nyhavna-lokal/page.tsx` | `dataset`, `board` |

### Eksakte slug-/ID-sjekker som i dag skrur på felles lokal funksjonalitet

| Sted | Sjekk | Funksjon som styres |
|---|---|---|
| `board-voice.tsx:118` | `data.demoDataset === "nyhavna-lokal"` | FAQ-fremdrift, `reveal_places`, `followHighlightCategory`, tempo-tillegg til hilsen, `revealed_place_ids` i kontekst, narration-fokus |
| `use-viewport-category-list.ts:56` | `data?.demoDataset === "nyhavna-lokal"` | Slår av viewport-scoping av kategorilista |
| `lib/live/use-live.ts:535` | `dataset === "nyhavna-lokal"` | Tillater kartkommandoen `reveal_places` |
| `lib/live/use-live.ts:251` | feiltekst «Åpne Nyhavna-demoen …» | Manglende snapshotId |
| `ReportReelsPage.tsx:705,708` | `boardData.projectSlug !== "nyhavna"` | Splash/intro hoppes over for det frosne Nyhavna-boardet (ikke for `nyhavna-lokal`) |
| `lib/live/demos.ts` | `LIVE_DATASETS = ["nyhavna-leve", LOCAL_DATASET_ID]`, `loadLiveDemo` velger med ternary | Registeret; faller til `leveDemo()` for alt som ikke er lokal-ID |
| `lib/demo/nyhavna-lokal/radius.ts` | `DISCOVERY_CATEGORIES = ['trening-aktivitet','natur-friluftsliv']` | Hvilke kategorier som får radius-utvidelse. Hardkodet kategori-ID. `discoveryGeometry` navngir ringen «N km fra Nyhavna». |
| `lib/demo/nyhavna-lokal/presentation.ts:65,99,138` | «å gå fra Nyhavna», `categoryId === "nyhavna-bydel"` | Avstandsordlyd og delområde-invitasjon |
| `lib/demo/nyhavna-lokal/voice.ts` | `LOCAL_DEMO_INSTRUCTION`, `buildLocalInstructions` | Prosjektnavn, «nyhavna-bydel», Transittkaia, delområder, «fra Nyhavna», referansepunkt-setning |
| `lib/demo/nyhavna-lokal/voice-instructions.ts` | `LOCAL_VOICE_INSTRUCTIONS` | «Du heter Anja … presenterer Nyhavna», delområde-regler |
| `lib/demo/nyhavna-lokal/dataset.ts` | `LOCAL_DATASET_DIR`, `LOCAL_DATASET_ID`, feiltekster med `docs/research/nyhavna-lokal-demo/README.md` | Én fast mappe og én fast ID |
| `lib/demo/nyhavna-lokal/board.ts` | `datasetId()` prefikser hash med `LOCAL_DATASET_ID`; `demoDataset: LOCAL_DATASET_ID`; `customer: "demo"` | Hash og datasett-ID |
| `lib/realtime/nyhavna-conversation.ts:63,228,231` | Verktøytekst «Søk i Nyhavna Utviklings eget innhold (nyhavna.no)», temaet `"nyhavna"` i søk, tomt-svar-note «Nyhavnas eget innhold» | Verktøybeskrivelse og standardsvar |
| `lib/realtime/nyhavna-greeting.ts` | `NYHAVNA_GREETING_INSTRUCTION` | Fallback-hilsen når `demoGreeting` mangler |
| `lib/live/voice-instructions.ts` | `NYHAVNA_VOICE_INSTRUCTIONS` | Fallback stemme-instruks når demoen ikke har egen |
| `app/demo/nyhavna-lokal/lokal-board-gate.tsx` | Fiktiv megler «Kari Hansen» + `brand: true` | Skal IKKE kopieres til Leangenbukta |
| `app/demo/nyhavna-lokal/layout.tsx` | Unbounded-font, `nyhavna-brand.css`, Nyhavna-favicon | Merkevare |
| `lib/live/supervisor.ts:13`, `sideband.ts:109` | `.context/nyhavna-live-session.json`, `nyhavna-live.log` | Filnavn på lokal tilstand/logg. Delt av alle demoer; beholdes (ikke innholdsbærende). |

### Live-grenser som skal bevares

- `app/api/prototype/live/route.ts`: `localRequest` → 404 utenfor localhost; ukjent `dataset` → 400 «Ukjent datasett.»; lastefeil → 503; `snapshotId`-avvik → 409 «Datagrunnlaget er oppdatert. Last boardet på nytt.»; én aktiv sesjon (`supervisor.reserve` → 429).
- `app/demo/nyhavna-lokal/page.tsx`: `notFound()` i produksjon; `force-dynamic`.
- `conversations.json` lastes bare av `loadConversations`; `loadDataset` og `voice.ts` rører den ikke.

## Eksisterende tester som karakteriserer atferden som skal bevares

`lib/demo/nyhavna-lokal/{dataset,board,voice,presentation,reserve,reveal-transition,shopping-centres,bo-content}.test.ts`, `use-faq-progress.test.tsx`, `use-narration-focus.test.tsx`, `lib/live/route.test.ts` (grenser, hash-avvik, datasettvalg), `lib/live/use-live.test.tsx`, `components/variants/report/board/voice/BoardVoiceControl.test.tsx`, `components/variants/report/board/neighbourhood/use-viewport-category-list.test.tsx`, `lib/realtime/nyhavna-conversation.test.ts`.

Testscenariene i U1 (Nyhavna laster med egne kategorier/manus/hilsen; FAQ/presentasjon/utvidelse når klienten med datasetthash; produksjonsbegrensning og 409 ved hashavvik) dekkes av disse i dag. Ingen ny karakterisering lagt til i U1; U2 må holde dem grønne og legge kryss-datasett-dekning i `lib/demo/local-board/*.test.ts`.

## Merknad om planens metadata

Plandokumentet mangler `artifact_readiness: implementation-ready` i frontmatter, men har full Planning Contract og åtte implementasjonsenheter. Behandlet som implementation-ready etter eksplisitt `/ce-work`-bestilling.
