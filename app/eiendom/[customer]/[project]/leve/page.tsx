import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCachedProjectTranslations } from "@/lib/supabase/cached-board-reads";
import { buildBoardMetadata } from "@/lib/seo/board-metadata";
import { buildReportBoardStyle } from "@/lib/board/report-board-style";
import {
  LEVE_CUSTOMER,
  LEVE_PROJECT,
} from "@/lib/demo/nyhavna-leve/build";
import { getNyhavnaSnapshot } from "@/lib/demo/nyhavna-leve/snapshot";
import LeveBoardGate from "./leve-board-gate";

/**
 * «Leve»-varianten av Nyhavna-boardet — møtedemo, 16. september 2026.
 *
 * Samme board som `/rapport-board`, med Nyhavna Utviklings eget innhold fra
 * nyhavna.no/leve lagt inn som de tre første temaene: Servering, Park og
 * promenade, Kunst og kultur. Den eksisterende demoen er urørt — dette er en
 * egen URL, og flettingen skjer i minnet (se `lib/demo/nyhavna-leve/build.ts`).
 *
 * Ruta ligger under `[customer]/[project]` for å arve boardets egen URL-familie,
 * men den gjelder ÉTT prosjekt. Alt annet er 404: en demo-variant som svarte på
 * hvilken som helst kunde ville vært en felle for neste person som provisjonerte
 * et board.
 */
export const revalidate = 3600;

export function generateStaticParams(): Array<{ customer: string; project: string }> {
  return [{ customer: LEVE_CUSTOMER, project: LEVE_PROJECT }];
}

/** Ingen andre kunder enn Nyhavna — se doc over. */
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ customer: string; project: string }>;
}

export default async function NyhavnaLevePage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  if (customer !== LEVE_CUSTOMER || projectSlug !== LEVE_PROJECT) notFound();

  const { project: leveProject } = await getNyhavnaSnapshot();

  const poiIds = leveProject.pois.map((p) => p.id);
  const themeIds = (leveProject.reportConfig?.themes || []).map((t) => t.id);
  const enTranslations = await getCachedProjectTranslations(
    customer,
    projectSlug,
    "en",
    poiIds,
    themeIds,
    leveProject.id,
  );

  const themeStyle = buildReportBoardStyle(leveProject);

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <LeveBoardGate
          project={leveProject}
          enTranslations={enTranslations}
        />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  if (customer !== LEVE_CUSTOMER || projectSlug !== LEVE_PROJECT) {
    return { title: "Rapport ikke funnet" };
  }
  const { project: projectData } = await getNyhavnaSnapshot();

  return buildBoardMetadata({
    project: projectData,
    titleSuffix: "Leve på Nyhavna",
    shareSuffix: "Leve på Nyhavna",
    path: `/eiendom/${customer}/${projectSlug}/leve`,
  });
}
