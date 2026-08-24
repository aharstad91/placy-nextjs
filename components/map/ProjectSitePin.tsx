"use client";

/**
 * SVG-markør for prosjektstedet.
 * Vises som Marker3D over selve tomten — alltid synlig uavhengig av tab-filter.
 *
 * ## Hvorfor disc og ikke kort (2026-08-24)
 *
 * Den var tidligere et lyst "listing-kort" (~300 × 105 px) med thumbnail,
 * navn og undertittel. Det dominerte kartet: bildet av tomta forsvant bak
 * kortet, og prosjektet leste som en reklame oppå kartet i stedet for som ett
 * sted blant stedene. Nå bruker den SAMME visuelle språk som POI-markørene
 * (lys disc + kategori-farget ring + ikon, navn ved siden av) — bare litt
 * større disc, tykkere ring og en myk aksent-glød rundt, så den vinner
 * oppmerksomhet uten å ta over. Har prosjektet en thumbnail, klippes den
 * sirkulært inn i disc-en i stedet for glyph-en.
 *
 * Google Maps 3D rasteriserer SVG-en (inkl. <image> data-URI) via browser-
 * rendereren før det blir en 3D-tekstur, så <rect>, <text>, <image> og filtre
 * fungerer her. Thumbnailen MÅ være en data-URI (ikke ekstern URL) for å være
 * lastet idet rasteriseringen skjer.
 *
 * ## Rammens form
 *
 * Markøren er forankret i bunn-midten. Derfor er rammen SYMMETRISK i bredden
 * (label-plassen speiles på begge sider av disc-en, samme grep som
 * `Marker3DPin`) og nøyaktig så høy som disc-en — da står disc-en på punktet
 * uansett hvor mye tekst som ligger ved siden av.
 */

interface ProjectSitePinProps {
  /** Prosjektnavn — vises som label */
  name: string;
  /** Undertittel — typisk "Nybygg 2028" eller lignende */
  subtitle?: string;
  /** Sirkulær thumbnail som data-URI (jpeg/png). Undefined → bygnings-glyph. */
  imageSrc?: string;
  /**
   * Skala på hele markøren (1 = intrinsisk størrelse). Google 3D-markører er
   * skjerm-forankret (konstant px uansett zoom), så MapView3D mater inn en
   * range-avhengig skala her. Påvirker kun `width`/`height` — `viewBox` er
   * uendret, så alt innhold skalerer uniformt og teksten holder seg skarp ved
   * re-rasterisering.
   */
  scale?: number;
}

const FONT = "system-ui,-apple-system,Helvetica Neue,sans-serif";
const TITLE = "#1c1917"; // nær-svart, samme som POI-labelen
const ACCENT = "#c45c3a"; // varm terrakotta — Placy redaksjonell aksent
const ACCENT_TINT = "#fbeee8"; // lys shade av aksenten (disc-bakgrunn)
const HALO = "#ffffff";
const HALO_W = 3.5;

const DISC = 52; // disc-diameter — POI-pinnene er 40, dette er "litt mer"
const RING_W = 3;
const GLOW_W = 3; // myk aksent-glød utenfor ringen
const GAP_X = 9; // disc → tekst
const NAME_SIZE = 13;
const SUB_SIZE = 10.5;
const NAME_CHAR_W = 7.3; // estimat, 13px bold system-ui
const SUB_CHAR_W = 5.9; // estimat, 10.5px semibold
const DOT_W = 10; // aksent-prikk + luft foran undertittel
const MAX_TEXT_W = 168;

/**
 * Undertittelen markøren viser når ingen er oppgitt.
 *
 * Eksportert fordi BÅDE komponenten og hindringsberegningen må bruke samme
 * verdi. Lå den bare som en parameter-default på to steder, ville de kunne
 * drifte og hindringen reservert plass til en annen tekst enn den som tegnes.
 */
export const PROJECT_PIN_DEFAULT_SUBTITLE = "Nybygg 2028";

/**
 * Hindringsboksen prosjektmarkøren OKKUPERER, som forskyvninger fra
 * ankerpunktet (bunn-midten av disc-en).
 *
 * Kollisjonskullingen i 3D trenger prosjektmarkøren som HINDRING — den er
 * alltid synlig og bærer sin egen tekst, så en POI-label eller -pin bak den er
 * tapt uansett. Målene utledes av navnelengden, så de kan ikke hardkodes hos
 * konsumenten; de må komme herfra, ellers driver hindringen fra det som
 * faktisk tegnes neste gang noen justerer typografien.
 *
 * ## Hvorfor boksen er ASYMMETRISK (2026-08-24)
 *
 * SVG-RAMMEN er symmetrisk (`halfBox` speiles) utelukkende for at disc-en skal
 * bli stående på punktet sitt uansett hvor mye tekst som ligger ved siden av —
 * se doc-blokken øverst. Men INNHOLDET er det ikke: teksten står bare til
 * høyre for disc-en, så den venstre halvdelen av rammen er tomrom.
 *
 * Tidligere sentrerte kollisjonskullingen hele den symmetriske rammen på
 * disc-en. For «Strindfjordvegen 10» ga det en ~362 px bred hindring der ~181
 * px stakk ut til VENSTRE for disc-en — nesten halve mobilbredden — og hver POI
 * i det båndet ble demotert til prikk uten at det sto noe der å kollidere med.
 */
export interface ProjectSitePinBlocker {
  /** Boksens senter, forskjøvet fra ankerpunktet. Positiv = mot høyre. */
  dx: number;
  /** Boksens senter, forskjøvet fra ankerpunktet. Negativ = oppover. */
  dy: number;
  halfWidth: number;
  halfHeight: number;
}

export function projectSitePinBlocker(
  name: string,
  subtitle: string | undefined,
  scale = 1,
): ProjectSitePinBlocker {
  const { textW } = pinLayout(
    name,
    subtitle === undefined ? PROJECT_PIN_DEFAULT_SUBTITLE : subtitle,
  );
  // Synlig utstrekning fra disc-senter: venstre kant er disc-radien, høyre kant
  // er disc-radius + luft + tekst.
  const left = -DISC / 2;
  const right = DISC / 2 + GAP_X + textW;
  return {
    dx: ((left + right) / 2) * scale,
    // Ankeret er bunn-midten, så boksen strekker seg oppover.
    dy: (-DISC / 2) * scale,
    halfWidth: ((right - left) / 2) * scale,
    halfHeight: (DISC / 2) * scale,
  };
}

function pinLayout(name: string, subtitle?: string) {
  const nameW = name.length * NAME_CHAR_W;
  const subW = subtitle ? subtitle.length * SUB_CHAR_W + DOT_W : 0;
  const textW = Math.min(MAX_TEXT_W, Math.max(nameW, subW));

  // Halv ramme: disc-radius + luft + tekst, speilet på begge sider.
  const halfBox = DISC / 2 + GAP_X + textW;
  return { textW, halfBox, totalW: halfBox * 2, totalH: DISC };
}

export function ProjectSitePin({
  name,
  subtitle = PROJECT_PIN_DEFAULT_SUBTITLE,
  imageSrc,
  scale = 1,
}: ProjectSitePinProps) {
  const { halfBox, totalW, totalH } = pinLayout(name, subtitle);

  const cx = halfBox;
  const cy = DISC / 2;
  const r = DISC / 2 - RING_W / 2 - GLOW_W / 2;
  const textX = cx + DISC / 2 + GAP_X;

  // Unik id-suffiks så flere instanser ikke kolliderer på url(#…)
  const uid = name.toLowerCase().replace(/[^a-z0-9]/g, "") || "site";
  const clipId = `psp-clip-${uid}`;
  const shadowId = `psp-shadow-${uid}`;

  // To tekstlinjer sentrert vertikalt på disc-en når begge finnes.
  const nameY = subtitle ? cy - 7 : cy;
  const subY = cy + 8;

  return (
    <svg
      width={totalW * scale}
      height={totalH * scale}
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="2"
            floodColor="#0f1d44"
            floodOpacity="0.35"
          />
        </filter>
      </defs>

      {/* Myk aksent-glød utenfor ringen — signalet om at dette er prosjektet,
          uten å legge en flate oppå kartet. */}
      <circle
        cx={cx}
        cy={cy}
        r={r + RING_W / 2 + GLOW_W / 2}
        fill="none"
        stroke={ACCENT}
        strokeOpacity={0.22}
        strokeWidth={GLOW_W}
      />

      {/* Disc: thumbnail eller tintet flate med bygnings-glyph */}
      {imageSrc ? (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={ACCENT_TINT}
            filter={`url(#${shadowId})`}
          />
          <image
            href={imageSrc}
            xlinkHref={imageSrc}
            x={cx - r}
            y={cy - r}
            width={r * 2}
            height={r * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      ) : (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={ACCENT_TINT}
          filter={`url(#${shadowId})`}
        />
      )}

      {/* Aksent-ring oppå (tegnes etter bildet så kanten blir ren) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={ACCENT}
        strokeWidth={RING_W}
      />

      {/* Building2 (Lucide) — 18×18-glyph, sentrert i disc-en. Kun uten bilde. */}
      {!imageSrc && (
        <g transform={`translate(${cx - 13.5} ${cy - 13.5}) scale(1.5)`}>
          <rect x="3" y="3" width="12" height="15" rx="1" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="7" y="10" width="4" height="8" rx="0.5" fill={ACCENT} />
          <path d="M3 3L9 0l6 3" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="6" y1="7" x2="6" y2="7.01" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12" y1="7" x2="12" y2="7.01" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}

      {/* Prosjektnavn. Tegnes TO ganger: hvit kontur, så fyll oppå — samme
          grunn som i Marker3DPin (`paint-order` overlever ikke alltid
          rasteriseringen, og underlaget er satellittfoto). */}
      <text
        x={textX}
        y={nameY}
        fill="none"
        stroke={HALO}
        strokeWidth={HALO_W}
        strokeLinejoin="round"
        strokeOpacity={0.95}
        fontSize={NAME_SIZE}
        fontFamily={FONT}
        fontWeight="700"
        dominantBaseline="middle"
      >
        {name}
      </text>
      <text
        x={textX}
        y={nameY}
        fill={TITLE}
        fontSize={NAME_SIZE}
        fontFamily={FONT}
        fontWeight="700"
        dominantBaseline="middle"
      >
        {name}
      </text>

      {/* Undertittel med aksent-prikk */}
      {subtitle && (
        <>
          <circle
            cx={textX + 3}
            cy={subY}
            r={4.5}
            fill={HALO}
            fillOpacity={0.95}
          />
          <circle cx={textX + 3} cy={subY} r={3} fill={ACCENT} />
          <text
            x={textX + DOT_W}
            y={subY}
            fill="none"
            stroke={HALO}
            strokeWidth={HALO_W}
            strokeLinejoin="round"
            strokeOpacity={0.95}
            fontSize={SUB_SIZE}
            fontFamily={FONT}
            fontWeight="600"
            dominantBaseline="middle"
          >
            {subtitle}
          </text>
          <text
            x={textX + DOT_W}
            y={subY}
            fill={ACCENT}
            fontSize={SUB_SIZE}
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
