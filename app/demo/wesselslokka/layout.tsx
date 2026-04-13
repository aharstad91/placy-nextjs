import { Fraunces } from "next/font/google";
import Script from "next/script";
import WesselsloekaHeader from "./WesselsloekaHeader";
import WesselsloekaFooter from "./WesselsloekaFooter";
import "./wesselslokka.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--ws-font",
  axes: ["SOFT", "opsz"],
});

export const metadata = {
  title: "Wesselsløkka – Nabolagsrapport",
  description:
    "Utforsk nabolaget rundt Wesselsløkka – Norges grønneste nabolag på Brøset i Trondheim.",
};

export default function WesselsloekaDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`ws-theme ${fraunces.variable}`}>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
        rel="stylesheet"
      />
      <WesselsloekaHeader />
      <main>{children}</main>
      <WesselsloekaFooter />
      {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
        <Script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
          src="https://plausible.io/js/script.js"
          strategy="lazyOnload"
        />
      )}
    </div>
  );
}
