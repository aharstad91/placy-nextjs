"use client";

import ReactMarkdown from "react-markdown";
import type { ReportThemeGroundingView } from "@/lib/types";

/**
 * V1-rendering av Gemini-grounded innhold. Raw narrative (ikke Claude-kuratert)
 * med inline http-lenker. Rendres alltid full — foreldrekomponent styrer
 * disclosure via DOM-gating. "Google foreslår også"-chips rendres inline per
 * tema via ReportGroundingChips. Aggregert kilder-footer rendres én gang i
 * bunn av rapporten via ReportSourcesAggregated.
 */
export interface ReportGroundingInlineProps {
  grounding: ReportThemeGroundingView;
}

export default function ReportGroundingInline({
  grounding,
}: ReportGroundingInlineProps) {
  return (
    <div>

      <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] [&>p]:mb-5 [&>p:last-child]:mb-0">
        <ReactMarkdown
          allowedElements={[
            "p",
            "ul",
            "ol",
            "li",
            "strong",
            "em",
            "a",
            "code",
            "h3",
            "h4",
          ]}
          unwrapDisallowed
          urlTransform={(url) =>
            /^(https?:|mailto:|#)/i.test(url) ? url : ""
          }
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                referrerPolicy="no-referrer"
                className="text-indigo-600 hover:underline"
              >
                {children}
              </a>
            ),
          }}
        >
          {grounding.narrative}
        </ReactMarkdown>
      </div>
    </div>
  );
}

