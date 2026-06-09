---
date: 2026-06-09
topic: kulturnatt-port-ny-arkitektur
---

# Kulturnatt-port til ny rapport-board-arkitektur (to varianter for sammenligning)

## Problem Frame

Kulturnatt 2025-prototypen (`/eiendom/kulturnatt-trondheim/kulturnatt-2025`) er bygget på den **gamle** Placy-arkitekturen: en ren Explorer med Kompass-onboarding (tema → dag → tid), 131 events importert fra trdevents.no som individuelle POI-er i Supabase, og "Min samling" (lagre events → personlig delbar URL). Ingen 3D, ingen sidebar, ingen live transport.

Siden den gang er Placy bygget om. Den nye **rapport-board-arkitekturen** (`/eiendom/.../rapport-board`) har venstre `DesktopStorySidebar`, persistent 3D + 2D-overlay-kart, kuraterte kategorier med redaksjonell drill-in, og **live transport i highlight-rader**. Men den er **ikke event-bevisst** — `BoardData`/`BoardCategory` har ingen tids-/dato-dimensjon, og sidebaren har ingen dag/tid-filtrering.

Midtbyen Management (Nanna Berntsen, Sissel Piene) kjenner bare den gamle versjonen. Målet er å løfte Kulturnatt inn i den nye, klart bedre arkitekturen — som grunnlag for et **Kulturnatt 2026-pilotløp med Midtbyen Management**.

Den åpne produktusikkerheten: en festival er grunnleggende et *"hva skjer, når, hvor"*-browse-problem. Vinner den filter-drevne Explorer-modellen, eller en hybrid med egen program-/tidslinje-inngang? Vi vet ikke — så vi bygger begge og bedømmer dem live.

## Requirements

**Felles fundament (begge varianter)**
- R1. Kulturnatt 2025-opplevelsen skal kjøre på den nye rapport-board-arkitekturen, på samme URL-mønster (`/eiendom/kulturnatt-trondheim/kulturnatt-2025`), med det nye sidebar-skallet og 3D/2D-kartet.
- R2. Board-modellen skal gjøres **event-bevisst**: dato + start/slutt-tid skal bæres helt fram til sidebar og kart. Event-feltene finnes på POI-nivå (`event_dates`, `event_time_start`, `event_time_end`) men er i dag ikke integrert i `BoardData`/`BoardCategory`.
- R3. Festival-filtrering på **tema, dag og tid** skal være tilgjengelig. Den faktiske filter-logikken (tema + dag + tid-på-døgn-bøtter + kronologisk sortering) ligger i `lib/hooks/useKompassFilter.ts`; `lib/kompass-store.ts` holder kun valg-state, og `lib/hooks/useEventDayFilter.ts` filtrerer kun på dag. Gjenbruk `useKompassFilter` som primær kilde.
- R4. Kartet skal vise events som markører og reagere på aktivt filter/valgt dag.
- R5. Live transport (Entur/bysykkel) beholdes der highlight-radene allerede støtter det — nyttig festival-kontekst ("kommer jeg meg hjem"), men ikke en visuell headline.
- R6. "Min samling" beholdes: lagre valgte events → personlig delbar URL.
- R7. Begge varianter skal være mobile-first (bottom-sheet-mønster på mobil, sidebar på desktop), i tråd med eksisterende adaptive mønster.

**Delte interaksjonsregler (så A/B-sammenligningen blir rettferdig — defineres i fundamentet, identisk i begge)**
- R12. Tomtilstand + lasting: delt "ingen events matcher"-tekst + nullstill-filter-CTA når filtrert antall = 0; delt skeleton mens data hentes.
- R13. Tid-på-døgn-bøtter som delte konstanter (f.eks. ettermiddag 12–17, kveld 17–22, natt 22+), konsumert av både filter-chips (A) og Program-view-headere (B). Dag-filter: når datasettet har kun én dato (2025 = én kveld), vises dag-kontrollen som read-only dato-label eller skjules — samme regel i begge.
- R14. Events uten klokkeslett ("permanent venue") får egen merket bøtte ("Tidspunkt ikke oppgitt") i Program-view; inkluderes i tid-filter per `useKompassFilter`-adferd.
- R15. Event-drill-in (delt): klikk på event (liste/tidslinje/markør) åpner detalj — sidebar-panel på desktop / utvider bottom-sheet på mobil — med tittel, tid, sted, beskrivelse + "legg i Min samling"-knapp.
- R16. Variant A sortering: `event_time_start` stigende, events uten tid sist (erstatter tvetydig "kronologisk/relevans").
- R17. Mobil: "Min samling" nås via persistent affordance (topp-bar-ikon/FAB); bottom-sheet har definerte peek/halv/full-states med tilhørende kart-synlighet — likt i begge. Variant B: filter virker in-place uansett aktiv `[Kategorier|Program]`-fane; fane-valget nullstilles ikke ved filterendring.

**Variant A — Explorer i nytt skall**
- R8. Sidebarens primærmodell er en **filter-drevet event-liste** (Kompass-DNA i nytt skall): tema/dag/tid-kontroller øverst, kronologisk/relevans-sortert event-liste under, kart-sentrisk interaksjon.

**Variant B — Hybrid / festival-native**
- R9. Sidebaren har en `[Kategorier | Program]`-toggle: **Kategori-view** (board-aktig kategori-inngang à la teknostallen) + **Program-view** (tidslinje sortert på klokkeslett). To innganger til samme data; tidslinjen eier "når"-aksen eksplisitt.

**Sammenligning & leveranse**
- R10. Begge varianter bygges fullverdig, hver i sin git-worktree, branchet fra en felles fundament-branch slik at eneste forskjell er sidebarens navigasjonsmodell.
- R11. Leveranse = begge kjørbare lokalt + screenshots (mobil + desktop) + kort helhetsvurdering (mobil-følelse + demo-verdi for Midtbyen). Andreas velger vinner etterpå.

## Visual Aid — delt fundament, divergens kun i sidebar

```
                 FELLES FUNDAMENT (bygges én gang, base-branch)
   ┌───────────────────────────────────────────────────────────────┐
   │  2025-data i Supabase  →  event-bevisst BoardData  →  3D/2D-kart │
   │  tema/dag/tid-filter   →  live transport (highlight)  →  Min saml.│
   └───────────────────────────────────────────────────────────────┘
                    │                              │
        worktree A  ▼                  worktree B  ▼
   ┌──────────────────────┐      ┌──────────────────────────────────┐
   │ VARIANT A            │      │ VARIANT B                         │
   │ Explorer i nytt skall│      │ Hybrid / festival-native          │
   │                      │      │                                   │
   │ [Tema▾][Dag▾][Tid▾]  │      │ [ Kategorier | Program ]  ← toggle │
   │ ─ event-liste ─      │      │ Program: 15:00 ┬ 🎵 …             │
   │ 🎵 Konsert 17:00     │      │          16:00 ┼ 🖼 …             │
   │ 🎭 Teater  18:30     │      │ Kategori: 🎵 Musikk · 🎭 Teater   │
   └──────────────────────┘      └──────────────────────────────────┘
              \________________  eneste variabel: nav-modell  _______/
```

## Success Criteria
- Begge varianter kjører på den nye arkitekturen med ekte 2025-data, filtrerbart på dag/tid/tema, med events synlige og klikkbare på kartet.
- Det er mulig å sette dem side om side (mobil + desktop) og kjenne på hvilken navigasjonsmodell som føles riktigst for å planlegge en festivalkveld.
- Produktet står på egne ben for Midtbyen Management — ingen Visit Trondheim-spesifikk framing har lekket inn.
- **Avgjør-signaler:** sammenligningen skal gi observasjoner ren resonnering ikke kan — f.eks. tommel-rekkevidde på `[Kategorier|Program]`-toggle, skanne-hastighet tidslinje vs. filtrert liste på mobil, hvor raskt man bygger en kveldsplan i "Min samling".
- **Uavklart-fallback:** hvis side-om-side er uavklart, ship Variant A (Kompass-DNA — lavest risiko, modellen Midtbyen allerede kjenner) som default.
- **Gyldighet:** dommen felles på 2025-data (én kveld). Den dekker tid-på-kvelden-aksen, men ikke fler-dagers program; re-valider valgt variant hvis/når fler-dagers 2026-data kommer.

## Scope Boundaries
- **Vi velger ikke vinner-variant nå.** Begge bygges fullverdig; valget tas etter at de kan ses live.
- Audio-tur / 3D-kamera-narrativ (den rene rapport-board-modellen) er bevisst utelatt — passer dårlig for 131 tidsbundne events.
- Live TRD Events-feed (dynamisk, alltid-på) er ikke en del av dette — vi bruker 2025-snapshotet som allerede er importert.

### Deferred to Separate Tasks
- **Visit Trondheim-sporet** (transport-pitch til Kari, hotell, cruise, Convention Bureau) — eget senere løp, tas opp når Midtbyen-porten står.
- **Live TRD Events-feed** (alltid-på event-plattform) — egen arkitektur-beslutning (strategi-doc P1). NB: gjelder *event-dataen*; live transport-laget (Entur/bysykkel) per R5 er i scope for begge varianter.
- **Innsiktslag** (klikk-/lagring-analytics Midtbyen ønsker) — egen oppgave; ikke del av navigasjonsmodell-sammenligningen.

## Key Decisions
- **Bygg begge → sammenlign live:** Andreas vet ærlig talt ikke hvilken navigasjonsmodell som vinner for en festival. Raskere og sikrere å se begge enn å resonnere seg fram.
- **Felles fundament bygges én gang, worktrees divergerer kun på sidebar:** Variant A og B deler ~80 % (data-port, skall, kart, filter, Min samling). Gir ren sammenligning (eneste variabel = nav-modell) og unngår dobbelt grovarbeid.
- **Midtbyen Management er primærmottaker; VT skilles ut:** Kulturnatt-porten skal stå på egne ben for Midtbyen. VT får eget løp.
- **Gjenbruk 2025-snapshot, ikke live-feed:** prototype-sammenligning, lav risiko, matcher det Midtbyen allerede kjenner.
- **Event-native datasti, ikke report-kuratering:** `transformToReportData`/`getReportThemes` er en *kuraterings*-pipeline (grupperer POI-er i få temaer, dropper temaer <2 POI, ranger + visible/hidden) — feil form for 131 individuelle tidsbundne events. Vi bygger en event-native adapter som mater de samme skall-komponentene (sidebar + `BoardMap`), i stedet for å presse events gjennom report-pipelinen. Holder også "eneste variabel = nav-modell" ærlig: begge varianter konsumerer samme event-data-shape fra fundamentet. *(verifisert mot kode av feasibility/adversarial-review)*
- **Fundament fryses ved split:** fundamentet tagges når worktrees brancher ut; fix-er oppdaget etter divergens back-merges til base og propageres til begge — ellers driver variantene fra hverandre og sammenligningen forurenses.

## Dependencies / Assumptions
- 2025 Kulturnatt-dataen antas fortsatt å ligge i Supabase (importert 2026-03-05 via `scripts/import-kulturnatt.ts`). Bekreftet at import-script + datamodell finnes i repo; **bør verifiseres mot prod-DB i planfasen**.
- Den nye rapport-board-arkitekturen (`components/variants/report/reels/DesktopStorySidebar.tsx`, `components/variants/report/board/BoardMap.tsx`, `components/variants/report/board/board-data.ts`) antas stabil nok å bygge på. Verifiser i planfasen at disse ikke er under aktiv parallell endring (flere `rapport-*`-ruter finnes).
- 2025-dataen dekker én kveld (2025-09-12 15:00 → 2025-09-13 01:00, ~131 events). Tidslinje-aksen (10 timer) er reell og testbar; *fler-dagers*-aksen er degenerert (dag-filter ~1 verdi, "morgen"-bøtte tom). Påvirker R13 og gyldigheten av dommen (se Success Criteria). *(verifisert mot `scripts/import-kulturnatt.ts` av adversarial-review)*

## Outstanding Questions

### Resolve Before Planning
- [Blokkerer R1, R4][Data] Verifiser Kulturnatt 2025-data i prod-Supabase: ~131 events med `event_dates` + `event_time_start`/`event_time_end` til stede. Kjøres som første steg i /ce-plan.

### Deferred to Planning
- [Affects R1, R6][Technical] Rute + produkttype: dagens kulturnatt-URL serverer Explorer-siden, mens rapport-board-skallet ligger på `/rapport-board`-subrute (productType "report"). Anbefalt retning: ny event-native rute på samme kulturnatt-URL som gjenbruker skall-komponentene, *ikke* report-produkttypen. Min samling-rehydrering (`?c=` → forhåndsvalgte events) finnes kun i gamle Explorer-siden og må bygges i ny rute.
- [Affects R2][Technical] Presis event-native datasti: hvordan event-felter (dato/tid) bæres inn i et BoardData-lignende shape som mater sidebar + `BoardMap`, additivt så eksisterende boligrapporter ikke brytes (event-felter optional).
- [Affects R3][Technical] Gjenbruke `useKompassFilter`/`kompass-store` direkte vs. integrere event-filter-state i `board-state`.
- [Affects R10][Technical] Worktree-mekanikk: felles base-branch → to feature-branches; fundament-frys + back-merge-disiplin (se Key Decisions); `.supabase`-gotcha + `scripts/setup-worktree.sh`; portbruk (3001/3002).

## Next Steps
-> `/ce-plan` for strukturert implementeringsplanlegging (felles fundament + to varianter).
