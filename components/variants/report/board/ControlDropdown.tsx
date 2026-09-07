"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Kontroll-språket boardet bytter valg med: en TRIGGER som viser hva som er
 * valgt nå, og et PANEL med radene du kan velge i stedet.
 *
 * ## Hvorfor det er én komponent
 *
 * Mønsteret fantes to steder med to implementasjoner. Reisemåte-velgeren over
 * minutt-kolonnen i nabolagslista var en dropdown (ikon + etikett + chevron),
 * mens kart-kontrollen nederst la ALLE valgene utbrettet i pillen: tre
 * ikonknapper for reisemåte, tre tekstknapper for kartvisning. Utbrettet
 * skalerer ikke — pillen sto på kapasitetsgrensen ved 320 px, og hvert nytt
 * valg måtte kappe en etikett for å få plass (2026-09-03).
 *
 * En dropdown koster ett trykk og gir tilbake plassen. Den viser dessuten mer
 * enn segmentet gjorde: raden kan bære etikett OG tall («Sykkel · 8 min»), noe
 * en 36 px ikonknapp aldri kunne.
 *
 * Trigger-utseendet er det ENESTE som varierer mellom flatene (`variant`):
 * pillen over kartet er 14 px i en kapsel, listeoverskriften er 11.5 px og
 * leser som en kolonneoverskrift. Åpne/lukke-mekanikken, foldretningen,
 * chevron-rotasjonen og trykk-utenfor er felles — er de ikke det, drifter
 * flatene fra hverandre, samme grunn som `BoardMapControls` deler
 * `controlsBody` mellom pillen og FAB-popoveren.
 */

export type ControlDropdownVariant = "bar" | "header";

interface Props {
  /** Ikonet for det som er valgt nå. Vises i triggeren, foran etiketten. */
  icon: LucideIcon;
  /** Etiketten for det som er valgt nå — «Til fots», «Satelitt». */
  label: string;
  /** Hva kontrollen VELGER («Reisemåte», «Kartvisning»). Aldri hva som er
   *  valgt: aria-label er navnet på kontrollen, verdien leses av etiketten. */
  ariaLabel: string;
  variant: ControlDropdownVariant;
  /**
   * Folder panelet opp eller ned. Fast per kallsted, ikke målt: kontroll-pillen
   * er låst til bunnen av kartet (opp er alltid riktig), og listeoverskriften
   * står øverst i sin egen flate (ned er alltid riktig). Chipene på ruta måler
   * retning fordi de sitter på en geografisk posisjon og kan havne hvor som
   * helst i viewporten — det gjelder ingen av disse. Default "down".
   */
  direction?: "up" | "down";
  /** Panelets vannrette forankring til triggeren. Default "center". */
  align?: "left" | "right" | "center";
  /** Touch-vennlig høyde (mobil, 44 px). Gjelder bare "bar". Default false. */
  compact?: boolean;
  /**
   * CSS-selector for flaten som KLIPPER panelet (`overflow-hidden`-foreldren).
   * Er den satt, måles takhøyden ved åpning og panelet blir rullbart i stedet
   * for avkuttet. Uten den vokser panelet fritt.
   *
   * Nødvendig i nabolags-sheeten: panelet er `position: absolute` og teller
   * derfor ikke i sheetens innholdsmåling, så sheeten kan ikke vokse for å gi
   * det plass. På den korteste skjermen vi støtter ble siste rad klippet bort —
   * usynlig, men fortsatt «åpen».
   */
  clipSelector?: string;
  /**
   * Endres denne, lukkes panelet. Et åpent panel skal aldri overleve inn i en
   * annen kontekst enn det ble åpnet i (nytt aktivt sted, ny fase).
   */
  closeKey?: string | number;
  /** Panelbredde. Default `w-48`. */
  panelWidthClass?: string;
  testId?: string;
  /** Klasser på beholderen (posisjonering i den omkringliggende raden). */
  className?: string;
  /** Radene. Får `close` inn, så en rad kan lukke panelet når den er valgt. */
  children: (close: () => void) => ReactNode;
}

export function ControlDropdown({
  icon: Icon,
  label,
  ariaLabel,
  variant,
  direction = "down",
  align = "center",
  compact = false,
  clipSelector,
  closeKey,
  panelWidthClass = "w-48",
  testId,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [maxH, setMaxH] = useState<number | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setOpen(false);
  }, [closeKey]);

  /* Trykk utenfor lukker uten å velge. Capture, så flaten under ikke rekker å
   * reagere på trykket først.
   *
   * IKKE legg til `stopPropagation()` eller `preventDefault()` her. Lytteren er
   * bevisst passiv: den leser hvor trykket kom, og slipper det videre. Grep-
   * handlen til nabolags-sheeten starter draget sitt på det samme
   * `pointerdown`-eventet, og en «defensiv» stopp her ville drept muligheten
   * til å dra flaten så lenge panelet står åpent — uten at noen test fanger
   * det. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Escape lukker. Panelet er ikke en modal — den fanger ingen fokus — men et
  // åpent panel over kartet må kunne forlates uten å treffe kartet med musa.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (wasOpen) return false;
      const wrap = wrapperRef.current;
      const clip = clipSelector ? wrap?.closest(clipSelector) : null;
      if (wrap && clip) {
        const wrapBox = wrap.getBoundingClientRect();
        const clipBox = clip.getBoundingClientRect();
        const room =
          direction === "down"
            ? clipBox.bottom - wrapBox.bottom
            : wrapBox.top - clipBox.top;
        setMaxH(Math.max(96, room - 12));
      } else {
        setMaxH(undefined);
      }
      return true;
    });
  }, [clipSelector, direction]);

  const isBar = variant === "bar";

  return (
    <div ref={wrapperRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        data-testid={testId}
        onClick={toggle}
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center whitespace-nowrap transition-colors duration-200",
          isBar
            ? cn(
                "gap-1.5 rounded-full px-3 text-sm font-medium",
                compact ? "h-11" : "h-8",
                open
                  ? "bg-stone-900/[0.07] text-stone-900"
                  : "text-stone-600 hover:bg-stone-900/[0.05] hover:text-stone-900",
              )
            : cn(
                "gap-1 rounded-lg px-1.5 py-0.5 text-[11.5px] font-semibold tracking-wide",
                open
                  ? "bg-black/[0.06] text-stone-900"
                  : "text-stone-500 hover:bg-black/[0.05]",
              ),
        )}
      >
        <Icon
          className={cn("shrink-0", isBar ? "h-4 w-4" : "h-3.5 w-3.5")}
          aria-hidden
        />
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          style={maxH === undefined ? undefined : { maxHeight: maxH }}
          className={cn(
            "absolute z-40 overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur",
            panelWidthClass,
            direction === "down" ? "top-full mt-1.5" : "bottom-full mb-1.5",
            align === "left" && "left-0",
            align === "right" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/**
 * Én rad i et kontroll-panel. Delt mellom reisemåte-panelet og
 * kartvisnings-panelet, så de to listene ikke kan drifte fra hverandre i
 * høyde, ikonstørrelse eller hvordan «valgt» ser ut.
 *
 * `meta` er den høyrestilte kolonnen: reisetiden i reisemåte-panelet, kilden
 * («Google») i kartvisnings-panelet. Utelates den, står raden uten kolonne —
 * ikke med en tom.
 */
export function ControlPanelRow({
  icon: Icon,
  label,
  active,
  meta,
  ariaLabel,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  meta?: ReactNode;
  /** Settes bare når etiketten ikke er nok alene («Satelitt» →
   *  «Satellitt ovenfra»). Ellers leses etiketten. */
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
        active ? "bg-stone-100" : "hover:bg-stone-50",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-stone-900" : "text-stone-500",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13.5px]",
          active ? "font-semibold text-stone-900" : "text-stone-600",
        )}
      >
        {label}
      </span>
      {meta !== undefined && (
        <span
          className={cn(
            "shrink-0 text-[13px] tabular-nums",
            active ? "font-semibold text-stone-900" : "text-stone-500",
          )}
        >
          {meta}
        </span>
      )}
    </button>
  );
}
