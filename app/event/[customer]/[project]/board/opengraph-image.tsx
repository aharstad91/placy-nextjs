import { getProductAsync } from "@/lib/data-server";
import { boardLocationLabel, resolveBoardHeroImage } from "@/lib/seo/board-metadata";
import { OG_IMAGE_SIZE, renderBoardOgImage } from "@/lib/seo/board-og-image";

export const revalidate = 3600;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "Program – Placy";

interface Props {
  params: Promise<{ customer: string; project: string }>;
}

export default async function OpengraphImage({ params }: Props) {
  const { customer, project: projectSlug } = await params;
  // Direkte (utagget) henting som event-board/page.tsx — event-rutene bruker
  // ikke unstable_cache.
  const projectData = await getProductAsync(customer, projectSlug, "explorer");

  // Ukjent board: 404 som page.tsx — og:image refereres kun fra boards som
  // finnes, og en 200-fallback ville gitt gratis satori-render + ISR-entry
  // per vilkårlig slug.
  if (!projectData) {
    return new Response("Not found", { status: 404 });
  }

  const location = boardLocationLabel(projectData);
  return renderBoardOgImage({
    title: projectData.story.title,
    subtitle: location ? `Program · ${location}` : "Program",
    imageUrl: resolveBoardHeroImage(projectData),
    themeColor: projectData.theme?.primaryColor,
  });
}
