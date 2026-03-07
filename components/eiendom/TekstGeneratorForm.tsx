"use client";

import { useState } from "react";
import AddressAutocomplete from "@/components/inputs/AddressAutocomplete";
import type { AddressResult } from "@/components/inputs/AddressAutocomplete";
import { Loader2, Copy, Check, RefreshCw } from "lucide-react";

type TargetAudience = "family" | "young" | "senior";

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string; description: string }[] = [
  { value: "family", label: "Familie", description: "Skole, barnehage, park" },
  { value: "young", label: "Ung", description: "Cafe, bar, trening" },
  { value: "senior", label: "Senior", description: "Lege, apotek, park" },
];

export default function TekstGeneratorForm() {
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("family");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = selectedAddress && !loading;

  const handleGenerate = async () => {
    if (!selectedAddress) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/eiendom/tekst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
          address: selectedAddress.address,
          targetAudience,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Noe gikk galt");
        return;
      }

      setResult(data.text);
    } catch {
      setError("Kunne ikke generere tekst. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="space-y-6">
      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Adresse
        </label>
        <AddressAutocomplete
          onSelect={setSelectedAddress}
          placeholder="Skriv inn boligens adresse..."
        />
      </div>

      {/* Target audience */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Målgruppe
        </label>
        <div className="grid grid-cols-3 gap-3">
          {AUDIENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTargetAudience(opt.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                targetAudience === opt.value
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

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canSubmit}
        className="w-full py-3.5 px-6 rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Genererer tekst...
          </>
        ) : (
          "Generer beliggenhetstekst"
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-6 bg-gray-50">
            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
              {result}
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 bg-white">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  Kopiert
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Kopier til utklippstavle
                </>
              )}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors ml-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Generer på nytt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
