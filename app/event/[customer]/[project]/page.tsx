import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * Container-landing for et event-prosjekt. Explorer-varianten (gammel
 * default her) døde ved cutover-trimmen 2026-07-06 — event-boardet er
 * produktflaten, så landingen redirecter dit.
 */

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function EventProjectLanding({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  redirect(`/event/${customer}/${projectSlug}/board`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { project: projectSlug } = await params;
  const title = projectSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return {
    title: `${title} | Placy`,
    description: `Utforsk ${title} med Placy`,
  };
}
