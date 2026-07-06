import type { Metadata } from "next";
import type { Project } from "@/lib/types";
import { getProjectSplashImage } from "@/lib/themes/project-brand";

/**
 * Delt metadata-bygger for board-rutene (rapport-board/-reels/-paraform og
 * event-board). Boards deles med prospekter, så OG/Twitter-previewet i
 * Slack/e-post/SoMe er en salgsflate — og:image kommer fra
 * opengraph-image.tsx-filkonvensjonen i hver rute og trenger ikke settes her.
 */

// Origin for hero-asset-fetchen i OG-bildet: preview-deploys henter fra egen
// deployment (VERCEL_URL) så nye/endrede assets kan verifiseres før prod;
// lokal dev faller tilbake til prod-domenet (samme fallback som
// lib/pipeline/provision.ts).
const ASSET_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://placy.no");

// Plattformene trunkerer selv rundt ~200 tegn; klipp på ordgrense så
// previewet ikke ender midt i et ord.
function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

/** Strøket boardet handler om, f.eks. "Ranheim, Trondheim". */
export function boardLocationLabel(project: Project): string | undefined {
  const parts = [project.reportConfig?.district, project.reportConfig?.city].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Representativt bilde for boardet, i prioritert rekkefølge: eksplisitt
 * heroImage → brand-splash (slug-konvensjonen fra ProjectAssetFlags) →
 * første story-hero. Returneres som absolutt URL; undefined gir
 * gradient-fallback i OG-bildet.
 */
export function resolveBoardHeroImage(project: Project): string | undefined {
  const reportConfig = project.reportConfig;
  const candidate =
    reportConfig?.heroImage ??
    getProjectSplashImage(project.urlSlug, reportConfig?.assets) ??
    project.story.heroImages?.[0];
  if (!candidate) return undefined;
  if (candidate.startsWith("http")) return candidate;
  // Protokoll-relative verdier ("//host/…") ville resolvet til vilkårlig host.
  if (candidate.startsWith("//")) return undefined;
  return new URL(candidate, ASSET_ORIGIN).toString();
}

interface BoardMetadataInput {
  project: Project;
  /** Suffiks i <title>, f.eks. "Nabolagsrapport (Board)". */
  titleSuffix: string;
  /** Renere suffiks til delings-tittelen (uten interne markører som "(Board)"). Default: titleSuffix. */
  shareSuffix?: string;
  /** Kanonisk path uten query, f.eks. `/eiendom/acme/prosjekt/rapport-board`. */
  path: string;
  /** Overstyrer beskrivelsen. Default: story.introText, deretter strøk-fallback. */
  description?: string;
}

export function buildBoardMetadata({
  project,
  titleSuffix,
  shareSuffix,
  path,
  description,
}: BoardMetadataInput): Metadata {
  const location = boardLocationLabel(project);
  const resolvedDescription = truncate(
    description ??
      project.story.introText ??
      `Utforsk nabolaget rundt ${project.name}${location ? ` i ${location}` : ""}.`,
  );
  const shareTitle = `${project.story.title} – ${shareSuffix ?? titleSuffix}`;

  return {
    title: `${project.story.title} – ${titleSuffix} | Placy`,
    description: resolvedDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: shareTitle,
      description: resolvedDescription,
      url: path,
      siteName: "Placy",
      locale: "nb_NO",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: resolvedDescription,
    },
  };
}
