# Plan: Apple-style Map Modal

**Dato:** 2026-04-15
**Brainstorm:** `docs/brainstorms/2026-04-15-apple-style-map-modal-brainstorm.md`
**Scope:** Re-design map-modal i `ReportThemeSection.tsx` for å matche Apple's modal-interaksjon (fra apple.com/no/macbook-pro).
**Branch:** `feat/apple-modal`

## Mål

Gjenskape Apple's slide-up-from-bottom modal med kraftig backdrop-blur for Placy sin rapport-kart-modal. Identisk oppførsel på desktop og mobil.

## Designbeslutninger (fra brainstorm — godkjent)

| Beslutning | Verdi |
|------------|-------|
| Modal-posisjon desktop | `inset-x-[4vw] top-[5vh] bottom-0` |
| Modal-posisjon mobil | `inset-x-0 top-[8vh] bottom-0` |
| Rounded corners | `rounded-2xl` alle fire hjørner |
| Backdrop | `bg-black/40 backdrop-blur-xl` (24px blur) |
| Åpne-animasjon | 400ms `cubic-bezier(0.32, 0.72, 0, 1)` slide-up |
| Lukke-animasjon | 300ms `cubic-bezier(0.32, 0.72, 0, 1)` slide-down |
| CSS-navn | `map-modal-slide-up`, `map-modal-slide-down` (unikt, ikke `slide-up`) |
| Header | Beholder eksisterende header med X-knapp og drag-handle på mobil |
| Scope-approach | Endrer `dialog.tsx` defaults (påvirker CookiesModal positivt) + override i ReportThemeSection |

## Deepening (best practices + research)

### Apple's easing-kurve
Apple bruker `cubic-bezier(0.32, 0.72, 0, 1)` for deres modal-animasjoner — dette gir en "spring-like" kurve med rask start og myk, forsinket landing. Dette er dokumentert i Apple's Human Interface Guidelines under "Motion" og observerbart i Safari inspector på deres sider.

Alternativer vurdert:
- `ease-out` — for generisk, lacks Apple's signatur
- `cubic-bezier(0.16, 1, 0.3, 1)` — Radix default for slide, bra men mindre "Apple"
- **Valgt:** `cubic-bezier(0.32, 0.72, 0, 1)` — matcher Apple's kurve

### GPU-akselerasjon for 60fps på mobil
`transform: translateY()` og `opacity` er **compositor-only** properties — de trigger ikke layout eller paint. Dette er essensielt for 60fps på mobil. Vi bruker kun disse i animasjonen.

`backdrop-filter: blur()` er derimot **dyrt** — særlig på lavspek-enheter. For en kortvarig modal-overlay (skjules av fading når lukket) er det akseptabelt, men vi bør:
- Bruke `isolate` på overlay-elementet (allerede gjort) for å begrense compositor-arbeid
- IKKE animere blur-verdien (dyrt) — bare fade opacity på overlay
- Fallback via `@supports (backdrop-filter: blur())` for nettlesere uten støtte

### Radix-state + tailwindcss-animate
Radix Dialog eksponerer `data-state="open|closed"` på innholdet, som vi binder animasjoner til:
```tsx
className="data-[state=open]:animate-map-modal-in data-[state=closed]:animate-map-modal-out"
```

`tailwindcss-animate` (v1.0.7) er installert, men vi bruker egne keyframes for å ha full Apple-spesifikk kontroll og unngå kollisjoner med tailwindcss-animate sine `slide-in-from-bottom`.

### prefers-reduced-motion
Brukere med `prefers-reduced-motion: reduce` bør få:
- Ingen slide-animasjon (instant vise)
- Ingen backdrop fade-inn (instant)
- Close-animasjon samme — instant

Dette legges til via CSS media query.

### Z-index-lag (fra eksisterende system)
Fra prior art og kodebase:
```
z-20: Floating widgets
z-30: Bottom sheets
z-40: Sidebars
z-50: Modals (Radix default — OK)
```
Map-modal er z-50 via Radix. Ingen endring trengs.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `app/globals.css` | Legg til `@keyframes map-modal-slide-up`, `map-modal-slide-down`, tilhørende `.animate-*` klasser + `prefers-reduced-motion` |
| `components/ui/dialog.tsx` | Oppdater `DialogOverlay` className: sterkere backdrop-blur (`xl` i stedet for `sm`), lengre duration på fade |
| `components/variants/report/ReportThemeSection.tsx` | Oppdater `DialogContent` className: fest til bunn, Apple-posisjon, slide-up animasjon |

## Implementasjonssteg

### Steg 1: Legg til CSS-animasjoner i `globals.css` → TC-01, TC-02, TC-08

Legg til ETTER eksisterende `@keyframes slide-up` (linje ~107) for å være tett med relatert kode, men med unike navn:

```css
/* Apple-style map modal — slide up from bottom, slide down to bottom */
@keyframes map-modal-slide-up {
  from {
    transform: translateY(100%);
    opacity: 0.6;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes map-modal-slide-down {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0.6;
  }
}

.animate-map-modal-in {
  animation: map-modal-slide-up 400ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

.animate-map-modal-out {
  animation: map-modal-slide-down 300ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  .animate-map-modal-in,
  .animate-map-modal-out {
    animation: none;
  }
}
```

**Verifiseres:** Kjør `grep -n "@keyframes" app/globals.css` og bekreft ingen duplikater etter tillegg.

### Steg 2: Oppdater `DialogOverlay` i `dialog.tsx` → TC-03, TC-04

Endre className for `DialogOverlay`:

**Før:**
```tsx
"fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
```

**Etter (justert etter tech-audit):**
```tsx
"fixed inset-0 isolate z-50 bg-black/40 supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl supports-[backdrop-filter:blur(1px)]:bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200"
```

**Endringer:**
- `bg-black/30` → `bg-black/40` (fallback uten blur støtte)
- `supports-[backdrop-filter:blur(1px)]:bg-black/30` (tynnere overlay når blur er aktiv — kombinert effekt blir sterkere)
- `backdrop-blur-sm` → `backdrop-blur-xl` (4px → 24px)
- **Tech-audit funn:** Bruker `supports-[backdrop-filter:blur(1px)]` ikke `supports-[backdrop-filter]` fordi sistnevnte genererer `@supports (backdrop-filter: var(--tw))` som ikke er en gyldig feature query. Den korrekte formen `@supports (backdrop-filter: blur(1px))` er bredt støttet. **Bonus:** Eksisterende `supports-backdrop-filter:backdrop-blur-sm` var en no-op — blur har aldri fungert i produksjon. Denne planen fikser det implisitt.
- Fjern `duration-100`, legg til separate `duration-*` for open og closed
- `duration-300` for open matcher ~300ms når selve modalen slider opp ~400ms — backdrop settles først, deretter modal completerer

### Steg 3: Oppdater `DialogContent`-className i `ReportThemeSection.tsx` → TC-01, TC-05, TC-06, TC-07

Nåværende (linje 356-359):
```tsx
<DialogContent
  showCloseButton={false}
  className="flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white fixed bottom-0 left-0 right-0 h-[85vh] rounded-t-2xl rounded-b-none md:static md:w-[80vw] md:h-[80vh] md:rounded-2xl"
>
```

Ny:
```tsx
<DialogContent
  showCloseButton={false}
  className="flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white
    fixed inset-x-0 bottom-0 top-[8vh]
    md:inset-x-[4vw] md:top-[5vh] md:bottom-0
    rounded-2xl
    data-[state=open]:animate-map-modal-in
    data-[state=closed]:animate-map-modal-out"
>
```

**Endringer:**
- `h-[85vh]` → `top-[8vh] bottom-0` (samme effekt, men eksplisitt festet til bunn)
- `md:static md:w-[80vw] md:h-[80vh]` → `md:inset-x-[4vw] md:top-[5vh] md:bottom-0` (Apple-posisjonering)
- `rounded-t-2xl rounded-b-none md:rounded-2xl` → `rounded-2xl` (alle fire hjørner alltid)
- Fjern `static` — nå er alltid `fixed` (Radix-portal håndterer det uansett)
- Legg til `data-[state=*]:animate-map-modal-*` for slide-up/down

### Steg 4: Verifiser — visuell + mekanisk → TC-09, TC-10

**Mekanisk:**
- `npm run lint` → 0 errors
- `npx tsc --noEmit` → ingen typefeil
- `npm run build` → bygger uten feil

**Visuell:**
- Start dev server på port 3001 (worktree-convention)
- Naviger til en rapport-side med tema-sectioner
- Klikk "Utforsk kartet" på mobil + desktop (Chrome DevTools throttle til "Fast 3G" + "CPU 4x slowdown" for å simulere mobil)
- Ta screenshots av:
  - Åpne-animasjon (midt-frame)
  - Fullt åpnet modal
  - Lukke-animasjon (midt-frame)
- Verifiser at `CookiesModal` fortsatt ser bra ut (footer → Informasjonskapsler)

### Steg 5: Kommersialiser og commit → TC-11

Commit med beskrivende melding, push til remote.

## Test Cases

| ID | Kategori | Prioritet | Krav | Given | When | Then |
|----|----------|-----------|------|-------|------|------|
| TC-01 | Funksjonell | P1 | Modal glir opp fra bunn | Report-side med "Utforsk kartet"-knapp | Bruker klikker knappen | Modal glir smooth opp fra bunn over ~400ms |
| TC-02 | Funksjonell | P1 | Lukking glir ned | Modal er åpen | Bruker klikker X eller backdrop | Modal glir ned over ~300ms før den demounters |
| TC-03 | Funksjonell | P1 | Backdrop har kraftig blur | Modal åpnes | Backdrop blir synlig | Bakgrunn er tydelig uskarp (24px blur) + subtil mørk overlay |
| TC-04 | Funksjonell | P2 | Fallback for nettlesere uten backdrop-filter | Modal åpnes i nettleser uten backdrop-filter-støtte | Backdrop rendres | `bg-black/40` gir tilstrekkelig kontrast uten blur |
| TC-05 | Visuell | P1 | Modal fester seg til bunn | Modal er åpen | — | Nedre kant av modal er ved viewport-bunn (0px fra bunn) |
| TC-06 | Visuell | P1 | Luft i topp | Modal er åpen desktop | — | Øvre kant er ~5vh fra viewport-topp |
| TC-06b | Visuell | P1 | Luft i topp mobil | Modal er åpen mobil | — | Øvre kant er ~8vh fra viewport-topp |
| TC-07 | Visuell | P1 | Rounded corners | Modal er åpen | — | Øvre hjørner har tydelig `rounded-2xl` radius |
| TC-08 | Funksjonell | P1 | Unike animasjonsnavn (ingen collision) | `grep @keyframes app/globals.css` | — | Ingen duplikater for `slide-up`, `modal-backdrop-in`, `modal-in`, `map-modal-slide-up`, `map-modal-slide-down` |
| TC-09 | Regresjon | P1 | CookiesModal påvirket positivt | Åpne CookiesModal via footer-link | — | Modal ser fortsatt bra ut, backdrop har tydeligere blur enn før |
| TC-10 | A11y | P1 | Escape lukker modalen | Modal er åpen | Bruker trykker Escape | Modal lukkes med slide-down-animasjon |
| TC-11 | A11y | P2 | prefers-reduced-motion | Bruker har `prefers-reduced-motion: reduce` | Modal åpnes | Modal vises uten slide-animasjon (fade via Radix gjenstår) |
| TC-12 | Funksjonell | P1 | POI-markør-klikk fungerer | Modal åpen | Klikk på POI-markør | Selected POI oppdateres og `ReportMapDrawer` vises |
| TC-13 | Funksjonell | P1 | Modal kan åpnes flere ganger | Modal er åpnet + lukket | Klikk "Utforsk kartet" igjen | Modal glir opp på nytt med full animasjon |
| TC-14 | Ytelse | P2 | 60fps på desktop | Modal åpnes på desktop | Chrome DevTools Performance | Ingen frame-drops >16ms under animasjon |
| TC-15 | Ytelse | P3 | 60fps på mobil-emulering | Modal åpnes med Chrome mobile-emulering + CPU 4x slowdown | — | Animasjonen oppleves jevn (vurderes visuelt) |

## Implementasjonssteg → TC mapping

| Steg | TC-IDs |
|------|--------|
| Steg 1: CSS-animasjoner | TC-01, TC-02, TC-08, TC-11 |
| Steg 2: DialogOverlay backdrop | TC-03, TC-04, TC-09 |
| Steg 3: DialogContent-klasser | TC-01, TC-02, TC-05, TC-06, TC-06b, TC-07, TC-13 |
| Steg 4: Verifiser | TC-09, TC-10, TC-12, TC-14, TC-15 |
| Steg 5: Commit | (ingen direkte TC) |

Hver implementasjonssteg mapper til ≥1 TC; hver TC dekkes av ≥1 steg ✓

## Risiko og mitigeringer (blir utdypet i tech audit)

| Risiko | Sannsynlighet | Mitigering |
|--------|---------------|------------|
| `backdrop-blur-xl` laggy på lavspek-mobil | Medium | Fallback via `supports-[backdrop-filter]`; blur animerer ikke (kun opacity) |
| CSS-keyframes kollisjon (prior art!) | Lav — vi bruker unike navn | Verifiser med grep post-endring |
| `CookiesModal` visuelt ødelagt av sterkere blur | Lav | Visuell sjekk i Steg 4 |
| Radix-state-attributes endrer seg mellom versjoner | Svært lav | Låst til nåværende Radix-versjon; Radix er stabilt |
| Animasjon oppfattes "treg" på desktop | Lav | 400ms er Apple's eget valg — god fit |

## Ikke-mål

- Swipe-to-dismiss på mobil (follow-up)
- Endre CollectionDrawer eller Modal.tsx
- Endre kart-innholdet
- Ny generisk Apple-modal-komponent

## Ferdigkriterier

1. Alle 15 test cases passerer (P1 må passe; P2/P3 dokumenteres hvis avvik)
2. `npm run lint` + `npx tsc --noEmit` + `npm run build` alle grønne
3. Visuell bekreftelse via Chrome DevTools — modal matcher Apple-referansen på både desktop og mobil
4. `CookiesModal` fortsatt funksjonell og visuelt OK
5. Commit + push til `feat/apple-modal`-branch
