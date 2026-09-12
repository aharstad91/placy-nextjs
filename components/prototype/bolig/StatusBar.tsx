"use client";

import { Mic, MicOff, RotateCcw, Square, X } from "lucide-react";
import { STATUS_LABEL, type VoiceSession } from "@/lib/prototype/bolig/contract";
import { formatUsd } from "@/lib/prototype/bolig/format";
import styles from "@/components/prototype/bolig/bolig.module.css";

const IDLE_STATUSES = new Set(["idle", "connecting", "ended"]);

/** Statuslinje + samtalekontroller nederst: avbryt, mikrofon, stopp/start igjen. */
export default function StatusBar({ session }: { session: VoiceSession }) {
  const { status, error, notice, muted, usage, interrupt, toggleMute, stop, start } = session;
  const controllable = !IDLE_STATUSES.has(status);
  const canInterrupt = status === "thinking" || status === "speaking";
  const showRestart = status === "idle" || status === "ended";

  return (
    <div className={styles.statusBarStack}>
      {error && <p className={styles.errorLine} role="alert">{error}</p>}
      {notice && <p className={styles.noticeLine}>{notice}</p>}
      <div className={styles.statusRow}>
        <span className={styles.statusIndicator} data-status={status} aria-live="polite">
          {status === "connecting" && <span className={styles.spinner} aria-hidden="true" />}
          {status === "listening" && <span className={styles.liveDot} aria-hidden="true" />}
          {status === "thinking" && <span className={styles.thinkingDot} aria-hidden="true" />}
          {status === "speaking" && <span className={styles.waveform} aria-hidden="true"><i /><i /><i /></span>}
          {STATUS_LABEL[status]}
        </span>
        {usage?.estimatedUsd != null && <span className={styles.usage}>Estimert forbruk: {formatUsd(usage.estimatedUsd)}</span>}
        <div className={styles.statusControls}>
          {canInterrupt && (
            <button type="button" className={styles.iconButton} onClick={interrupt} aria-label="Avbryt svaret"><X size={16} /></button>
          )}
          <button
            type="button"
            className={styles.iconButton}
            onClick={toggleMute}
            disabled={!controllable}
            aria-pressed={muted}
            aria-label={muted ? "Slå på mikrofon" : "Slå av mikrofon"}
          >
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          {showRestart ? (
            <button type="button" className={styles.restartButton} onClick={start}><RotateCcw size={14} /> Start samtalen igjen</button>
          ) : (
            <button type="button" className={styles.stopButton} onClick={stop} disabled={!controllable} aria-label="Stopp samtalen">
              <Square size={12} /> Stopp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
