"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { ReportThemeGroundingViewV2 } from "@/lib/types";
import type { POI } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getIcon } from "@/lib/utils/map-icons";
import { Star, MapPin } from "lucide-react";

/**
 * V2-rendering av Gemini-grounded innhold. Unified kuratert narrative med
 * POI-inline-lenker. Erstatter to-tekst-mønsteret (Placy + Gemini-drawer).
 *
 * Sikkerhet:
 * - ReactMarkdown med rehypeSanitize (whitelist av tags + poi/https-protokoller)
 * - POI-href-regex validering før render
 * - Render-time re-validering mot loaded POI-set (ghost-POIs → plain text)
 * - searchEntryPointHtml rendres verbatim (DOMPurify-sanert ved write, Google ToS)
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
  /** Queryen vi stilte Gemini — vises som indigo-chip over Google-forslag. */
  query?: string;
}

export default function ReportCuratedGrounded({
  grounding,
  poisById,
  query,
}: ReportCuratedGroundedProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-8">
      {/* Google G-logo + attribution — én linje over curated-teksten */}
      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
        <GoogleGLogo className="w-4 h-4" />
        <span>Utdyping fra Google AI</span>
      </div>

      {/* Unified curated narrative — collapsible med fade-preview.
          Fade-out + "Les utdyping" hvis ikke expanded; full høyde + sources når expanded. */}
      <div
        className={`relative ${
          expanded ? "" : "max-h-[200px] overflow-hidden"
        }`}
      >
        <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] [&>p]:mb-5 [&>p:last-child]:mb-0 [&>ul]:mb-5 [&>ol]:mb-5 [&_li]:ml-5 [&_li]:mb-1">
        <ReactMarkdown
          rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
          // Standard urlTransform strips ikke-http protokoller — tillat poi:+https
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
              // POI-lenke: validér format + slå opp i poisById (ghost-POI fallback)
              if (href && POI_HREF_RE.test(href)) {
                const uuid = href.slice(4).toLowerCase();
                const poi = poisById.get(uuid);
                if (poi) {
                  return (
                    <PoiChipRenderer
                      poi={poi}
                      label={String(children)}
                    />
                  );
                }
                // POI slettet etter curation → fallback til plain tekst
                return <>{children}</>;
              }
              // Ekstern lenke: kun http(s)
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
              // Ukjent protokoll → strip lenke, behold tekst
              return <>{children}</>;
            },
          }}
        >
          {grounding.curatedNarrative}
        </ReactMarkdown>
        </div>

        {/* Gradient fade-out overlay — kun når kollapsed */}
        {!expanded && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white"
          />
        )}
      </div>

      {/* Toggle: Les utdyping / Skjul */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#4f46e5] hover:text-[#3730a3] transition-colors"
        >
          {expanded ? "Skjul utdyping" : "Les hele utdypingen"}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Sources + attribution — kun synlige når expanded (støyreduksjon) */}
      {expanded && (
        <>
          {grounding.sources.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                Kilder ({grounding.sources.length})
              </h4>
              <ol className="flex flex-wrap gap-2">
                {grounding.sources.map((source, idx) => (
                  <li key={`${source.url}-${idx}`}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                      title={source.title}
                    >
                      <FavIcon domain={source.domain} />
                      <span className="max-w-[180px] truncate">{source.domain}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border/50 space-y-4">
            {query && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Vi stilte spørsmålet
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-full">
                  <GoogleGLogo className="w-3 h-3" />
                  {query}
                </span>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Google foreslår også
              </p>
              <div
                className="grounding-search-entry"
                dangerouslySetInnerHTML={{ __html: grounding.searchEntryPointHtml }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Generert med Google AI basert på offentlige kilder. Oppdatert{" "}
              {formatFetchedAt(grounding.curatedAt ?? grounding.fetchedAt)}.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function formatFetchedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("no-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function FavIcon({ domain }: { domain: string }) {
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={14}
      height={14}
      className="rounded-sm"
      loading="lazy"
    />
  );
}

/**
 * POI-chip renderer — samme mønster som POIInlineLink i ReportThemeSection,
 * men standalone for bruk i curated markdown.
 */
function PoiChipRenderer({ poi, label }: { poi: POI; label: string }) {
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-baseline gap-1 font-semibold text-[#1a1a1a] underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] transition-colors cursor-pointer"
        >
          <span
            className="inline-flex items-center justify-center w-[1.2em] h-[1.2em] rounded-full shrink-0 overflow-hidden relative translate-y-[0.15em]"
            style={!imageUrl ? { backgroundColor: poi.category.color + "20" } : undefined}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-[0.6em] h-[0.6em]" style={{ color: poi.category.color }} />
            )}
          </span>
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-0 gap-0 overflow-hidden">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={poi.name} className="w-full aspect-[16/9] object-cover" />
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-[#1a1a1a] leading-tight">{poi.name}</h3>
              <p className="text-xs text-muted-foreground">{poi.category.name}</p>
            </div>
          </div>
          {poi.googleRating != null && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <Star className="w-3 h-3 fill-current text-yellow-500" />
              <span>{poi.googleRating.toFixed(1)}</span>
              {poi.googleReviewCount != null && (
                <span className="text-xs">({poi.googleReviewCount})</span>
              )}
            </div>
          )}
          {walkMin != null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{walkMin} min gange</span>
            </div>
          )}
          {poi.editorialHook && (
            <p className="text-sm text-[#4a4a4a] leading-relaxed mt-2">
              {poi.editorialHook}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
