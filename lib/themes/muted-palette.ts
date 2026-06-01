// Spike-iterasjon 2026-05-21: kart-markører i rapport-board roper med
// Tailwind 500-level. Vi mapper til ~450-level (interpolert mellom 400 og
// 500) på render-tid — en hakk dempet uten å bli "deaktivert" på lys
// kart-bakgrunn. Når data er migrert kan denne fjernes og fargene leses
// direkte fra DB.

const MUTED_BY_HEX: Record<string, string> = {
  // BOLIG_THEMES (tema-nivå)
  "#22c55e": "#36d16f", // green-500 → 450
  "#ef4444": "#f35a5a", // red-500 → 450
  "#0ea5e9": "#23b1f0", // sky-500 → 450
  "#10b981": "#22c68d", // emerald-500 → 450
  "#ec4899": "#f05da7", // pink-500 → 450
  "#f59e0b": "#f8ae17", // amber-500 → 450
  "#3b82f6": "#4d93f8", // blue-500 → 450

  // Sub-kategori-farger fra lib/generators/poi-discovery.ts
  "#f97316": "#fa8229", // orange-500 → 450 (cafe, tram)
  "#a855f7": "#b46cf9", // purple-500 → 450 (bar)
  "#06b6d4": "#14c4e1", // cyan-500 → 450 (pharmacy)
  "#6366f1": "#7279f4", // indigo-500 → 450 (bank, parking)
  "#f43f5e": "#f75871", // rose-500 → 450 (post)
  "#8b5cf6": "#9973f8", // violet-500 → 450 (shopping)
  "#14b8a6": "#20c6b2", // teal-500 → 450 (library)
  "#d946ef": "#e05ff4", // fuchsia-500 → 450 (haircare)
  "#7c3aed": "#8a51f5", // violet-600 → 550 (liquor)
  "#0891b2": "#079fc4", // cyan-600 → 550 (hotel)
};

/** Returnerer dempet variant av en hex hvis kjent, ellers original. */
export function mutedColor(hex: string | undefined | null): string | undefined {
  if (!hex) return undefined;
  return MUTED_BY_HEX[hex.toLowerCase()] ?? hex;
}
