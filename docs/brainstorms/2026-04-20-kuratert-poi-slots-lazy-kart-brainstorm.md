---
title: "Kuratert POI-slots + lazy kart per kategori"
date: 2026-04-20
topic: kuratert-poi-slots-lazy-kart
status: ready-for-plan
---

# Kuratert POI-slots + lazy kart per kategori

## Hva vi bygger

To forbedringer av Report-tekstseksjonen som henger logisk sammen:

1. **Kuratert rekkefølge i POI-slider**: Slot 1–3 i slideren fylles av predefinerte "ankerplass"-POI-typer per tema. Slot 4–6 fylles av score-ranking. Ankerplass-slots som mangler POI-data fylles av neste beste fra ranking.

2. **Lazy kart**: Kart-preview skjules inntil brukeren klikker CTA-knappen "Se alle N steder på kartet". Klikk på CTA viser kart-preview, andre klikk på preview åpner full kart-modal.

## Hvorfor dette

**Kuratert rekkefølge**: Boligkjøpere stiller de samme spørsmålene hver gang — "hvilken barneskole hører til her?", "er det en dagligvare i nærheten?". Score-ranking svarer på "hva er best?" men ikke "hva er relevant?". Kuraterte slots garanterer at de ikke-forhandlingsbare svarene alltid er synlig i slot 1–3 uten at brukeren må lete.

**Lazy kart**: Kartet tar plass og kognitiv belastning for kategorier brukeren ikke er interessert i. CTA-trigger = naturlig interessesignal. Brukeren har allerede lest tekst og sett kortene — neste steg er geografisk kontekst.

## Nøkkelbeslutninger

### Ankerplass-logikk per tema

| Tema | Slot 1 | Slot 2 | Slot 3 |
|------|--------|--------|--------|
| Barn & Aktivitet | Barneskole (category.name match) | Ungdomsskole | Videregående |
| Hverdagsliv | Dagligvare | Apotek | Kjøpesenter |
| Trening & Aktivitet | Treningssenter (nærmeste) | Treningssenter | Treningssenter |
| Transport & Mobilitet | Buss | Bysykkel | Bildeling |
| Mat & Drikke | — ren ranking | — | — |
| Natur & Friluftsliv | Park | Tursti | Badeplass |
| Opplevelser | Bibliotek | Kino | — ranking |

**Matching-strategi**: `category.name` substring-match (case-insensitive). Eksempel: slot "Barneskole" matcher POI-er der `category.name` inneholder "barneskole".

**Fallback**: Tom ankerplass-slot → fyll med neste beste fra score-ranking (ikke hopp over). Slideren er alltid full.

**Determinisme**: Innenfor én ankerplass-type, velg POI-en med lavest `travelTime.walk` (nærmest). Ingen score-tiebreaker nødvendig — nærhet er den relevante aksen for ankerplass-POI-er.

### Lazy kart-trigger

- **Skjul**: Kart-preview (`dormant`-tilstand) skjules som default.
- **Vis**: Etter at brukeren klikker CTA "Se alle N steder på kartet" — kart-preview animerer inn.
- **Åpne modal**: Andre klikk på kart-preview åpner `UnifiedMapModal` som i dag.
- **State**: `mapPreviewVisible: boolean` per tema-seksjon (lokalt i `ReportThemeSection`).

Eksisterende `dormant`-preview-komponent gjenbrukes — bare conditional rendering endres.

### Seksjonsstruktur og progressive disclosure

Tre nivåer av interesse:

```
DEFAULT (alltid synlig):
[ Tema-header                           ]
[ Placy narrativ tekst (truncated)      ]
[ ....................................... ] ← fade + "Les mer"-knapp

ETTER "Les mer"-klikk (interesse vist):
[ Placy narrativ tekst (full)           ]
[ --- POI-slider: ankerplass + ranking ---]  ← første reveal
[ Gemini grounding-tekst                ]
[ Se alle N steder på kartet  →        ]  ← CTA

ETTER CTA-klikk (dyp interesse):
[ kart-preview (dormant) animerer inn   ]
[ klikk på preview → UnifiedMapModal   ]
```

**Logikken**: POI-slider er første "belønning" for å lese mer — konkrete steder, ikke bare tekst. Gemini-teksten utdyper konteksten. Kartet gir geografisk perspektiv for de mest interesserte.

**State-krav**: Eksisterende `expanded`-tilstand (for "Les mer") styrer synlighet av slider + Gemini. Ny `mapPreviewVisible`-tilstand styrer kart-preview.

## Åpne spørsmål (parkert)

- **Animasjon for kart-reveal**: slide-down vs fade-in? Spesifiseres i plan.
- **Analytics-event**: skal CTA-klikk og kart-reveal logges? Ikke scope nå.
- **Fler-prosjekt-validering**: ankerplass-kategoriene er definert for "Eiendom - Bolig". Næringsprosjekter har andre temaer — ikke scope her.

## Teknisk kontekst

- `ReportThemeSection.tsx` — har allerede `mapDialogOpen` state + dormant preview
- `top-ranked-pois.ts` — ny funksjon `getCuratedPOIs(pois, themeId, limit)` bygges her
- `report-data.ts` — `theme.topRanked` erstattes av `theme.curatedPOIs` (eller beholdes som fallback)
- POI-data: `category.name` (display string), `poiTier` (1/2/3), `travelTime.walk` (sekunder)

## Scope-avgrensning

Dette er ren UI/logikk-endring. Ingen nye API-kall, ingen datamodell-endringer, ingen nye komponenter (bortsett fra mulig kuraterings-util). `ReportMapBottomCard` og `ReportThemePOICarousel` er uendrede.
