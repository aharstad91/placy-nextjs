import type { Metadata } from "next";
import { MapPin } from "lucide-react";

/**
 * Brandet «kontor ikke funnet» (Unit 1, R15). Rendres når page.tsx kaller
 * notFound() for ukjent/inaktiv/rate-limited slug. Generisk tekst — lekker ikke
 * om slugen var ukjent vs. deaktivert (ingen rotasjons-orakel).
 */

export const metadata: Metadata = {
  title: "Kontor ikke funnet | Placy",
  robots: { index: false, follow: false },
};

export default function OfficeNotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Kontor ikke funnet</h1>
        <p className="text-gray-600">
          Denne kontor-lenken finnes ikke, eller er ikke lenger aktiv. Sjekk at du
          har hele lenken, eller ta kontakt med Placy for en oppdatert lenke.
        </p>
      </div>
    </div>
  );
}
