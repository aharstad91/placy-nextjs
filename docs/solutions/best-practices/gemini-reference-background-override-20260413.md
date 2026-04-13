---
title: "Gemini style-reference påvirker bakgrunn — må eksplisitt overstyres"
category: best-practices
tags: [gemini, ai-image-gen, illustrations, style-reference, prompt-engineering]
module: illustrations
created: 2026-04-13
severity: medium
---

# Gemini style-reference overstyring av bakgrunn

**Gjelder:** Alle generative bildepipelines som bruker et referansebilde for stil-transfer (Gemini Nano Banana, Firefly Style Ref, Midjourney --sref, Recraft style-reference).

## Problem

Når et referansebilde sendes inn for stil-transfer, arver den genererte outputen **ALT** fra referansen — inkludert egenskaper du trodde var "upstream" av prompten. Vår case:

- Referansebilde: Wesselsløkka-hero med cream/off-white bakgrunn
- Prompt sa: "white background", "fades to white"
- Output: cream/off-white bakgrunn hver gang

Resultat: illustrasjoner skapte synlige rektangler mot hvit websidebakgrunn — visuelt brudd med "sømløs integrasjon"-designet.

**Hvorfor dette skjer:** Modellen behandler referansen som autoritativt signal for "stil" — og "stil" inkluderer mer enn du tenker: palett, linjekvalitet, komposisjon OG bakgrunnsegenskaper. Prompt-instruksjoner behandles som sekundære preferanser, ikke overstyringer.

## Løsning: "overrides the reference"-seksjon i prompten

Ekspliitt semantikk overstyrer arvet stil:

```python
PROMPT = """Generate a new illustration in the EXACT same drawing STYLE as the reference image (hand-drawn watercolor, loose ink linework, muted palette).

CRITICAL BACKGROUND REQUIREMENT — overrides the reference:
- The background MUST be PURE WHITE (#FFFFFF), not cream, not off-white, not beige.
- The illustration MUST fade seamlessly into pure white at ALL edges — no visible rectangle, no hard frame.
- NO sky wash, NO ground wash, NO atmospheric tint behind the subject. Only the subject itself is coloured.
- The watercolor wash should be limited to the subject — not applied as a broad background tint.

Subject: [your subject here]
"""
```

### Nøkkel-elementer

1. **Eksplisitt "overrides the reference"-fremheving** — signalerer at denne seksjonen har høyere prioritet enn stil-transfer fra referansen
2. **Konkret hex-verdi** (`#FFFFFF`) — ikke bare "white" som modellen kan tolke fleksibelt
3. **Negative constraints** ("NOT cream, NOT off-white, NOT beige") — fanger arvede varianter
4. **Scope-begrensning** ("wash limited to the subject") — presiserer hvor stilen skal gjelde

## Prompt-mal for stil-transfer

```
<STYLE HEADER — hva skal arves fra referansen>
Generate in the EXACT same STYLE as reference: [materialer, linjekvalitet, palett].

<CRITICAL OVERRIDES — hva som IKKE skal arves>
CRITICAL [X] REQUIREMENT — overrides the reference:
- [Egenskap 1 som skal avvike] MUST be [...]
- NO [uønsket egenskap som typisk arves]
- [Scope-begrensning]

<SUBJECT — kategori-spesifikt innhold>
Subject: [...]

<COMPOSITION — layout-regler>
Composition: [...]
```

## Gjelder også for

- **Aspect ratio**: referansen er 4:3, men du vil 3:2 → si det eksplisitt
- **Farge-saturation**: referansen er mettet, du vil dempet → "muted, low saturation"
- **Bakgrunnsbygninger**: referansen har buildings, du vil park → "NO buildings, pure nature scene"
- **Tekst/logoer**: referansen har skilter, du vil rent → "NO readable text, NO logos"

## Hvorfor ikke andre tilnærminger?

- **Bare sterkere prompt-instruksjoner** ("please make background pure white") — modellen prioriterer referansen over prompt
- **Svakere referanse-vekt** — ikke eksponert i Gemini API
- **Post-processing crop/edit** — virker, men kompensasjon for feil i kilden

## Eksempel fra Placy

Wesselsløkka kategori-illustrasjoner (7 stk) og spot-ikoner (7 stk):
- Alle 14 bilder generert med samme "CRITICAL BACKGROUND"-seksjon
- Alle 14 har pure hvit bakgrunn → sømløs integrasjon
- Stil-konsistens bevart — bare bakgrunn overstyrt

## Referanse-implementasjon

- `/tmp/gen_kategori_batch.py` — illustrasjoner
- `/tmp/gen_ikoner_batch.py` — spot-ikoner
- Begge bruker identisk STYLE_HEADER-struktur

## Relatert

- `docs/solutions/best-practices/auto-crop-idempotency-20260413.md` — post-processing for å fjerne overflødig hvit bakgrunn
