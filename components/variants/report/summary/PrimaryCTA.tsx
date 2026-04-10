"use client";

import type { BrokerInfo, ReportCTA } from "@/lib/types";

interface PrimaryCTAProps {
  cta: ReportCTA;
  primaryBroker?: BrokerInfo;
  projectTitle: string;
}

function normalizePhoneHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible(event, props ? { props } : undefined);
  }
}

function resolvePrimaryHref(
  cta: ReportCTA,
  broker: BrokerInfo | undefined,
  projectTitle: string
): string | null {
  if (cta.leadUrl) return cta.leadUrl;
  if (broker?.email) {
    const subject = encodeURIComponent(
      cta.primarySubject ?? `Interesse for ${projectTitle}`
    );
    return `mailto:${broker.email}?subject=${subject}`;
  }
  return null;
}

export default function PrimaryCTA({
  cta,
  primaryBroker,
  projectTitle,
}: PrimaryCTAProps) {
  const primaryHref = resolvePrimaryHref(cta, primaryBroker, projectTitle);
  const primaryLabel = cta.primaryLabel ?? "Meld interesse";
  const isExternalLink = primaryHref?.startsWith("http");

  const phoneHref = primaryBroker?.phone
    ? normalizePhoneHref(primaryBroker.phone)
    : null;

  if (!primaryHref && !phoneHref) return null;

  return (
    <div className="flex flex-col items-center sm:items-start gap-3 pt-2">
      {primaryHref && (
        <a
          href={primaryHref}
          target={isExternalLink ? "_blank" : undefined}
          rel={isExternalLink ? "noopener noreferrer" : undefined}
          className="inline-flex items-center justify-center w-full sm:w-auto sm:min-w-[280px] h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:shadow-lg transition-shadow"
          aria-label={`${primaryLabel} – ${projectTitle}`}
          onClick={() =>
            track("cta_primary_click", {
              destination: primaryHref,
              project: projectTitle,
            })
          }
        >
          {primaryLabel}
        </a>
      )}

      {phoneHref && primaryBroker && (
        <a
          href={phoneHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() =>
            track("cta_phone_click", { broker: primaryBroker.name })
          }
        >
          Eller ring direkte: <span className="font-medium">{primaryBroker.phone}</span>
        </a>
      )}
    </div>
  );
}
