---
title: "Auto-crop av bilder må være idempotent — JPG quality matters"
category: best-practices
tags: [image-processing, jpg, crop, idempotency, pipeline]
module: illustrations
created: 2026-04-13
severity: medium
---

# Auto-crop idempotency

**Gjelder:** Alle bilde-pipelines som croppr til bounding box av innhold og lagrer tilbake i samme format.

## Problem

Vår crop-pipeline (PIL numpy-mask → find content bbox → save JPG) **virket non-idempotent**: hver ny kjøring trimte litt mer, selv om ingenting i input-bildene endret seg logisk.

Observert:
- Første kjøring: `barn-aktivitet.jpg 1264×848 → 1262×848` (-0%)
- Andre kjøring: `1262×848 → 1255×728` (-15%)
- Tredje kjøring trimet enda mer

Dette bryter pipeline-forutsigbarhet — re-kjøring gir ikke samme output.

## Root cause

**JPG kompresjon ved quality=90 introduserer microskopisk off-white støy rundt kanter.**

Crop-logikken identifiserer "hvit bakgrunn" som pixels hvor `alle RGB-kanaler >= 250`. Etter JPG-save med quality=90:
- Pixels som var (255, 255, 255) kan bli (253, 254, 255)
- Pixels som var (253, 253, 253) kan bli (250, 251, 250)

Neste kjøring ser disse som "innhold" (de er under threshold et sted) og utvider bounding box. Men samtidig introduseres nye edges som treffer mellom 250-255 grenseland.

**Netto effekt:** progressiv trimming ved hver re-run.

## Løsning: quality=95 + buffer

```python
# scripts/crop_illustrations.py
WHITE_THRESHOLD = 250
FADE_BUFFER = 4  # preserves the fade's last soft traces

def crop_to_content(path: Path):
    img = Image.open(path).convert('RGB')
    arr = np.array(img)
    mask = np.any(arr < WHITE_THRESHOLD, axis=2)
    # ... compute bbox ...
    cropped = img.crop((left, top, right, bottom))
    # quality=95 minimizes compression artifacts that would make re-runs
    # keep shrinking the image
    cropped.save(path, "JPEG", quality=95)
```

### Hvorfor quality=95 virker

- Mindre aggressive kvantisering av DCT-koeffisienter
- Mindre chroma-subsampling-artifacts
- Netto: kanter som var pure hvit (>=250) forblir pure hvit etter save
- Pipeline blir idempotent — re-run gir identisk output

### Alternative løsninger vurdert

| Approach | Pro | Con |
|----------|-----|-----|
| PNG i stedet for JPG | Lossless, perfekt idempotency | 3-5× større filer |
| Quality=100 | Ingen artifacts | Enda større filer, marginal gevinst over 95 |
| Hever threshold til 245 | Ignorerer artifacts | Risiko for å trimme ekte fade-innhold |
| **Quality=95** ✓ | Minimerer artifacts, små filer | Krever bevisst valg |

## Fade-buffer bevarer myk utgang

Utover idempotency: watercolor-illustrasjoner har gradvis fade mot hvit. Aggressiv crop til bounding box tar vekk siste 1-2 pixels som bidrar til fade-følelsen.

`FADE_BUFFER=4` holder 4px på hver side → fade-halen er bevart, men overflødig tomrom trimmes.

## Sjekkliste for crop-pipeline

- [ ] Threshold-verdi (250 fungerer for pure hvit bakgrunn, juster for andre)
- [ ] Fade-buffer (2-6px avhengig av motivets fade-lengde)
- [ ] Quality ≥95 for JPG-save
- [ ] Eller: PNG hvis filstørrelse ikke er kritisk
- [ ] Verifiser idempotency: re-run scriptet, sjekk at output er uendret
- [ ] Loggføring av before/after-dimensjoner for sanity-sjekk

## Eksempel-resultat

Etter migrering til quality=95 + FADE_BUFFER=4:

| Fil | 1st run | 2nd run | Idempotent? |
|-----|---------|---------|-------------|
| barn-aktivitet | 1264×848 → 1255×728 | 1255×728 → 1255×728 | ✓ |
| mat-drikke | 1264×848 → 1188×748 | 1188×748 → 1188×748 | ✓ |

## Relatert

- `docs/solutions/best-practices/gemini-reference-background-override-20260413.md` — upstream-prompten som skaper de genererte bildene
- `scripts/crop_illustrations.py` — live implementasjon
