"use client";

/**
 * SVG-basert label-chip for prosjektstedet.
 * Vises som Marker3D over selve tomten — alltid synlig uavhengig av tab-filter.
 *
 * Lyst "listing-kort": hvit, avrundet chip med stor prosjekt-thumbnail (arkitekt-
 * rendering) til venstre, prosjektnavn + undertittel til høyre, myk skygge så
 * den løfter seg fra det mørke satellitt-/3D-underlaget, og en liten pil ned
 * mot bakken. Mangler thumbnail → faller tilbake til en bygnings-glyph.
 *
 * Google Maps 3D rasteriserer SVG-en (inkl. <image> data-URI) via browser-
 * rendereren før det blir en 3D-tekstur, så <rect>, <text>, <image> og filtre
 * fungerer her. Thumbnailen MÅ være en data-URI (ikke ekstern URL) for å være
 * lastet idet rasteriseringen skjer.
 */

interface ProjectSitePinProps {
  /** Prosjektnavn — vises som label */
  name: string;
  /** Undertittel — typisk "Nybygg 2028" eller lignende */
  subtitle?: string;
  /** Kvadratisk thumbnail som data-URI (jpeg/png). Undefined → bygnings-glyph. */
  imageSrc?: string;
}

const FONT = "system-ui,-apple-system,Helvetica Neue,sans-serif";
const CARD = "#ffffff";
const BORDER = "#ece7e0";
const TITLE = "#1a1a1a";
const ACCENT = "#c45c3a"; // varm terrakotta — Placy redaksjonell aksent

const PAD = 10; // luft rundt chip-en i viewBox (rom til skygge)
const THUMB = 80;
const CHIP_RAD = 20; // hjørneradius på chip-en (avrundet rektangel, ikke stadion-pille)
const RAD = 13; // hjørneradius på thumbnail (≈ CHIP_RAD − INSET, nestes pent)
const INSET = 7; // thumbnail-innrykk fra chip-kant
const GAP = 13; // thumbnail → tekst
const RIGHT_PAD = 18;
const CHIP_H = THUMB + INSET * 2; // 94
const ARROW_H = 11;
const DOT_W = 12; // aksent-prikk + luft foran undertittel

export function ProjectSitePin({
  name,
  subtitle = "Nybygg 2028",
  imageSrc,
}: ProjectSitePinProps) {
  // Estimert tekstbredde (system-ui): navn 17px bold ≈ 9.8px/tegn,
  // undertittel 13px ≈ 7.4px/tegn (+ aksent-prikk).
  const nameW = name.length * 9.8;
  const subW = subtitle ? subtitle.length * 7.4 + DOT_W : 0;
  const textW = Math.max(nameW, subW, 120);

  const chipW = INSET + THUMB + GAP + textW + RIGHT_PAD;
  const totalW = chipW + PAD * 2;
  const totalH = PAD + CHIP_H + ARROW_H + PAD;

  const chipX = PAD;
  const chipY = PAD;
  const chipBottom = chipY + CHIP_H;
  const cx = chipX + chipW / 2;
  const textX = chipX + INSET + THUMB + GAP;
  const midY = chipY + CHIP_H / 2;

  // Unik id-suffiks så flere instanser ikke kolliderer på url(#…)
  const uid = name.toLowerCase().replace(/[^a-z0-9]/g, "") || "site";
  const clipId = `psp-clip-${uid}`;
  const shadowId = `psp-shadow-${uid}`;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={chipX + INSET}
            y={chipY + INSET}
            width={THUMB}
            height={THUMB}
            rx={RAD}
            ry={RAD}
          />
        </clipPath>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="4"
            floodColor="#0f1d44"
            floodOpacity="0.28"
          />
        </filter>
      </defs>

      {/* Chip + pil som én skyggegruppe (hvit silhuett, felles skygge) */}
      <g filter={`url(#${shadowId})`}>
        <polygon
          points={`${cx - 8},${chipBottom - 2} ${cx + 8},${chipBottom - 2} ${cx},${chipBottom + ARROW_H}`}
          fill={CARD}
        />
        <rect
          x={chipX}
          y={chipY}
          width={chipW}
          height={CHIP_H}
          rx={CHIP_RAD}
          ry={CHIP_RAD}
          fill={CARD}
          stroke={BORDER}
          strokeWidth={1}
        />
      </g>

      {/* Thumbnail eller glyph-fallback */}
      {imageSrc ? (
        <>
          <image
            href={imageSrc}
            xlinkHref={imageSrc}
            x={chipX + INSET}
            y={chipY + INSET}
            width={THUMB}
            height={THUMB}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          {/* Hårfin ramme rundt thumbnail for kontrast mot lyse partier */}
          <rect
            x={chipX + INSET}
            y={chipY + INSET}
            width={THUMB}
            height={THUMB}
            rx={RAD}
            ry={RAD}
            fill="none"
            stroke="#000000"
            strokeOpacity="0.1"
            strokeWidth={1}
          />
        </>
      ) : (
        <>
          <rect
            x={chipX + INSET}
            y={chipY + INSET}
            width={THUMB}
            height={THUMB}
            rx={RAD}
            ry={RAD}
            fill="#f6f1ea"
          />
          {/* Building2 (Lucide) — 18×18-glyph skalert ×2, sentrert i 80×80-feltet */}
          <g transform={`translate(${chipX + INSET + 22} ${chipY + INSET + 22}) scale(2)`}>
            <rect x="3" y="3" width="12" height="15" rx="1" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="7" y="10" width="4" height="8" rx="0.5" fill={ACCENT} />
            <path d="M3 3L9 0l6 3" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="6" y1="7" x2="6" y2="7.01" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="12" y1="7" x2="12" y2="7.01" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </>
      )}

      {/* Prosjektnavn */}
      <text
        x={textX}
        y={subtitle ? midY - 10 : midY}
        fill={TITLE}
        fontSize={17}
        fontFamily={FONT}
        fontWeight="700"
        dominantBaseline="middle"
      >
        {name}
      </text>

      {/* Undertittel med aksent-prikk */}
      {subtitle && (
        <>
          <circle cx={textX + 4} cy={midY + 13} r={3.5} fill={ACCENT} />
          <text
            x={textX + DOT_W + 3}
            y={midY + 13}
            fill={ACCENT}
            fontSize={13}
            fontFamily={FONT}
            fontWeight="600"
            dominantBaseline="middle"
          >
            {subtitle}
          </text>
        </>
      )}
    </svg>
  );
}
