"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Info,
  MoreHorizontal,
  Share2,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import { useCopyShare } from "../summary/hooks/useCopyShare";

// TODO(Andreas): bekreft faktisk Placy-URL (og om «Om Placy» skal til en egen
// side/seksjon). Placeholder inntil videre — begge lenker peker hit.
const PLACY_URL = "https://placy.no";

interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  /** Hold menyen åpen etter klikk (f.eks. mute-toggle, så label-skiftet vises). */
  keepOpen?: boolean;
}

/**
 * Transport-meny (mobil, nedre høyre) — ⋯-knapp som åpner en popover OPP fra
 * høyre hjørne. Et voksende sett lenker/funksjoner; v1: demp lyd, del, om Placy,
 * besøk nettside. Lukkes ved klikk utenfor / Escape / valg (unntatt mute).
 */
export function ReelsMenu() {
  const [open, setOpen] = useState(false);
  const { muted, toggleMuted } = useAudioElement();
  const { share } = useCopyShare();

  // Escape lukker. Klikk-utenfor håndteres av et backdrop (ikke en document-
  // listener) så lukke-tappet IKKE faller gjennom til reel-flaten (= utilsiktet
  // pause) eller transport-knappene under.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const items: MenuItem[] = [
    {
      key: "mute",
      label: muted ? "Slå på lyd" : "Demp lyd",
      icon: muted ? VolumeX : Volume2,
      onClick: toggleMuted,
      keepOpen: true,
    },
    {
      key: "share",
      label: "Del rapport",
      icon: Share2,
      onClick: () => void share(),
    },
    { key: "about", label: "Om Placy", icon: Info, href: PLACY_URL },
    { key: "web", label: "Besøk nettside", icon: ExternalLink, href: PLACY_URL },
  ];

  const itemClass =
    "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-white active:bg-white/10";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Meny"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative z-20 flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 text-white active:scale-95"
      >
        <MoreHorizontal size={20} />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Lukk meny"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-stone-900/95 shadow-2xl backdrop-blur-sm"
        >
          {items.map((it) => {
            const Icon = it.icon;
            const inner = (
              <>
                <Icon size={17} className="shrink-0 text-white/70" />
                <span className="flex-1">{it.label}</span>
              </>
            );
            return it.href ? (
              <a
                key={it.key}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                {inner}
              </a>
            ) : (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  it.onClick?.();
                  if (!it.keepOpen) setOpen(false);
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
