import type { Metadata } from "next";
import Script from "next/script";
import { PLACY_BOARD } from "@/app/demo/leangenbukta-nettside/placy-row";
import { SiteChrome } from "@/app/demo/leangenbukta-nettside/site-chrome";
import "@/app/demo/leangenbukta-nettside/original.css";
import "@/app/demo/leangenbukta-nettside/pages.css";
import "@/app/demo/leangenbukta-nettside/demo.css";

export const metadata: Metadata = {
  title: "Leangenbukta",
  robots: { index: false, follow: false },
  icons: { icon: "/demo/leangenbukta-nettside/Leangenbukta_brown_01-270fa8.svg" },
};

/**
 * Kopien av kundens nettsted vises bare med demotilgang. Gaten er proxyen
 * (`proxy.ts` → lib/demo/leangenbukta-site/access.ts), som kjører foran hver
 * side- og RSC-forespørsel: uten gyldig cookie gir et konfigurert miljø
 * innlogging og et ukonfigurert 404. Sidene selv er statiske — fragmentene
 * leses ved bygging — og derfor kaller ikke layouten `headers()`.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteChrome>{children}</SiteChrome>
      {/* Tekstchatten lastes med den samme innbyggingskoden en WordPress-side
          ville brukt: ett skript og data-attributter. Siden brukeren står på
          leses fra `data-placy-page-id` på hver side. */}
      <Script
        src="/embed/placy-chat.js"
        strategy="afterInteractive"
        data-endpoint="/api/demo/leangenbukta-chat"
        data-page-id="forside"
        data-label="Spør om Leangenbukta"
        data-board-href={PLACY_BOARD}
      />
    </>
  );
}
