# Brainstorm: Apple-style Map Modal

**Dato:** 2026-04-15
**Referanse:** apple.com/no/macbook-pro — "Utforsk M5-chipene"-modal
**Scope:** Map-modal i `ReportThemeSection.tsx` (åpnes fra "Utforsk kartet"-knapp per tema i rapporter)

## Kontekst

### Hva vi har i dag
- Map-modal bruker shadcn `Dialog` (Radix UI primitives) fra `components/ui/dialog.tsx`.
- **Desktop:** Sentrert vertikalt/horisontalt, 80vw × 80vh, rounded-2xl. Ingen åpne/lukke-animasjon på selve innholdet, kun svak `fade-in` på backdrop.
- **Mobil:** Festet til bunn, 85vh høy, drag-handle, rounded-t-2xl. Ingen slide-animasjon.
- **Backdrop:** `bg-black/30` + `backdrop-blur-sm` (veldig svak blur — 4px).

### Apple's implementasjon (observert)
1. Modal **festet til bunn**, full bredde med padding (ca. 16-24px på sidene), full på mobil.
2. Høyde tar ~85-90% av viewport-høyden.
3. **Glir opp fra bunn** ved åpning — smooth ease-out, Apple's karakteristiske kurve (~400-450ms).
4. **Kraftig backdrop-blur** — ikke bare svak sløring, men tydelig "frosted"-effekt som gjør bakgrunn nærmest uleselig. Kombinert med subtil mørkning.
5. Runded corners på ALLE fire hjørner (ikke bare topp). Modalen "flyter" over bakgrunnen.
6. Close-knapp som en liten sirkel med X i øvre høyre hjørne — festet til selve modalen.
7. Lukking: glir ned igjen med samme animasjonskurve i revers.
8. Mobil: identisk oppførsel, bare smalere.

### Prior art (compound-docs)
- **modal-backdrop-half-viewport-css-animation-collision-20260215** — Lærdom: bruk ALDRI generiske CSS-animasjonsnavn (`slide-up`, `fade-in`) fordi duplikat-keyframes silently overrider hverandre. Bruk unike navn som `map-modal-slide-up`. Vi har allerede `@keyframes slide-up` i bruk — vi må navngi nye animasjoner unikt.
- **skeleton-loading-report-map-20260204** — Lærdom: `backdrop-filter: blur()` er dyrt på mobil. Testet bevisst uten på andre steder. For én enkelt modal på ~150ms åpne-animasjon er det trygt, men bør testes.
- **refactor-collection-modal-20260215** — Vi har en generisk `components/ui/Modal.tsx` med lignende animasjonsnavn (`animate-modal-in`, `animate-slide-up`). Disse er IKKE i bruk av map-modalen (map-modalen bruker shadcn Dialog).

## Designbeslutninger (med forslag)

### 1. Hvor stor skal modalen være på desktop?
Apple sin modal er **90vw × 90vh** med ~5vw padding og fester seg med bunn mot bunn.
- Vår nåværende: `md:w-[80vw] md:h-[80vh]` sentrert.
- **Forslag:** `md:w-[92vw] md:h-[90vh]` festet til bunn med ~4vh luft over.
  - Dette matcher Apple-proporsjonene på desktop.
  - På mobil: full bredde, 90vh høy, festet i bunn.

### 2. Hvor mye padding/luft rundt modal?
Apple: ca. 16-24px på sidene og ~5vh i toppen.
- **Forslag desktop:** `inset-x-[4vw] bottom-0 top-[4vh]` → modalen fyller visuelt, men har luft i toppen.
- **Forslag mobil:** `inset-x-0 bottom-0 top-[8vh]` → full bredde, litt mer luft i topp.

### 3. Rounded corners — alle fire eller bare topp?
Apple bruker rounded på alle fire. Vår nåværende: bare topp på mobil (`rounded-t-2xl`), alle fire på desktop.
- **Forslag:** Alle fire hjørner `rounded-2xl` både desktop OG mobil. Mer moderne, matcher Apple. Fordrer at modalen har luft i bunn også — men siden den fester seg i bunn (`bottom-0`), ser rounded bottom ikke ut. 
- **Alternativ:** Fest modalen i bunn med `bottom-0` på mobil (bare rounded-t), men bruk padding på alle sider på desktop (rounded alle fire).
- **Beslutning:** Apple sin tolkning → modalen **har** bunnmargin også. Alle fire runded. Fester IKKE bunnen til 0 — har `bottom-[4vh]` eller lignende.

Hmm, dette strider litt mot "0px festet i bunn" som brukeren nevnte. La oss se nøye på Apple igjen... Ja, Apple har faktisk `bottom: 0` — men modalen er så stor at det ikke spiller så stor rolle. Rounded corners på ALLE fire hjørner, men de nederste er under viewporten hvis modalen er 0 fra bunn. **Det ser visuelt ut som bare topp er rounded**, fordi de nedre er utenfor viewporten.

Så: `bottom-0 left-[4vw] right-[4vw] top-[4vh]` med `rounded-2xl` på alle hjørner. De nedre hjørnene er skjult av overflow, men det er OK — på Apple ser det likt ut.

- **Final forslag:** `bottom-0 left-[4vw] right-[4vw] top-[5vh]` på desktop, `inset-x-0 bottom-0 top-[8vh]` på mobil. `rounded-2xl` på alle hjørner både mobil og desktop.

### 4. Backdrop-blur intensitet
Apple: svært kraftig blur, ca. 20-24px + subtil mørk overlay.
- Vår nåværende: `bg-black/30 backdrop-blur-sm` (4px). For svak.
- **Forslag:** `bg-black/40 backdrop-blur-xl` (24px). Tailwind støtter ikke direkte `backdrop-blur-xl` på alle setups — vi bruker `backdrop-blur-xl` som er 24px eller custom `backdrop-filter: blur(24px)`.
- Fallback: `supports-backdrop-filter:backdrop-blur-xl` eller bare bruke en mer opak bg-black/55 for nettlesere uten støtte.

### 5. Animasjon — timing og easing
Apple bruker sin egen easing-kurve. Forslag:
- **Varighet:** 400ms (åpne), 300ms (lukke).
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` — Apple's standard "spring-like" kurve.
- **Transform:** `translateY(100%)` → `translateY(0)` kombinert med subtil `opacity: 0 → 1` på backdrop.
- **Close:** Radix støtter `data-[state=closed]:animate-out` + `slide-out-to-bottom` via `tailwindcss-animate` — gratis reverse.

### 6. Unikt navn på animasjoner (kritisk!)
Prior art viser at duplikate keyframes silently overrider. Vi MÅ bruke unike navn:
- `@keyframes map-modal-slide-up` (ikke `slide-up` som allerede finnes)
- `@keyframes map-modal-backdrop-in` (kan gjenbruke eksisterende `modal-backdrop-in` eller lage ny — vi lager ny for tydelighet, siden blur-intensiteten skiller dem)

Alternativt: bruk Radix/tailwindcss-animate utilities direkte på className uten å definere egne keyframes. Dette er sannsynligvis enklest og mest idiomatisk med shadcn.

### 7. Påvirker endringene andre dialoger?
- `CookiesModal.tsx` bruker også `Dialog`/`DialogContent`. Den har `className="max-w-md"` og forventer default sentrert oppførsel.
- **Plan:** IKKE endre default i `dialog.tsx`. Override via className i ReportThemeSection, eller legg til opt-in variant prop i DialogContent.

**Forslag:** Pass endringene kun til map-modalen via className-overstyringer. Ikke modifiser `dialog.tsx` sin default. Dette bevarer CookiesModal og åpner for at andre fremtidige dialoger også beholder default.

### 8. Close-knapp
Apple har en liten, perfect-round knapp med X i øvre høyre hjørne av selve modalen.
- Vår har allerede en close-knapp i headeren. Vi kan:
  - Beholde headeren med X-knappen som i dag (enklere, matcher Placy).
  - Eller: matche Apple mer presist med en sirkel-knapp absolutely posisjonert i top-right hjørne, uten header-bar.
- **Forslag:** Behold dagens header med X på mobil (trenger drag-handle + tittel). På desktop: absolutt posisjonert sirkel-knapp i top-right hjørne, header kollapses til bare innhold. 
- Enklere alternativ: Behold header-strukturen men re-styl den med sirkulær X-knapp. Mindre arbeid, lik UX.
- **Beslutning:** Behold header-struktur, beskjedne Apple-preg. Ikke overengineer close-knappen i første runde.

## Implementasjonsskisse

### Filer som endres

| Fil | Endring |
|-----|---------|
| `app/globals.css` | Legg til `map-modal-slide-up`, `map-modal-fade-in` (unike navn) |
| `components/variants/report/ReportThemeSection.tsx` | Oppdater className på `DialogContent` og overlay (via custom overlay eller className-prop) |
| `components/ui/dialog.tsx` | (Mulig) Tillat å overstyre `DialogOverlay` sin className via prop |

### Teknisk approach

Siden Radix Dialog har en intern `DialogOverlay` som rendrer backdrop, og `DialogContent` selv er innholdet, har vi to veier:

**A. Override className på DialogContent og DialogOverlay inline.**
- Trenger DialogOverlay eksponert eller at vi mounter en custom overlay.
- Shadcn-dialog pakker `DialogContent` inne i `DialogOverlay` i samme fil (linje 60), så overlay-className settes internt. Vi må enten endre dialog.tsx eller acceptere svakere backdrop.
- Enkleste: **endre `DialogOverlay`-className i dialog.tsx for å støtte sterkere blur**, men ENDRE KUN hvis ikke annen dialog ville bli påvirket (CookiesModal kan håndtere det fint — sterkere blur er et designvalg, ikke en feil).

**B. Dropp shadcn Dialog, bygg custom med Radix direkte i ReportThemeSection.**
- Mer kode, men full kontroll.
- Ikke verdt det.

**C. Erstatt dialog.tsx sin default blur med Apple-nivå, og legg til slide-up til DialogContent.**
- Dette er det mest idiomatiske. Siden vi bare har 2 bruk (map + cookies), kan vi sjekke at begge ser bra ut med den nye backdrop.
- CookiesModal vil også få Apple-style backdrop → sannsynligvis en forbedring.

**Valgt approach: C** — gjør Apple-style til default i `dialog.tsx`, verifisert mot CookiesModal i testfasen.

### Animasjons-CSS (kjerne)

```css
/* In globals.css */
@keyframes map-modal-slide-up {
  from { transform: translateY(100%); opacity: 0.5; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes map-modal-slide-down {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(100%); opacity: 0.5; }
}

@keyframes map-modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-map-modal-in {
  animation: map-modal-slide-up 400ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

.animate-map-modal-out {
  animation: map-modal-slide-down 300ms cubic-bezier(0.32, 0.72, 0, 1) both;
}
```

Alternativt: bruk tailwindcss-animate sitt innebygde `slide-in-from-bottom` via className — ingen egen CSS nødvendig.

### JSX-endring i ReportThemeSection

```tsx
<Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
  <DialogContent
    showCloseButton={false}
    className={cn(
      "flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white",
      // Apple-style: fester til bunn, rounded alle hjørner
      "fixed bottom-0 left-0 right-0 top-[8vh]",
      "md:inset-x-[4vw] md:top-[5vh] md:bottom-0",
      "rounded-2xl",
      // Slide up on open, slide down on close
      "data-[state=open]:animate-map-modal-in",
      "data-[state=closed]:animate-map-modal-out"
    )}
  >
    {/* ... */}
  </DialogContent>
</Dialog>
```

### DialogOverlay-endring i dialog.tsx

```tsx
// Før
"fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"

// Etter
"fixed inset-0 isolate z-50 bg-black/40 duration-300 supports-backdrop-filter:backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-400 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-300"
```

## Mål / akseptansekriterier

1. ✅ Map-modal glir opp fra bunnen ved åpning — smooth ease-out, ~400ms.
2. ✅ Ved lukking glir modalen ned igjen — ~300ms.
3. ✅ Backdrop har tydelig blur-effekt (ikke svak, `backdrop-blur-xl` eller sterkere) + mørk overlay.
4. ✅ Modal fester seg til bunnen (0px fra viewport-bunn) med luft i toppen (~5-8vh).
5. ✅ Rounded corners på alle 4 hjørner.
6. ✅ Fungerer identisk på mobil og desktop (samme animasjon + stil, skalert for bredde).
7. ✅ Eksisterende funksjonalitet (POI-markører, drawer, transport-data) er uendret.
8. ✅ `CookiesModal` ser fortsatt bra ut med den nye backdrop-blur (muligens forbedret).
9. ✅ 60fps på iPhone (ikke lagging) — testes med Chrome DevTools throttle.
10. ✅ Keyboard (Escape), focus-trap, ARIA alle fungerer som før (arvet fra Radix).

## Ikke-mål

- Endrer ikke selve kart-innholdet (POI-rendering, transport-chips, etc).
- Endrer ikke `CollectionDrawer` eller andre modal-like komponenter.
- Lager ikke ny generisk Apple-modal-komponent (gjenbruker shadcn Dialog).
- Drag-to-dismiss-gest på mobil (swipe ned for å lukke) — blir en follow-up hvis ønsket.

## Åpne spørsmål

Ingen kritiske. Brukeren har gitt tydelig visuell referanse og bekreftet identisk oppførsel på mobil og desktop.
