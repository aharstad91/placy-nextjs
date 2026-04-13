"use client";

import Image from "next/image";
import { useState } from "react";

const MENU_ITEMS = [
  { label: "Åpent infosenter", href: "https://www.wesselslokka.no/" },
  { label: "Finn din bolig", href: "https://www.wesselslokka.no/" },
  { label: "Om prosjektet", href: "https://www.wesselslokka.no/" },
  { label: "Prosjektstatus", href: "https://www.wesselslokka.no/" },
  { label: "Dokumenter", href: "https://www.wesselslokka.no/" },
  { label: "Området", href: "#" },
  { label: "Kart", href: "#" },
  { label: "Kontakt", href: "https://www.wesselslokka.no/" },
];

export default function WesselsloekaHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="ws-header">
      <div className="ws-header__inner">
        <a href="https://www.wesselslokka.no/" className="ws-header__logo" aria-label="Wesselsløkka — Norges grønneste nabolag">
          <Image
            src="/ws-demo/wesselslokka-script.webp"
            alt="Wesselsløkka"
            width={240}
            height={58}
            priority
            className="ws-header__wordmark"
          />
        </a>

        <nav className="ws-header__nav" aria-label="Hovedmeny">
          {MENU_ITEMS.map((item) => (
            <a key={item.label} href={item.href} className="ws-header__nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ws-header__actions">
          <a href="https://facebook.com/" aria-label="Facebook" className="ws-header__social">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.5H7.5v3.2h2.8V21h3.2z" />
            </svg>
          </a>
          <a href="https://instagram.com/" aria-label="Instagram" className="ws-header__social">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a
            href="https://www.wesselslokka.no/"
            className="ws-cta ws-cta--pink"
          >
            Meld interesse
          </a>
          <button
            type="button"
            className="ws-header__burger"
            onClick={() => setOpen((v) => !v)}
            aria-label="Meny"
            aria-expanded={open}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {open && (
        <nav className="ws-header__mobile-nav" aria-label="Mobilmeny">
          {MENU_ITEMS.map((item) => (
            <a key={item.label} href={item.href} className="ws-header__mobile-link">
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
