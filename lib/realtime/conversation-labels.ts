/**
 * Navnene samtalen sier om stedet den presenterer (2026-09-18).
 *
 * Verktøybeskrivelsene, det tomme svaret og temanøkkelen for prosjektinnhold
 * sto tidligere som «Nyhavna» rett i koden. Da het ethvert nytt datasetts guide
 * fortsatt Nyhavna i det modellen leste, selv når boardet viste et annet sted –
 * og nettopp den forvekslingen finnes de lokale demoene for å unngå.
 *
 * Navnene hører til DATASETTET; reglene rundt dem hører til koden. Det frosne
 * Nyhavna-snapshotet sender `NYHAVNA_LABELS` eksplisitt, så teksten det gir
 * modellen er ordrett den samme som før.
 */
export interface ConversationLabels {
  /** Stedet guiden presenterer, slik verktøytekstene navngir det. */
  areaName: string;
  /** Prosjektets eget kildemateriale, slik `find_project_info` omtaler det. */
  projectInfoLabel: string;
  /**
   * Kortformen i det tomme svaret («Ingen kildebelagt omtale i …»). Utelatt =
   * `projectInfoLabel`. Nyhavna har en egen genitivform der den lange
   * beskrivelsen ville blitt ulesbar som setningsledd.
   */
  projectInfoShortLabel?: string;
  /**
   * Temanøkkelen prosjektinnholdet ellers er merket med, lagt til ved siden av
   * kapittelets eget tema i søket. Utelatt = bare kapittelets tema.
   */
  areaThemeId?: string;
}

/** Det frosne snapshotets navn. Endres ikke: teksten er innarbeidet i lyttetestene. */
export const NYHAVNA_LABELS: ConversationLabels = {
  areaName: "Nyhavna",
  projectInfoLabel: "Nyhavna Utviklings eget innhold (nyhavna.no)",
  projectInfoShortLabel: "Nyhavnas eget innhold",
  areaThemeId: "nyhavna",
};

/** Kortformen med tilbakefall, så et datasett bare trenger oppgi ett navn. */
export const shortProjectInfoLabel = (labels: ConversationLabels): string =>
  labels.projectInfoShortLabel ?? labels.projectInfoLabel;
