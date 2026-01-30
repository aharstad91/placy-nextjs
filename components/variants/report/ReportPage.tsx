"use client";

import { useMemo } from "react";
import type { Project } from "@/lib/types";
import { transformToReportData } from "./report-data";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportClosing from "./ReportClosing";

interface ReportPageProps {
  project: Project;
}

export default function ReportPage({ project }: ReportPageProps) {
  const reportData = useMemo(
    () => transformToReportData(project),
    [project]
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <ReportHero
        projectName={reportData.projectName}
        metrics={reportData.heroMetrics}
      />

      {/* Theme sections */}
      {reportData.themes.map((theme, i) => (
        <div key={theme.id}>
          {i > 0 && (
            <div className="max-w-3xl mx-auto px-6">
              <div className="h-px bg-[#e8e4df]" />
            </div>
          )}
          <ReportThemeSection
            theme={theme}
            center={reportData.centerCoordinates}
          />
        </div>
      ))}

      {/* Closing */}
      <ReportClosing
        projectName={reportData.projectName}
        totalPOIs={reportData.heroMetrics.totalPOIs}
        avgRating={reportData.heroMetrics.avgRating}
      />
    </div>
  );
}
