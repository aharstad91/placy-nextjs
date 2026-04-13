import type { BrokerInfo, ReportCTA, ReportSummary } from "@/lib/types";
import SummaryHeadline from "./summary/SummaryHeadline";
import SummaryInsights from "./summary/SummaryInsights";
import BrokerInvite from "./summary/BrokerInvite";
import BrokerCard from "./summary/BrokerCard";
import PrimaryCTA from "./summary/PrimaryCTA";
import ShareAction from "./summary/ShareAction";

interface ReportSummarySectionProps {
  summary?: ReportSummary;
  brokers?: BrokerInfo[];
  cta?: ReportCTA;
  projectTitle: string;
  themesCount: number;
}

export default function ReportSummarySection({
  summary,
  brokers,
  cta,
  projectTitle,
  themesCount,
}: ReportSummarySectionProps) {
  const brokersList = brokers ?? [];
  const ctaConfig = cta ?? {};
  const primaryBroker = brokersList[0];

  const hasAnyContent =
    (summary?.headline && summary.headline.length > 0) ||
    (summary?.insights && summary.insights.length > 0) ||
    brokersList.length > 0;

  if (!hasAnyContent) return null;

  return (
    <section className="relative col-span-12 py-16 md:py-20">
      <div className="md:max-w-4xl space-y-8">
        <div className="h-px bg-border mb-4" />

        <div className="relative">
          <ShareAction shareTitle={ctaConfig.shareTitle ?? projectTitle} />

          {summary?.headline && <SummaryHeadline text={summary.headline} />}
        </div>

        {summary?.insights && summary.insights.length > 0 && (
          <SummaryInsights items={summary.insights} />
        )}

        {brokersList.length > 0 && (
          <div className="pt-6 space-y-5">
            <BrokerInvite
              text={summary?.brokerInviteText}
              fallbackBroker={primaryBroker}
              themesCount={themesCount}
              projectName={projectTitle}
            />
            <div className="grid gap-4">
              {brokersList.map((broker, idx) => (
                <BrokerCard
                  key={broker.email || `broker-${idx}`}
                  broker={broker}
                  projectTitle={projectTitle}
                />
              ))}
            </div>
          </div>
        )}

        <PrimaryCTA
          cta={ctaConfig}
          primaryBroker={primaryBroker}
          projectTitle={projectTitle}
        />
      </div>
    </section>
  );
}
