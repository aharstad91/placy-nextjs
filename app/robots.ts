import type { MetadataRoute } from "next";

// Pre-launch: blokker all crawl. Placy.no er ikke lansert, og bot-trafikk
// (Googlebot, GPTBot, ClaudeBot, Ahrefs, Semrush, m.fl.) sto for tilnærmet
// all Vercel-trafikk. Reverser ved lansering.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
