import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/for/", "/admin/", "/api/", "/trips/", "/test-3d/"],
      },
    ],
    sitemap: "https://placy.no/sitemap.xml",
  };
}
