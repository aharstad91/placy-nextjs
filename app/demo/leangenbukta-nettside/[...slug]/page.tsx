import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlacyField } from "@/app/demo/leangenbukta-nettside/placy-field";
import { readSiteFragment } from "@/lib/demo/leangenbukta-site/fragments";
import { renderSiteFragment, type PlacySlots } from "@/lib/demo/leangenbukta-site/html-to-react";
import { getSitePageByPath, getSitePages, type SitePage } from "@/lib/demo/leangenbukta-site/pages";

/**
 * Alle kopierte sider i Leangenbukta-demoen, unntatt forsiden, som har egen
 * håndskrevet rute (2026-09-23).
 *
 * Hvilke sider som finnes, avgjør sideregisteret (`pages.json`), og ingen
 * andre: `dynamicParams = false` gir 404 for alt som ikke står der. Innholdet
 * er kundens egen markup fra snapshotet, renset av byggeskriptet og rendret
 * som React (lib/demo/leangenbukta-site/html-to-react.tsx).
 */

export const dynamicParams = false;

const HANDWRITTEN = new Set(["forside"]);

export function generateStaticParams() {
  return getSitePages()
    .filter((page) => !HANDWRITTEN.has(page.id))
    .map((page) => ({ slug: page.path.split("/").filter(Boolean) }));
}

async function pageFor(params: Promise<{ slug: string[] }>): Promise<SitePage | null> {
  const { slug } = await params;
  const page = getSitePageByPath(`/${slug.join("/")}`);
  return page && !HANDWRITTEN.has(page.id) ? page : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const page = await pageFor(params);
  if (!page) return {};
  return {
    title: `${page.title} – Leangenbukta`,
    description: `${page.title} – demokopi av leangenbukta.no med Placy.`,
    robots: { index: false, follow: false },
  };
}

function slotsFor(page: SitePage): PlacySlots {
  const question = page.chatStarters[0] ?? `Hva bør jeg vite om ${page.title}?`;
  return {
    building: <PlacyField variant="building" name={page.shortName ?? page.title} question={question} />,
    location: <PlacyField variant="location" question={question} />,
    article: <PlacyField variant="article" question={question} />,
  };
}

export default async function LeangenbuktaSitePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const page = await pageFor(params);
  if (!page) notFound();
  return (
    <>
      <div data-placy-page-id={page.id} hidden />
      {renderSiteFragment(readSiteFragment(page.id), slotsFor(page))}
    </>
  );
}
