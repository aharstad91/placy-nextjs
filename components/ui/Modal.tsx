"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fokuserbare elementer inne i dialogen, i DOM-rekkefølge. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnBackdrop) onClose();
    },
    [onClose, closeOnBackdrop]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  /**
   * Fokus-håndtering. Dialogen hadde `role="dialog"` og ESC, men ingen
   * autofokus, ingen fokus-felle og ingen fokus-retur — så tastaturbrukere ble
   * stående i innholdet BAK modalen, som `aria-modal` sier ikke finnes.
   *
   * Ligger her og ikke i den enkelte modalen, slik at alle konsumenter
   * (POIExploreModal, BoardCollectionDrawer) arver oppførselen.
   */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Fokuser panelet selv, ikke første knapp: da leser skjermlesere
    // dialogens innhold fra toppen i stedet for å starte midt i.
    panelRef.current?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      // Fokus tilbake dit brukeren kom fra — ellers hopper fokus til
      // dokumentstart når modalen lukkes.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop — separate fixed layer */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 animate-modal-backdrop-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Modal centering container */}
      <div className="fixed inset-0 z-[101] flex items-end md:items-center md:justify-center p-4 md:p-6 pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={cn(
            "outline-none",
            "w-full md:w-auto md:min-w-[400px] md:max-w-[480px] bg-white flex flex-col pointer-events-auto",
            "max-h-[85vh] md:max-h-[50vh]",
            "rounded-2xl",
            "animate-slide-up md:animate-modal-in",
            "shadow-xl",
            className
          )}
        >
          {/* Header */}
          {title !== undefined && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 min-w-0">{typeof title === "string" ? (
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              ) : (
                title
              )}</div>
              <button
                onClick={onClose}
                type="button"
                aria-label="Lukk"
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">{children}</div>

          {/* Sticky footer */}
          {footer && (
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
