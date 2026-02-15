"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
          role="dialog"
          aria-modal="true"
          className={cn(
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
