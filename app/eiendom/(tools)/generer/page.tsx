import type { Metadata } from "next";
import GenererClient from "./generer-client";

export const metadata: Metadata = {
  title: "Lag nabolagskart | Placy",
  description: "Bestill et interaktivt nabolagskart for boligen du selger — 999 kr",
  robots: { index: false, follow: false },
};

export default function EiendomGenererPage() {
  return <GenererClient />;
}
