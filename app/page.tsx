import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

/**
 * Minimal forside. Den gamle (public)-SEO-flaten (områdesider/steder/guides)
 * ble slettet ved cutover 2026-07-06 — Placy-flatene er embeds/boards per
 * kunde, ikke et frittstående nettsted.
 */

export const metadata: Metadata = {
  title: "Placy",
  description: "Interaktive nabolagskart for eiendom og opplevelser",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <MapPin className="w-12 h-12 text-gray-900 mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Placy</h1>
        <p className="text-gray-600 mb-8">
          Interaktive nabolagskart for eiendom og opplevelser.
        </p>
        <Link
          href="/eiendom/generer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          Lag nabolagskart
        </Link>
      </div>
    </div>
  );
}
