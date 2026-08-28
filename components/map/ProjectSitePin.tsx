"use client";

import { labelHaloShadow } from "@/lib/board/label-collision";

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
 * ## Ekte DOM, ikke rasterisert SVG (2026-08-24)
 *
 * Markøren var en SVG som Google rasteriserte til en 3D-tekstur. Teksten ble
 * derfor uskarp på telefon — se `DomMarker3D` for målingene. Nå er den HTML og
 * CSS, og nettleseren tegner teksten på skjermens egen oppløsning.
 *
 * Prosjektnavnet er den ENESTE teksten som overlever i film-capture (film- og
 * fly-modus dropper POI-pinsene), så lesbarheten mot satellittfoto er ikke en
 * detalj. Den kommer fra en fire-veis hvit text-shadow der SVG-en tegnet hver
 * tekst to ganger.
 *
 * Byttet var IKKE valgfritt sammen med POI-pinnene: en DOM-markør maler over
 * hele WebGL-canvaset uansett `zIndex`, så en rasterisert prosjektpinne ville
 * havnet UNDER POI-ene. Verre: `pin-declutter` demoterer POI-er til prikk
 * nettopp fordi de ligger bak prosjektpinnen, og prikkene fjernes ikke — de
 * ville lagt seg på pinnens ansikt.
 *
 * ## Rammens form
 *
 * Markøren er forankret i bunn-midten, og `anchorLeft: -50%` er prosent av
 * ELEMENTETS EGEN boks. Boksen holdes derfor KVADRATISK (disc-en alene) og
 * teksten ligger `position: absolute` utenfor flyten — ellers vandrer disc-en
 * bort fra punktet sitt når navnet blir langt. Den gamle SVG-en løste samme
 * problem med en symmetrisk ramme, altså ved å betale for tomrom på motsatt
 * side; det er nettopp det tomrommet `projectSitePinBlocker` finnes for å ikke
 * regne som hindring.
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
   * range-avhengig skala her. Alt innhold skalerer uniformt.
   *
   * MERK at teksten nå er ekte DOM: den skaleres ved å regne px-størrelsen, ikke
   * ved å strekke en tekstur, så den er skarp på alle skalaer.
   */
  scale?: number;
}

const FONT = "system-ui,-apple-system,Helvetica Neue,sans-serif";
const TITLE = "#1c1917"; // nær-svart, samme som POI-labelen
const ACCENT = "#c45c3a"; // varm terrakotta — Placy redaksjonell aksent
const ACCENT_TINT = "#fbeee8"; // lys shade av aksenten (disc-bakgrunn)
const HALO = "#ffffff";
const HALO_W = 3.5;

const DISC = 52; // disc-diameter — POI-pinnene er 32 (PIN_SIZE), så hjemmet
                 // leser som klart større uten å bli et kort igjen
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
  const disc = DISC * scale;
  const ring = RING_W * scale;
  const glow = GLOW_W * scale;

  return (
    <div
      data-project-pin=""
      style={{
        position: "relative",
        // Boksen er kvadratisk og teksten ligger utenfor flyten — samme grep som
        // PoiMarkerContent, og av samme grunn: `anchorLeft: -50%` er prosent av
        // ELEMENTETS EGEN boks, så en tekst i flyten flytter disc-en bort fra
        // punktet sitt. Den gamle SVG-en løste det med en symmetrisk ramme.
        width: disc,
        height: disc,
      }}
    >
      {/* Myk aksent-glød utenfor ringen — signalet om at dette er prosjektet,
          uten å legge en flate oppå kartet. */}
      <span
        style={{
          position: "absolute",
          inset: -glow,
          borderRadius: "50%",
          border: `${glow}px solid ${ACCENT}`,
          opacity: 0.22,
          boxSizing: "border-box",
        }}
      />
      {/* Disc: thumbnail eller tintet flate med bygnings-glyph. Bildet legges som
          CSS background-image, ikke som <img> — ingen ekstra node, og ingen
          next/image-regel å bryte. Data-URI, så den er lastet ved paint. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: imageSrc ? `${ACCENT_TINT} center/cover url(${imageSrc})` : ACCENT_TINT,
          border: `${ring}px solid ${ACCENT}`,
          boxShadow: `0 ${1.5 * scale}px ${2 * scale}px rgba(15,29,68,0.35)`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!imageSrc && <BuildingGlyph size={27 * scale} />}
      </span>

      {/* Navn + undertittel. Haloen er fire-veis text-shadow der SVG-en tegnet
          to noder. Prosjektnavnet er den ENESTE teksten som overlever i
          film-capture, og lesbarheten mot satellittfoto kommer fra konturen. */}
      <span
        style={{
          position: "absolute",
          left: disc + GAP_X * scale,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 1 * scale,
          maxWidth: MAX_TEXT_W * scale,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: FONT,
            fontSize: NAME_SIZE * scale,
            fontWeight: 700,
            lineHeight: 1.15,
            color: TITLE,
            textShadow: haloShadow(HALO_W * scale),
          }}
        >
          {name}
        </span>
        {subtitle && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4 * scale,
              whiteSpace: "nowrap",
              fontFamily: FONT,
              fontSize: SUB_SIZE * scale,
              fontWeight: 600,
              lineHeight: 1.15,
              color: ACCENT,
              textShadow: haloShadow(HALO_W * scale),
            }}
          >
            <span
              style={{
                width: 6 * scale,
                height: 6 * scale,
                borderRadius: "50%",
                background: ACCENT,
                flex: "0 0 auto",
                boxShadow: `0 0 0 ${1.5 * scale}px rgba(255,255,255,0.95)`,
              }}
            />
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}

/** Fire-veis hvit kontur. SVG-stien tegnet teksten to ganger for samme effekt. */
/**
 * Prosjektnavnets kontur. Samme harde kant som POI-labelene
 * (`labelHaloShadow`) — to tekststiler på samme kartflate leser som en feil —
 * men tykkere, fordi teksten her er 13 px bold der POI-labelen er 10 px: en
 * 1-px kant forsvinner i den vekten.
 */
function haloShadow(w: number): string {
  return labelHaloShadow(Math.max(1, w / 2.5), HALO, 0.85);
}

/** Building2 (Lucide) i aksentfargen. Beholdt som SVG — det er TEKSTEN som
 *  trengte DOM, ikke ikonet. */
function BuildingGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="12" height="15" rx="1" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="10" width="4" height="8" rx="0.5" fill={ACCENT} />
      <path d="M3 3L9 0l6 3" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="6" y1="7" x2="6" y2="7.01" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="7" x2="12" y2="7.01" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
