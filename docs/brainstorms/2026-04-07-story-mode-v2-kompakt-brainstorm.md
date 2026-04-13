# Story Mode v2 — Kompakt, kartdrevet conversational scrollytelling

**Dato:** 2026-04-07
**Status:** Brainstorm ferdig, klar for implementering
**Forgjenger:** docs/brainstorms/2026-04-07-interaktiv-storytelling-brainstorm.md

## Problemet med v1

V1 av Story Mode brukte store POI-kort (16:9 bilde + tekst) for hvert sted. Dette ga:
- **~4 skjermhøyder per tema** — for mye scrolling
- **"Nettside-vibber"** — kortstakk føles som en vanlig nettside, ikke en samtale
- **Manglende spatial kontekst** — kart kom på slutten, ikke der det trengs
- **Ineffektivt** — boligkjøpere vil ha oversikt, ikke 44 individuelle kort

## Hva vi bygger (v2)

En kompakt, kartdrevet opplevelse der hvert tema tar **~1 skjermhøyde**:

### Ny tema-rytme

```
INTRO (~0.5 skjermhøyde):
  → ChatBubble: "Hva vil du vite om [sted]?"
  → ThemeSelector med POI-counts

PER TEMA (~1-1.5 skjermhøyde):
  → Kart-stripe med alle tema-POI-prikker (kompakt, ~150px høy)
  → Chat-liste boble med 5 steder:
    ★ Favoritt    4.7★  3 min
    ● Sted 2      4.5★  5 min
    ● Sted 3      4.6★  4 min
    ● Sted 4      4.4★  2 min
    ● Sted 5      4.5★  6 min
  → ChoicePrompt: "Se flere" / "Neste tema" / "Oppsummering"

OPPSUMMERING:
  → ChatBubble + 2-kolonne grid (beholdes fra v1)
```

### Tap-to-expand i lista

Tap på et sted i chat-lista → inline expand INNE I bobla:
- Bilde (eller kategori-ikon fallback)
- Editorial hook
- Adresse
- Google Maps-lenke

Bare ett sted kan være expanded om gangen. Tap igjen for å lukke.

### Kart som kontekst-stripe

- Statisk Mapbox-bilde, ~150px høyt, full bredde
- Viser alle tema-POI-er som fargede prikker
- Gir umiddelbar "aha, alt dette er rundt meg"-følelse
- Kommer FØR lista — setter kontekst

## Nøkkelbeslutninger

1. **Alt kompakt** — ingen store POI-kort. Favoritten markeres med ★ men får ikke eget kort
2. **Kart som kontekst-stripe** — kompakt stripe øverst per tema, ikke stort kart
3. **Chat-liste i boble** — flere steder i én boble, conversational
4. **Rett på tema-velger** — ingen intro-tekst, ingen fakta-boble. Bare "Hva vil du vite?"
5. **Inline expand** — tap sted i lista → expand med bilde/hook/lenke inne i bobla
6. **~1 skjermhøyde per tema** — vs ~4 i v1. 4x mer effektivt.

## Endringer fra v1

| Hva | v1 | v2 |
|-----|----|----|
| Intro | Chat + FactBubble + ThemeSelector | Chat + ThemeSelector |
| Kart plassering | Slutten av tema | Toppen av tema (stripe) |
| POI-presentasjon | Store individuelle kort (16:9) | Kompakt chat-liste i boble |
| Favoritt | Første POI-kort | ★-markering i lista |
| Steder per batch | 3 (store kort) | 5 (kompakt liste) |
| Plass per tema | ~4 skjermhøyder | ~1-1.5 skjermhøyder |
| Detaljer | Alltid synlig accordion | Tap-to-expand inline |

## Komponenter å endre/legge til

### Nye blokk-typer
- **MapStripe** — Erstatter MapReveal. Kompakt kart-stripe (~150px) med alle tema-prikker
- **POIListBubble** — Chat-boble med liste av steder. Tap-to-expand inline.

### Fjernes/forenkles
- **StoryPOICard** — Fjernes helt. Erstattes av POIListBubble
- **StoryThemeBridge** — Forenkles eller fjernes (kart-stripen ER overgangen)
- **StoryFactBubble** — Fjernes fra intro, kan beholdes i tema om ønsket

### Beholdes
- **StoryChatBubble** — Brukes for intro-tekst
- **StoryChoicePrompt** — Beholdes som er
- **StorySummary** — Beholdes som er
- **StoryThemeSelector** — Beholdes, men uten FactBubble før

## Åpne spørsmål

- Hvor mange steder i "Se flere"-batch? 5 til?
- Skal kart-stripen ha en label (f.eks. "44 mat-steder")?
- Skal expanded POI vise bilde eller bare tekst?
