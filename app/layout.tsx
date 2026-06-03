import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import TransitionProvider from "@/components/transitions/TransitionProvider";
import "./globals.css";
import "@/components/variants/report/board/audio-tour/tour-mode.css";

// Figtree er Placys eneste typeface (variabel font, 300–900) — brukt for
// både UI/brødtekst og redaksjonelle overskrifter.
const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://placy.no"),
  title: "Placy — Oppdag de beste stedene",
  description: "Oppdag de beste stedene i norske byer gjennom kuraterte guider og lokalkunnskap.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" className={figtree.variable}>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
      </head>
      <body className="antialiased">
        <TransitionProvider>{children}</TransitionProvider>
      </body>
    </html>
  );
}
