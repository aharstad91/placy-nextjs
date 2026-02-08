# Placy Guide — Produktbrainstorm

**Dato:** 2026-02-02
**Trigger:** Bygge Guide-produktet — kuraterte, temabaserte turer
**Referanse:** [Visit Norway 10,000 skritt Trondheim](https://www.visitnorway.no/reisemal/byferie/10-000-skritt/trondheim/)

---

## Hva vi bygger

**Placy Guide** er et frittstående produkt for kuraterte gåturer. En guide inneholder et håndplukket sett POI-er i bestemt rekkefølge, vist på kart med rutelinje og støttet av redaksjonelt innhold.

**Mål:** 10x bedre UX enn Visit Norway-eksempelet, spesielt på mobil.

---

## Hvorfor denne tilnærmingen

### Visit Norway gjør bra:
- Nummerert liste med klar rekkefølge (1-7 stopp)
- Rutelinje visualisert på kartet
- Redaksjonelt innhold per stopp
- Sammenhengende narrativ som binder stoppene

### Hva Placy Guide gjør 10x bedre:
- **Mobil-først:** Fungerer perfekt når du faktisk går turen
- **Interaktivt kart:** Sanntids posisjon, klikk på markører
- **Progressjon:** Track hvor langt du har kommet, estimert tid igjen
- **Adaptive design:** Separate mobil- og desktop-opplevelser

---

## Nøkkelbeslutninger

### 1. Guide er et eget produkt
- ProductType: `"guide"` (ny verdi)
- Eget prosjekt med egne POI-er i bestemt rekkefølge
- Kan være standalone eller linket til Explorer

### 2. Mye gjenbruk fra Explorer
- Samme kart-komponent
- Samme POI-kort (tilpasset)
- Samme bottom sheet-mønster
- Ny logikk: rekkefølge, rute-visualisering, progressjon

### 3. Mobil UX: Navigasjons-modus
**Konsept:** Kart-først med ekspanderbart POI-panel

```
┌─────────────────────────┐
│                         │
│    KART med rute        │
│    + din posisjon       │
│    + nummererte markører│
│                         │
├─────────────────────────┤
│ ● ● ● ○ ○ ○ ○  3/7      │ ← Progressbar
├─────────────────────────┤
│ 3  Nidarosdomen         │
│    340m · 4 min         │ ← Kompakt panel
│    [Ekspander ↑]        │
└─────────────────────────┘
```

**Ekspandert panel:**
- Fullt POI-kort med bilde, editorial hook, beskrivelse
- "Merk som besøkt" → animasjon, vis neste stopp
- Kart minimeres men forblir synlig

### 4. Desktop UX: Split-view med interaktivitet
```
┌──────────────────┬──────────────────────────┐
│  LISTE           │                          │
│                  │        KART              │
│  1 ● Sellanraa   │        med rute          │
│  2 ○ Torget      │        og markører       │
│  3 ○ Nidaros     │                          │
│  ...             │                          │
├──────────────────┤                          │
│  Rute: 3.4 km    │                          │
│  ~45 min å gå    │                          │
└──────────────────┴──────────────────────────┘
```

- Klikk på liste-item → scroll kart + vis detaljer
- Klikk på markør → scroll liste + vis detaljer
- Hover-effekter for kobling mellom liste og kart

### 5. Innholdsmodell: Start minimalt
**MVP:** POI-navn, kort beskrivelse, bilde, koordinater
**Senere:** Editorial hook, local insight, sammenhengende narrativ

### 6. MVP-scope: Mobil prototype
- Én hardkodet guide (10,000 skritt Trondheim)
- Fungerende mobil-UX med navigasjons-modus
- Validere konseptet før full infrastruktur

---

## Åpne spørsmål

1. **Rute-beregning:** Bruke Mapbox Directions for faktisk gangvei, eller rett linje mellom punktene?
2. **Progressjon-persistens:** Lagre besøkte stopp lokalt (localStorage) eller kreve innlogging?
3. **Offline-støtte:** Skal guider kunne lastes ned for bruk uten nett?
4. **Notifikasjoner:** Varsle når du nærmer deg neste stopp? (krever bakgrunns-geolokasjon)
5. **Guide-bibliotek:** Hvordan vise flere guider for en by? Egen landingsside?

---

## Teknisk tilnærming

### Ny type i `lib/types.ts`:
```typescript
export type ProductType = "explorer" | "report" | "portrait" | "guide";

export interface GuideStop {
  poiId: string;
  order: number;
  transitionText?: string; // "Herfra går du over brua..."
}

export interface GuideConfig {
  stops: GuideStop[];
  totalDistance?: number; // meter
  estimatedDuration?: number; // minutter
  difficulty?: "easy" | "moderate" | "challenging";
}
```

### Ny variant-mappe:
```
components/variants/guide/
├── GuidePage.tsx          # Hovedkomponent
├── GuideMap.tsx           # Kart med rute-linje
├── GuideBottomSheet.tsx   # Mobil: ekspanderbart panel
├── GuideStopCard.tsx      # POI-kort tilpasset guide
├── GuideProgress.tsx      # Progressbar
└── GuideDesktopPanel.tsx  # Desktop: liste-panel
```

### Gjenbruk fra Explorer:
- `ExplorerMap.tsx` → Basiskart, markør-logikk
- `ExplorerPOICard.tsx` → POI-visning
- `ExplorerBottomSheet.tsx` → Sheet-mønster
- `GeoLocationWidget.tsx` → Brukerposisjon

---

## Neste steg

1. **Prototyp:** Bygg mobil-UX for 10,000 skritt Trondheim
2. **Test:** Gå turen med prototypen, noter hva som mangler
3. **Iterer:** Juster basert på faktisk bruk
4. **Infrastruktur:** Når UX er validert, bygg datamodell + admin

---

*Klar for `/workflows:plan` når mobil-prototype skal implementeres.*
