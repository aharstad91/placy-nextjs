import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import TransitionProvider from "@/components/transitions/TransitionProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="no" className={`${inter.variable} ${newsreader.variable}`}>
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
