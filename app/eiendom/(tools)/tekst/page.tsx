import type { Metadata } from "next";
import TekstGeneratorForm from "@/components/eiendom/TekstGeneratorForm";
import { eiendomGenererUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Beliggenhetstekst-generator for meglere — Placy",
  description: "Generer profesjonell beliggenhetstekst med konkrete stedsnavn og avstander. Gratis.",
};

export default function TekstPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Beliggenhetstekst-generator
          </h1>
          <p className="text-gray-600">
            Skriv inn adressen, velg målgruppe, og få en ferdig beliggenhetstekst
            med konkrete stedsnavn og gangavstander.
          </p>
        </div>

        <TekstGeneratorForm />

        <div className="mt-12 text-center border-t border-gray-100 pt-8">
          <p className="text-sm text-gray-500 mb-3">
            Vil du ha interaktivt kart og rapport?
          </p>
          <a
            href={eiendomGenererUrl()}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Bestill nabolagskart — 999 kr
          </a>
        </div>
      </div>
    </div>
  );
}
