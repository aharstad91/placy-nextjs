---
title: "AI-modellvalg for flyfoto → akvarell-stiloverføring"
category: best-practices
tags: [ai-image-gen, style-transfer, gemini, flux, replicate, aerial-photos, illustrations, model-selection]
module: illustrations
created: 2026-04-15
severity: medium
---

# AI-modellvalg for flyfoto → akvarell-stiloverføring

**Gjelder:** Pipeline-design for å transformere Google Maps 3D-screenshots til akvarell-illustrasjoner i rapport-produktet. Modell-valget er ikke-opplagt og feiler på subtile måter hvis du velger feil.

## Problem

Vi skulle bygge en pipeline som tar et 3D-flyfoto av nabolaget og transformerer det til en akvarell-illustrasjon som:

1. Bevarer nabolagets layout eksakt (veier, bygninger, parker, topografi)
2. Ser ut som profesjonell håndmalt akvarell
3. Kan genereres automatisk via API
4. Har høy nok oppløsning til å vises i en modal med zoom

**De fleste anbefalinger på nettet peker mot "img2img"-modeller som Flux Kontext, men de feiler på punkt 1 for flyfoto-bruk.**

## Faktiske testresultater

Vi testet 4 forskjellige tilnærminger med samme input-bilde:

### 1. Gemini 2.5 Flash Image — BEST for vår bruk

- **API:** `gemini-2.5-flash-image` via standard `generativelanguage.googleapis.com`
- **Layout-bevaring:** Meget bra. Gjenkjennbare veier, bygninger, parker.
- **Akvarell-kvalitet:** God. Ekte penselstrøk-feel, ikke bare Instagram-filter.
- **Oppløsning:** Hard cap på ~1344x768 — ikke konfigurerbar på standard API.
- **Pris:** Gratis (på eksisterende API-nøkkel).
- **Konsistens:** Varierer mellom kjøringer. Cherry-pick fra 2-3 forsøk for beste resultat.
- **Prompt:** Eksplisitt "watercolor illustration, visible brushstrokes, paint bleeds, soft edges" + "do NOT end edges abruptly".

### 2. Gemini 3 Pro Image — SAMME cap, ikke verdt oppgradering uten Vertex AI

- **API:** `gemini-3-pro-image-preview` via standard API
- **Oppløsning:** ~1376x768 (samme cap som Flash). 4K er kun tilgjengelig via Vertex AI.
- **Kvalitet:** Litt mer konsistent enn Flash, men ikke markant bedre.
- **`imageConfig.size`-parameter:** Ignoreres — gir `Unknown name "size"` feil på standard API.
- **Konklusjon:** Bruk bare hvis du allerede har Vertex AI oppsatt.

### 3. Flux Kontext Pro (Replicate) — KATASTROFALT

- **Model:** `black-forest-labs/flux-kontext-pro`
- **Forventning:** Edit-modell, burde bevare struktur.
- **Faktisk resultat:** Genererte et **helt annet landskap**. Mistet nabolagets layout komplett.
- **Hvorfor:** Kontext er designet for lokal redigering (f.eks. "fjern bilen", "bytt ut skjorten"). For full stil-transformasjon på aerial-views tolker modellen det som "generer et nytt bilde inspirert av dette" snarere enn "behold strukturen, endre stilen".
- **Ikke bruk for:** Aerial-views, arkitektur-illustrasjoner, eller andre tilfeller der presist layout-bevaring er kritisk.

### 4. Replicate (fofr/style-transfer, ControlNet) — IKKE TESTET FERDIG

- **Krever:** Betalingsmetode på Replicate (gratis-kvoten brukes opp raskt).
- **Teori:** ControlNet-depth + IP-Adapter på SDXL er bygget for struktur-bevaring + stil-transfer.
- **Oppløsning:** SDXL-basert, capp på 1024-1536px native.
- **Status:** Testet men blokkert av billing — kan være lovende for senere.

## Anbefalt modell-rangering (for denne bruken)

| Modell | Layout | Stil | Oppløsning | Pris/bilde | Setup |
|--------|--------|------|------------|-----------|-------|
| **Gemini 2.5 Flash Image** | Bra | Bra | 1344px | Gratis | Enkel API |
| **Gemini 3 Pro (Vertex AI)** | Bra | Bedre | **4096px** | $0.24 | gcloud + GCP |
| **Recraft V3 img2img** | Bra | SOTA | 2048px+ | $0.29 | API-nøkkel |
| **FLUX.2 [flex]** | Ukjent | Bra | 2560px | $0.12 | API-nøkkel |
| Flux Kontext Pro | **Dårlig** | Bra | 1392px | $0.05 | - |
| Midjourney | Best | Best | 2048px | - | **Ingen API** |

## Praktisk pipeline (det vi bruker nå)

```python
# Enkel Gemini 2.5 Flash pipeline
# 1. Input: Google Maps 3D-screenshot (JPEG, ~1830x1016px)
# 2. Output: Watercolor PNG (~1344x768px)
# 3. Bruk i TabbedAerialMap-komponenten med zoom cap på 1.5x

PROMPT = """
Completely repaint this aerial city view as a hand-painted watercolor
illustration. I want visible brushstrokes, paint bleeds, wet-on-wet effects,
and the soft imprecise edges characteristic of watercolor art. Buildings
should be simplified geometric shapes in warm ochre and terracotta. Trees
as loose expressive blobs of sage green and olive. Streets suggested with
thin lines, not photorealistic. Urban sketcher style.

IMPORTANT: The illustration should extend naturally all the way to every
edge. Do NOT end any edge with an abrupt solid color band or hard cutoff.
Let the landscape continue softly toward the edges with a gentle watercolor
wash.
"""

# For 4 retninger: generer N/Ø/S/V separat fra hver Google Maps-screenshot
```

## Hvorfor Kontext/Redux-type modeller feiler

**Nøkkelinnsikten:** "Img2img" er ikke én ting. Det finnes minst tre arkitekturer:

1. **Structure-preserving** (ControlNet, depth-conditioned) — ekstraher kanter/dybde fra input, generer ny versjon med samme struktur. BRA for layout-bevaring.
2. **In-context editing** (Flux Kontext, Gemini edit) — forstår bildet semantisk, gjør målrettede endringer. BRA for "fjern X, endre Y", men kan forkaste hele scenen hvis prompten er for generell.
3. **Conversational image generation** (Gemini Flash/Pro Image) — modellen ser input som referanse og genererer et lignende bilde i ny stil. Middels layout-bevaring, men fungerer overraskende bra på aerial-views.

**Flux Kontext feilet fordi:** En prompt som "transform to watercolor" ga for mye frihet. Modellen tolket det som "lag et akvarell-landskap" og droppet input-scenen.

## Prevention / fremtidig arbeid

- Ikke ta AI-modell-anbefalinger for gitt — test faktisk med vårt use case før valg.
- For bedre oppløsning: Vertex AI (Gemini 3 Pro) eller Recraft V3 + Creative Upscale er neste steg.
- Gemini er overraskende robust for aerial-views selv uten ControlNet. Kan være fordi modellen er trent mye på Google Maps-data.
- Ved modell-research: alltid spør "hvilken arkitektur bruker denne modellen" (structure-preserving vs. editing vs. conversational) — det forutsier oppførsel bedre enn markedsføringsbeskrivelser.

## Relatert

- `components/variants/report/blocks/TabbedAerialMap.tsx` — komponenten som bruker disse bildene
- `public/illustrations/wesselslokka-{nord,ost,vest,sor}.png` — eksempler på Gemini 2.5 Flash-output
- `docs/solutions/best-practices/gemini-reference-background-override-20260413.md` — relatert Gemini-læring om style reference-oppførsel
