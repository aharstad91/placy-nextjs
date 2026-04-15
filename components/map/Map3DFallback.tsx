// @ts-nocheck — 3D component preserved for future use
'use client';

import { MapPin } from 'lucide-react';
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

/**
 * Check if WebGL is available for 3D rendering
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return true; // SSR - assume available

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Hook to check WebGL availability
 */
export function useWebGLCheck() {
  if (typeof window === 'undefined') {
    return { isAvailable: true, checked: false };
  }
  return { isAvailable: isWebGLAvailable(), checked: true };
}
