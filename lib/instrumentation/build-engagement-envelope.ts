import type {
  EngagementContextEnvelope,
  EngagementSrc,
} from "./event-types";

/**
 * Bygger kontekst-konvolutten (Moat-2 / R19) — ren, testbar helper trukket ut av
 * ReportReelsPage sin useMemo. `src` foldes inn KUN når den er satt (kjent
 * kanal-markør), ellers utelates feltet (ingen "unknown"-støy i datasettet).
 * Sikrer at kanal-attribusjonen (finn|embed|qr) har en regresjonsvakt uavhengig
 * av det tunge board-treet.
 */
export function buildEngagementEnvelope(opts: {
  eventMode: boolean;
  has3dAddon: boolean;
  categoriesPresented: string[];
  locale: string;
  src?: EngagementSrc;
}): EngagementContextEnvelope {
  return {
    mode: opts.eventMode ? "event" : "report",
    has_3d_addon: opts.has3dAddon,
    categories_presented: opts.categoriesPresented,
    locale: opts.locale,
    ...(opts.src ? { src: opts.src } : {}),
  };
}
