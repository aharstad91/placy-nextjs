import type { Metadata } from "next";
import localFont from "next/font/local";
import "./nyhavna-brand.css";

const unbounded = localFont({
  src: [
    { path: "../../../public/demo/nyhavna-nettside/unbounded-600.ttf", weight: "600" },
    { path: "../../../public/demo/nyhavna-nettside/unbounded-700.ttf", weight: "700" },
  ],
  variable: "--font-nyhavna-board",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/demo/nyhavna-nettside/symbol.svg" },
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
      <div className={`nyhavna-board ${unbounded.variable}`}>{children}</div>
    </>
  );
}
