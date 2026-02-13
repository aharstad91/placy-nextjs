import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Placy — Oppdag de beste stedene",
  description: "Oppdag de beste stedene i norske byer gjennom kuraterte guider og lokalkunnskap.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className="antialiased">{children}</body>
    </html>
  );
}
