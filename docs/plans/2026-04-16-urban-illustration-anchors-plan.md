# Plan — Urban illustrasjonsankere og venue_context

**Dato:** 2026-04-16  
**Brainstorm:** docs/brainstorms/2026-04-16-urban-illustration-anchors-brainstorm.md  
**Status:** Klar for implementering

---

## Mål

Gjøre illustrasjonspipelinen kontekst-bevisst: urbane prosjekter (sentrum, kaikant, tett bebyggelse) skal bruke urban stil-ankre, suburban prosjekter beholder eksisterende ankre.

---

## Akseptansekriterier (totalt)

- [ ] `anchor-urban-waterfront.jpg` finnes i `assets/` og viser kaikant-scene i korrekt stil
- [ ] `anchor-urban-street.jpg` finnes i `assets/` og viser tett bygårdsgater i korrekt stil
- [ ] SKILL.md beskriver urban vs suburban anker-valg
- [ ] prompt-patterns.md har "Urban variant" av Mønster A
- [ ] `projects.venue_context` kolonne eksisterer i DB (`suburban | urban`, default `suburban`)
- [ ] TypeScript-typen `Project` har `venue_context` feltet
- [ ] `generate-bolig.md` Steg 0 spør om urban/suburban
- [ ] `generate-bolig.md` Steg 3 setter `venue_context` i project INSERT
- [ ] `generate-bolig.md` Steg 11.5 velger riktig anker-sett basert på `venue_context`
- [ ] Stasjonskvartalet har `venue_context='urban'` i DB

---

## Fase 1 — Urban stil-ankere (raskest verdi)

### 1.1 Kopier waterfront-anker

```bash
cp public/illustrations/stasjonskvartalet-hero.jpg \
   .claude/skills/placy-illustrations/assets/anchor-urban-waterfront.jpg
```

Ingen generering nødvendig — illustrasjonen vi laget i dag er allerede perfekt.

### 1.2 Generer urban street-anker (Mønster A, urban variant)

**Scene:** Tett norsk bygårdsgater. 5-6 etasjer med kommersielt i 1. etg — kafé, dagligvare, butikkskilt. Fortau med folk i middle-ground. Tegl + puss, noe glass. Ingen park/hage, men kanskje ett tre på fortauet.

**Ankre:** `anchor-wesselslokka.png` (stil-referanse) — samme stil, ulik skala

**Prompt-nøkkelelementer (urban variant av Mønster A):**
- "dense Norwegian urban street" (ikke "mixed-use 3-4 stories")
- "5-6 story brick and rendered apartment buildings, commercial ground floor"
- "narrow street, cobblestone or asphalt, no front gardens"
- "2-3 figures on pavement — one with a coffee cup, one walking a dog, one on a bike"
- Fjern: "Large deciduous trees framing the scene" → erstatt med "one or two small street trees"

**Output:** `.claude/skills/placy-illustrations/assets/anchor-urban-street.jpg`

### 1.3 Kvalitetssjekk begge ankre

7-punkts sjekkliste fra style-guide.md mot begge ankere.

---

## Fase 2 — SKILL.md og prompt-patterns.md

### 2.1 Oppdater SKILL.md — anker-tabell

Erstatt eksisterende anker-tabell med to seksjoner:

```markdown
### Suburban (standard)
| Asset | Karakter | Bruk når... |
|-------|----------|-------------|
| anchor-playground.jpg | Nærscene, liten bygning | Oppvekst, barnehage, nabolagscorner |
| anchor-cafe.jpg | Gatenivå, café, lav bebyggelse | Mat & drikke, smågate, handel |
| anchor-wesselslokka.png | Bredere kompleks, park, mange figurer | Master-scener, parkanlegg |

### Urban (byprosjekter)
| Asset | Karakter | Bruk når... |
|-------|----------|-------------|
| anchor-urban-waterfront.jpg | Kaikant, 6-8 etasjer, havnepromenade | Bryggeprosjekter, kaikant |
| anchor-urban-street.jpg | Bygårdsgater, 5-6 etasjer, fortau | Sentrum, bykvartal |
```

### 2.2 Oppdater prompt-patterns.md — Urban variant av Mønster A

Legg til seksjon etter Mønster A med urban-tilpasningene (endrede bygningshøyder, mindre grønt, tettere komposisjon).

---

## Fase 3 — Database og typer

### 3.1 Migration 066_add_venue_context.sql

```sql
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS venue_context TEXT 
  DEFAULT 'suburban' 
  CHECK (venue_context IN ('suburban', 'urban'));

-- Retroaktivt: kjente urbane prosjekter
UPDATE projects 
SET venue_context = 'urban' 
WHERE id IN (
  'banenor-eiendom_stasjonskvartalet'
);
```

### 3.2 Oppdater TypeScript-type

`lib/types.ts` — legg til `venue_context: 'suburban' | 'urban'` i `Project`-interface.

---

## Fase 4 — generate-bolig pipeline

### 4.1 Steg 0 — Nytt spørsmål

**Spørsmål 3 (etter kildebilde og 3D):**
> "Er dette et urban prosjekt (sentrum, kaikant, tett bybebyggelse) eller suburban (forstad, rolig nabolag)? (urban/suburban, default: suburban)"

Lagre som `{venueContext}`.

### 4.2 Steg 3 — Project INSERT

Legg til `venue_context: {venueContext}` i INSERT-body.

### 4.3 Steg 11.5 — Anker-valg

```
if venueContext == "urban":
    refs:
      - {sourceImagePath}  (IMAGE 1: subject)
      - anchor-urban-waterfront.jpg  (IMAGE 2: style)
    # Valgfritt for ekstra stil-lock: legg til anchor-urban-street.jpg
else:
    refs:
      - {sourceImagePath}  (IMAGE 1: subject)
      - anchor-wesselslokka.png  (IMAGE 2: style)
```

Oppdater også prompten for urban-prosjekter: bygg-høyde i KEEP-seksjonen skal reflektere urbane proporsjoner.

---

## Implementeringsrekkefølge

```
1. Fase 1: Ankere (kopier + generer) — raskest verdi, kan verifiseres visuelt
2. Fase 2: SKILL.md + prompt-patterns.md — dokumentasjon
3. Fase 3: Migration + TypeScript — fundament
4. Fase 4: generate-bolig pipeline — integrerer alt
```

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `.claude/skills/placy-illustrations/assets/anchor-urban-waterfront.jpg` | NY — kopi av stasjonskvartalet-hero |
| `.claude/skills/placy-illustrations/assets/anchor-urban-street.jpg` | NY — generert |
| `.claude/skills/placy-illustrations/SKILL.md` | Oppdatert anker-tabell |
| `.claude/skills/placy-illustrations/references/prompt-patterns.md` | Ny urban-seksjon |
| `supabase/migrations/066_add_venue_context.sql` | NY |
| `lib/types.ts` | `venue_context` i Project |
| `.claude/commands/generate-bolig.md` | Steg 0, 3, 11.5 |

**Ingen endringer i app-kode** — venue_context brukes kun i pipeline og fremtidige admin-features.
