# Agent Instructions

**`CLAUDE.md` er autoritativ for dette prosjektet.** Denne fila dekker kun det som
gjelder agent-harnesser generelt (også de som ikke leser `CLAUDE.md`): shell-hygiene
og hvor oppgaver spores.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Oppgavesporing

To spor, med ulike roller:

- **Trello-boardet «Utvikling»** (`onb3nsLD`) er der NYE utviklingsoppgaver, bugs og
  features hører hjemme. Se `CLAUDE.md` → Trello for board-IDer.
- **beads (`bd`)** holder rebuild-PRD-grafen (124 issues, 15 epics) som ble bygd
  2026-06-29. Grafen er git-persistert i `.beads/issues.jsonl` og brukes til å lese
  avhengigheter og status i rebuild-arbeidet — den er ikke stedet nye løpende
  oppgaver opprettes.

```bash
bd ready --json          # Ublokkert rebuild-arbeid
bd show <id> --json      # Detaljer
bd update <id> --claim   # Claim atomisk
bd close <id> --reason "Done"
```

**`bd`-gotcha:** `bd`-på-Dolt henger under bulk-skriv (cycle-check-spørringen timer
ut etter ~200 sekvensielle skriv). Skriv i mindre bolker, og `--sandbox` BLOKKERER
skriv — ikke bruk det. Dolt-storen er lokal og gjenskapes fra `issues.jsonl`.

`scripts/build-loop.sh` konsumerer **ikke** beads i dag — koblingen mellom loopen og
`bd ready` er ikke bygd.

## Sesjonsavslutning

Placy er på prototype-/demo-stadiet, og Andreas styrer selv når ting pushes.

- **Ikke push uten at Andreas har bedt om det.** Commit lokalt; push ved en naturlig
  milepæl eller på forespørsel.
- Kjør de mekaniske sjekkene når kode er endret: `npm run lint`, `npm test`,
  `npx tsc --noEmit`, og `npm run build` før PR.
- Logg meningsfulle sesjoner: teknisk arbeid i `PROJECT-LOG.md`, forretning/strategi i
  `docs/strategy/LOG.md`. Se `CLAUDE.md` for auto-prompt-reglene.
- Etterlat åpne tråder eksplisitt beskrevet i loggen framfor som udokumentert
  lokal tilstand.
