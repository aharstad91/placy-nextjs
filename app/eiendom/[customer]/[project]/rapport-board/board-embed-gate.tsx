"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";

type Props = Omit<
  ComponentProps<typeof ReportReelsPage>,
  "embed" | "fromEmbed" | "source"
>;

function normalizeSource(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().slice(0, 32);
  return /^[a-z0-9_-]+$/.test(v) ? v : undefined;
}

/**
 * Leser `?embed`/`?from` på KLIENTEN slik at server-siden slipper searchParams
 * — å lese dem der tvinger ruten til dynamisk rendering og skrur av ISR-en
 * (`revalidate = 3600` i page.tsx). Må stå bak <Suspense> (useSearchParams-krav
 * ved statisk prerender).
 */
export default function BoardEmbedGate(props: Props) {
  const searchParams = useSearchParams();

  // `?embed=1` (eller bare `?embed`): siden limes inn i en iframe på en ekstern
  // nettside → lett splash-teaser i stedet for full board-opplevelse.
  const embedParam = searchParams.get("embed");
  const embed = embedParam === "1" || embedParam === "" || embedParam === "true";
  // `?from=embed`: brukeren klikket seg hit fra embed-teaseren → "Klar"-gate
  // (oppvarming + ett lyd-trykk) i stedet for å gjenta velkomst-splashen.
  const fromEmbed = searchParams.get("from") === "embed";
  // `?src=qr|finn|mail|some|…`: inngangskilde for Moat 2. Normaliseres her så
  // konvolutten aldri bærer fri tekst; ugyldig verdi → utelatt, ikke feil.
  const source = normalizeSource(searchParams.get("src"));

  return (
    <ReportReelsPage {...props} embed={embed} fromEmbed={fromEmbed} source={source} />
  );
}
