import { unstable_cache } from "next/cache";
import { getProductAsync } from "@/lib/data-server";
import { boardLocationLabel, resolveBoardHeroImage } from "@/lib/seo/board-metadata";
import { OG_IMAGE_SIZE, renderBoardOgImage } from "@/lib/seo/board-og-image";

// Samme taggede getter som page.tsx (identiske keyParts → delt cache-entry),
// så revalidateTag buster side og OG-bilde i samme operasjon.
const getCachedReportProduct = (customer: string, projectSlug: string) =>
  unstable_cache(
    () => getProductAsync(customer, projectSlug, "report"),
    ["report-product", customer, projectSlug],
    {
      tags: [`product:${customer}_${projectSlug}`],
      revalidate: 3600,
    },
  )();

export const revalidate = 3600;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "Reels – Placy";

interface Props {
  params: Promise<{ customer: string; project: string }>;
}

export default async function OpengraphImage({ params }: Props) {
  const { customer, project: projectSlug } = await params;
  const projectData = await getCachedReportProduct(customer, projectSlug);

  // Ukjent board: 404 som page.tsx — og:image refereres kun fra boards som
  // finnes, og en 200-fallback ville gitt gratis satori-render + ISR-entry
  // per vilkårlig slug.
  if (!projectData) {
    return new Response("Not found", { status: 404 });
  }

  const location = boardLocationLabel(projectData);
  return renderBoardOgImage({
    title: projectData.story.title,
    subtitle: location ? `Reels · ${location}` : "Reels",
    imageUrl: resolveBoardHeroImage(projectData),
    themeColor: projectData.theme?.primaryColor,
  });
}
