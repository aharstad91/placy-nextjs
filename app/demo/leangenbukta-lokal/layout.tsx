import type { Metadata } from "next";
import localFont from "next/font/local";
import "./leangenbukta-brand.css";

/**
 * Overskriftsfonten fra leangenbukta.no.
 *
 * Nettsidekopien setter Mukta på h1–h6 og Open Sans på brødtekst
 * (`app/demo/leangenbukta-nettside/original.css`). Filene her er de latinske
 * delsettene (`unicode-range: U+0000-00FF`) av Muktas 500 og 800 — de dekker æ,
 * ø og å. De øvrige delsettene i kopien er devanagari og latin-ext, som denne
 * flaten ikke bruker.
 */
const mukta = localFont({
  src: [
    { path: "../../../public/brand-fonts/mukta-500.woff2", weight: "500" },
    { path: "../../../public/brand-fonts/mukta-800.woff2", weight: "800" },
  ],
  variable: "--font-leangenbukta-board",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/demo/leangenbukta-lokal/leangenbukta-logo.svg" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mapbox-stilarket, som de andre board-rutene (`app/eiendom/layout.tsx`)
          laster. Uten det ligger 2D-kartets markører ustilt i dokumentflyten
          under lerretet i stedet for på kartet (funnet 2026-09-14). */}
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
        rel="stylesheet"
      />
      <div className={`leangenbukta-board ${mukta.variable}`}>{children}</div>
    </>
  );
}
