"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";
import { parseSrc } from "@/lib/instrumentation/event-types";

type Props = Omit<ComponentProps<typeof ReportReelsPage>, "embed" | "src">;

/**
 * Leser `?embed` på KLIENTEN slik at server-siden slipper searchParams — å lese
 * dem der tvinger ruten til dynamisk rendering og skrur av ISR-en
 * (`revalidate = 3600` i page.tsx). Må stå bak <Suspense> (useSearchParams-krav
 * ved statisk prerender).
 */
export default function BoardEmbedGate(props: Props) {
  const searchParams = useSearchParams();

  // `?embed=1` (eller bare `?embed`): siden limes inn i en iframe på en ekstern
  // nettside → Unit 4 rendrer det fulle boardet med EmbedChrome-overlegg.
  const embedParam = searchParams.get("embed");
  const embed = embedParam === "1" || embedParam === "" || embedParam === "true";

  // Kanal-markør (R19): finn|embed|qr fra distribusjons-artefaktene. Kun kjente
  // verdier slipper gjennom (parseSrc) → rir i engagement-konvolutten (Unit 5).
  const src = parseSrc(searchParams.get("src"));

  return <ReportReelsPage {...props} embed={embed} src={src} />;
}
