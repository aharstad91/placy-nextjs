---
name: placy-illustrations
description: This skill should be used when generating watercolor illustrations in Placy's "Wesselsløkka-akvarell"-stil — the canonical visual language for all Placy-project illustrations (kategori-bilder, prosjekt-scener, stil-transfer fra foto). Triggers on "lag akvarell", "generer illustrasjon", "Wesselsløkka-stil", "kategori-bilde", "stil-transfer", or any image-generation request for content that lives in `public/illustrations/`. Uses Gemini 3 Pro Image via bundled script with curated style anchors.
---

# Placy Illustrations — Wesselsløkka-akvarell-pipeline

## Overview

Produce illustrations in Placy's signature style: loose pen/ink sketch + dempet akvarell-vask, pure-white papir-bakgrunn, middle-ground figurer i norsk urban-forstad-kontekst. All visuelt innhold for Placy-plattformen skal følge denne stilen for konsistens på tvers av Explorer, Guide og Report.

## When to use

Use this skill when:
- Generating new category illustrations for the 7 bransjeprofil-temaer (Hverdagsliv, Mat & drikke, Trening, etc.)
- Producing project-specific scenes (prosjekt-torg, nabolagscorner, oversiktsscener)
- Style-transferring photos (renders, luftfoto, marina-bilder) into akvarell
- Creating humor-varianter (Mode C — tørr juxtaposition)

Do not use for: icons, UI-elementer, logoer, fotorealistiske produktbilder, eller ikke-Placy-prosjekter.

## Prerequisites

- `GEMINI_API_KEY` defined in environment or in project `.env.local`
- Python 3.9+ with `google-genai` and `Pillow` packages installed
- Running from within the Placy repo (so `.env.local` can be sourced)

## Workflow

### Step 1 — Read relevant references

Load `references/style-guide.md` into context on every use. It contains the canonical palette, technique rules, composition constraints, and quality checklist that must not be violated.

Load `references/prompt-patterns.md` to choose the right prompt pattern for the task (A: new scene, B: style-transfer, C: humor variant).

Load `references/humor-learnings.md` only if humor is part of the brief.

### Step 2 — Pick style anchors from `assets/`

Always include 1–3 reference images to lock the style. Choose based on scene character:

- `assets/anchor-playground.jpg` — close-up scenes, single small building, few figures
- `assets/anchor-cafe.jpg` — street-level, café, walking/shopping
- `assets/anchor-wesselslokka.png` — wider complex, park, many middle-ground figures

For style-transfer from a user-provided photo, include the photo as first content item and anchor(s) as subsequent items.

### Step 3 — Construct the prompt from the right pattern

Use `references/prompt-patterns.md`:
- **Pattern A** for new scenes from scratch
- **Pattern B** for photo → watercolor style-transfer (uses explicit IMAGE 1 / IMAGE 2 / KEEP / APPLY / ADD / REMOVE structure)
- **Pattern C** appended when humor is requested

Fill in the bracketed `[...]` placeholders with scene-specific detail. Preserve the structural scaffolding — it is what makes the output consistent.

### Step 4 — Run the generator

Execute `scripts/generate.py` with the composed prompt:

```bash
python3 .claude/skills/placy-illustrations/scripts/generate.py \
    --prompt-file /tmp/prompt.txt \
    --refs .claude/skills/placy-illustrations/assets/anchor-playground.jpg \
           .claude/skills/placy-illustrations/assets/anchor-wesselslokka.png \
    --out public/illustrations/new-scene.jpg \
    --aspect 3:2
```

For inline prompts use `--prompt "..."`. For style-transfer, pass the source photo as the first `--refs` entry.

The script auto-sources `GEMINI_API_KEY` from `.env.local` if not already in environment.

**Default aspect:** `3:2`. Use `16:9` for master-scenes, `4:3` for close-ups.

**Output format:** always `.jpg` (Gemini returns JPEG even if asked for PNG — wrong extension causes media-type mismatches downstream).

### Step 5 — Quality-check against `style-guide.md`

Before accepting the result, run the 7-point checklist from `references/style-guide.md` ("Kvalitetscheck før godkjenning"). If any point fails, iterate — see the "Iterasjons-tips" section in `prompt-patterns.md`.

### Step 6 — Save to final location

Generated illustrations typically belong in:
- `public/illustrations/` for category and project images
- `public/` for top-level project-specific illustrations (e.g. `wesselslokka-illustrasjon-v4.png`)

When replacing existing illustrations, follow project naming conventions (`-v2`, `-v3`, etc.) and update references in code that point to the old file.

## Bundled resources

- `scripts/generate.py` — Gemini generation CLI with `.env.local` auto-sourcing. Supports prompt-file or inline prompt, multiple reference images, configurable aspect ratio. Read and run via Bash.
- `references/style-guide.md` — canonical palette, technique, composition rules, and 7-point quality checklist. Load on every use.
- `references/prompt-patterns.md` — three proven prompt structures (A: new scene, B: style-transfer, C: humor). Load when building a new prompt.
- `references/humor-learnings.md` — Mode C humor principles, proven patterns (visual rhyme, tempo juxtaposition), known Gemini weaknesses. Load only when humor is part of the brief.
- `assets/anchor-*.{jpg,png}` — three curated style anchors representing close, medium, and wide scene characters. Always attach at least one to the generation call.

## Notes

- The wrapping Gemini API mechanics (models, parameters, file formats) live in the `compound-engineering:gemini-imagegen` skill. This skill layers Placy-specific style and workflow on top.
- Style anchors in `assets/` are frozen by design — do not replace them without a deliberate style-refresh process, because every future illustration will drift from prior ones.
- When in doubt about a new scene type, study `public/illustrations/` for prior examples in the same category before generating.
