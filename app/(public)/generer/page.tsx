import type { Metadata } from "next";
import GenererClient from "./generer-client";

export const metadata: Metadata = {
  title: "Lag nabolagskart | Placy",
  description: "Skriv inn en adresse og få et interaktivt nabolagskart",
  robots: { index: false, follow: false },
};

export default function GenererPage() {
  return <GenererClient />;
}
