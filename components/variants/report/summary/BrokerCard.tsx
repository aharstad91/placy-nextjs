"use client";

import { useState } from "react";
import { Mail, Phone, User } from "lucide-react";
import type { BrokerInfo } from "@/lib/types";

interface BrokerCardProps {
  broker: BrokerInfo;
  projectTitle: string;
}

function normalizePhoneHref(phone: string): string {
  const stripped = phone.replace(/\s+/g, "");
  return `tel:${stripped}`;
}

function buildMailtoHref(email: string, projectTitle: string): string {
  const subject = encodeURIComponent(`Interesse for ${projectTitle}`);
  return `mailto:${email}?subject=${subject}`;
}

function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible(event, props ? { props } : undefined);
  }
}

export default function BrokerCard({ broker, projectTitle }: BrokerCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = broker.photoUrl && !imageFailed;

  const telHref = normalizePhoneHref(broker.phone);
  const mailHref = buildMailtoHref(broker.email, projectTitle);

  return (
    <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 bg-card border border-border rounded-2xl p-6">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={broker.photoUrl}
          alt={broker.name}
          width={96}
          height={96}
          className="w-24 h-24 rounded-full object-cover shrink-0 self-center sm:self-start"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-full bg-muted flex items-center justify-center shrink-0 self-center sm:self-start"
          aria-hidden="true"
        >
          <User className="w-12 h-12 text-muted-foreground" />
        </div>
      )}

      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div>
          <div className="text-lg font-semibold text-foreground leading-tight">
            {broker.name}
          </div>
          <div className="text-sm text-muted-foreground">
            {broker.title}
            {broker.officeName && `, ${broker.officeName}`}
          </div>
          {broker.bio && (
            <div className="text-sm text-muted-foreground italic mt-1">
              {broker.bio}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mt-1">
          <a
            href={telHref}
            className="inline-flex items-center gap-2 text-base text-foreground hover:text-primary transition-colors w-fit"
            aria-label={`Ring ${broker.name}, ${broker.phone}`}
            onClick={() => track("broker_phone_click", { broker: broker.name })}
          >
            <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{broker.phone}</span>
          </a>
          <a
            href={mailHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit break-all"
            aria-label={`Send e-post til ${broker.name}, ${broker.email}`}
            onClick={() => track("broker_email_click", { broker: broker.name })}
          >
            <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{broker.email}</span>
          </a>
        </div>

        {broker.officeLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={broker.officeLogoUrl}
            alt={broker.officeName}
            className="h-6 w-auto mt-2 opacity-70"
          />
        )}
      </div>
    </div>
  );
}
