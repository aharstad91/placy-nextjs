import Image from "next/image";
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
  /** Optional illustration mirroring the hero layout */
  heroImage?: string;
}

export default function ReportSummarySection({
  summary,
  brokers,
  cta,
  projectTitle,
  themesCount,
  heroImage,
}: ReportSummarySectionProps) {
  const brokersList = brokers ?? [];
  const ctaConfig = cta ?? {};
  const primaryBroker = brokersList[0];

  const hasAnyContent =
    (summary?.headline && summary.headline.length > 0) ||
    (summary?.insights && summary.insights.length > 0) ||
    brokersList.length > 0;

  if (!hasAnyContent) return null;

  const hasBrokerBlock = brokersList.length > 0;

  return (
    <>
      {/* Top: summary + illustration (hero-style 50/50) */}
      <section className="min-h-[66vh] flex flex-col bg-white">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
          {/* Left: summary text */}
          <div className="flex flex-col justify-center px-6 py-10 md:px-16 md:py-14">
            <div className="space-y-8">
              <div className="relative">
                <ShareAction shareTitle={ctaConfig.shareTitle ?? projectTitle} />

                {summary?.headline && <SummaryHeadline text={summary.headline} />}
              </div>

              {summary?.insights && summary.insights.length > 0 && (
                <SummaryInsights items={summary.insights} />
              )}
            </div>
          </div>

          {/* Right: illustration */}
          {heroImage && (
            <div className="relative hidden md:block">
              <Image
                src={heroImage}
                alt={projectTitle}
                fill
                className="object-contain object-center"
                sizes="50vw"
              />
            </div>
          )}
        </div>
      </section>

      {/* Bottom: broker block + primary CTA (own section, breathes) */}
      {(hasBrokerBlock || ctaConfig.primaryLabel) && (
        <section className="bg-white px-6 py-12 md:px-16 md:py-20">
          <div className="max-w-[800px] mx-auto space-y-8">
            {hasBrokerBlock && (
              <div className="space-y-5">
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
      )}
    </>
  );
}
