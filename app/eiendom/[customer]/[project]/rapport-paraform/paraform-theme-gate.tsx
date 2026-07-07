"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import ReportPageParaform from "@/components/variants/report/paraform/ReportPageParaform";

type Props = Omit<ComponentProps<typeof ReportPageParaform>, "primaryThemeIds">;

/**
 * Leser `?themes=` på KLIENTEN slik at server-siden slipper searchParams —
 * å lese dem der tvinger ruten til dynamisk rendering og skrur av ISR-en
 * (`revalidate = 3600` i page.tsx). Må stå bak <Suspense> (useSearchParams-krav
 * ved statisk prerender).
 */
export default function ParaformThemeGate(props: Props) {
  const searchParams = useSearchParams();

  const themesParam = searchParams.get("themes");
  const primaryThemeIds =
    typeof themesParam === "string" && themesParam.length > 0
      ? themesParam.split(",")
      : undefined;

  return <ReportPageParaform {...props} primaryThemeIds={primaryThemeIds} />;
}
