"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  LABEL_FONT_SIZE,
  LABEL_GAP_X,
  LABEL_LINE_H,
  LABEL_MAX_LINES,
  LABEL_MAX_W,
  type LabelSide,
} from "@/lib/board/label-collision";

/**
 * Innholdet i en POI-markør: disc + ikon + navn, som HTML og CSS.
 *
 * Erstatter den rasteriserte `Marker3DPin`. Teksten er nå en ekte tekstnode som
 * nettleseren tegner på skjermens egen oppløsning — det er hele grunnen til
 * byttet. Se `DomMarker3D` for målingene som viser at ingen innstilling kunne
 * gjort SVG-teksten skarp.
 *
 * ## Boksen MÅ være kvadratisk (og hvorfor)
 *
 * `MarkerElement`s anker er `anchorLeft: -50%` / `anchorTop: -100%` — prosent av
 * ELEMENTETS EGEN boks. Verifisert i browser (målt da disc-en var 40 px): disc +
 * label i flex-flyt gjorde verts-boksen 132 px bred, og `-50%` av den flyttet
 * disc-en 46 px bort fra punktet sin — og motsatt vei når labelen flippet side.
 * En naken disc og en disc med absolutt plassert label fikk derimot IDENTISK
 * `translate(623.5px, 497.005px)`.
 *
 * Derfor: disc-en er en `position: relative` boks på nøyaktig {@link PIN_SIZE},
 * og labelen ligger `position: absolute` UTENFOR flyten. Da er ankeret uendret
 * bunn-midt, og `anchorToDiscCenterY` i kollisjonskullingen samt mini-popupens
 * −28 px står riktig uten re-utledning.
 *
 * Dette er samme grep som den gamle SVG-en løste med en symmetrisk ramme — bare
 * uten å betale for tomrommet på motsatt side.
 *
 * ## Haloen
 *
 * SVG-en tegnet teksten TO ganger (hvit kontur, så fyll) fordi SVG mangler
 * `text-shadow`. I DOM er det en fire-veis `text-shadow`. Underlaget er
 * satellittfoto, ikke et lyst karttema, så konturen er ikke pynt — den er det
 * som gjør navnet lesbart.
 *
 * ## Skalaen
 *
 * `scale` kommer fra kollisjonskullingen, som leser den av kameraet når det
 * faller til ro ({@link poiPinScaleForZoom}). Den ganger disc, ikon, prikk OG
 * navnet — hele markøren, ikke bare skiva, for det var teksten som ble for
 * liten på nær zoom. Boksen vokser med den, og siden Googles anker er PROSENT
 * av elementets egen boks (se over) blir markøren stående på punktet sitt uten
 * at noe anker må regnes om.
 *
 * ## Pointer-events
 *
 * DOM-markøren tar over hit-testingen fra WebGL-canvaset (verifisert:
 * `elementFromPoint` på markørsenteret returnerer markørens egen node). Labelen
 * er derfor `pointer-events: none` — den skal ikke stjele kart-gester eller
 * utvide treffflaten langt utover disc-en. Klikk håndteres av `gmp-click` på
 * verten, ikke av React-handlere her.
 */

/**
 * Markør-diameter — ÉN kilde for hele 3D-stien: kollisjonskullingen
 * (`use-3d-marker-declutter`), reveal-lagets legend-pin og den rasteriserte
 * `Marker3DPin` importerer alle denne. De hadde hver sin kopi av tallet, og en
 * kopi driver fra originalen ved første justering.
 *
 * 32 px, ikke 40 (2026-08-27): 40 leste som store fargeklumper over
 * satellittfoto — flaten er tettere enn et lyst karttema, så samme disc bærer
 * mer visuell vekt her. 32 er dessuten NØYAKTIG den inaktive 2D-markøren
 * (`BoardMarker`s `containerSize`), så samme sted er like stort i begge motorer.
 */
export const PIN_SIZE = 32;
/** Prikken en demotert markør tegnes som. Speiles av `DOT_HALF`. */
export const DOT_SIZE = 14;
/** Ikon-ratio 0,50 — 32 px disc → 16 px ikon, samme som 2D-markørene og lista. */
const ICON_RATIO = 0.5;

/** Nær-svart, samme som 2D-labelen. */
const LABEL_FILL = "#1c1917";
const LABEL_HALO = "#ffffff";
/** Fire-veis kontur. SVG-stien tegnet to <text>-noder for samme effekt. */
const LABEL_TEXT_SHADOW = [
  `0 0 2px ${LABEL_HALO}`,
  `1px 1px 2px ${LABEL_HALO}`,
  `-1px 1px 2px ${LABEL_HALO}`,
  `1px -1px 2px ${LABEL_HALO}`,
  `-1px -1px 2px ${LABEL_HALO}`,
].join(",");

export interface PoiMarkerContentProps {
  /** Kategorifarge — ring rundt disc-en og ikon-fyll. */
  color: string;
  /** Lys tint av `color` (typisk `hexLightTint`). Disc-bakgrunn. */
  backgroundColor: string;
  Icon: PhosphorIcon;
  /** Valgfritt tall-badge øverst til høyre. */
  number?: number;
  /**
   * Kjøpesenter-modus: `+`-merke øverst til høyre i stedet for et tall.
   *
   * Merket er KVALITATIVT med vilje. Et tall («60») er FINN-mønsteret vi
   * forkastet: det forutsetter at de seksti er likeverdige objekter, og for en
   * boligkjøper betyr tallet ingenting — «har senteret det jeg trenger» er
   * spørsmålet, ikke «hvor mange leietakere har det». `+` sier «det er mer her
   * inne» uten å påstå noe om hvor mye.
   *
   * Ingen ny elementtype: samme kvadratiske {@link PIN_SIZE}-boks, samme
   * kategori-ikon, samme anker. Det er hele grunnen til at det er en modus og
   * ikke en egen markør — se spøkelses-teksturen i `map-view-3d`.
   */
  anchor?: boolean;
  /**
   * POI-navnet. Utelates når kollisjonskullingen ikke fant plass, eller når
   * kamera-avstanden er under label-tieren — pinnen står, teksten forsvinner.
   */
  label?: string;
  labelSide?: LabelSide;
  /** Tegn som ren farge-prikk i stedet for full ikon-pin (demotert/compact). */
  compact?: boolean;
  /**
   * Zoom-avhengig størrelse, 1 = {@link PIN_SIZE}. Ganger disc, ikon, prikk og
   * label-typografi. Kilden er `poiPinScaleForZoom`, lest ved kamera-ro — og
   * kollisjonskullingen MÅ regne med samme tall, ellers reserverer den plass til
   * en annen markør enn den som tegnes.
   */
  scale?: number;
}

export function PoiMarkerContent({
  color,
  backgroundColor,
  Icon,
  number,
  anchor = false,
  label,
  labelSide = "right",
  compact = false,
  scale = 1,
}: PoiMarkerContentProps) {
  // Prikken beholder markørens fulle {@link PIN_SIZE}-boks, så ankeret ikke
  // flytter seg når en markør demoteres. Bare det tegnede innholdet krymper.
  const pin = Math.round(PIN_SIZE * scale);
  const dot = Math.round(DOT_SIZE * scale);
  const iconSize = Math.round(pin * ICON_RATIO);
  // Størrelsen skifter i trinn ved kamera-ro, ikke per frame — uten en overgang
  // ville hvert trinn vært et hopp. Transformen eier Google, så vi animerer bare
  // boksen og typografien.
  const grow = "width 180ms ease-out, height 180ms ease-out";

  // Et eksplisitt tall vinner over `+`. Nummererte markører er turrekkefølge
  // (Guide), og den rekkefølgen er en påstand vi ikke skal overskrive.
  const badge = number !== undefined ? number : anchor ? "+" : undefined;

  return (
    <div
      data-poi-marker=""
      style={{
        position: "relative",
        width: pin,
        height: pin,
        transition: grow,
        // Ingen `overflow` her: labelen SKAL stikke utenfor boksen. Google
        // klipper ikke marker-innhold (verifisert: overflow visible, contain
        // none), og kartelementets egen `contain: content` holder den likevel
        // innenfor kartflaten.
      }}
    >
      {compact ? (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: dot,
            height: dot,
            marginLeft: -dot / 2,
            marginTop: -dot / 2,
            borderRadius: "50%",
            background: color,
            border: "2px solid #ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
            boxSizing: "border-box",
            transition: grow,
          }}
        />
      ) : (
        <>
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: backgroundColor,
              border: `2px solid ${color}`,
              boxShadow: "0 1.5px 3px rgba(0,0,0,0.35)",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon width={iconSize} height={iconSize} weight="fill" color={color} />
          </span>
          {badge !== undefined && (
            <span
              data-poi-badge={anchor && number === undefined ? "anchor" : ""}
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                padding: "0 3px",
                borderRadius: 999,
                background: "#ffffff",
                border: `1.5px solid ${color}`,
                color,
                font: "700 10px/16px system-ui, -apple-system, sans-serif",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              {badge}
            </span>
          )}
        </>
      )}

      {label && (
        <span
          data-poi-label=""
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            // Labelen starter utenfor disc-kanten, på den siden
            // kollisjonskullingen valgte. `LABEL_GAP_X` er delt med 2D-stien.
            ...(labelSide === "right"
              ? { left: pin + LABEL_GAP_X * scale }
              : { right: pin + LABEL_GAP_X * scale }),
            maxWidth: LABEL_MAX_W * scale,
            // Linjebrytingen er nå CSS-ens jobb. SVG-<text> brøt ikke selv, og
            // det er derfor `wrapLabelLines` fantes.
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: LABEL_MAX_LINES,
            overflow: "hidden",
            fontSize: LABEL_FONT_SIZE * scale,
            lineHeight: `${LABEL_LINE_H * scale}px`,
            fontWeight: 600,
            fontFamily: "system-ui, -apple-system, Helvetica Neue, sans-serif",
            color: LABEL_FILL,
            textShadow: LABEL_TEXT_SHADOW,
            textAlign: labelSide === "right" ? "left" : "right",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
