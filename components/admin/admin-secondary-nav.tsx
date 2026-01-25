"use client";

import { X, PanelLeftClose } from "lucide-react";

interface AdminSecondaryNavProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function AdminSecondaryNav({ children, isOpen, onClose, title }: AdminSecondaryNavProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Secondary nav panel */}
      <aside
        className={`
          fixed lg:relative inset-y-0 lg:inset-y-auto
          left-0 lg:left-auto
          z-40 lg:z-auto
          w-72 lg:w-[280px]
          h-full
          bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          lg:transform-none lg:translate-x-0
          flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100 lg:hidden">
          {title && <span className="font-semibold text-gray-900">{title}</span>}
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
            aria-label="Lukk panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </aside>
    </>
  );
}

// Mobile trigger button - use this in pages that need secondary nav
interface SecondaryNavTriggerProps {
  onClick: () => void;
  label?: string;
}

export function SecondaryNavTrigger({ onClick, label = "Åpne panel" }: SecondaryNavTriggerProps) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 left-4 z-20 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors lg:hidden flex items-center gap-2"
      aria-label={label}
    >
      <PanelLeftClose className="w-5 h-5 text-gray-700" />
    </button>
  );
}
