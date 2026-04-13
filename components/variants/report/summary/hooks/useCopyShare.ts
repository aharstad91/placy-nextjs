"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ShareOptions {
  title?: string;
  url?: string;
}

interface UseCopyShareResult {
  share: (options?: ShareOptions) => Promise<void>;
  copied: boolean;
  error: string | null;
}

/**
 * Siste-utvei fallback via document.execCommand("copy").
 * Dekker Safari Private Browsing, HTTP utenfor localhost, og eldre browsere.
 * Returnerer true ved suksess. SSR-safe (kun kalt fra callback).
 */
function copyViaExecCommand(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Hook for share/clipboard handling with icon-swap confirmation.
 *
 * Strategy:
 * 1. If navigator.share() exists AND canShare() approves the payload, use it
 *    (native share sheet on mobile — Instagram, SMS, WhatsApp, etc.).
 * 2. Otherwise fall back to navigator.clipboard.writeText().
 * 3. If clipboard API unavailable or throws NotAllowedError (Safari Private
 *    Browsing), fall back to document.execCommand("copy").
 * 4. On success, `copied` flips to true for 2s, then resets.
 * 5. AbortError (user cancelled share sheet) is swallowed silently.
 * 6. Other errors populate `error` but never throw.
 *
 * SSR-safe: all browser API access is inside the callback, not at module load.
 */
export function useCopyShare(): UseCopyShareResult {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const share = useCallback(async (options: ShareOptions = {}) => {
    if (typeof window === "undefined") return;

    const url = options.url ?? window.location.href;
    const title = options.title;
    setError(null);

    try {
      const payload: ShareData = { url, ...(title ? { title } : {}) };

      if (
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare(payload))
      ) {
        await navigator.share(payload);
        // Native share sheet used — no "copied" toast needed, but flip briefly
        // so the UI confirms something happened.
        setCopied(true);
      } else if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch (clipErr) {
          // Safari Private Browsing + enkelte HTTP-kontekster kan kaste
          // NotAllowedError. Fall tilbake til execCommand.
          if (!copyViaExecCommand(url)) throw clipErr;
          setCopied(true);
        }
      } else if (copyViaExecCommand(url)) {
        // Ingen clipboard-API (HTTP utenfor localhost, eldre browsere).
        setCopied(true);
      } else {
        throw new Error("No share or clipboard API available");
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    } catch (err) {
      // User cancelled the share sheet — silent.
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { share, copied, error };
}
