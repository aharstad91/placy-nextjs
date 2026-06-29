# Nivå-modell: kjerne vs. overflate + kondisjonell-render-kontrakt

> **Status:** Normativ kontrakt (PRD 2 / Unit 02.1). Dette er reglene **provisjon (PRD 3)** og
> **render (PRD 9)** er enige om. Selve renderingen bygges i PRD 9 — IKKE her. Dette dokumentet
> definerer *hva som vises når*, ikke *hvordan*.
> **Forankret i:** PRD 2 §5.2/§5.3/§5.4 + `report-defaults.ts` (taksonomi, PRD 2 / r02.3).

---

## 1. To leveransenivåer

Placy leverer ÉN board-opplevelse i to nivåer. Nivå er et felt på `products.config.reportTier`
(`1 | 2`; `undefined`/manglende = nivå 1).

| Nivå | Hva det er | Hvem setter det |
|------|-----------|-----------------|
| **Nivå 1** | Autonomt generert default. Provisjonering produserer hele boardet uten menneskelig kuratering. **Alle board er minst nivå 1.** | Provisjon (PRD 3), automatisk |
| **Nivå 2** | Eksplisitt **kuratert editorial** oppå nivå-1-fundamentet. Det ENESTE nivå 2 *legger til* er kuratert editorial på alle temaer (+ kuratert hero/branding-overflate). | Admin-only i starten (kun Andreas, manuelt) |

**Nivå-modellen er minimal.** Alt annet enn editorial (3D, VO, branding, camera-tours, brokers) er
ortogonale akser som IKKE avhenger av nivå (§3).

```ts
// report-tier-schema.ts
export const ReportTierSchema = z.union([z.literal(1), z.literal(2)]);
export type ReportTier = z.infer<typeof ReportTierSchema>; // 1 | 2
// undefined / manglende = nivå 1 (autonomt generert default)
```

---

## 2. Kjerne vs. overflate (hva deles, hva divergerer)

Rebuild-mantraet: **del nedover stacken, diverger oppover i UX.** Datamodell, skjema, taksonomi og
tilgangskontrakt er ALLTID delt — aldri forket per nivå. Nivå-deltaet fanges av en kontrakt
(dette dokumentet) + en lett readiness-sjekk (§6), ALDRI av forket kode eller forket skjema.

| Lag | Eier | Divergerer per nivå? | Divergerer per profil? |
|-----|------|----------------------|------------------------|
| Datamodell (`products.config`, `projects.has_3d_addon` — leses fra `v2`) | PRD 1 | Nei — felt finnes alltid, fylles betinget | Nei |
| Nivå-felt (1\|2) + denne render-kontrakten | PRD 2 | Nei — kontrakten *beskriver* divergensen, men er selv delt | Nei |
| Taksonomi (`report-defaults` + `theme-definitions`) | PRD 2 | **Nei** — identisk på alle board (også nivå 1) | **Ja** — `bolig`=6 temaer, `naering`=5 + egne radier |
| Board-data / VO-seleksjon (`pickPlayableAudio`) | PRD 5 | Nei — velger spillbart spor uavhengig av nivå | Nei |
| 3D-motor, RSC-render, kontroller | PRD 6 / 9 | Nei — identisk skall, vises på `has_3d_addon` (ortogonalt) | Nei |
| **Kuratert editorial/hero** | PRD 9 (nivå-2-overflate) | **Ja (nivå 2)** — bevisst divergens, fylles betinget | Nei |
| Render-features (VO, camera-tour, branding/reels, brokers) | PRD 9 | Nei — drives av ortogonale flagg/data-presence | Nei |

«ÉN board-opplevelse / ÉT skall» = én foundation/app (ikke to parallelle). Det forbyr IKKE
nivå-bevisst UX-design (layout/flyt kan divergere mye over tid) — det forbyr rigid
capability-matrise-gating av enkeltfeatures.

---

## 3. Kondisjonell-render-kontrakt

Hver akse driver rendering **uavhengig** av de andre. Renderingen implementeres i PRD 9; reglene bor her.

| Akse | Driver (input) | Hva vises når den er sann |
|------|----------------|---------------------------|
| **Nivå 2** | `reportConfig.reportTier === 2` | Kuratert editorial/hero/branding-overflate (i stedet for autonomt nivå-1-innhold) |
| **3D** | `projects.has_3d_addon === true` | 3D-kart-motor (ellers 2D-skall) |
| **VO** | spillbart lydspor finnes (`pickPlayableAudio` — `reelsAudio ?? audio` m/ manus+url) | Voiceover-avspilling + karaoke |
| **Camera-tour** | `camera-tours`-entry finnes for sluggen | Flythrough/kino-kamera |
| **Brokers** | `reportConfig.brokers` ELLER `getProjectBrokers(slug)` gir treff | Ansvarlig-megler-blokk |
| **Brand-assets** | `reportConfig.assets.brand` finnes | Prosjekt-branding |

---

## 4. Ortogonalitet + INGEN render-gating på nivå

**Aksene i §3 er ORTOGONALE — ingen akse gater en annen.**

- Et **nivå-1-board kan ha 3D og VO** (på `has_3d_addon` + spillbart spor) uten å være nivå 2 — fordi
  3D/VO er data-presence, ikke nivå-krav.
- Et **nivå-2-board uten 3D-addon** renderes i 2D.
- **VO er en ortogonal render-akse, IKKE en nivå-gate.** `pickPlayableAudio` (PRD 5) er bare *navnet
  på inputet* som driver VO-rendering — readiness-sjekken (§6) sjekker IKKE VO. Konsumentene skal
  ALDRI gjeninnføre den gamle VO-«speilingen» (CARRY-OVER linje 270) i validator-/readiness-laget.

🚫 **Det finnes INGEN render-gating på `reportTier`** (patch #2, verifisert: ingen `reportTier`-ref i
`BoardMap3D`/`ReportReelsPage`). Features skjules ALDRI på nivå — de vises på sine egne ortogonale
flagg/data-presence. Det skal ikke bygges render-gating, og det finnes ingen `TIER_CAPABILITIES`-
matrise (eier-besluttet forenkling 2026-06-27).

---

## 5. Segment-agnostisk + profil ≠ segment

- **Nivå-modellen er IKKE en segment-akse.** Ingen `bolig`/`naering`/`bruktmegler`/`utbygger`-felt får
  finnes i nivå-modellen. Kjernen er segment-agnostisk.
- **Profil (`bolig`/`naering`) er en SEPARAT akse**, ortogonal til nivå, som styrer taksonomien
  (`bolig`=6 temaer, `naering`=5 + egne discovery-radier — `report-defaults.ts`). Profil ≠ segment:
  profil velger tema-sett, segment er en go-to-market-distinksjon som ikke bakes inn i kjernen.

---

## 6. Lett nivå-2-readiness-sjekk (ikke et capability-rammeverk)

`validateReportTier(project): ReportTierFinding[]` — **ren funksjon, funn er data (ingen throws),
ingen render-gating.** Sjekker KUN det som faktisk definerer nivå 2 + to trivielle data-sjekker:

| Sjekk-id | Nivå | Level | Trigger |
|----------|------|-------|---------|
| `invalid-tier` | alle | error | `reportTier` parses ikke som 1/2 — returnerer tidlig |
| `highlight-poi` | nivå-uavhengig | warning | `highlightPoiId` resolver ikke mot injisert `poiIds` (hoppes hvis utelatt) |
| `editorial` | 2 | error | tom `themes`, eller tema uten editorial (ikke-tom body ELLER ≥1 highlight) |

De gamle nivå-3-sjekkene (`vo`, `camera-tours`, `has3d-addon`, `brokers`, `brand-assets`) er **fjernet
som nivå-gater** — de er ortogonale render-flagg (§3), eid av PRD 9. `audioTourEnabled` valideres
bevisst ikke (dødt flagg). Sjekken kan holdes minimal/utsatt i starten (kun admin setter nivå 2).

---

## 7. Lazy-load (ytelse, ikke nivå)

De tre verifiserte **tunge ortogonale modulene** — 3D-motor, voiceover-orkestrering,
reels/splash-video — `dynamic()`-importeres i skallet så nivå-1/uten-flagg ikke betaler bundle-kosten.
Selve `dynamic()`-wrappingen + bundle-beviset implementeres i PRD 9; kontrakten her sier kun at de
SKAL lazy-lastes. **Abstrahér ikke for innbilte fremtider — kun disse tre.**
