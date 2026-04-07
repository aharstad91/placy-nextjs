---
title: "feat: Profil-filter for Explorer Eiendom - Bolig"
type: feat
date: 2026-04-07
deepened: 2026-04-07
brainstorm: docs/brainstorms/2026-04-07-profil-filter-eiendom-brainstorm.md
---

# Profil-filter for Explorer Eiendom - Bolig

## Enhancement Summary

**Deepened on:** 2026-04-07
**Research agents used:** frontend-design, kompass-code-extraction, learnings-check, repo-research, spec-flow-analyzer

### Key Improvements
1. Konkrete Tailwind-klasser og animasjonsspecs fra KompassOnboarding-mønsteret
2. Parchment-palett (#faf9f7) konsistent med WelcomeScreen — ikke bg-white som Kompass
3. Gotcha fra learnings: håndter edge case der alle kategorier er disabled (0 POI-er)
4. Exit-animasjon (slide-down) og selection feedback (scale press/bounce + 400ms delay)

---

## Sammendrag

Bottom sheet modal over Explorer-kartet for Eiendom-Bolig-prosjekter. Brukeren velger livsfase (barnefamilie, par, singel, pensjonist) og Explorer filtrerer automatisk til relevante temaer. Samme UX-mønster som KompassOnboarding (Event).

## Problem

Eiendom-Explorer viser 200+ POI-er fordelt på 7 temaer. Det er overveldende. Boligkjøpere har ulike prioriteringer basert på livsfase — en barnefamilie bryr seg om skoler, ikke uteliv. I dag starter alle med alle temaer på, og må manuelt skru av via tema-chips.

## Løsning

Ett-stegs livsfase-velger som bottom sheet over kartet. Velg livsfase → temaer settes automatisk → Explorer åpner filtrert. "Hopp over" gir alle temaer (dagens default).

## Akseptansekriterier

- [ ] Bottom sheet modal vises over kartet ved første besøk på Eiendom-Bolig Explorer
- [ ] 4 livsfase-valg: Barnefamilie, Par uten barn, Aktiv singel, Pensjonist
- [ ] "Hopp over"-CTA som dismisser modalen med alle temaer aktive
- [ ] Klikk utenfor modalen (backdrop) = hopp over
- [ ] Valg av livsfase setter riktige temaer av/på og dismisser modalen
- [ ] Etter dismissal kan brukeren justere temaer via tema-chips (eksisterende UX)
- [ ] Modalen vises IKKE i collection view
- [ ] Modalen vises IKKE når URL har `initialCategories` (deep link)
- [ ] Feature-flagget `profilFilter` på bransjeprofilen styrer visning
- [ ] Kart med POI-markører synlig bak modalen (semi-transparent backdrop)
- [ ] Mobil-først: bottom sheet. Desktop: centered modal
- [ ] Selection feedback: visuell respons (scale + border) før dismiss med 400ms delay
- [ ] Exit-animasjon: slide-down + backdrop fade

## Livsfase → Tema-mapping

Mapping bruker theme IDs fra `BOLIG_THEMES` i `lib/themes/bransjeprofiler.ts`. Koden flatter til category IDs via `theme.categories`.

| Livsfase | Temaer PÅ (theme IDs) | Temaer AV |
|----------|----------------------|-----------|
| `family` — Barnefamilie | `barn-oppvekst`, `hverdagsliv`, `natur-friluftsliv`, `transport` | `mat-drikke`, `opplevelser`, `trening-aktivitet` |
| `couple` — Par uten barn | `mat-drikke`, `opplevelser`, `trening-aktivitet`, `hverdagsliv` | `barn-oppvekst`, `natur-friluftsliv`, `transport` |
| `single` — Aktiv singel | `mat-drikke`, `trening-aktivitet`, `opplevelser`, `transport` | `barn-oppvekst`, `hverdagsliv`, `natur-friluftsliv` |
| `senior` — Pensjonist | `hverdagsliv`, `natur-friluftsliv`, `opplevelser`, `transport` | `barn-oppvekst`, `mat-drikke`, `trening-aktivitet` |
| `skip` — Hopp over | alle 7 temaer PÅ | ingen |

## Teknisk design

### Arkitektur

```
ExplorerPage.tsx
  ├── showProfilFilter = features.profilFilter && !isCollectionView && !hasInitialCategories
  ├── profilFilterDismissed (useState, default false)
  │
  ├── <BoligProfilFilter>  (vises når showProfilFilter && !profilFilterDismissed)
  │     ├── backdrop (semi-transparent, onClick = skip)
  │     ├── 4 livsfase-kort (radio-style, single select)
  │     ├── "Hopp over" CTA
  │     └── onSelect(livsfase) → beregn disabledCategories → callback → dismiss
  │
  └── disabledCategories ← oppdateres av callback fra BoligProfilFilter
```

### Ingen egen Zustand store

Kompass trenger egen store fordi den har multi-steg flow, tabs, og kompleks state. Profil-filteret er ett steg med én callback — `useState` i ExplorerPage er tilstrekkelig.

- `profilFilterDismissed: boolean` — kontrollerer om modalen vises
- Ingen persistering — modalen vises hver gang (sessionStorage kan legges til senere)

### Suppression-regler

Modalen vises **ikke** når:
1. `features.profilFilter` er `false` (bransjeprofil)
2. `isCollectionView` er `true` (collection-modus)
3. URL har `initialCategories` (deep link med forhåndsvalgte kategorier)
4. `profilFilterDismissed` er `true` (bruker har allerede valgt/skippet)

---

## Implementeringsplan

### Steg 1: Feature flag i bransjeprofil

**Fil:** `lib/themes/bransjeprofiler.ts`

1. Legg til `profilFilter?: boolean` i `BransjeprofilFeatures` interface
2. Sett `profilFilter: true` på "Eiendom - Bolig" bransjeprofil i `features`-blokken

```typescript
// I BransjeprofilFeatures:
profilFilter?: boolean;

// I BRANSJEPROFILER["Eiendom - Bolig"]:
features: {
  profilFilter: true,
},
```

### Steg 2: Livsfase-mapping

**Fil:** `lib/themes/profil-filter-mapping.ts` (ny fil)

```typescript
import type { ThemeDefinition } from "./theme-definitions";

export type Livsfase = "family" | "couple" | "single" | "senior";

export interface LivsfaseOption {
  id: Livsfase;
  label: string;
  icon: string;
  description: string;
  enabledThemes: string[];
}

export const LIVSFASE_OPTIONS: LivsfaseOption[] = [
  {
    id: "family",
    label: "Barnefamilie",
    icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}",
    description: "Skole, barnehage, lekeplasser og trygge nabolag",
    enabledThemes: ["barn-oppvekst", "hverdagsliv", "natur-friluftsliv", "transport"],
  },
  {
    id: "couple",
    label: "Par uten barn",
    icon: "\u{1F491}",
    description: "Restauranter, kultur, trening og hverdagsliv",
    enabledThemes: ["mat-drikke", "opplevelser", "trening-aktivitet", "hverdagsliv"],
  },
  {
    id: "single",
    label: "Aktiv singel",
    icon: "\u{1F3C3}",
    description: "Uteliv, trening, opplevelser og mobilitet",
    enabledThemes: ["mat-drikke", "trening-aktivitet", "opplevelser", "transport"],
  },
  {
    id: "senior",
    label: "Pensjonist",
    icon: "\u{1F9D3}",
    description: "Hverdagstjenester, natur, kultur og transport",
    enabledThemes: ["hverdagsliv", "natur-friluftsliv", "opplevelser", "transport"],
  },
];

/**
 * Get category IDs to DISABLE for a given livsfase.
 * Takes all themes from bransjeprofil, finds those NOT in enabledThemes,
 * flattens their categories into a Set.
 */
export function getDisabledCategories(
  livsfase: Livsfase,
  allThemes: ThemeDefinition[]
): Set<string> {
  const option = LIVSFASE_OPTIONS.find((o) => o.id === livsfase);
  if (!option) return new Set();

  const disabled = new Set<string>();
  for (const theme of allThemes) {
    if (!option.enabledThemes.includes(theme.id)) {
      for (const cat of theme.categories) {
        disabled.add(cat);
      }
    }
  }
  return disabled;
}
```

### Steg 3: BoligProfilFilter-komponent

**Fil:** `components/variants/explorer/BoligProfilFilter.tsx` (ny fil)

**Props:**
```typescript
interface BoligProfilFilterProps {
  projectName: string;
  onSelect: (livsfase: Livsfase) => void;
  onSkip: () => void;
}
```

**Bottom sheet struktur (kopiér fra KompassOnboarding):**
```tsx
// Outer container — same as KompassOnboarding
<div className="absolute inset-0 z-40 flex items-end lg:items-center lg:justify-center">
  {/* Backdrop — litt lettere enn Kompass for at kart-markører skal synes */}
  <div
    className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
    onClick={onSkip}
  />

  {/* Sheet — parchment-palett, ikke bg-white */}
  <div className="relative w-full lg:w-[400px] lg:rounded-2xl bg-[#faf9f7]
                  rounded-t-2xl shadow-2xl animate-slide-up max-h-[70vh] flex flex-col">
    {/* Drag handle — mobile only */}
    <div className="w-10 h-1 bg-[#ddd9d3] rounded-full mx-auto mt-3 mb-4 lg:hidden" />

    {/* Content */}
    <div className="px-5 pb-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold text-[#1a1a1a] text-center">
        Hva passer deg best?
      </h2>

      {/* Option cards */}
      <div className="flex flex-col gap-2.5">
        {LIVSFASE_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                       border border-[#ddd9d3] bg-white
                       hover:border-[#c5bfb8] hover:shadow-sm
                       active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="text-2xl">{option.icon}</span>
            <div className="text-left">
              <span className="text-sm font-medium text-[#1a1a1a]">{option.label}</span>
              <p className="text-xs text-[#6a6360]">{option.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Skip CTA — inline, not sticky footer */}
      <button
        onClick={onSkip}
        className="py-3 text-xs uppercase tracking-[0.15em] text-[#6a6360]
                   hover:text-[#1a1a1a] transition-colors"
      >
        Hopp over
      </button>
    </div>
  </div>
</div>
```

**Selection feedback og dismiss:**
```typescript
function handleSelect(livsfase: Livsfase) {
  // Visuell feedback — kort delay før dismiss
  setSelectedId(livsfase);
  setTimeout(() => {
    onSelect(livsfase);
  }, 400);
}
```

Valgt kort får `border-[#1a1a1a] bg-[#f5f3f0] shadow-sm` state mens 400ms delay tikker.

**Animasjon — gjenbruk eksisterende `animate-slide-up` fra `globals.css`:**
Kompass definerer allerede `@keyframes slide-up` og `.animate-slide-up` i `app/globals.css:92-103`. Gjenbruk direkte — ingen nye keyframes nødvendig for entry.

### Steg 4: Integrer i ExplorerPage

**Fil:** `components/variants/explorer/ExplorerPage.tsx`

1. Importer `BoligProfilFilter` og `getDisabledCategories`
2. Legg til `profilFilterDismissed` state (`useState(false)`)
3. Beregn `showProfilFilter` (plassér nær `showKompass` ca. linje 173):
   ```typescript
   const showProfilFilter = !!features?.profilFilter && !isCollectionView && !initialCategories;
   ```
4. Legg til handlers:
   ```typescript
   const handleProfilSelect = useCallback((livsfase: Livsfase) => {
     const disabled = getDisabledCategories(livsfase, themes);
     setDisabledCategories(disabled);
     setProfilFilterDismissed(true);
   }, [themes]);

   const handleProfilSkip = useCallback(() => {
     setProfilFilterDismissed(true);
   }, []);
   ```
5. Render `<BoligProfilFilter>` (plassér nær KompassOnboarding-rendering, ca. linje 774):
   ```tsx
   {showProfilFilter && !profilFilterDismissed && (
     <BoligProfilFilter
       projectName={project.name}
       onSelect={handleProfilSelect}
       onSkip={handleProfilSkip}
     />
   )}
   ```

**OBS: Profil-filter og Kompass er gjensidig eksklusivt** — Eiendom-Bolig har `profilFilter: true`, Event har `kompass: true`. Begge sjekker egne feature flags, så de vil aldri vises samtidig.

---

## Edge Cases

### Alle kategorier disabled etter manuell justering
**Fra learning:** `empty-product-categories-explorer-zero-pois-20260205.md`

Etter profil-filter setter 3 av 7 temaer AV, kan brukeren via tema-chips skru av de resterende 4 — og få 0 synlige POI-er. Eksisterende Explorer-kode håndterer dette allerede med "0 av X steder synlige" melding. Ingen ekstra kode nødvendig, men vær obs på at dette er mulig.

### initialCategories-konflikt
Hvis URL har `?themes=mat-drikke,transport` (deep link), vises IKKE profil-filteret. Deep link-intent overstyrer generisk profil-filter. Eksisterende `initialCategories`-logikk i ExplorerPage håndterer dette.

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `lib/themes/bransjeprofiler.ts` | Legg til `profilFilter` i interface + `features: { profilFilter: true }` på Eiendom-Bolig |
| `lib/themes/profil-filter-mapping.ts` | **Ny** — livsfase-typer, options, `getDisabledCategories()`-funksjon |
| `components/variants/explorer/BoligProfilFilter.tsx` | **Ny** — bottom sheet modal-komponent |
| `components/variants/explorer/ExplorerPage.tsx` | Integrer profil-filter: state, handlers, conditional render |

## Test Cases

### Functional

```
TC-01 | Functional | P1
Requirement: Bottom sheet modal vises over kartet ved første besøk
Given: Bruker åpner Eiendom-Bolig Explorer for første gang
When: ExplorerPage rendres
Then: BoligProfilFilter bottom sheet vises med 4 livsfase-valg over kartet

TC-02 | Functional | P1
Requirement: Valg av livsfase setter riktige temaer av/på
Given: BoligProfilFilter er synlig
When: Bruker klikker "Barnefamilie"
Then: disabledCategories inneholder category IDs fra mat-drikke, opplevelser, trening-aktivitet temaene. Explorer viser kun POI-er fra barn-oppvekst, hverdagsliv, natur-friluftsliv, transport.

TC-03 | Functional | P1
Requirement: "Hopp over" dismisser med alle temaer aktive
Given: BoligProfilFilter er synlig
When: Bruker klikker "Hopp over"
Then: Modalen dismisses, disabledCategories er tom Set, alle 7 temaer vises

TC-04 | Functional | P1
Requirement: Backdrop-klikk = hopp over
Given: BoligProfilFilter er synlig
When: Bruker klikker på backdrop (utenfor modalen)
Then: Samme som TC-03 — modal dismisses, alle temaer aktive

TC-05 | Functional | P2
Requirement: Selection feedback med delay
Given: BoligProfilFilter er synlig
When: Bruker klikker et livsfase-kort
Then: Kortet får selected styling (border-[#1a1a1a], bg-[#f5f3f0]), 400ms delay, deretter dismiss

TC-06 | Functional | P1
Requirement: Etter dismissal kan temaer justeres via tema-chips
Given: Bruker har valgt "Barnefamilie" og modalen er dismisset
When: Bruker klikker på "Mat & Drikke" tema-chip
Then: Mat & Drikke-temaet aktiveres, POI-er fra det temaet vises
```

### Suppression

```
TC-07 | Functional | P1
Requirement: Modalen vises IKKE i collection view
Given: Eiendom-Bolig Explorer i collection view (isCollectionView=true)
When: Siden rendres
Then: BoligProfilFilter rendres IKKE

TC-08 | Functional | P1
Requirement: Modalen vises IKKE med initialCategories
Given: URL har ?themes=mat-drikke,transport
When: Siden rendres
Then: BoligProfilFilter rendres IKKE, deep link-kategorier brukes

TC-09 | Functional | P1
Requirement: Feature flag styrer visning
Given: Prosjekt med tag "Event" (ikke Eiendom-Bolig)
When: Siden rendres
Then: BoligProfilFilter rendres IKKE (features.profilFilter er undefined)
```

### Edge Cases

```
TC-10 | Edge-case | P2
Requirement: Alle 4 livsfaser mapper korrekt
Given: BoligProfilFilter er synlig
When: Bruker velger "Par uten barn"
Then: barn-oppvekst, natur-friluftsliv, transport er disabled. mat-drikke, opplevelser, trening-aktivitet, hverdagsliv er aktive.

TC-11 | Edge-case | P2
Requirement: Alle 4 livsfaser mapper korrekt (singel)
Given: BoligProfilFilter er synlig
When: Bruker velger "Aktiv singel"
Then: barn-oppvekst, hverdagsliv, natur-friluftsliv er disabled. mat-drikke, trening-aktivitet, opplevelser, transport er aktive.

TC-12 | Edge-case | P2
Requirement: Alle 4 livsfaser mapper korrekt (senior)
Given: BoligProfilFilter er synlig
When: Bruker velger "Pensjonist"
Then: barn-oppvekst, mat-drikke, trening-aktivitet er disabled. hverdagsliv, natur-friluftsliv, opplevelser, transport er aktive.
```

### Visual / UX

```
TC-13 | Visual | P1
Requirement: Mobil-først bottom sheet, desktop centered modal
Given: Bruker åpner på mobil
When: BoligProfilFilter rendres
Then: Sheet er bottom-aligned (rounded-t-2xl), drag handle synlig

TC-14 | Visual | P1
Requirement: Kart synlig bak modalen
Given: BoligProfilFilter er synlig
When: Bruker ser på skjermen
Then: Kart med POI-markører er synlig gjennom semi-transparent backdrop (bg-black/25)
```

### Implementation Step → TC Mapping

```
Steg 1 (Feature flag)     → TC-09
Steg 2 (Livsfase-mapping) → TC-02, TC-10, TC-11, TC-12
Steg 3 (Komponent)        → TC-01, TC-03, TC-04, TC-05, TC-13, TC-14
Steg 4 (ExplorerPage)     → TC-01, TC-02, TC-03, TC-04, TC-06, TC-07, TC-08
```

---

## Referanser

- KompassOnboarding: `components/variants/explorer/KompassOnboarding.tsx` — UX-mønster, bottom sheet struktur
- Bransjeprofiler: `lib/themes/bransjeprofiler.ts` — feature flags, theme definitions
- ExplorerPage filtering: `components/variants/explorer/ExplorerPage.tsx:74-106` — disabledCategories flow
- Globals CSS: `app/globals.css:92-103` — eksisterende `animate-slide-up` keyframe
- Compound doc: `docs/solutions/feature-implementations/kompass-event-recommendation-prototype-20260311.md`
- Learning: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`
