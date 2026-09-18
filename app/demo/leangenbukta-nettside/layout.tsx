import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/app/demo/leangenbukta-nettside/site-chrome";
import "@/app/demo/leangenbukta-nettside/original.css";
import "@/app/demo/leangenbukta-nettside/demo.css";

export const metadata: Metadata = {
  title: "Leangenbukta",
  robots: { index: false, follow: false },
  icons: { icon: "/demo/leangenbukta-nettside/Leangenbukta_brown_01-270fa8.svg" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // Demoen er en lokal kopi av kundens nettsted og skal aldri serves i prod.
  if (process.env.NODE_ENV === "production") notFound();

  return <SiteChrome>{children}</SiteChrome>;
}
