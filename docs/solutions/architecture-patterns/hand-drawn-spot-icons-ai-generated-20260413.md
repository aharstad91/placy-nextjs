---
title: "Håndtegnede spot-ikoner i samme AI-stil som illustrasjonene"
category: architecture-patterns
tags: [icons, ai-generated, illustrations, visual-identity, gemini, brand]
module: illustrations
created: 2026-04-13
---

# Hand-drawn spot-icons fra samme pipeline som illustrasjonene

**Gjelder:** Produkter/demos som har investert i distinkt akvarell- eller tegneaktig visuell identitet og trenger ikoner som ikke bryter den identiteten.

## Problem

Lucide, Heroicons, shadcn og lignende ikon-biblioteker er **stilmessig nøytrale/moderne** — rene geometriske linjer, uniform stroke-width, profesjonell minimalisme. De fungerer godt med moderne SaaS-UI.

Men ved siden av håndtegnede akvarell-illustrasjoner ser de **sjelløse og generiske ut**. Visuelt brudd: illustrasjonen sier "hand-crafted editorial", ikonet sier "stock UI component".

Effekt: brukeren registrerer ubevisst at "noe ikke stemmer" — demoen føles som en Lucide-app med illustrasjoner klistret på toppen, ikke som et gjennomført produkt.

## Løsning: Generer spot-ikoner via samme AI-pipeline som illustrasjonene

### Prinsipper

1. **Samme style-reference** — send inn samme referansebilde som brukes for hovedillustrasjonene
2. **Single focal object** — ikke en scene, bare én pictogram-verdig gjenstand (shopping bag, swing, coffee cup, book, bench, dumbbell, bicycle)
3. **Prompt-låst stil**:
   - "hand-drawn ink linework, slightly wobbly, warm dark grey (~#3a3530)"
   - "one muted watercolor wash per icon, transparent"
   - "NOT a flat vector icon, NOT a Lucide-style monoline icon"
4. **Pure hvit bakgrunn** med generøs safe-area (subject 50-60% av canvas)
5. **1:1 square** — universal aspect for ikoner
6. **Én palett-aksent per ikon** — salvie, terrakotta, oker, grå-blå — gir karakter uten å kreve hovedrolle

### Prompt-struktur (reuseable)

```python
STYLE_HEADER = """Generate a small pictogram icon in the SAME hand-drawn drawing
style as the reference image — loose ink linework, slightly imperfect pen strokes,
the feeling of an architect's sketch. NOT a flat vector icon. NOT a Lucide-style
monoline icon. Hand-drawn character is essential.

CRITICAL BACKGROUND REQUIREMENT:
- Background MUST be PURE WHITE (#FFFFFF). Solid white canvas, no tint.
- Icon centered with generous white margin around it.
- NO shadow, NO border, NO frame.

Style details:
- Ink outline in warm dark grey (not pure black) — approximately #3a3530
- ONE small muted watercolor wash behind or inside the shape (transparent).
- Muted Nordic palette. Must not dominate the ink line.
- No text, no labels, no logos.
- Square 1:1 composition, subject occupies 50-60% of canvas.

Feeling: a pictogram drawn with a fountain pen in a sketchbook, with a quick
watercolor wash. Single focal object only — not a scene."""

# Per-icon subject
ICONS = [
  {"slug": "hverdagsliv", "subject": "Subject: a simple shopping bag..."},
  {"slug": "barn-aktivitet", "subject": "Subject: a simple playground swing..."},
  # ... etc
]
```

Se `/tmp/gen_ikoner_batch.py` for live implementasjon.

### Placering i UI

Plasser sentrert **over** tittel (ikke inline til venstre):

```tsx
<div className="flex flex-col items-center text-center mb-8">
  <Image
    src={theme.iconSrc}
    alt=""
    aria-hidden="true"
    width={288}
    height={288}
    className="w-32 h-32 md:w-36 md:h-36 mb-3"
  />
  <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-5">
    {theme.name}
  </h2>
  <p className="text-xl md:text-2xl text-[#6a6a6a] leading-snug max-w-2xl">
    {renderEmphasizedText(bridgeText)}
  </p>
</div>
```

**Hvorfor ikke inline:** Hand-drawn ikoner har varierende proporsjoner og intern whitespace — inline lookes rotete ved siden av tekst. Over tittel, sentrert, får de plass til å være spot-illustrasjoner i stedet for pressede pikseldekorasjoner.

### Størrelse

- **w-32 md:w-36** (128-144px rendered) → detaljene kommer frem
- Intrinsic width/height `288` på `<Image>` → Next reserverer riktig plass
- For mindre kontekster (sidebar, chips) kan Lucide-fallback beholdes hvis akvarellen mister styrken på små størrelser

## Arkitektur i kode

### Type-definisjon

```ts
// components/variants/report/report-data.ts
export interface ReportTheme {
  // ... andre felter
  iconSrc?: string;  // path til PNG
}
```

### Config-map

```ts
const THEME_ICONS: Record<string, string> = {
  hverdagsliv: "/illustrations/icons/hverdagsliv-icon.png",
  "barn-oppvekst": "/illustrations/icons/barn-aktivitet-icon.png",
  // ... 7 totalt
};

// I transformToReportData:
iconSrc: THEME_ICONS[themeDef.id],
```

Ny kategori → legg til én entry + generér PNG via batch-script. Ingen andre endringer.

### Fallback til Lucide

Sidebar/navigation/små kontekster kan fortsatt bruke Lucide — akvarell-ikoner tar *over* der store visuelle øyeblikk skjer, ikke overalt:

```tsx
{theme.iconSrc ? (
  <Image src={theme.iconSrc} ... />
) : (
  <Icon className="w-7 h-7" />  // Lucide fallback
)}
```

## Konsistens og skala

### 7 ikoner for Wesselsløkka (bransjeprofil Eiendom - Bolig)

| Tema | Ikon | Palett-aksent |
|------|------|---------------|
| Hverdagsliv | Handlepose m/ brød og blad | Salvie |
| Barn & Aktivitet | Huske m/ tau | Salvie |
| Mat & Drikke | Kaffekopp m/ damp | Terrakotta |
| Opplevelser | Åpen bok m/ bokmerke | Pale oker |
| Natur & Friluftsliv | Parkbenk m/ gress | Salvie |
| Trening & Aktivitet | Manual (dumbbell) | Grå-blå |
| Transport & Mobilitet | Sykkel sett fra siden | Salvie |

Alle generert i én batch-kjøring (~2 min) med identisk `STYLE_HEADER` og per-ikon `subject`-variasjon.

### Palett-variasjon uten brudd

Alle bruker samme ink-stroke-farge (#3a3530). Akvarell-washen varieres per ikon — skaper karakter uten å bryte identitet. Samme logikk som mote-serie: samme klesstil, ulike farger.

## Kostnad

- ~$0.04 per ikon via Gemini gemini-3-pro-image-preview
- 7 ikoner = ~$0.28 per demo
- Regenerasjoner billig nok til å iterere

## Konsekvenser for produkt

**Før spot-ikoner:** Lucide-ikoner ved siden av akvarell-illustrasjoner = visuell usammenheng. Demoen føles som et SaaS-produkt med pyntebilder.

**Etter spot-ikoner:** Hver seksjon har en visuell "forside" som peker fremover til illustrasjonen. Samme hånd, samme palette, samme rytme gjennom hele rapporten. Demoen føles som en kuratert produksjon, ikke en databaserapport.

Salgs-verdi: visuell kvalitet signaliserer omtanke → tillit → kjøpsvilje.

## Når dette **ikke** er verdt det

- **Internverktøy** uten branding-krav → Lucide er raskere og "riktig"
- **Ikoner som trenger å skalere til 12-16px** → akvarell-detaljer mister lesbarhet
- **Høy-interaksjons-UI** (forms, settings) → SaaS-stil-ikoner matcher forventning

## Fremtidig skala

For N demoer med samme bransjeprofil:
- 7 ikoner per profil (Eiendom-Bolig har 7)
- Regenerer kun hvis stil-retning endres eller ny kategori tilføyes
- Ikoner kan deles på tvers av demoer i samme bransjeprofil

## Relatert

- `docs/solutions/best-practices/gemini-reference-background-override-20260413.md` — prompt-struktur for å låse stil
- `docs/solutions/architecture-patterns/placy-shell-tokens-vs-full-whitelabel-20260413.md` — strategisk ramme for hvorfor demo-kvalitet betyr noe
- Live implementasjon: `THEME_ICONS` i `components/variants/report/report-data.ts`
