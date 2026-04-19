"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ReportThemeGroundingView } from "@/lib/types";

/**
 * Inline Google AI-utdyping nederst i en temaseksjon. Mønster inspirert av
 * Explorer's "hent flere POIs"-knapp: stegvis animasjon gir brukeren agens og
 * bekrefter at det jobbes.
 *
 * Flow:
 * 1. Default: diskret "Utdyp med Google AI"-knapp
 * 2. Klikk: knapp → spinner + "Henter utdyping…" (~1s theatre-pause)
 * 3. Knapp fader ut, narrativ + kilder fader inn under der knappen stod
 * 4. "Skjul utdyping" lar brukeren kollapse tilbake
 *
 * Data ligger allerede i DOM (server-rendret) — pausen er teateret, ikke fetch.
 * Formatering matcher extendedBridgeText så det smelter inn i rapport-kroppen.
 *
 * Google ToS: searchEntryPointHtml rendres verbatim etter narrativen,
 * DOMPurify-sanert ved lagring.
 */
export interface ReportGroundingInlineProps {
  grounding: ReportThemeGroundingView;
  /** Queryen vi stilte til Gemini — vises som "Vi stilte spørsmålet" over chips. */
  query?: string;
}

type ViewState = "idle" | "loading" | "expanded";

export default function ReportGroundingInline({
  grounding,
  query,
}: ReportGroundingInlineProps) {
  const [state, setState] = useState<ViewState>("idle");

  function handleExpand() {
    setState("loading");
    // Theatre-pause — gir leseren tid til å oppfatte at noe hentes
    setTimeout(() => setState("expanded"), 1000);
  }

  function handleCollapse() {
    setState("idle");
  }

  if (state === "idle") {
    return (
      <div className="mt-8">
        <button
          type="button"
          onClick={handleExpand}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#4f46e5] bg-[#eef2ff] rounded-full hover:bg-[#e0e7ff] transition-colors"
        >
          <GoogleGLogo className="w-4 h-4" />
          Utdyp med Google AI
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mt-8">
        <button
          type="button"
          disabled
          aria-busy="true"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#4f46e5] bg-[#eef2ff] rounded-full animate-pulse"
        >
          <SpinnerIcon className="w-4 h-4 animate-spin" />
          Henter utdyping fra Google AI…
        </button>
      </div>
    );
  }

  // state === "expanded"
  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Subtle G-logo attribution før narrativen */}
      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
        <GoogleGLogo className="w-4 h-4" />
        <span>Utdyping fra Google AI</span>
      </div>

      {/* Narrativen — matcher lowerNarrative-typografi (text-base md:text-lg,
          leading-[1.8], #4a4a4a). [&>p]:mb-5 gir tydelig avsnittsspacing mellom
          <p>-elementer som react-markdown splitter på \n\n. */}
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

      {/* Kilder — alltid synlige som pills med favicons */}
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

      {/* Attribution: vår egen query først, Google's chips etter.
          Google ToS krever at searchEntryPointHtml rendres verbatim — vi legger
          det i egen seksjon med klar label så leseren forstår at det er
          Google's tilleggsforslag, ikke vår query. */}
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
          {formatFetchedAt(grounding.fetchedAt)}.
        </p>
      </div>

      {/* Collapse-kontroll */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleCollapse}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Skjul utdyping
        </button>
      </div>
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
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
