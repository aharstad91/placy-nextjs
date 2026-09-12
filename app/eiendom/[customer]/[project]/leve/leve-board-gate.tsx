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
 * Samme klient-gate som boardets egen (`rapport-board/board-embed-gate.tsx`):
 * leser `?embed`/`?from`/`?src` på KLIENTEN så server-siden slipper
 * searchParams — det ville tvunget ruta til dynamisk rendering og skrudd av
 * ISR-en (`revalidate = 3600` i page.tsx). Må stå bak <Suspense>.
 */
export default function LeveBoardGate(props: Props) {
  const searchParams = useSearchParams();

  const embedParam = searchParams.get("embed");
  const embed = embedParam === "1" || embedParam === "" || embedParam === "true";
  const fromEmbed = searchParams.get("from") === "embed";
  const source = normalizeSource(searchParams.get("src"));

  return (
    <ReportReelsPage {...props} embed={embed} fromEmbed={fromEmbed} source={source} />
  );
}
