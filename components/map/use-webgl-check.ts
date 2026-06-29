"use client";

import { useState } from "react";

// WebGL-tilgjengelighet endrer seg ikke i løpet av en økt → sjekk ÉN gang og
// cache resultatet. KRITISK: hver sjekk oppretter en WebGL-kontekst, og
// nettleseren tillater bare ~16 samtidige. Uten caching ble sjekken kjørt på
// HVER render av MapView3D (~8/sek under avspilling) → kontekstene hopet seg
// opp → "Too many active WebGL contexts" → kaskade-crash. (Bug funnet 2026-06-02.)
let cachedWebGLAvailable: boolean | null = null;

/**
 * Check if WebGL is available for 3D rendering. Memoisert + frigjør probe-
 * konteksten umiddelbart (loseContext) så den ikke beslaglegger én av de ~16.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return true; // SSR - assume available
  if (cachedWebGLAvailable !== null) return cachedWebGLAvailable;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGLRenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    // Frigjør probe-konteksten med en gang — vi trenger bare ja/nei-svaret.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    cachedWebGLAvailable = !!gl;
  } catch {
    cachedWebGLAvailable = false;
  }
  return cachedWebGLAvailable;
}

/**
 * Hook to check WebGL availability. Lazy useState-init → sjekken kjører kun ÉN
 * gang per mount (ikke per render), og kombinert med modul-cachen over deler
 * alle Map3D-instanser ett enkelt ja/nei-resultat.
 */
export function useWebGLCheck() {
  const [state] = useState(() =>
    typeof window === "undefined"
      ? { isAvailable: true, checked: false }
      : { isAvailable: isWebGLAvailable(), checked: true },
  );
  return state;
}
