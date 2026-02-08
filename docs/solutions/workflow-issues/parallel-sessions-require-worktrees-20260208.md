---
title: Parallelle Claude Code-sesjoner krever git worktrees
category: workflow-issues
tags: [git, worktrees, parallel-sessions, claude-code]
date: 2026-02-08
severity: critical
symptoms:
  - Files mysteriously reverting after edits
  - "Linter" appearing to undo changes
  - Git stash/checkout conflicts between sessions
  - System reminders showing old file content after writes
---

# Parallelle Claude Code-sesjoner krever git worktrees

## Problem

Når flere Claude Code-sesjoner kjører i **samme working directory** (f.eks. tre Warp-vinduer i `~/Documents/placy-ralph/`), overskriver de hverandres filer konstant. Symptomene ser ut som "linter-revertering" men er egentlig en annen sesjon som skriver tilbake sine versjoner av filene.

### Rotårsak

Git har kun **én working directory per klon**. `git checkout branch-a` endrer filene på disk for alle prosesser som leser fra den mappen. Tre sesjoner som kjører `git checkout` mot ulike branches vil slåss om de samme filene.

### Symptomer vi observerte

1. Skrev `ReportThemeSection.tsx` med nye props → fil ble "revertet" til originalen
2. Skrev `report-data.ts` med nye typer → endringer forsvant
3. `git stash` fanget "reverteringer" som egentlig var den andre sesjonens filversjon
4. Brukte 45+ minutter på å re-applye endringer som ble overskrevet igjen og igjen

## Løsning: Git Worktrees

Hver sesjon skal jobbe i sin **egen mappe** med sin egen branch:

```bash
# Sesjon 1: Hovedmappe (main eller en feature)
cd ~/Documents/placy-ralph/

# Sesjon 2: Worktree for feature A
git worktree add ../placy-ralph-trust -b feat/trust-pipeline
cd ../placy-ralph-trust/

# Sesjon 3: Worktree for feature B
git worktree add ../placy-ralph-report-map -b feat/report-sticky-map
cd ../placy-ralph-report-map/
```

### Fordeler

- Hver sesjon har sin egen working directory
- Ingen filkonflikter mellom sesjoner
- `git checkout` påvirker kun den ene mappen
- Alle worktrees deler samme .git-historikk (commits, branches, stashes)

### Viktige regler

1. **Aldri to sesjoner i samme mappe** — dette er garantert ødeleggende
2. **Bruk worktrees fra starten** — ikke etter at problemet oppstår
3. **Rydd opp etterpå**: `git worktree remove ../placy-ralph-feature`
4. **Sjekk aktive worktrees**: `git worktree list`

### Claude Code workflow

Bruk `/compound-engineering:git-worktree` skill, eller manuelt:

```bash
# Opprett worktree
git worktree add ../placy-ralph-<feature> -b feat/<feature-name>

# Start Claude Code i den mappen
cd ../placy-ralph-<feature>
claude

# Når ferdig, rydd opp
git worktree remove ../placy-ralph-<feature>
```

## Tidsbruk

- **Uten worktrees**: 45+ min tapt på mystiske reverteringer, debugging, re-applying
- **Med worktrees**: 0 min — zero konflikter
