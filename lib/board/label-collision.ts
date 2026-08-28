/**
 * Label-plassering med kollisjonskulling for board-kartet
 * (2026-08-12, Oppdal-runden; anker-flipping lagt til etter iPhone-test).
 *
 * Problemet bredde-triks ikke kan løse: to POI-er 8–25 m fra hverandre får
 * labels som krysser på mellom-zoom (16–17), og resultatet er uleselig grøt
 * («SabruraCoop Stick… Opp…»). Standard kartografi-svar i to trinn:
 *   1. Prøv alternative anker-sider — høyre først, så venstre (som Google
 *      Maps). En pin i en tett klynge eller nær høyre skjermkant får dermed
 *      ofte navn likevel, med ledig plass på motsatt side.
 *   2. Kolliderer begge sider, skjul labelen med lavest prioritet — den
 *      kommer tilbake når brukeren zoomer inn og det blir plass.
 *
 * Ren funksjon over skjerm-koordinater — projeksjonen (lngLat → px) skjer hos
 * konsumenten. Deterministisk: samme kandidater gir samme resultat uavhengig
 * av input-rekkefølge.
 *
 * DELT AV BEGGE KART-MOTORENE (2026-08-23). 2D projiserer med Mapbox' egen
 * `map.project` på `moveend`; 3D projiserer med `projectLatLngToScreen` når
 * Google-kameraet har falt til ro. Bare tre ting skiller flatene, og alle er
 * parametre her: markør-bredden ({@link LabelMetrics.offsetX}), at 3D-markøren
 * VOKSER på nær zoom ({@link LabelMetrics.scale}), og at 3D har en bred
 * prosjekt-chip som hindring ({@link LabelObstacle.halfWidth}). Selve
 * plasserings-regelen er ÉN.
 *
 * Geometrien speiler BoardMarker-CSS-en: label ligger inntil markør-
 * containeren (kant + 8 px margin), vertikalt sentrert, fontSize 10/600,
 * maxWidth LABEL_MAX_W med brytning til maks 2 linjer.
 */

export type LabelSide = "right" | "left";

export interface LabelCandidate {
  id: string;
  /** Markørsenter i skjerm-px (map.project av visningskoordinaten). */
  x: number;
  y: number;
  name: string;
  /**
   * Høyere vinner ved kollisjon. Aktiv POI skal sendes med
   * Number.POSITIVE_INFINITY så den aldri kulles.
   */
  priority: number;
}

/**
 * Fast hindring labels aldri får krysse — typisk en markør-sirkel (senter +
 * halv bredde/høyde). Egen markør kolliderer aldri med egen label (labelen
 * starter 8 px utenfor sirkelkanten på begge sider), så alle markører kan
 * sendes inn.
 *
 * `halfWidth`/`halfHeight` overstyrer `halfSize` per akse. Kvadratiske
 * hindringer (markør-sirkler) setter kun `halfSize`; brede, lave hindringer —
 * prosjekt-chipen i 3D er ~300 × 105 px — trenger begge aksene separat, ellers
 * ville et kvadrat på 150 px halv-høyde blokkert halve skjermen vertikalt.
 */
export interface LabelObstacle {
  x: number;
  y: number;
  halfSize: number;
  /** Overstyrer `halfSize` horisontalt. */
  halfWidth?: number;
  /** Overstyrer `halfSize` vertikalt. */
  halfHeight?: number;
}

/**
 * Skjermflate i px. Gis viewport, regnes en side som uakseptabel når labelen
 * ville stukket horisontalt utenfor — pinnen flipper da til motsatt side i
 * stedet for å rendre avkuttet tekst i skjermkanten.
 */
export interface LabelViewport {
  width: number;
}

/** Speiler BoardMarker: maxWidth på label-spanen. */
export const LABEL_MAX_W = 132;
/** Estimert snittbredde per tegn ved fontSize 10 / weight 600. */
export const LABEL_CHAR_W = 5.9;
/** Speiler BoardMarker: lineHeight 1.2 × fontSize 10. */
export const LABEL_LINE_H = 12;
/** Speiler BoardMarker: fontSize på label-teksten. */
export const LABEL_FONT_SIZE = 10;
/** Maks antall linjer før teksten kuttes med ellipsis. */
export const LABEL_MAX_LINES = 2;
/** Luft mellom markør-kanten og labelens nærmeste tekstkant. */
export const LABEL_GAP_X = 8;

/**
 * Kontur rundt kart-tekst: åtte harde skygger, ingen blur — og valgfritt en
 * mørk, uskarp skygge BAK dem.
 *
 * Halo-en var tidligere bare en myk glød (`0 0 2px` + fire diagonaler med 2 px
 * blur). På satellittfoto la den en dis rundt hver bokstav, og teksten så
 * uskarp ut selv om den var skarp — Andreas, 2026-08-28: «nå er det text shadow
 * som er ganske bred, kan vi få en langt mer crisp look på teksten?»
 *
 * Uten blur blir konturen en KANT: åtte retninger dekker hjørnene også, så
 * bokstaven får jevn hvit ramme i stedet for fire tapper. Delt mellom begge
 * motorene og prosjektpinnen, slik at samme kartflate ikke har to tekststiler.
 *
 * `backdrop` legger en mørk sky UTENFOR den hvite kanten. Den gjør to ting den
 * hvite kanten ikke kan: løfter teksten fra flaten, og gir kontrast der
 * underlaget selv er lyst — hvit kant mot hvit husvegg på satellittfoto er
 * ingen kant. Rekkefølgen er derfor kritisk: CSS tegner FØRSTE skygge øverst,
 * så den mørke må ligge sist i lista, ellers legger den seg over kanten og
 * teksten blir grumsete. Andreas, 2026-08-28: «en mørk blur skygge i bakgrunn
 * samtidig som vi har en 1px skygge på teksten … spesielt viktig for
 * satelitt/3d».
 *
 * @param width Konturens tykkelse i px. 1 til POI-labelen (10 px tekst),
 *              tykkere til større tekst — en 1 px kant forsvinner i 13 px bold.
 * @param backdrop Styrken på den mørke skyen, 0–1. 0 = av (lyst karttema, der
 *              nær-svart tekst allerede har kontrast og en mørk sky bare ville
 *              smusset flaten).
 */
export function labelHaloShadow(
  width = 1,
  color = "#ffffff",
  backdrop = 0,
): string {
  const w = Math.round(Math.max(1, width) * 10) / 10;
  const outline = [
    [w, 0],
    [-w, 0],
    [0, w],
    [0, -w],
    [w, w],
    [w, -w],
    [-w, w],
    [-w, -w],
  ].map(([x, y]) => `${x}px ${y}px 0 ${color}`);
  if (backdrop <= 0) return outline.join(",");
  // To lag: en tett skygge rett under bokstaven (løftet), og en bredere,
  // svakere sky rundt (kontrast mot lyst underlag). Radiene er målt mot
  // satellittfoto ved 3× oppskalering: mindre enn dette forsvinner skyen bak
  // den hvite kanten, mer og den begynner å lese som uskarphet.
  const near = Math.round(Math.max(3, w * 3) * 10) / 10;
  const far = near * 2;
  const a = Math.min(1, backdrop);
  return [
    ...outline,
    `0 ${w}px ${near}px rgba(0,0,0,${Math.round(a * 100) / 100})`,
    `0 0 ${far}px rgba(0,0,0,${Math.round(a * 70) / 100})`,
  ].join(",");
}
/** Default container-halvbredde (32 px inaktiv 2D-markør) + {@link LABEL_GAP_X}.
 *  3D-pinnen er like bred, men VOKSER på nær zoom, og sender derfor inn sin egen
 *  `offsetX` via {@link LabelMetrics}. */
export const LABEL_OFFSET_X = 16 + LABEL_GAP_X;
/** Liten slack så labels som så vidt tangerer ikke regnes som kollisjon. */
const SLACK = 2;

/**
 * Geometri-avvik mellom kart-motorene. Begge markørene er 32 px ved basis, men
 * 3D-pinnen vokser mot nær zoom — labelen må da starte lenger ut og settes
 * større, ellers legger den seg oppå sin egen pin og kollisjonen regner på en
 * mindre tekst enn den som tegnes. Tallene (font, linjehøyde, maksbredde) er
 * felles; disse to parametrene er det som skiller flatene.
 */
export interface LabelMetrics {
  /** Avstand fra markørsenter til labelens nærmeste kant. Default {@link LABEL_OFFSET_X}. */
  offsetX?: number;
  /**
   * Typografi-skala, 1 = tallene over. 3D-pinnen vokser på nær zoom
   * (`poiPinScaleForZoom`), og teksten vokser med den — uten dette ville
   * kollisjonen reservert en 10 px-boks til et 14 px navn og labels som
   * overlapper hadde blitt sluppet gjennom. 2D sender den ikke (fast 32 px
   * markør, fast 10 px navn).
   */
  scale?: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Estimert label-bbox i skjerm-px for en kandidat. Eksportert for test.
 *
 * Bredden er et bevisst OVERESTIMAT, og det er invarianten hele kollisjonen
 * hviler på: feilen skal gå mot å reservere for mye plass, aldri mot å påstå at
 * det er ledig der teksten faktisk ligger.
 *
 * Anslaget er `navnelengde × LABEL_CHAR_W` på én linje opp til taket, mens begge
 * motorene bryter på ordgrense med CSS (`-webkit-line-clamp`) og i praksis får en
 * litt smalere blokk. Verifisert mot canvas `measureText` med den faktiske
 * font-stacken (600 10px system-ui): verste faktiske tegnbredde over 14 reelle
 * POI-navn var 5,84 px mot anslagets 5,9 — se testen.
 */
export function estimateLabelBox(
  c: LabelCandidate,
  side: LabelSide,
  offsetX: number = LABEL_OFFSET_X,
  scale = 1,
): Box {
  const textW = c.name.length * LABEL_CHAR_W * scale;
  const maxW = LABEL_MAX_W * scale;
  const width = Math.min(textW, maxW);
  const lines = textW > maxW ? LABEL_MAX_LINES : 1;
  const height = lines * LABEL_LINE_H * scale;
  const left = side === "right" ? c.x + offsetX : c.x - offsetX - width;
  const top = c.y - height / 2;
  return { left, top, right: left + width, bottom: top + height };
}

function intersects(a: Box, b: Box): boolean {
  return (
    a.left < b.right - SLACK &&
    a.right > b.left + SLACK &&
    a.top < b.bottom - SLACK &&
    a.bottom > b.top + SLACK
  );
}

function obstacleBox(o: LabelObstacle): Box {
  const hw = o.halfWidth ?? o.halfSize;
  const hh = o.halfHeight ?? o.halfSize;
  return {
    left: o.x - hw,
    top: o.y - hh,
    right: o.x + hw,
    bottom: o.y + hh,
  };
}

function fitsViewport(box: Box, viewport?: LabelViewport): boolean {
  if (!viewport) return true;
  return box.left >= 0 && box.right <= viewport.width;
}

/**
 * Greedy plassering: kandidater behandles i prioritetsrekkefølge; hver prøver
 * høyre så venstre side (motsatt orden når høyre ville gått utenfor
 * viewporten). En side er akseptabel når boksen verken krysser en obstacle
 * (markør-sirkler tegnes alltid, så tekst under en pin er like uleselig som
 * tekst under tekst), en allerede plassert label, eller viewport-kanten.
 *
 * Returnerer id → side for labels som skal VISES. Id-er som mangler er
 * kullet (pinnen står, teksten fjernes). Kandidater med Infinity-prioritet
 * (aktiv POI) plasseres alltid — på foretrukket side om ingen er ledig.
 *
 * Tiebreak på id (leksikografisk) så resultatet er stabilt på tvers av
 * render-rekkefølge og pan-retning.
 */
export function computeLabelPlacements(
  candidates: readonly LabelCandidate[],
  obstacles: readonly LabelObstacle[] = [],
  viewport?: LabelViewport,
  metrics: LabelMetrics = {},
): Map<string, LabelSide> {
  const offsetX = metrics.offsetX ?? LABEL_OFFSET_X;
  const scale = metrics.scale ?? 1;
  const sorted = [...candidates].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1),
  );
  const blocked: Box[] = obstacles.map(obstacleBox);
  const accepted: Box[] = [];
  const placements = new Map<string, LabelSide>();

  for (const c of sorted) {
    const rightBox = estimateLabelBox(c, "right", offsetX, scale);
    const sideOrder: LabelSide[] = fitsViewport(rightBox, viewport)
      ? ["right", "left"]
      : ["left", "right"];

    let placed = false;
    for (const side of sideOrder) {
      const box =
        side === "right"
          ? rightBox
          : estimateLabelBox(c, "left", offsetX, scale);
      if (!fitsViewport(box, viewport)) continue;
      if (
        blocked.some((b) => intersects(b, box)) ||
        accepted.some((a) => intersects(a, box))
      ) {
        continue;
      }
      placements.set(c.id, side);
      accepted.push(box);
      placed = true;
      break;
    }

    // Aktiv POI kulles aldri — legg den på foretrukket side selv om det
    // koster en overlapp (den ligger øverst i z-orden og har brukerfokus).
    if (!placed && c.priority === Number.POSITIVE_INFINITY) {
      const side = sideOrder[0];
      placements.set(c.id, side);
      accepted.push(
        side === "right"
          ? rightBox
          : estimateLabelBox(c, "left", offsetX, scale),
      );
    }
  }
  return placements;
}
