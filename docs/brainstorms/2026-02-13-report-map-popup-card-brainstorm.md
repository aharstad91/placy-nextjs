# Brainstorm: Report Map Popup Card

**Dato:** 2026-02-13
**Kontekst:** Report-produktet mangler en god måte å vise detaljert POI-info. Explorer har full-bredde accordion, men Report sin two-col grid + featured cards gjør dette vanskelig. Løsningen er å flytte detaljert info til kartet via en popup-card over markøren.

---

## Problemet

Report viser POI-er i to formater:
1. **Featured cards** (horisontal scroll) — kompakte foto-kort med editorial hook
2. **List rows** (two-col grid) — accordion-expand med detaljer (editorial hook, local insight, åpningstider, action buttons)

Utfordringen: Accordion-expand i two-col grid fungerer dårlig visuelt. Kortet ekspanderer og dytter naboer ned. Det gir ikke den redaksjonelle, polerte opplevelsen Report sikter mot.

## Inspirasjon: Pilegrimsleden.no

Pilegrimsleden sin kartløsning viser en **popup-card over markøren** ved klikk:
- Sirkulært bilde øverst
- Kategori-label
- Tittel
- Kort beskrivelse
- "Les mer" CTA-knapp
- Lukk-knapp (X)

Denne tilnærmingen flytter detaljert info **til kartet** i stedet for å presse den inn i kortlista.

## Foreslått løsning

### 1. Layout: 60/40 → 50/50

Endre split fra 60/40 til **50/50** mellom content-panel og kart. Grunnen:
- Kartet får mer plass til popup-card
- Popup-carden trenger rom for bilde, tekst og knapper
- Content-listen forblir ren og kompakt — ingen accordion-expand nødvendig
- Balanserer visuelt mellom tekst-innhold og kartopplevelse

### 2. Map Popup Card — nytt komponent

Ny komponent `MapPopupCard` som rendres over aktiv markør i kartet:

**Innhold (fra bilde #3 + Pilegrimsleden-mønster):**
- POI-navn + kategori + rating/reviews
- Featured image (16:9 ratio, stor — kartet har plass nå)
- Editorial hook (i highlight-boks, som i dag)
- Local insight (kortere tekst)
- Åpningstider (hentet on-demand)
- Action buttons: "Vis rute" + "Google Maps"

**Posisjonering:**
- Rendres som Mapbox GL `Popup` eller custom overlay posisjonert over markøren
- Anchor: bottom-center (peker ned mot markøren)
- Max-bredde: ~320px (tilpasset 50% kartbredde)
- Lukkes ved: klikk X, klikk annen markør, klikk tomt kart

### 3. Interaksjonsmodell — bidireksjonell

**Klikk kort i lista → aktiver markør + vis popup:**
- Markør highlightes (pulsing ring, som i dag)
- Map flyr til markør (som i dag)
- Popup-card åpnes over markøren
- Kort i lista scrolles til synlig posisjon (som i dag)

**Klikk markør på kart → vis popup + finn kort i lista:**
- Popup-card åpnes over markøren
- Markør highlightes
- Kort i lista scrolles til og får visuell highlight (ring, som i dag)

**Lukk popup:**
- Klikk X på popup
- Klikk annen markør (bytter popup)
- Klikk tomt kartet
- Scroll forbi seksjonen (markør blir uaktiv)

### 4. Hva skjer med accordion-expand i lista?

**Fjernes fra Report.** Kort-lista fokuserer kun på:
- Vise POI-er kompakt (som i dag — thumbnail, navn, kategori, rating)
- Klikk → aktiverer popup på kart
- Ingen expand i lista — all detaljert info lever i kartet

Featured cards (horisontal scroll) forblir som de er — de er allerede kompakte og fungerer godt.

---

## Tekniske vurderinger

### Popup-implementering: Mapbox Popup vs. Custom Overlay

**Alternativ A: Mapbox GL `Popup`**
- Pros: Innebygd posisjonering, følger kart-pan/zoom, collision detection
- Cons: Rendrer via DOM — kan ikke bruke React-komponenter direkte uten `createRoot`

**Alternativ B: Custom React-komponent med `Marker`**
- Pros: Full React-kontroll, Tailwind-styling, konsistent med eksisterende kode
- Cons: Må håndtere posisjonering selv, kan flyte utenfor kart-viewport

**Anbefaling: Alternativ B — Custom React overlay via Mapbox `Marker`**
- Bruker `react-map-gl` sin `Marker`-komponent (allerede brukt for alle markører)
- Rendrer popup-card som child av Marker, offset oppover
- Full Tailwind-styling, enkel å matche Report-design
- Konsistent med eksisterende markør-pattern i ReportStickyMap

### State-håndtering

Eksisterende `activePOI: { poiId, source }` state er allerede på plass. Popup vises når `activePOI !== null`. Ingen ny state nødvendig — bare en ny visuell representasjon av eksisterende state.

### Data-tilgang

Popup trenger samme data som accordion-expand:
- POI-data: allerede tilgjengelig via props
- Åpningstider: hentet on-demand via `/api/places/{googlePlaceId}` (som i dag)
- Realtime-data: eventuelt, men kan utelates i V1

### Mobil

- Desktop (lg+): 50/50 split med popup-card i sticky map
- Mobil (<lg): Ingen endring — bruker allerede per-section inline maps, ingen sticky map

---

## Scope

### Inkludert
- [ ] Layout 60/40 → 50/50
- [ ] `MapPopupCard` komponent med POI-detaljer
- [ ] Popup vises ved klikk på markør ELLER kort i lista
- [ ] Fjern accordion-expand fra Report list rows
- [ ] Bidireksjonell sync (kort ↔ markør ↔ popup)
- [ ] On-demand åpningstider i popup
- [ ] Lukk-mekanisme (X, annen markør, tomt kart)

### Ikke inkludert (fremtidig)
- Realtime transit-data i popup
- Animert popup-overgang (fade/slide)
- Mobil bottom-sheet variant av popup
- "Les mer" som åpner fullstendig POI-side

---

## Beslutning

**Tilnærming:** Custom React overlay (Marker-basert) med 50/50 layout-split. Fjern accordion fra lista, all detaljinfo i kart-popup. Pilegrimsleden-inspirert men med Placy sin eksisterende visuelle stil og data (editorial hooks, ratings, bilder).

**Neste steg:** Plan → implementering.
