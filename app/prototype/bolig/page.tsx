import type { Metadata } from "next";
import { BOLIG_FIXTURE } from "@/lib/prototype/bolig/fixture";
import BoligClient from "@/app/prototype/bolig/BoligClient";

export const metadata: Metadata = {
  title: "Snakk om nabolaget — Placy bruktbolig-prototype",
  description: "Mobil talesamtale om beliggenheten til én eksempelbolig på Ranheim. Lokal prototype.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * `/prototype/bolig` — ekte tale (krever OPENAI_API_KEY lokalt).
 * `/prototype/bolig?sim=1` — lokal simulering for layout og flyt, uten betalt samtale.
 */
export default async function BoligPrototypePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const simulated = params.sim === "1";
  return <BoligClient fixture={BOLIG_FIXTURE} simulated={simulated} />;
}
