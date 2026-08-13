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
 * Ren funksjon over skjerm-koordinater — projeksjonen (lngLat → px) skjer i
 * BoardMap, som kaller denne på moveend. Deterministisk: samme kandidater gir
 * samme resultat uavhengig av input-rekkefølge.
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
 */
export interface LabelObstacle {
  x: number;
  y: number;
  halfSize: number;
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
const CHAR_W = 5.9;
/** Speiler BoardMarker: lineHeight 1.2 × fontSize 10. */
const LINE_H = 12;
/** Container-halvbredde (32 px inaktiv markør) + margin 8. */
const LABEL_OFFSET_X = 16 + 8;
/** Liten slack så labels som så vidt tangerer ikke regnes som kollisjon. */
const SLACK = 2;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Estimert label-bbox i skjerm-px for en kandidat. Eksportert for test. */
export function estimateLabelBox(c: LabelCandidate, side: LabelSide): Box {
  const textW = c.name.length * CHAR_W;
  const width = Math.min(textW, LABEL_MAX_W);
  const lines = textW > LABEL_MAX_W ? 2 : 1;
  const height = lines * LINE_H;
  const left =
    side === "right" ? c.x + LABEL_OFFSET_X : c.x - LABEL_OFFSET_X - width;
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
  return {
    left: o.x - o.halfSize,
    top: o.y - o.halfSize,
    right: o.x + o.halfSize,
    bottom: o.y + o.halfSize,
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
): Map<string, LabelSide> {
  const sorted = [...candidates].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1),
  );
  const blocked: Box[] = obstacles.map(obstacleBox);
  const accepted: Box[] = [];
  const placements = new Map<string, LabelSide>();

  for (const c of sorted) {
    const rightBox = estimateLabelBox(c, "right");
    const sideOrder: LabelSide[] = fitsViewport(rightBox, viewport)
      ? ["right", "left"]
      : ["left", "right"];

    let placed = false;
    for (const side of sideOrder) {
      const box = side === "right" ? rightBox : estimateLabelBox(c, "left");
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
      accepted.push(side === "right" ? rightBox : estimateLabelBox(c, "left"));
    }
  }
  return placements;
}
