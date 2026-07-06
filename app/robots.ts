import type { MetadataRoute } from "next";

// Pre-launch: blokker generell crawl. Placy.no er ikke lansert, og bot-trafikk
// (Googlebot, GPTBot, ClaudeBot, Ahrefs, Semrush, m.fl.) sto for tilnærmet
// all Vercel-trafikk. Reverser `*`-regelen ved lansering. IKKE legg inn en
// /admin-disallow da: en robots-blokkert URL kan fortsatt URL-only-indekseres,
// og crawleren ser aldri noindex-metaen i app/admin/layout.tsx — la /admin
// crawles og noindexes (requireAdmin redirecter uansett admin-HTML i prod).
//
// Unntak: preview-botene under, så totalblokken ikke dreper OG-previews når
// boards deles med prospekter — selve salgsflaten. Twitterbot, LinkedInBot og
// facebookexternalhit respekterer robots.txt for previews (dokumentert);
// Slackbot/Discordbot varierer; WhatsApp/Telegram henter den ikke. Allow-
// regelen koster ingenting og fjerner robots.txt som feilkilde for previews
// på board-rutene. Lengste-path-regelen (RFC 9309) gjør at allow vinner over
// disallow "/" for disse stiene.
const SOCIAL_PREVIEW_BOTS = [
  "Slackbot",
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: SOCIAL_PREVIEW_BOTS,
        allow: ["/eiendom/", "/event/"],
        disallow: "/",
      },
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
