import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/app/demo/nyhavna-nettside/header";
import { SiteChatVoiceBridge } from "@/components/demo/site-chat-voice-bridge";
import { nhChatEnabled, nhChatVoiceEnabled } from "@/lib/demo/nyhavna-chat/access";
import { NH_BOARD_HREF } from "@/lib/demo/nyhavna-chat/links";
import {
  NH_CHAT_VOICE_CONTINUED_GREETING, NH_CHAT_VOICE_DATASET, NH_CHAT_VOICE_GREETING,
} from "@/lib/demo/nyhavna-chat/voice";
import "@/app/demo/nyhavna-nettside/original.css";
import "@/app/demo/nyhavna-nettside/demo.css";

const unbounded = localFont({
  src: [
    {
      path: "../../../public/brand-fonts/unbounded-400.ttf",
      weight: "400",
    },
    {
      path: "../../../public/brand-fonts/unbounded-600.ttf",
      weight: "600",
    },
    {
      path: "../../../public/brand-fonts/unbounded-700.ttf",
      weight: "700",
    },
  ],
  variable: "--font-nyhavna",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/demo/nyhavna-nettside/symbol.svg" },
};

/**
 * Chatboksen (2026-09-24) er den samme widgeten og den samme talebroen som
 * Leangenbukta-kopien bruker, med Nyhavnas endepunkt, datasett og farger.
 * Den vises bare der chatten finnes: på en utviklingsserver, eller i et bygg
 * der `PLACY_NH_CHAT_ENABLED` og signeringsnøkkelen er satt
 * (`lib/demo/nyhavna-chat/access.ts`). Talebroen monteres bare der stemmen kan
 * startes; ellers får widgeten ingen «Snakk» og er ren tekstchat.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const chat = nhChatEnabled();
  const voice = chat && (process.env.NODE_ENV !== "production" || nhChatVoiceEnabled());
  return (
    <div className={`nyhavna-site ${unbounded.variable}`}>
      <a className="demo-skip" href="#main-content">
        Gå til hovedinnholdet
      </a>
      <Header />
      {children}
      <footer className="demo-footer site-width" id="kontakt">
        <a className="demo-wordmark" href="/demo/nyhavna-nettside">
          Nyhavna
        </a>
        <p>
          Kobbes gt. 2, 6. etg
          <br />
          7042 Trondheim
          <br />
          <a href="mailto:post@nyhavna.no">post@nyhavna.no</a>
        </p>
        <nav aria-label="Bunnmeny">
          <a href="https://nyhavna.no/om-selskapet/">Om selskapet</a>
          <a href="https://nyhavna.no/om-selskapet/baerekraft/">Bærekraft</a>
          <a href="https://nyhavna.no/personvern/">Personvern</a>
        </nav>
      </footer>
      {voice ? (
        <SiteChatVoiceBridge
          dataset={NH_CHAT_VOICE_DATASET}
          greeting={NH_CHAT_VOICE_GREETING}
          continuedGreeting={NH_CHAT_VOICE_CONTINUED_GREETING}
        />
      ) : null}
      {chat ? (
        // Samme innbyggingskode som på Leangenbukta; siden brukeren står på
        // leses fra `data-placy-page-id` på hver side.
        <script
          src="/embed/placy-chat.js"
          defer
          data-endpoint="/api/demo/nyhavna-chat"
          data-page-id="forside"
          data-label="Spør om Nyhavna"
          data-board-href={NH_BOARD_HREF}
          data-offset-bottom="20px"
          data-accent="#005ef5"
          data-accent-dark="#0046ba"
          data-border="#cfd3dc"
          data-surface="#f7f5eb"
          data-soft="#eef3fb"
          data-soft-border="#dbe4f3"
          data-muted="#4f5261"
        />
      ) : null}
    </div>
  );
}
