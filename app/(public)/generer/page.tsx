import type { Metadata } from "next";
import GenererForm from "@/components/generer/GenererForm";

export const metadata: Metadata = {
  title: "Lag nabolagskart | Placy",
  description: "Skriv inn en adresse og få et interaktivt nabolagskart",
  robots: { index: false, follow: false },
};

export default function GenererPage() {
  return <GenererForm />;
}
