import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Placy - Lokasjonsbasert storytelling",
  description: "Oppdag nabolag gjennom kuraterte historier og lokalkunnskap",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
