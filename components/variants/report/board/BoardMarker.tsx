"use client";

import { Marker } from "react-map-gl/mapbox";
import React from "react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardPOI } from "./board-data";
import { hexLightTint, markerCircleStyle } from "./marker-style";
import {
  labelHaloShadow,
  LABEL_FONT_SIZE,
  LABEL_MAX_W,
  type LabelSide,
} from "@/lib/board/label-collision";
import type { BoardZoomTier } from "./use-board-zoom-tier";
import {
  STORY_EMPHASIS_OPACITY,
  STORY_EMPHASIS_PIN_SCALE,
  type StoryEmphasis,
} from "./story/story-model";
import { REACH_OUTSIDE_OPACITY } from "@/lib/board/reach";

/**
 * Ikon-sirkelens diameter for en INAKTIV markør, i px.
 *
 * Eksportert fordi kollisjonsmodellen i `BoardMap` må reservere den samme
 * skiva som faktisk tegnes — både label-kullingen og utglisningen. Speiles
 * tallet i stedet for å importeres, kolliderer vi mot en størrelse som ikke
 * finnes på skjermen. Samme disiplin som `PIN_SIZE` i 3D-stien.
 */
export const MARKER_CIRCLE_SIZE = 32;

/** Den demoterte prikkas diameter, i px. Se {@link MARKER_CIRCLE_SIZE}. */
export const MARKER_DOT_SIZE = 8;

interface Props {
  poi: BoardPOI;
  color: string;
  icon: string;
  isActive: boolean;
  /**
   * Når false fader markøren ut (opacity + scale) i stedet for å unmounte.
   * Beholder DOM-identitet på tvers av kategori-skifter så Mapbox ikke må
   * re-projisere markører og fade kan animeres i CSS.
   */
  isVisible: boolean;
  /**
   * Unit 5: event-board "Min samling". Når true tegnes en egen highlight-ring
   * rundt markøren (uavhengig av `isActive`/`isVisible`) så et lagret event
   * skiller seg ut på kartet — også når et tema/dag/tid-filter er aktivt.
   * Default false (boligrapporter har ingen samling-highlight).
   */
  inCollection?: boolean;
  /**
   * Zoom-tier fra `useBoardZoomTier`. Styrer hvilken sub-element som er
   * synlig: `dot` viser kun farget prikk, `icon` viser ikon-sirkel,
   * `icon+label` viser ikon-sirkel + POI-navn.
   */
  zoomTier: BoardZoomTier;
  /**
   * Når true, undertrykk inline-label selv om aktiv. Brukes når
   * `popupMode === "mini"` for aktiv POI — `BoardPOIMiniPopup` viser
   * allerede navnet, så vi unngår dobbel-rendering (R10c i planen).
   */
  suppressLabel: boolean;
  /**
   * Anker-side fra label-plasseringen (`computeLabelPlacements`): høyre er
   * default; venstre brukes når høyre side kolliderer med nabo-label/-pin
   * eller viewport-kanten. Venstre-labels høyrejusteres mot pinnen.
   */
  labelSide: LabelSide;
  /**
   * Utglisning (`computePinDemotions`, regnet i `BoardMap` ved kamera-ro):
   * pinnen fikk ikke plass ved siden av naboene sine og faller tilbake til
   * prikk. Prikken står fortsatt der, er fortsatt klikkbar, og forfremmes
   * tilbake til full pin så snart brukeren zoomer inn.
   *
   * Samme regel som Google-motoren har hatt siden Strindfjordvegen-runden
   * (2026-08-23) — 2D manglet den, og fem steder i samme kjøpesenter ble fem
   * hele skiver stablet oppå hverandre der 3D viste én pin og fire prikker.
   */
  demoted?: boolean;
  /**
   * Omvisningens vekt på dette punktet, eller null/utelatt når ingen omvisning
   * kjører (kartet er da urørt).
   *
   * Tre nivåer, ikke to: `named` er de tre stedene stoppet snakker om, `scene`
   * er kategorien rundt dem, `texture` er resten av nabolaget. Med bare
   * dempet/ikke-dempet ble alle punktene like viktige som de tre.
   *
   * Er verdien satt, er markøren dessuten INERT: i omvisningen er pinnene
   * illustrasjon, og trykkflaten er stedene i flaten. Ett interaksjonsmønster,
   * ikke to.
   */
  emphasis?: StoryEmphasis | null;
  /**
   * Punktet ligger UTENFOR rekkevidde-konturene for den valgte reisemåten
   * (`useReach`), og rekkevidde er slått på.
   *
   * Utslaget er det samme som utglisningen bruker — pinnen faller til prikk —
   * pluss en reell demping (`REACH_OUTSIDE_OPACITY`). Det er dét som gjør
   * ringene til en grense man SER: fulle ikoner innenfor, blasse prikker
   * utenfor. Uten det lå konturene som tre streker punktene ikke svarte på
   * (Andreas, 2026-09-07).
   *
   * Prikken er fortsatt klikkbar, og et ÅPNET punkt er unntatt — åpner du et
   * sted langt unna, skal det ikke være en blass prikk under popupen din.
   * Samme regel som `demoted`.
   */
  outOfReach?: boolean;
  /**
   * Punktet er OMTALT akkurat nå, og dette er plassen i rekken (1-basert).
   * Utelatt = ikke omtalt, og markøren er uendret.
   *
   * Egen akse ved siden av `isActive`, fordi den svarer på et annet spørsmål:
   * den aktive er stedet leseren har åpnet, disse er stedene noen snakker om —
   * og det kan være flere av dem samtidig. Se `BoardState.highlightedPoiIds`.
   *
   * Utslaget er å BLI SETT: full skive (38 px, som omvisningens navngitte),
   * en mørk ring med hvit luft rundt, rekkefølgetallet øverst til venstre, og
   * navnet synlig uansett zoom-tier. Et omtalt sted faller ALDRI til prikk —
   * verken fra utglisningen eller fra rekkevidde — for en prikk kan du ikke
   * kjenne igjen ut fra det som ble sagt.
   */
  highlightIndex?: number;
  onClick: () => void;
}

function BoardMarkerImpl({
  poi,
  color,
  icon,
  isActive,
  isVisible,
  inCollection = false,
  zoomTier,
  suppressLabel,
  labelSide,
  demoted = false,
  emphasis = null,
  outOfReach = false,
  highlightIndex,
  onClick,
}: Props) {
  const isHighlighted = highlightIndex !== undefined;
  const Icon = getFilledIcon(poi.raw.category.icon || icon);
  const circle = markerCircleStyle(color);
  // Lysere border (~50% hvit-blanding) demper rammen så ikonet får primær
  // visuell vekt — mindre detaljer per markør, men hue-identitet bevart.
  // Aktiv markør beholder full farge for tydelig fokus-signal.
  const inactiveBorder = hexLightTint(color, 0.5);

  // Utglisningen slår inn FØR R10 under: et demotert punkt er en prikk på
  // samme måte som et punkt under dot-tieren er det, og R10 løfter det tilbake
  // hvis brukeren åpner det. `BoardMap` gir aldri aktiv POI eller et anker
  // `demoted` (de har Infinity-prioritet), så dette er bare et sikkerhetsnett.
  //
  // Et OMTALT sted er unntatt begge: assistenten sa navnet, og et navnløst
  // punkt kan leseren ikke kjenne igjen. Rekkevidde-dempingen er tatt bort av
  // samme grunn (se `reachOpacity`) — 45 % leser som «avskrudd», og et sted
  // noen nettopp snakket om skal ikke se avskrudd ut. Samme fritak som den
  // åpne POI-en alt har.
  const crowdedTier: BoardZoomTier =
    (demoted || outOfReach) && !isHighlighted ? "dot" : zoomTier;

  // R10: aktiv markør på `dot`-tier promoteres visuelt til `icon`-tier-størrelse
  // så label har et anker å stå ved siden av. Omtalte steder løftes av samme
  // grunn: ringen og rekkefølgetallet trenger en skive å ligge rundt.
  const effectiveTier: BoardZoomTier =
    (isActive || isHighlighted) && crowdedTier === "dot" ? "icon" : crowdedTier;

  const showDot = effectiveTier === "dot";
  const showIconCircle = !showDot;
  const showLabel =
    (effectiveTier === "icon+label" || isActive || isHighlighted) &&
    !suppressLabel;

  // Container-størrelse styres av isActive (uavhengig av tier). Aktiv = 44 px
  // (matcher dagens `w-11 h-11`), inaktiv = 32 px (matcher `w-8 h-8`). Dot og
  // IconCircle er absolute-sentrert i samme container, så tap-koordinaten flytter
  // seg ikke når R10-promotion skjer.
  // Omtalte steder tegnes med samme vekt som omvisningens navngitte (38): de er
  // det kartet handler om akkurat nå, men de er ikke åpnet — 44 er forbeholdt
  // punktet leseren faktisk står i.
  const containerSize = isActive
    ? 44
    : isHighlighted || emphasis === "named"
      ? 38
      : Math.round(
          MARKER_CIRCLE_SIZE *
            (emphasis ? STORY_EMPHASIS_PIN_SCALE[emphasis] : 1),
        );

  // Omvisningens tre nivåer. `named` beholder full styrke og får sin vekt fra
  // størrelsen over; de to andre trekker seg tilbake.
  //
  // Vekten er VISUELL, ikke en gate på trykk (2026-08-28). Pinnene var inerte
  // under et stopp — `pointer-events: none` så snart et nivå var satt — med
  // begrunnelsen at trykkflaten var radene i flaten. En dempet pinne du kan se
  // men ikke ta på leser som et kart som har sluttet å virke, så et trykk går nå
  // gjennom uansett nivå; det er flaten som følger etter (se `useMapPinClick`).
  //
  // Størrelsen over er hovedsignalet: nabolaget rundt stoppet tegnes mindre, men
  // beholder ikon, farge og navn (`STORY_EMPHASIS_PIN_SCALE`). Opacityen er bare
  // et hint om dybde ved siden av — se doccen i story-model for hvorfor den
  // ikke kan bære skillet alene (2026-08-28).
  //
  // Et omtalt sted er aldri kontekst: nevner assistenten en barnehage under et
  // mat-stopp, er barnehagen det du skal finne igjen.
  const emphasisOpacity =
    emphasis && !isHighlighted ? STORY_EMPHASIS_OPACITY[emphasis] : 1;

  // Rekkevidde legger seg OPPÅ omvisningens vekting i stedet for å erstatte
  // den: begge kan være på samtidig (omvisningen kjører, leseren slår på
  // rekkevidde), og et punkt som både er kontekst og utenfor rekkevidde er
  // svakere enn hvert av dem alene. `effectiveTier` over har alt fritatt den
  // åpne POI-en fra prikk-formen; her fritas den fra dempingen.
  const reachOpacity =
    outOfReach && !isActive && !isHighlighted ? REACH_OUTSIDE_OPACITY : 1;

  return (
    <Marker
      longitude={poi.coordinates.lng}
      latitude={poi.coordinates.lat}
      anchor="bottom"
      offset={[0, 0]}
      onClick={(e) => {
        if (!isVisible) return;
        e.originalEvent.stopPropagation();
        onClick();
      }}
      style={{
        cursor: isVisible ? "pointer" : "default",
        // Omtalte steder legger seg over nabolaget, men UNDER det åpne punktet:
        // popupen og rutelinja hører til det ene stedet leseren står i.
        zIndex: isActive ? 5 : isHighlighted ? 4 : 1,
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      {/* Inner container: bærer kategori-fade (isVisible) og overflow:visible
          så aktiv ikon-sirkel (44 px) ikke klippes av container-bbox når den
          vokser. Label sitter absolute utenfor container-edge til høyre. */}
      <div
        style={{
          position: "relative",
          width: containerSize,
          height: containerSize,
          opacity: isVisible ? emphasisOpacity * reachOpacity : 0,
          transform: isVisible ? "scale(1)" : "scale(0.5)",
          // Vektskiftet skal SEES, ikke bare være der: ved et stoppbytte endrer
          // flere hundre markører nivå samtidig, og en rask fade leser som at
          // kartet blinket. 500 ms gjør den til en rolig bevegelse øyet får med
          // seg. Størrelsen holder 200 ms — den svarer på fingeren din
          // (`isActive`), og skal kjennes umiddelbar.
          transition:
            "opacity 500ms ease-out, transform 500ms ease-out, width 200ms ease-out, height 200ms ease-out",
          overflow: "visible",
        }}
      >
        {/* Unit 5: "Min samling"-ring. Tegnes BAK ikon-sirkelen/prikken (lavere i
            stacking-rekkefølgen, pointer-events:none) som en bookmark-aksent rundt
            markøren. Skalerer med container så den omkranser både dot- og icon-
            tier. Kun synlig for lagrede events. */}
        {inCollection && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: containerSize + 10,
              height: containerSize + 10,
              borderRadius: "50%",
              border: "2.5px solid #0ea5e9",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
              pointerEvents: "none",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 200ms ease-out",
            }}
          />
        )}

        {/* Omtalt-ring. Mørk kontur med 2 px hvit luft inn mot skiva, tegnet
            som `inset`-skygge i stedet for et ekstra element — luften må ligge
            MELLOM ringen og ikon-sirkelen, og en andre ring-div ville vært et
            mount til per markør i et sett på rundt tusen.

            Fargen er nesten-svart og ikke kategorifargen med vilje: ringen sier
            «denne snakker vi om», og det er en påstand om samtalen, ikke om
            hvilket tema stedet hører til. Kategorifargen står allerede i skiva
            under. Nesten-svart er dessuten det eneste som leser trygt over det
            lyse karttemaet uansett hvilken kategorifarge den omkranser. */}
        {isHighlighted && (
          <div
            aria-hidden
            data-poi-highlight-ring=""
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              // containerSize + 2 px hvit luft + 2,5 px ring på hver side. Uten
              // border-box legger kanten seg utenpå bredden, så den ytre
              // diameteren blir containerSize + 9 og den hvite inset-skyggen
              // lander nøyaktig på ikon-sirkelens kant.
              width: containerSize + 4,
              height: containerSize + 4,
              borderRadius: "50%",
              border: "2.5px solid #1c1917",
              boxShadow: "inset 0 0 0 2px #ffffff",
              pointerEvents: "none",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 200ms ease-out",
            }}
          />
        )}

        {/* Dot — absolute centered. Vises ved effectiveTier="dot" (kun
            inaktive markører ved lav zoom). Tap-koordinat = container-senter
            (samme som IconCircle), så promotion til icon flytter ikke
            klikk-anker horisontalt. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: MARKER_DOT_SIZE,
            height: MARKER_DOT_SIZE,
            borderRadius: "50%",
            backgroundColor: color,
            opacity: showDot ? 1 : 0,
            transition: "opacity 200ms ease-out",
            pointerEvents: "none",
          }}
        />

        {/* IconCircle — eksisterende sirkel-design, absolute centered.
            Vises ved alle andre effectiveTier-states. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: containerSize,
            height: containerSize,
            borderRadius: "50%",
            borderWidth: isActive ? 3 : 2,
            borderStyle: "solid",
            borderColor: isActive ? circle.borderColor : inactiveBorder,
            backgroundColor: circle.backgroundColor,
            color: circle.borderColor,
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
            opacity: showIconCircle ? 1 : 0,
            transition:
              "opacity 200ms ease-out, width 200ms ease-out, height 200ms ease-out, border-width 200ms ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Ikonet følger sirkelen: 16 px i en 22 px ring med 2 px kant ville
              ligget helt inntil kanten. Tallene er de samme forholdene som den
              fulle pinnen har. */}
          <Icon
            className={
              isActive
                ? "w-5 h-5"
                : containerSize < 28
                  ? "w-3 h-3"
                  : "w-4 h-4"
            }
            weight="fill"
          />

          {/* Kjøpesenter-merket. Samme `+` som Google-motoren tegner
              (`PoiMarkerContent`), og med vilje samme geometri: 16 px boks,
              1,5 px kant i kategorifargen, 2 px utenfor sirkelkanten. Uten det
              var Valentinlyst Senter en butikkpinne som alle andre på 2D-
              kartet, og de ti virksomhetene inni var usynlige.

              Merket er KVALITATIVT — aldri et tall. Se `PoiMarkerContent`:
              «60» forutsetter at de seksti er likeverdige objekter, og for en
              boligkjøper er spørsmålet «har senteret det jeg trenger», ikke
              «hvor mange leietakere har det».

              Ligger inne i ikon-sirkelen, så det fader og krymper med den —
              en prikk bærer ikke merke. */}
          {poi.isAnchor && (
            <span
              aria-hidden="true"
              data-poi-badge="anchor"
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
                pointerEvents: "none",
              }}
            >
              +
            </span>
          )}
        </div>

        {/* Rekkefølgetallet. Øverst til VENSTRE, mens kjøpesenter-merket står
            øverst til høyre — de to er ulike påstander og må kunne stå samtidig
            (et omtalt kjøpesenter skal fortsatt si at det er mer inni).

            Ligger UTENFOR ikon-sirkelen, ikke inni som `+`-merket: sirkelen
            fader og krymper med tieren, og tallet skal stå så lenge stedet er
            omtalt. Google-motoren bruker samme plassering av samme grunn (se
            `PoiMarkerContent.highlightIndex`). */}
        {isHighlighted && (
          <span
            aria-hidden="true"
            data-poi-badge="highlight"
            style={{
              position: "absolute",
              top: -6,
              left: -6,
              minWidth: 16,
              height: 16,
              padding: "0 3px",
              borderRadius: 999,
              background: "#ffffff",
              border: "1.5px solid #1c1917",
              color: "#1c1917",
              font: "700 10px/16px system-ui, -apple-system, sans-serif",
              textAlign: "center",
              boxSizing: "border-box",
              pointerEvents: "none",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 200ms ease-out",
            }}
          >
            {highlightIndex}
          </span>
        )}

        {/* Label — absolute inntil container, side styrt av labelSide
            (kollisjons-flipping). `pointer-events: none` + `aria-hidden`
            så ikon-sirkelen er eneste klikk-target og skjermlesere ikke
            leser navnet dobbelt. Bryter på ordgrense til maks 2 linjer
            (kompakt rektangel gir mindre horisontalt fotavtrykk → færre
            label-kollisjoner enn én lang linje); ellipsis først etter
            linje 2. Venstre-labels høyrejusteres så teksten ligger an mot
            pinnen. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            ...(labelSide === "right"
              ? { left: "100%", marginLeft: 8, textAlign: "left" as const }
              : { right: "100%", marginRight: 8, textAlign: "right" as const }),
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: LABEL_FONT_SIZE,
            fontWeight: 600,
            lineHeight: 1.2,
            color: "#1c1917",
            // Hard kontur, ikke glød: den myke halo-en la en dis rundt hver
            // bokstav og fikk skarp tekst til å se uskarp ut (2026-08-28).
            textShadow: labelHaloShadow(),
            WebkitFontSmoothing: "antialiased",
            // Absolutt posisjonert i containeren → shrink-to-fit ville
            // kollapset bredden til lengste enkeltord (ett ord per linje).
            // max-content + maxWidth gir full linjebredde opp til taket.
            // Tallene er label-collisions egne, så det som TEGNES og det som
            // RESERVERES ikke kan drifte fra hverandre.
            width: "max-content",
            maxWidth: LABEL_MAX_W,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "break-word",
            pointerEvents: "none",
            opacity: showLabel ? 1 : 0,
            transition: "opacity 200ms ease-out",
          }}
        >
          {poi.name}
        </span>
      </div>
    </Marker>
  );
}

export const BoardMarker = React.memo(
  BoardMarkerImpl,
  (prev, next) =>
    prev.poi.id === next.poi.id &&
    prev.color === next.color &&
    prev.icon === next.icon &&
    prev.isActive === next.isActive &&
    prev.isVisible === next.isVisible &&
    prev.inCollection === next.inCollection &&
    prev.zoomTier === next.zoomTier &&
    prev.suppressLabel === next.suppressLabel &&
    prev.labelSide === next.labelSide &&
    prev.demoted === next.demoted &&
    prev.emphasis === next.emphasis &&
    // MÅ stå her. Sammenligneren er en hvitliste, så en prop som ikke er nevnt
    // rører aldri skjermen: uten denne linja slo rekkevidde på konturene og
    // bildeteksten, mens alle 973 markørene sto igjen som fulle pins (målt i
    // nettleseren 2026-09-07 — 0 dempede av 973).
    prev.outOfReach === next.outOfReach &&
    // Samme regel, samme felle: uten denne linja ville et nytt svar fra
    // assistenten skrevet en ny liste i state uten at én eneste markør endret
    // seg på skjermen.
    prev.highlightIndex === next.highlightIndex,
);
