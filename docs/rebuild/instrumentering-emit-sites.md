# Instrumentering — Emit-Sites Spec

**Eier:** PRD 13 (Unit 4) — spec-dokument  
**Implementasjon:** PRD 9 Unit 5 (logEvent-kall inn i board-skallet)

> **⚠ REVIDERT av audit-fiks 2026-07-05 — `EngagementEmitter` erstatter direkte `logEvent`-kall.**
> Fable-auditen fant tre P0 i implementasjonen av denne specen: ingen kontekst-konvolutt,
> `project_id` kun på `board_viewed`, og fersk `session_id` per event. Kall-mønsteret er
> derfor endret: emit-sites kaller nå `useEngagement().emit(eventType, extras)` fra
> `lib/instrumentation/engagement-scope.tsx` — emitteren (bygget ÉN gang per board-mount i
> `ReportReelsPage` og delt via `EngagementProvider`) injiserer `projectId`, delt økt-nøkkel
> og kontekst-konvolutt (`payload.context`: `mode`/`has_3d_addon`/`categories_presented`/`locale`)
> i HVERT event. Fire-and-forget-/fail-soft-kontrakten under gjelder uendret (bakt inn i
> `emit`). Field-mapping-blokkene under viser det OPPRINNELIGE mønsteret og leses som
> hendelses-spesifikke felt (`poiId`, `category_id`, `voiceover_segment`) — scope-feltene
> kommer nå fra emitteren. NB: `projectId` er `project.id` (stabil UUID), ikke `project.slug`.

---

## Formål

Dette dokumentet deklarerer de fire emit-sites som PRD 13 definerer, separert fra selve
implementasjonen (PRD 9 Unit 5). Målet er at PRD 9 og PRD 13 ikke kolliderer på
board-komponentfiler — PRD 13 eier *typene og logger-grensen*, PRD 9 eier *call-site-plassering*.

---

## Kall-mønster (ufravikelig)

Alle logEvent-kall MÅ følge dette mønsteret fra klientkomponenter:

```ts
void logEvent({ eventType: "...", ... }).catch(() => {});
```

**Begrunnelse:** Et un-awaited `'use server'`-kall fra en klient-handler er en kjent
Next.js-fallgruve — det genererer en floating promise som kan bli unhandled rejection
dersom React unmounter komponenten eller navigerer bort før løftet resolver. `.catch(()=>{})
` binder avvisningshandleren eksplisitt slik at rejections aldri er unhandled. `logEvent`
er allerede fail-soft internt (try/catch, logger aldri videre), men `.catch()` på kalleren
er den defensive ytterste linjen.

**Ytterligere krav:**
- Kallet er **aldri** await-blocking på render-stien
- Kallet er **tier-agnostisk** — samme call-site på nivå 1 og nivå 2, ingen `reportTier`-branch
- `logEvent` må tåle å bli kalt-og-forlatt uten ressurslekkasje (ingen cleanup-behov)

---

## De fire emit-sites

### 1. `poi_clicked`

**Trigger:** Bruker klikker en POI-markør på 3D-kartet.

**Verifisert anker (rebuild):**
- `handlePOIClick` definert `components/variants/report/board/BoardMap3D.tsx:270`
- `dispatch({ type: "OPEN_POI", id: found.id, categoryId: cat.id })` på `:275`

Emit-site = inni `handlePOIClick`-callbacken, rett etter `dispatch`-kallet.

**Field-mapping:**
```ts
void logEvent({
  eventType: "poi_clicked",
  projectId: project.slug,      // eller project.id
  productId: product?.id,
  poiId: found.id,              // top-level events.poi_id — IKKE i payload
  // payload: undefined (poi_clicked har ingen payload, jf. EventPayloads)
}).catch(() => {});
```

---

### 2. `category_opened`

**Trigger:** Bruker bytter aktivt kategori på boardet.

**Verifisert anker (rebuild):**
- Action-type `SELECT_CATEGORY` definert `board-state.tsx:48`
- Reducer-case `board-state.tsx:65`
- BoardContext dispatch-grense: interface `:131`, `useReducer`-oppretting `:172`, eksponert i context `:192`

**To dispatch-sites (begge er `SELECT_CATEGORY`):**
1. `components/variants/report/reels/ReportReelsPage.tsx` — `BoardReelsSync`-funksjonen ca. `:311–340` (source: `"audio"`, reels-drevet)
2. `components/variants/report/reels/DesktopStorySidebar.tsx:460` — `handleSelectPreviewCategory` (source: `"rail"`, klikk i sidebar)

> **Åpent (resolve med PRD 9 Unit 5):** Begge sites dispatcher `SELECT_CATEGORY`. PRD 9
> bestemmer hvilket (eller begge) som er canonical emit-point for `category_opened`, slik at
> én bruker-sesjon ikke double-counts. Alternativ: filtrer på `source !== "audio"` (reels-
> synken kjøres passivt ved scroll) og logg kun `source: "rail"` + ev. fremtidige
> interaktive sources. PRD 13 Unit 5 implementerer kallet der PRD 9 plasserer det.

**Field-mapping:**
```ts
void logEvent({
  eventType: "category_opened",
  projectId: project.slug,
  productId: product?.id,
  payload: { category_id: categoryId },
}).catch(() => {});
```

---

### 3. `voiceover_played`

**Trigger:** VO-avspilling starter for et nytt spor.

**Verifisert anker (rebuild):**
- `void audio.play().catch(() => setError())` på `components/variants/report/board/audio-tour/use-audio-element.tsx:97`
- Branchen kjøres når `phase === "playing"` og trackIndex/tracks-deps endres (Effekt 1, `:86–98`)

> **Merknad (unverified i rebuild-skall):** `use-audio-element.tsx:97` er den faktiske
> avspillingstriggerenpå DOM-nivå. Den kanoniske *emit-site for logEvent* kan avvike —
> PRD 9 Unit 5 bestemmer om kallet legges her eller på en høyere VO-start-handler
> (f.eks. en `onPlay`-callback ekspedert fra audio-tour-store). Kall-site markert
> «resolve with PRD 9».
>
> **Viktig:** `hasVoiceOver` (BoardMap3D.tsx:202) er en content-exists-boolean
> («prosjektet HAR lyd») — det er **ikke** VO-play-triggeren.

**Field-mapping:**
```ts
void logEvent({
  eventType: "voiceover_played",
  projectId: project.slug,
  productId: product?.id,
  payload: { voiceover_segment: trackUrl },  // tracks[trackIndex].url eller ID
}).catch(() => {});
```

---

### 4. `board_viewed`

**Trigger:** Board-klientkomponenten mountes (bruker åpner boardet).

**Verifisert anker (rebuild):**
- `ReportReelsPage` er top-level klientkomponent: `"use client"` på `:1`, `export default function ReportReelsPage` på `:154`
- RSC-wrapper: `app/eiendom/[customer]/[project]/rapport-board/page.tsx` (server-side)

> **Åpent (resolve med PRD 9 Unit 5):** PRD 9 bestemmer mount-punktet for `board_viewed`.
> Anbefalt: `useEffect(() => { void logEvent({...}).catch(() => {}); }, [])` nær toppen av
> `ReportReelsPage` (tom deps-array = én gang per mount). Alternativt: dedikert
> `BoardViewLogger`-komponent som wrapper BoardProvider-treet. PRD 9 eier plasseringen.

**Field-mapping:**
```ts
void logEvent({
  eventType: "board_viewed",
  projectId: project.slug,
  productId: product?.id,
  // payload: undefined (board_viewed har ingen payload)
}).catch(() => {});
```

---

## Oppsummering

| event_type        | Trigger                          | Anker (rebuild)                              | Status                  |
|-------------------|----------------------------------|----------------------------------------------|-------------------------|
| `poi_clicked`     | Markør-klikk                     | BoardMap3D.tsx:270 `handlePOIClick`          | ✓ Verifisert            |
| `category_opened` | Kategoribytte via SELECT_CATEGORY | board-state.tsx:48, to call-sites            | Resolve med PRD 9 Unit 5|
| `voiceover_played`| VO-avspilling starter             | use-audio-element.tsx:97 (DOM-nivå)          | Resolve med PRD 9 Unit 5|
| `board_viewed`    | Board-komponent mountes           | ReportReelsPage.tsx:154 (klient-mount)       | Resolve med PRD 9 Unit 5|

**PRD 9 Unit 5 er eier** av alle konkrete `logEvent`-kall. Denne spesen sier *hva* som
skal emiteres og *hvor* i kodetreet call-sites hører hjemme — PRD 9 sier *akkurat
hvilke linjer* de skal på.
