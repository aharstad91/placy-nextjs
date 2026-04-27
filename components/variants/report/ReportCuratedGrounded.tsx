"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { ReportThemeGroundingViewV2, POI } from "@/lib/types";
import POIPopover from "./POIPopover";

/**
 * V2-rendering av Gemini-grounded innhold. Unified kuratert narrative med
 * POI-inline-lenker. Rendres alltid i full høyde — foreldrekomponent styrer
 * disclosure via DOM-gating. "Google foreslår også"-chips rendres inline per
 * tema via ReportGroundingChips. Aggregert kilder-footer rendres én gang i
 * bunn av rapporten via ReportSourcesAggregated.
 *
 * Sikkerhet:
 * - ReactMarkdown med rehypeSanitize (whitelist av tags + poi/https-protokoller)
 * - POI-href-regex validering før render
 * - Render-time re-validering mot loaded POI-set (ghost-POIs → plain text)
 */

// POI href-format: poi:<uuid>
const POI_HREF_RE =
  /^poi:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// rehype-sanitize schema: tillat poi: og https: på href
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "poi", "mailto"],
  },
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "href",
    ],
  },
};

export interface ReportCuratedGroundedProps {
  grounding: ReportThemeGroundingViewV2;
  poisById: Map<string, POI>;
}

export default function ReportCuratedGrounded({
  grounding,
  poisById,
}: ReportCuratedGroundedProps) {
  return (
    <div>

      <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] [&>p]:mb-5 [&>p:last-child]:mb-0 [&>ul]:mb-5 [&>ol]:mb-5 [&_li]:ml-5 [&_li]:mb-1">
        <ReactMarkdown
          rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
          urlTransform={(url) =>
            /^(poi:|https?:|mailto:|#)/i.test(url) ? url : ""
          }
          allowedElements={[
            "p",
            "ul",
            "ol",
            "li",
            "strong",
            "em",
            "a",
            "code",
          ]}
          unwrapDisallowed
          components={{
            a: ({ href, children }) => {
              if (href && POI_HREF_RE.test(href)) {
                const uuid = href.slice(4).toLowerCase();
                const poi = poisById.get(uuid);
                if (poi) {
                  return (
                    <POIPopover
                      poi={poi}
                      label={String(children)}
                    />
                  );
                }
                return <>{children}</>;
              }
              if (href?.startsWith("https:") || href?.startsWith("http:")) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {children}
                  </a>
                );
              }
              return <>{children}</>;
            },
          }}
        >
          {grounding.curatedNarrative}
        </ReactMarkdown>
      </div>
    </div>
  );
}

