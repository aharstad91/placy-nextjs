"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Search, Menu, X } from "lucide-react";

const base = "/demo/nyhavna-nettside";
const links = [
  ["Leve", "https://nyhavna.no/leve/"],
  ["Bo", "https://nyhavna.no/bo/"],
  ["Beliggenhet", `${base}/beliggenhet`],
  ["Jobbe", "https://nyhavna.no/jobbe/"],
  ["Hva skjer", "https://nyhavna.no/hva-skjer/"],
  ["Aktuelt", "https://nyhavna.no/aktuelt/"],
  ["Historien", "https://nyhavna.no/historien/"],
  ["Om selskapet", "https://nyhavna.no/om-selskapet/"],
];

export function Header() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<"menu" | "search" | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="demo-header"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          (panel === "menu" ? menuButton : searchButton).current?.focus();
          setPanel(null);
        }
      }}
    >
      <div className="demo-header-inner">
        <a
          className="demo-wordmark"
          href={base}
          data-no-transition
          aria-label="Nyhavna – forsiden"
        >
          {pathname !== base && (
            <Image className="demo-header-symbol" src={`${base}/symbol.svg`} width={32} height={30} alt="" />
          )}
          Nyhavna
        </a>
        <nav
          id="nyhavna-menu"
          className={`demo-nav ${panel === "menu" ? "is-open" : ""}`}
          aria-label="Hovedmeny"
        >
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              data-no-transition
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setPanel(null)}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          ref={searchButton}
          className="demo-icon-button"
          aria-label={panel === "search" ? "Lukk søk" : "Søk"}
          aria-expanded={panel === "search"}
          aria-controls="nyhavna-search"
          onClick={() => setPanel(panel === "search" ? null : "search")}
        >
          {panel === "search" ? <X /> : <Search />}
        </button>
        <button
          ref={menuButton}
          className="demo-icon-button demo-menu-button"
          aria-label={panel === "menu" ? "Lukk meny" : "Åpne meny"}
          aria-expanded={panel === "menu"}
          aria-controls="nyhavna-menu"
          onClick={() => setPanel(panel === "menu" ? null : "menu")}
        >
          {panel === "menu" ? <X /> : <Menu />}
        </button>
      </div>
      {panel === "search" && (
        <form
          id="nyhavna-search"
          className="demo-search site-width"
          action="https://nyhavna.no/soek/"
        >
          <label htmlFor="nyhavna-query">Søk på Nyhavna</label>
          <div>
            <input
              id="nyhavna-query"
              name="search"
              type="search"
              placeholder="Søkeord"
              required
              autoFocus
            />
            <button className="btn" type="submit">
              Søk
            </button>
          </div>
        </form>
      )}
    </header>
  );
}
