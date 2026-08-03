---
date: 2026-08-03
topic: mobil-nabolagsflate
---

# Mobil nabolagsflate — kart + liste for boards uten VO

> **Ordbruk:** dette dokumentet unngår «nivå 1 / nivå 2» om flatene, fordi de
> ordene allerede betyr *tier* i Placys nivåmodell (`reportConfig.reportTier`).
> De to flatene heter **nabolagslista** og **kategorisiden**. Fem av de seks
> boardene under er tier 2 — tier og VO-tilstedeværelse er uavhengige akser.

## Problem Frame

Rapport-boards **uten spillbar voice-over får ingen innholdsflate på mobil**.
Etter splash-en møter brukeren et fullskjerm kart med pins, og det er alt. All
kategori-struktur, all tekst og alle gangtider er kun nåbare på desktop, via
`DesktopStorySidebar`.

Årsaken er en gating i `components/variants/report/reels/ReportReelsPage.tsx`:
`mapIsSurface = state.mapOpen || !hasAudioMobile`. Uten lyd er kartet permanent
primærflate, og historie-flaten (`ReelSwipeStack` / `CardRouter`) monteres aldri.
`2026-06-16-mobil-rapport-board-ux-requirements.md` R17 lovet en fallback for
no-audio, men den finnes ikke i kode.

Fire av seks provisjonerte boards er i denne tilstanden. Merk skillet mellom
**kuratert** editorial (fra `curate-area`) og **generert** editorial
(minimum-garantien fra 2026-07-07, syntetisert i `board-data.ts`) — kolonnen
«Rendres» er det brukeren faktisk ser:

| Board | Tier | 3D | Temaer | Kuratert | Rendres | VO |
|---|---|---|---|---|---|---|
| `wesselslokka` | 2 | ja | 7 | 6 (4 m/highlights) | kuratert + generert | — |
| `teknostallen` | 2 | ja | 5 | 5 | kuratert | — |
| `ferjemannsveien-10` | 2 | nei | 5 | 0 | **kun generert** | — |
| `cutover-pilot` | 1 | nei | 6 | 0 | **kun generert** | — |
| `byggetrinn-4` | 2 | ja | 7 | 7 | kuratert | 7 |
| `stasjonskvartalet` | 2 | ja | 7 | 0 | kun generert | 7 |

Wesselsløkka har kuratert tekst på 6 av 7 temaer som rendres på desktop og er
bokstavelig talt uoppnåelig på mobil. Skillet går på **VO-tilstedeværelse, ikke
tier**.

Formen er hentet fra Citymappers `Nearby`, analysert fra to skjermopptak
(2026-08-03, London): todelt vertikal layout, fritt dragbar sheet over
interaktivt kart, og drill-in som en **fullskjerms push** — der kartet bytter
til emnets egen skala.

## Requirements

**Flate og navigasjon**

- R1. Boards uten spillbar VO får en ny mobil-flate: kart øverst, sheet nederst.
  Den erstatter dagens «splash → fullskjerm kart, ingenting mer».
- R2. Flaten er en navigasjonsstakk med to trinn. **Nabolagslista** ligger i
  sheeten. **Kategorisiden** pushes som en fullskjerms *innholdsflate* med egen
  tilbake-chevron. Begge trinn deler **samme monterte kartinstans** — den
  persistente `gmp-map-3d`-instansen kan aldri unmountes (WebGL-context-lekk,
  `BoardMap.tsx`), så «eget kart» er utelukket som mekanisme. Kartet bytter kun
  kamera-ramme mellom trinnene.
- R3. Sheeten på nabolagslista dras fritt mellom en lav hvileposisjon (kartet
  dominerer) og en høy (lista dominerer), med snap til nærmeste hvileposisjon
  ved slipp. Kartet er aldri helt skjult, og er pan/zoom-bart i alle
  sheet-høyder. I lav hvileposisjon viser sheeten header + minst ett fullt
  kategorikort, slik at ankomsttilstanden aldri leses som en tom skuff.
- R4. Ankomst beholder eksisterende splash. Har boardet 3D-addon
  (`wesselslokka`, `teknostallen`), går sheeten til lav hvileposisjon når
  establishing-flythrough-en lander. Uten 3D-addon (`ferjemannsveien-10`,
  `cutover-pilot`) finnes ingen flytur — `willBasicIntro` i `ReportReelsPage`
  krever `has3dAddon` — og sheeten kommer inn i lav hvileposisjon direkte ved
  splash-fade.
- R5. Kartets effektive senter og ramme følger sheetens **målte** høyde i alle
  hvileposisjoner, slik at boligen og de nærmeste punktene aldri havner bak
  sheeten. Kompensasjonen må virke for begge motorer: Mapbox har `setPadding`
  i bruk i dag, `BoardMap3D` har ingen padding-mekanisme og deklarerer
  `mapPaddingLeft` uten å bruke den. Ikke anta viewport-høyde slik
  `EventMobileSheet` gjør (hardkodet 700 px). **Hvor mye kompensasjon som
  føles riktig avgjøres på enhet, ikke på papiret** — start med full
  sheet-høyde som bottom-padding i 2D (Mapbox `setPadding` er allerede i bruk),
  kjenn på det, og juster. 3D har ingen mekanisme i dag, så den delen kan først
  vurderes når den er bygget.

**Nabolagslista**

- R6. **Boligen er origo for alle avstander, alltid** — også på kategorisiden.
  Kartutsnittet bestemmer *hvilke* punkter som står i lista, aldri hva de måles
  fra.
- R7. **Boligen kan aldri forlate kartutsnittet.** Panorering begrenses slik at
  boligmarkøren alltid er synlig. Dette gjenoppretter koblingen mellom
  måle-anker og romlig anker som Citymappers blå prikk leverer, uten å innføre
  et sikte-kryss.
- R8. **Ankomst-utsnittet rammer inn en gangbar radius (~10 minutter), ikke
  hele POI-settet.** Da er dekningsbrøken i R10 informativ fra første skjerm, og
  zoom ut avdekker faktisk nye steder i stedet for bare å skjule.
- R9. Lista viser punkter innenfor det **ikke-okkluderte** kartutsnittet — kartets
  bounds minus sheetens høyde, samme rektangel som padding-kompensasjonen i R5
  beskriver. For 3D må «utsnitt» defineres eksplisitt: et tiltet kamera
  (`DEFAULT_CAMERA_LOCK` tilt 45, maxTilt 75) har ingen rektangulær bounds, og en
  frustum til horisonten ville inkludert nesten alt.
- R10. Lista er gruppert per kategori. Kategoriene sorteres på gangtiden til sitt
  nærmeste synlige punkt. Kategorikortets header er tett og prosafri: ikon, navn,
  og en underoverskrift med dekning og tidsspenn — f.eks. `9 av 17 synlig ·
  4–21 min`. Tidsspennene reflekterer faktiske data: medianen på Wesselsløkka er
  19 minutter, så tosifrede spenn er normalen, ikke unntaket.
- R11. Under headeren står inntil tre av kategoriens synlige punkter med navn og
  gangtid. Finnes flere, avslutter kortet med en rad som fører til kategorisiden.
- R12. Lista re-scopes **kun ved slipp av en brukerinitiert kart-gest, og ved
  endring av sheetens hvileposisjon** (som endrer det ikke-okkluderte området).
  Programmatiske kamerabevegelser — flythrough-landing (R4), fly-to ved
  punkt-valg (R19), gjenoppretting ved tilbake (R18) — endrer aldri listas scope.
- R13. Gangtider leses fra de precomputede verdiene (`POI.travelTime`, fra
  `v2.project_pois.travel_times`). Ingen runtime-ruting, ingen luftlinje-estimat.
  Dette gjelder **alt minuttall på flaten**, inkludert tall inne i generert prosa
  — `lib/generators/bridge-text-generator.ts` faller i dag tilbake på haversine
  × 1,3 når `travelTime.walk` mangler, og må utelate minuttallet i stedet.
- R14. Kategorier uten synlige punkter faller helt ut av lista.

**Kategorisiden**

- R15. Tapp på kategorikortets header eller «se alle»-raden pusher kategorisiden.
- R16. Kategorisiden **ignorerer kartutsnittet** og viser hele kategorien.
- R17. Kuratert og generert innhold skilles på
  `BoardCategory.editorial.generated`, **ikke** på om `editorial` finnes —
  `board-data.ts` syntetiserer `{body, highlights, generated: true}` for hvert
  tema uten kuratering, per minimum-garantien fra 2026-07-07. Konkret:
  - Er innholdet kuratert: høydepunktene står først i kurators rekkefølge
    (allerede resolvet og capped til `MAX_HIGHLIGHTS` i
    `inherit-area-editorial.ts`), visuelt skilt fra resten, og prosaen står over
    lista. Skillelinjen bruker **ikke** ordet «kuratert» i brukervendt tekst —
    det er intern redaksjonsvokabular.
  - Er innholdet generert: prosaen vises uten kuratert-ramme, og de genererte
    høydepunktene får **ingen** egen seksjon — hele lista sorteres på gangtid.
  - Er prosaen forankret i boligen («nærmeste handelsknutepunkt»), skal den
    fremstå som det, slik at den ikke leses som en beskrivelse av det brukeren
    tilfeldigvis har panorert til.
- R18. Kartet på kategorisiden rammer inn kategoriens egne punkter og demper de
  øvrige. Tilbake gjenoppretter både listas scroll-posisjon og det nøyaktige
  kamera-utsnittet brukeren kom fra.

**Punkt-interaksjon**

- R19. Tapp på en punkt-rad utvider raden på stedet — ingen tredje flate — og
  flyr kartet til punktet. Raden forblir i lista til brukeren selv panorerer
  (R12). Innholdet er adresse, tekst når den finnes, gangtid fra boligen, og
  sanntid for transport-punkter når `/api/entur` / GBFS-data er tilgjengelig;
  uten data utelates sanntidsblokken.
- R20. **Kategori-låsingen av markørsettet er deaktivert på denne flaten.**
  Dagens `OPEN_POI` setter `activeCategoryId` i `board-state.tsx`, og både
  `BoardMap` (2D) og `selectMarkerPOIs` (3D) viser da kun den kategoriens pins
  — mens lista fortsatt lister de andre. `BACK_TO_DEFAULT` gjenoppretter det
  ikke. På nabolagslista styres markør-synligheten i stedet av **viewport-settet
  alene**: `activeCategoryId` konsumeres ikke for markør-utvalg. Ingen ny
  board-action bygges for dette — desktop og VO-flatene beholder dagens
  oppførsel uendret.
- R21. Tapp på en kart-pin markerer tilsvarende rad og scroller til den. Ligger
  punktet i en kategori som ikke er utvidet, åpnes den. Kun én rad er utvidet om
  gangen.
- R22. Kamera-bevegelser respekterer `prefers-reduced-motion`: fly-to erstattes
  av en umiddelbar reframe når brukeren har slått på redusert bevegelse.

**Kamera, tomme tilstander og veier ut**

- R23. Flaten trenger en delt **«ramm inn nabolaget»**-kamerahandling som
  gjenbruker `computeFitBounds` / `fitToVisiblePois`. Rutinen finnes, men fyrer
  i dag kun når `tourActive` (VO-boards) eller `shouldFitToProgram`
  (`eventMode`) — ingen av dem gjelder en VO-løs boligrapport.
- R24. Reframe-handlingen er tilgjengelig **når som helst kartutsnittet avviker
  fra ankomst-utsnittet**, ikke bare når lista er tom. Et delvis tomt utsnitt
  («1 av 17 synlig · 34 min») er mer sannsynlig enn et helt tomt, siden
  POI-tettheten avtar gradvis utover.
- R25. Er lista helt tom, viser sheeten en tom tilstand med reframe-handlingen
  som eneste innhold.
- R26. Mangler et punkt gangtid, vises raden uten minutt-tall og sorteres sist i
  sin gruppe. Dekningen er 100 % på alle fire mål-boards i dag, så grenen må
  dekkes av en syntetisk test — den fyrer ikke på produksjonsdata.
- R27. Brukeren har alltid en synlig vei tilbake til nabolagslista fra
  kategorisiden.
- R28. Første gang brukeren møter flaten, får hen én gang et ikke-blokkerende
  hint om at kartet styrer lista. Uten det finnes ingen affordans for koblingen:
  det er verken søkefelt eller sikte-kryss på flaten, og en boligkjøper som
  kommer kaldt fra en annonse har ikke Citymapper-brukerens innlærte forventning.

### Modell

```
NABOLAGSLISTA                          KATEGORISIDEN
┌───────────────────────┐              ┌───────────────────────┐
│  KART — ~10 min ramme │              │ ‹   Hverdagsliv       │
│    🏠 alltid synlig   │    tapp      ├───────────────────────┤
│    ● ● ●              │  ─────────►  │  SAMME kartinstans,   │
├───────────────────────┤              │  ny kamera-ramme      │
│ Nabolaget             │  ◄─────────  ├───────────────────────┤
│                       │   tilbake    │ 17 steder · 4–21 min  │
│ 🛒 Hverdagsliv        │  (kamera     │                       │
│    9 av 17 · 4–21 min │  gjenopp-    │ «Valentinlyst senter  │
│    Coop Mega    4 min │   rettes)    │  er nærmeste handels- │
│    Vinmonopolet 6 min │              │  knutepunkt med…»     │
│    Se alle 17      ›  │              │                       │
│                       │              │ ● Coop Mega     4 min │
│ 🌲 Natur & Friluft    │              │ ● Vinmonopolet  6 min │
│    6 av 10 · 3–9 min  │              │   Kiwi Tyholt   5 min │
└───────────────────────┘              │   … 14 til            │
   sheet dras fritt                    └───────────────────────┘
   kartet alltid synlig                   innholdsflate, ikke nytt kart
```

## Success Criteria

- På `wesselslokka` i Safari på iPhone er teksten for alle seks kuraterte temaer
  nåbar uten å forlate nabolagslista, med maks én drill-in per tema. I dag:
  uoppnåelig.
- På et navngitt kuratert tema matcher rekkefølgen på kategorisiden
  `editorial.highlightPoiIds` nøyaktig; på `ferjemannsveien-10` og
  `cutover-pilot` finnes ingen høydepunkt-seksjon i det hele tatt.
- Tilbake fra kategorisiden gir identisk kamera-tilstand og scroll-posisjon som
  før drill-in.
- Dekningsbrøken og tidsspennet på hvert kategorikort stemmer mot faktisk antall
  synlige punkter og faktiske `travelTime.walk`-verdier.
- Lista står helt stille under sheet-drag og under enhver programmatisk
  kamerabevegelse; den endrer seg kun ved slipp av kart-gest og ved bytte av
  sheet-hvileposisjon.
- Boligmarkøren er synlig i hvert eneste kart-frame gjennom en fri
  panorerings-sesjon.
- Alle fire VO-løse boards rendrer flaten uten tomme kategorikort.
- Andreas validerer på ekte enhet at drag, push og tilbake føles riktig — ikke i
  simulator eller responsive mode.

## Scope Boundaries

- Boards **med** spillbar VO (`byggetrinn-4`, `stasjonskvartalet`) beholder
  dagens to-flate-modell uendret.
- Ingen ny kuratering, ingen nye POI-er, ingen pipeline-endring. Flaten leser
  data som allerede finnes.
- Desktop-sidebaren er uendret.
- Ingen søke- eller filterfelt. Kartutsnittet er filteret.
- Ingen «Hele nabolaget»-rad fra desktop.
- Ingen eksponering av `travelTime.bike` / `.car` på denne flaten.

### Deferred to Separate Tasks

- Å samle VO-boards, event-sheeten og nabolagsflaten på én felles mobil-modell.
  Tas opp når denne flaten er validert på enhet.
- Tidsbudsjett (5/10/15 min) som eksplisitt kontroll. Vurderes hvis den direkte
  kart-koblingen viser seg for grov på enhet — retningen er enveis, siden en
  kontroll kan legges oppå koblingen, men ikke omvendt.
- Full ikke-gestuell vei gjennom flaten for brukere som ikke kan panorere
  presist. R23/R24 gir en tastaturnåbar reset, men ikke fri utforsking.

## Key Decisions

- **Boligen er origo, ikke et fritt sikte-kryss.** Citymappers reticle finnes
  fordi avganger er ferskvare og brukeren faktisk står et sted. En boligkjøper
  har nøyaktig ett relevant origo. Dessuten har vi 100 % precomputet
  gangtidsdekning fra boligen — fra et fritt punkt måtte vi enten kalle Mapbox
  Matrix runtime, som arkitekturreglene forbyr, eller falle tilbake på luftlinje.
- **Ingen grønn reticle, men boligen låses i utsnittet (R7).** Citymappers
  viewport-filter virker fordi origo alltid ligger i utsnittet — reticlen holder
  måle-ankeret og det romlige ankeret koblet. Fjerner vi reticlen og beholder
  filteret, får vi den halvdelen som *forutsetter* koblingen uten den som
  *leverer* den. R7 gjenoppretter koblingen med en begrensning i stedet for et
  UI-element.
- **Ankomst rammer ~10 minutter, ikke alt (R8).** Rammes hele settet inn, er
  filteret en no-op i den eneste tilstanden alle brukere ser, og
  dekningsbrøken står på «17 av 17». Datasettet er dessuten fast — uten en
  strammere ankomstramme kan panorering bare skjule, aldri hente frem.
- **Kategorisiden deler kartinstans (R2).** «Eget kart» er fysisk umulig så
  lenge `gmp-map-3d` ikke kan unmountes, og to av fire mål-boards er 3D.
- **Kuratert vs. generert skilles på `generated` (R17).** Ellers ville
  `ferjemannsveien-10` og `cutover-pilot` — som ikke har kuratering i det hele
  tatt — vist maskinvalgte tier-1-punkter under en kuratert-etikett.
- **Sorteringen er et startpunkt, ikke en konklusjon.** Kurator-først bevarer
  Moat 1-beslutningen fra `curate-area`, men hvor godt det oppleves avhenger av
  kurateringens kvalitet. Byttet til ren gangtid er en enlinjes endring og
  evalueres på enhet.
- **Fri drag, ikke `EventMobileSheet`s tapp-syklus.** Den shippede event-sheeten
  unngikk gest-konflikten mot kart-pan ved å droppe drag helt (tapp på handle
  sykler mellom 32/62/92 %). Her er fri drag et bevisst brudd: skjermopptaket
  fra London viser kontinuerlig drag med snap, og den direkte manipulasjonen er
  hoveddelen av det som gjør flaten levende. Gest-koeksistensen må derfor løses,
  ikke omgås.

## Dependencies / Assumptions

- `POI.travelTime` er plumbet fra `v2.project_pois.travel_times` til klienten via
  `lib/supabase/v2-queries.ts`. Verifisert.
- **Gangtidsdekning er 100 % på alle fire mål-boards** (2026-08-03):
  `wesselslokka` 103/103 (1–39 min), `teknostallen` 176/176 (1–47),
  `ferjemannsveien-10` 284/284 (1–34), `cutover-pilot` 206/206 (1–34). Verifisert.
- Kuratert rekkefølge overlever til render som `editorial.highlightPoiIds`,
  ordnet og capped. Verifisert i `lib/pipeline/inherit-area-editorial.ts`.
- Kartet leser i dag **ikke** tilbake sitt eget utsnitt. `BoardMap` skriver
  kamera via `fitBounds`, men har ingen `onMoveEnd`- eller bounds-avlesning.
  Viewport-scoping er ny plumbing, og må bygges for begge motorer. Verifisert.
- `BoardPOIMiniPopup` er **ikke** gjenbrukbar som innhold — den *er* en
  `react-map-gl/mapbox`-`<Popup>` og krever Mapbox-kontekst. Den utvidede raden
  krever at innholdet trekkes ut i en motor-uavhengig presentasjonskomponent
  (adresse + body + gangtid + `POIRealtimeSection`). `useRealtimeData` og
  `POIRealtimeSection` er derimot direkte gjenbrukbare.
- `use-popup-mode.ts` og `BoardMap.tsx` refererer en `BoardMobileSheet` som ikke
  finnes i repoet. Død referanse — ryddes i samme arbeid.
- `ferjemannsveien-10` har 284 POI-er. Kategorisiden (R16, hele kategorien) kan
  bli en liste på over hundre rader; scroll-anker ved tilbake (R18) er ikke
  trivielt på den lengden.
- `teknostallen` kjører Næring-bransjeprofilen og har et tema som **heter**
  «Nabolaget». Sheet-headeren kan ikke bruke samme ord der.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] Konkrete hvileposisjoner, og hvordan sheet-draget
  sameksisterer med kart-pan. `BoardMap3D` har allerede en
  pointerdown/touchstart-lytter som kan komme i veien.
- [Affects R9][Technical] Hvordan «synlig utsnitt» defineres i 3D med tiltet
  kamera — projisert bakkerektangel, radius rundt kamerasenteret, eller annet.
- [Affects R7][Technical] Hvordan bolig-låsen håndheves — clamp på kamerasenter,
  eller korrigerende reframe etter gest-slipp.
- [Affects R8][Technical] Hvordan «~10 minutters gange» oversettes til en
  kamera-ramme: isokron finnes ikke, så trolig bounds over POI-ene med
  `travelTime.walk <= 10`.
- [Affects R28][Needs research] Hvilken form førstegangs-hintet tar uten å bli
  en modal eller en coach-mark som må avvises.
- [Affects flere][Technical] Om 2D/3D-toggelen skal være tilgjengelig på flaten,
  og hva som skjer med lista ved motorbytte midt i.
- [Affects R9][Technical] Rotasjon og `100dvh`-endring (Safari-adressefelt) endrer
  bounds uten en brukergest — teller det som en scope-endring?

## Next Steps

-> `/ce-plan` for structured implementation planning
