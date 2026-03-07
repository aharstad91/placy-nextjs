"use client";

import { useState } from "react";
import AddressAutocomplete from "@/components/inputs/AddressAutocomplete";
import type { AddressResult } from "@/components/inputs/AddressAutocomplete";
import { slugify } from "@/lib/utils/slugify";
import { MapPin, CheckCircle, Loader2 } from "lucide-react";

type HousingType = "family" | "young" | "senior";

const HOUSING_OPTIONS: { value: HousingType; label: string; description: string }[] = [
  { value: "family", label: "Familie", description: "Skole, barnehage, lekeplass, idrett" },
  { value: "young", label: "Ung / Førstegangskjøper", description: "Cafe, bar, trening, kollektiv" },
  { value: "senior", label: "Senior", description: "Lege, apotek, dagligvare, park" },
];

export default function GenererClient() {
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [housingType, setHousingType] = useState<HousingType>("family");
  const [email, setEmail] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ slug: string; url: string; existing?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = selectedAddress && email && brokerage && consent && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress || !email || !brokerage || !consent) return;

    setSubmitting(true);
    setError(null);

    try {
      const slug = slugify(selectedAddress.address.split(",")[0]);

      const res = await fetch("/api/generation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: selectedAddress.address,
          email,
          housingType,
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
          city: selectedAddress.city,
          slug,
          consentGiven: true,
          brokerage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Noe gikk galt");
        return;
      }

      setResult(data);
    } catch {
      setError("Kunne ikke sende forespørsel. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation view
  if (result) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {result.existing ? "Kart allerede forespurt" : "Forespørsel mottatt!"}
          </h1>
          <p className="text-gray-600 mb-6">
            {result.existing
              ? "Denne adressen har allerede et kart under generering."
              : "Nabolagskartet genereres. Det tar vanligvis 5-10 minutter."}
          </p>
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <p className="text-sm text-gray-500 mb-2">Kartet vil være tilgjengelig på:</p>
            <a
              href={result.url}
              className="text-lg font-mono font-semibold text-gray-900 hover:text-emerald-600 transition-colors break-all"
            >
              placy.no{result.url}
            </a>
          </div>
          <p className="text-sm text-gray-500">
            Bokmerke denne lenken — du kan sjekke statusen når som helst.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Lag nabolagskart</h1>
          <p className="text-gray-600">
            Skriv inn adressen til boligen du selger, og vi genererer et interaktivt nabolagskart du kan dele med kjøpere.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse
            </label>
            <AddressAutocomplete
              onSelect={setSelectedAddress}
              placeholder="Skriv inn boligens adresse..."
            />
            {selectedAddress && (
              <p className="mt-1.5 text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {selectedAddress.address}
              </p>
            )}
          </div>

          {/* Brokerage */}
          <div>
            <label htmlFor="brokerage" className="block text-sm font-medium text-gray-700 mb-1.5">
              Meglerkontor
            </label>
            <input
              id="brokerage"
              type="text"
              value={brokerage}
              onChange={(e) => setBrokerage(e.target.value)}
              placeholder="F.eks. Eiendomsmegler Krogsveen"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {/* Housing type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Boligtype
            </label>
            <div className="grid grid-cols-3 gap-3">
              {HOUSING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setHousingType(opt.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    housingType === opt.value
                      ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900 block">
                    {opt.label}
                  </span>
                  <span className="text-xs text-gray-500 block mt-0.5">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              E-postadresse
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@epost.no"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-600">
              Jeg godtar at e-postadressen min lagres for å motta varsling når kartet er klart.
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 px-6 rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sender...
              </>
            ) : (
              "Lag nabolagskart"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
