#!/usr/bin/env bash
#
# ralph-beads.sh — Autonom bead-drevet build-loop for Placy v2 rebuild (Steg-2-broa).
#
# Hver iterasjon kjører en FERSK headless `claude` som bygger NØYAKTIG ÉN bead:
#   bd ready → bygg mot AC → gates (tsc/lint/test/build) → bd close → commit (ALDRI push).
# Fersk kontekst per bead = ingen compaction-problem. Den ytre løkka gir «keep going».
#
# Kjør detached (overlever at du lukker terminalen):
#   nohup ./scripts/ralph-beads.sh > ralph-logs/run.log 2>&1 &
#   echo $! > ralph-logs/ralph.pid        # husk PID for å stoppe
#
# Stopp:  kill "$(cat ralph-logs/ralph.pid)"   (eller: pkill -f ralph-beads.sh)
# Følg:   tail -f ralph-logs/*-summary.log
#
# Env-overstyringer:
#   RALPH_MAX_ITERS  (default 30)  — hard tak på antall beads per kjøring
#   RALPH_MODEL      (default tom = CLI-default)  — f.eks. "sonnet" for billigere mekanisk port
#
# Merk: IKKE `set -u` — macOS-bash 3.2 feiler på tom-array-ekspansjon ("${arr[@]}")
# under set -u. Vi bruker :- / +-guards eksplisitt der det trengs i stedet.
set -o pipefail
cd "$(dirname "$0")/.." || { echo "fant ikke repo-rot"; exit 1; }

MAX_ITERS="${RALPH_MAX_ITERS:-30}"
MODEL_ARG=()
[ -n "${RALPH_MODEL:-}" ] && MODEL_ARG=(--model "$RALPH_MODEL")

LOG_DIR="ralph-logs"
mkdir -p "$LOG_DIR"
RUN_TS="$(date +%Y%m%d-%H%M%S)"
SUMMARY="$LOG_DIR/${RUN_TS}-summary.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$SUMMARY"; }

PROMPT='AUTONOM RALPH-ITERASJON (Placy v2 rebuild). Du er i en headless loop — bygg NØYAKTIG ÉN bead og avslutt. Det finnes INGEN bruker å spørre; ikke be om bekreftelse.

KONTEKST: Les CLAUDE.md (prosjektregler) + memory-frontier (MEMORY.md → project_prd_audit_beads_ready.md) for status + mønstre. Build-loopen drives av beads (bd-CLI via Bash).

GJØR:
1. Kjør `bd ready`. Velg ÉN byggbar bead. Prioriter board-MVP-stien mot et SYNLIG kjørende board: PRD 5 (board-data, resten) → PRD 6 (3D-kart-motor) → PRD 9 (board-UI-skall) → 10/14. Ellers laveste P0→P1→P2. HOPP OVER beads som krever ekte produkt-/scope-valg eller xhigh-prod-kjøring (se pkt 5/vakter).
2. Bygg bead-en til akseptansekriteriene. Mange er VERBATIM-PORTER (koden finnes alt — verifiser mot AC, ikke omskriv). Følg CLAUDE.md + memory-mønstre: v2-skrivesti = Option-A schema-param på delte mutations; v2-paritet-gaps (NOT-NULL-uten-default som featured/version/default_product) settes eksplisitt; fjern spuriøse over-gating-deps på rene kode-beads (bd dep remove).
3. GATES (MÅ passere før commit): `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npx vitest run` (alle grønne), `npm run build`. Legg til/utvid tester for ny logikk («ferdig betyr ferdig»).
4. GRØNNE gates → `bd close <id>` med dokumenterende kommentar + `bd export -o .beads/issues.jsonl` + `git add` + `git commit` (Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>). ALDRI `git push`. Oppdater memory-frontier kort.
5. Viser bead-en seg å kreve et EKTE produkt-/scope-valg (ikke en teknisk avstemming du kan utlede fra PRD/kode) → IKKE gjett. Append funnet til docs/rebuild/DECISIONS-QUEUE.md (opprett om mangler; IKKE re-kø noe som alt står der), commit den (chore), og velg en ANNEN byggbar bead. Finnes ingen byggbar → skriv kort hvorfor og avslutt UTEN commit.
6. RØDE gates du ikke trygt kan fikse → revert dine endringer for den bead-en (git checkout/restore), loggfør i DECISIONS-QUEUE, avslutt.

VAKTER (ufravikelige): ALDRI `git push`. ALDRI masseslett/destruktivt. ALDRI kjør faktisk provisjon/migrasjon mot v2-PROD (xhigh) — slikt køes i DECISIONS-QUEUE. La arbeidstreet være RENT ved exit (alt enten committet eller revertet). Bygg KUN ÉN bead, så avslutt.'

log "=== ralph-beads start (max $MAX_ITERS iter, model='${RALPH_MODEL:-default}') ==="
stuck=0
for i in $(seq 1 "$MAX_ITERS"); do
  iter_log="$LOG_DIR/${RUN_TS}-iter-$(printf '%02d' "$i").log"
  log "── iterasjon $i/$MAX_ITERS → $iter_log"
  head_before="$(git rev-parse HEAD 2>/dev/null)"

  # ${arr[@]+"${arr[@]}"} = bash-3.2-trygg ekspansjon av evt. tom MODEL_ARG.
  claude --dangerously-skip-permissions ${MODEL_ARG[@]+"${MODEL_ARG[@]}"} -p "$PROMPT" > "$iter_log" 2>&1 || \
    log "  (claude exited non-zero — se $iter_log)"

  head_after="$(git rev-parse HEAD 2>/dev/null)"
  if [ "$head_before" = "$head_after" ]; then
    stuck=$((stuck + 1))
    log "  ingen ny commit (stuck=$stuck/2)"
    if [ "$stuck" -ge 2 ]; then
      log "STOPP: 2 iterasjoner uten fremgang — tom for byggbare beads eller blokkert. Sjekk DECISIONS-QUEUE.md + iter-logger."
      break
    fi
  else
    stuck=0
    log "  ✓ $head_after — $(git log -1 --format='%s' "$head_after" 2>/dev/null)"
  fi
done
log "=== ralph-beads ferdig ==="
