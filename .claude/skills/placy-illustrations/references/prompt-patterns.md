# Prompt-mønstre for Placy-illustrasjoner

Tre beviste mønstre, destillert fra faktiske kjøringer. Bruk som utgangspunkt — tilpass scenedetaljer og beholde rammeverket.

---

## Mønster A — Ny kategori-illustrasjon (fra scratch)

Bruk for scener som matcher bransjeprofil-temaer (Mat & drikke, Hverdagsliv, Trening, etc.) eller prosjekt-spesifikke scener.

**Anbefalt:** 1–2 referanser, aspect `3:2` eller `4:3`.

```
Create a horizontal architectural watercolor illustration in the EXACT style of the reference image(s) attached. Match precisely: loose pen/ink sketch lines combined with soft watercolor washes, muted palette (terracotta-brick, sage-green, warm cream, soft grey), pure white background that fades at the edges (no frame, no border), paper-like quality, middle-ground figures that are 8-15% of canvas height (never close-ups, never dominant).

SUBJECT — "[SCENE NAME]":
[1-3 sentence scene description — what is this place, what time of day, what's happening]

FOREGROUND/MIDDLE-GROUND:
- [Key visual element 1]
- [Key visual element 2]
- [Key visual element 3]

BUILDINGS (realistic Norwegian mixed-use, 3-4 stories, commercial ground floor + apartments above):
- [Building detail 1 — color, style, signage shape]
- [Building detail 2]

PEOPLE IN MIDDLE-GROUND (all same small scale, no close-ups):
- [Figure 1 — who, what they're doing]
- [Figure 2]
- [Figure 3 — optional]

BACKGROUND:
- Large deciduous trees with loose watercolor foliage framing the scene
- Soft sky — mostly white paper showing through

LIGHTING: soft afternoon daylight, gentle shadows, no harsh contrast.

CRITICAL STYLE RULES:
- Loose hand-drawn ink outlines, slightly imperfect, visible pen-work
- Watercolor washes that don't fully fill outlines — white paper shows through
- Background fades to pure white toward edges (no hard rectangular crop)
- NO TEXT anywhere in the image
- NO heavy shadows or dramatic lighting
- NO cartoon style — this is architectural illustration quality
- Figures feel "lived-in", not posed
```

---

## Mønster B — Stil-transfer fra foto til akvarell

Bruk for å gjenbruke eksisterende fotos (render, luftfoto, etc.) i Placy-stilen.

**Viktig:** Strukturen `IMAGE 1 (SUBJECT) / IMAGE 2 (STYLE) / KEEP / APPLY / ADD / REMOVE` gjør at modellen forstår rollen til hvert bilde. Uten denne strukturen mister modellen layouten fra subject-bildet.

**Anbefalt:** 2 referanser (subject først, style-anchor etter), aspect matcher originalen.

```
I am providing TWO images:
- IMAGE 1 (SUBJECT): [describe the photo — e.g., "a photograph of a waterfront marina development at sunset"]
- IMAGE 2 (STYLE REFERENCE): an architectural watercolor illustration of a Norwegian residential neighborhood.

TASK: Redraw IMAGE 1 in the EXACT style of IMAGE 2.

KEEP from IMAGE 1 (subject matter):
- The same building composition and layout: [describe buildings, number, heights, colors]
- [Key spatial elements — water, paths, plazas]
- The general layout: foreground/middle-ground/background
- The number of floors and approximate building heights

APPLY from IMAGE 2 (style):
- Loose pen/ink sketch lines visible on all architectural edges
- Soft watercolor washes that don't fully fill the outlines — white paper shows through
- Muted, slightly desaturated palette — keep subject colors but softer/chalkier (like watercolor pigments)
- Pure white background on the edges — let the image fade to white paper at corners and top
- The sky should be mostly white paper with just a few very soft wash strokes
- Loose vegetation strokes for trees/plants (same leaf-cluster technique as IMAGE 2)
- Slightly imperfect, hand-drawn feel — NOT photorealistic
- Watercolor granulation and paper texture visible

ADD (middle-ground figures, 8-15% canvas height, same scale as figures in IMAGE 2):
- [Figure 1 — e.g., "A few people walking along the quayside promenade"]
- [Figure 2 — e.g., "A cyclist rolling past"]
- [Figure 3 — optional]

REMOVE from IMAGE 1:
- [List photographic qualities to lose — e.g., dramatic sunset sky, photorealism, lit windows]
- Any dramatic / nighttime / neon elements — this is a calm daytime scene

CRITICAL:
- NO TEXT anywhere
- NO photo quality — this must look hand-painted
- Match the exact line-weight and wash-opacity of IMAGE 2
- Background fades to pure white paper
```

---

## Mønster C — Humor-variant (Mode C)

Bruk etter mønster A eller B når subtil humor er ønsket. Lim inn på slutten av prompten.

Se `humor-learnings.md` for sterkeste humor-mønstre.

```
SUBTLE HUMOR (Mode C — dry juxtaposition, not slapstick):
- Include maximum 2 humor details, both as middle-ground figures at 8-15% canvas height
- [SPECIFIC HUMOR DETAIL 1, e.g.: "a person in child's pose yoga with a dog in play-bow position next to them — the dog's posture visually rhymes with the yoga pose"]
- [SPECIFIC HUMOR DETAIL 2, optional, e.g.: "a jogger passing an elderly couple holding hands, subtle tempo juxtaposition"]
- Humor should be discovered on second look, not shouted
- Same scale as other figures in the scene — never close-ups
- NO slapstick, NO cartoon exaggeration, NO facial comedy
```

---

## Iterasjons-tips

- **Første forsøk feilet på stil-lock?** Legg til flere referanser (opp til 14). Understrek "EXACT style" og "match precisely" sterkere.
- **Figurer for store / i forgrunnen?** Understrek "middle-ground only" og "8-15% canvas height" eksplisitt flere ganger i prompten.
- **Scenen ble for tett/urban?** Øk vekt på "large deciduous trees framing the scene" og "white paper background showing at edges".
- **Humor ble for tydelig?** Fjern "subtle" og erstatt med "barely noticeable on first glance".
- **Farge-paletten ble for mettet?** Legg til: "palette must feel chalky and desaturated, like watercolor pigments on paper — NOT photo-saturated".
