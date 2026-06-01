import { useEffect, useRef, useState } from "react";

/**
 * rAF-tween fra forrige opacity-map til nytt target-map. Brukes av 3D-board
 * der Google Maps rasteriserer SVG-markører per render — vi kan ikke bruke
 * CSS-transition og må drive opacity som React-state.
 *
 * Anrop: `useTweenedOpacities(allIds, visibleIds, 300)` returnerer
 * `Record<id, number>` der hver verdi animerer mot 1 (synlig) eller 0 (skjult)
 * over `durationMs` med ease-out cubic. Re-fyrer når `visibleKey` endres —
 * ny tween starter fra gjeldende opacity (ikke 0/1), så avbrutte overganger
 * fortsetter glidende.
 */
export function useTweenedOpacities(
  allIds: readonly string[],
  visibleIds: ReadonlySet<string>,
  durationMs = 300,
): Record<string, number> {
  const [opacities, setOpacities] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const id of allIds) o[id] = visibleIds.has(id) ? 1 : 0;
    return o;
  });

  const opacitiesRef = useRef(opacities);
  opacitiesRef.current = opacities;

  const frameRef = useRef<number | null>(null);

  const visibleKey = Array.from(visibleIds).sort().join("|");
  const allKey = allIds.join("|");

  useEffect(() => {
    const startOpacities: Record<string, number> = { ...opacitiesRef.current };
    const targets: Record<string, number> = {};
    for (const id of allIds) {
      targets[id] = visibleIds.has(id) ? 1 : 0;
      if (!(id in startOpacities)) startOpacities[id] = targets[id];
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next: Record<string, number> = {};
      for (const id of allIds) {
        const start = startOpacities[id] ?? 0;
        const target = targets[id] ?? 0;
        next[id] = start + (target - start) * eased;
      }
      setOpacities(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setOpacities(targets);
        frameRef.current = null;
      }
    };

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // visibleKey/allKey som serialisert nøkkel — pois-array har ny identitet
    // per render selv om innholdet er likt, så vi kan ikke depende direkte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, allKey, durationMs]);

  return opacities;
}
