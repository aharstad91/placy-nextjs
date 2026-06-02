// @ts-nocheck — 3D component preserved for future use
'use client';

import { MapPin } from 'lucide-react';
import { useState } from 'react';
import type { POI } from '@/lib/types';

interface Map3DFallbackProps {
  pois: POI[];
  message?: string;
}

/**
 * Fallback component shown when WebGL/3D is not available
 */
export function Map3DFallback({ pois, message }: Map3DFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-100 p-8">
      <MapPin className="w-16 h-16 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-700 mb-2">
        3D-kart er ikke tilgjengelig
      </h3>
      <p className="text-gray-500 text-center mb-4">
        {message || 'Din nettleser støtter ikke 3D-kart. Se listen nedenfor.'}
      </p>
      {pois.length > 0 && (
        <ul className="text-sm text-gray-600 max-h-64 overflow-y-auto">
          {pois.map(poi => (
            <li key={poi.id} className="flex items-center gap-2 py-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: poi.category?.color || '#6B7280' }}
              />
              {poi.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  if (typeof window === 'undefined') return true; // SSR - assume available
  if (cachedWebGLAvailable !== null) return cachedWebGLAvailable;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    // Frigjør probe-konteksten med en gang — vi trenger bare ja/nei-svaret.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
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
    typeof window === 'undefined'
      ? { isAvailable: true, checked: false }
      : { isAvailable: isWebGLAvailable(), checked: true },
  );
  return state;
}
