"use client";

/**
 * SVG-basert label-chip for prosjektstedet.
 * Vises som Marker3D over selve tomten — alltid synlig uavhengig av tab-filter.
 *
 * Designet som en "planning tool"-chip: avrundet rektangel med bygningsikon
 * og prosjektnavn, med en liten pil ned mot bakken.
 * Google Maps 3D rasteriserer SVG via browser-rendereren før det blir
 * en 3D-tekstur, så <text> og <rect> fungerer helt fint her.
 */

interface ProjectSitePinProps {
  /** Prosjektnavn — vises som label */
  name: string;
  /** Undertittel — typisk "Nybygg 2028" eller lignende */
  subtitle?: string;
}

const FONT = "system-ui,-apple-system,Helvetica Neue,sans-serif";
const BG = "#1a1a1a";
const ACCENT = "#e8b86d"; // varm gull-tone — skiller seg fra POI-pins

export function ProjectSitePin({
  name,
  subtitle = "Nybygg 2028",
}: ProjectSitePinProps) {
  // Estimert bredde basert på tekstlengde (ca 7px per tegn i 13px font)
  const nameWidth = Math.max(name.length * 7.5, 80);
  const chipW = nameWidth + 52; // ikon (20) + padding (16+16)
  const chipH = subtitle ? 44 : 32;
  const totalH = chipH + 10; // + pil
  const totalW = chipW;

  // Senterpunkt for pilen
  const arrowX = totalW / 2;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Chip-bakgrunn */}
      <rect
        x={0}
        y={0}
        width={chipW}
        height={chipH}
        rx={chipH / 2}
        ry={chipH / 2}
        fill={BG}
      />

      {/* Bygningsikon (Building2 — manuelt SVG-path) */}
      <g transform={`translate(14 ${chipH / 2 - 9})`}>
        {/* Building2 fra Lucide — 18×18 */}
        <rect x="3" y="3" width="12" height="15" rx="1" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="7" y="10" width="4" height="8" rx="0.5" fill={ACCENT} />
        <path d="M3 3L9 0l6 3" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="6" y1="7" x2="6" y2="7.01" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12" y1="7" x2="12" y2="7.01" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Prosjektnavn */}
      <text
        x={40}
        y={subtitle ? chipH / 2 - 2 : chipH / 2 + 4.5}
        fill="white"
        fontSize={subtitle ? 12 : 13}
        fontFamily={FONT}
        fontWeight="700"
        dominantBaseline="middle"
      >
        {name}
      </text>

      {/* Undertittel */}
      {subtitle && (
        <text
          x={40}
          y={chipH / 2 + 11}
          fill={ACCENT}
          fontSize={10}
          fontFamily={FONT}
          fontWeight="500"
          dominantBaseline="middle"
        >
          {subtitle}
        </text>
      )}

      {/* Liten pil ned */}
      <polygon
        points={`${arrowX - 6},${chipH} ${arrowX + 6},${chipH} ${arrowX},${totalH}`}
        fill={BG}
      />
    </svg>
  );
}
