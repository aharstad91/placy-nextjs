import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public-client";
import { slugify } from "@/lib/utils/slugify";
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";
import { CURATED_LISTS } from "@/lib/curated-lists";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = createPublicClient();
  if (!client) return [];

  const baseUrl = "https://placy.no";
  const entries: MetadataRoute.Sitemap = [];

  // Homepage
  entries.push({
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  });

  // Visit Trondheim landing pages
  entries.push({
    url: `${baseUrl}/visit-trondheim`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  });
  entries.push({
    url: `${baseUrl}/en/visit-trondheim`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  });

  // Get all active areas
  const { data: areas } = await client
    .from("areas")
    .select("id, slug_no, slug_en")
    .eq("active", true);

  if (!areas) return entries;

  for (const area of areas) {
    // Area pages (NO + EN)
    entries.push({
      url: `${baseUrl}/${area.slug_no}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    });
    entries.push({
      url: `${baseUrl}/en/${area.slug_en}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    });

    // Get category slugs
    const { data: categorySlugs } = await client
      .from("category_slugs")
      .select("category_id, slug, locale");

    if (categorySlugs) {
      const noSlugs = categorySlugs.filter((s) => s.locale === "no");
      const enSlugs = categorySlugs.filter((s) => s.locale === "en");

      // Category pages
      for (const slug of noSlugs) {
        entries.push({
          url: `${baseUrl}/${area.slug_no}/${slug.slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
      for (const slug of enSlugs) {
        entries.push({
          url: `${baseUrl}/en/${area.slug_en}/${slug.slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }

    // Guide pages (curated lists)
    const areaLists = CURATED_LISTS[area.id] ?? [];
    for (const list of areaLists) {
      entries.push({
        url: `${baseUrl}/${area.slug_no}/guide/${list.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
      entries.push({
        url: `${baseUrl}/en/${area.slug_en}/guide/${list.slugEn ?? list.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Get all POIs for this area
    const { data: pois } = await client
      .from("pois")
      .select("name")
      .eq("area_id", area.id)
      .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`);

    if (pois) {
      for (const poi of pois) {
        const poiSlug = slugify(poi.name);
        entries.push({
          url: `${baseUrl}/${area.slug_no}/steder/${poiSlug}`,
          lastModified: new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
        entries.push({
          url: `${baseUrl}/en/${area.slug_en}/places/${poiSlug}`,
          lastModified: new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  }

  return entries;
}
