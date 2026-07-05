"use client";

import { useEffect, useRef, useState } from "react";
import AddressAutocomplete from "@/components/inputs/AddressAutocomplete";
import type { AddressResult } from "@/components/inputs/AddressAutocomplete";
import { MapPin, CheckCircle, Loader2 } from "lucide-react";

/**
 * DEN ene self-serve-formen (PRD 3 Unit 8) — adaptiv: meglerkontor er
 * VALGFRITT (uten → boardet havner under reservert `intern`-kunde).
 * Boligtype-velgeren (family/young/senior) er død — pipelinen bruker
 * profil (bolig-default) og rapport-temamodellen.
 *
 * Async-kontrakt: POST svarer pending + id umiddelbart; formen poller
 * GET ?id= til completed/failed (pipelinen kjører in-process på serveren).
 */

interface SubmitResult {
  id: string;
  slug: string;
  url: string;
  status: string;
  existing?: boolean;
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000; // litt over serverens maxDuration

export default function GenererForm() {
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [email, setEmail] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollStop = useRef(false);

  const canSubmit = selectedAddress && email && consent && !submitting;

  // Poll status til completed/failed (eller timeout → e-post-fallback-tekst)
  useEffect(() => {
    if (!result || result.status !== "pending") return;
    pollStop.current = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (pollStop.current) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setLiveStatus("timeout");
        return;
      }
      try {
        const res = await fetch(`/api/generation-requests?id=${result.id}`);
        if (res.ok) {
          const data: { status: string; resultUrl: string | null } = await res.json();
          if (data.status === "completed" || data.status === "failed") {
            setLiveStatus(data.status);
            if (data.resultUrl) setResultUrl(data.resultUrl);
            return;
          }
        }
      } catch {
        // nettverksglipp under polling er ufarlig — prøv igjen neste tick
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    const timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      pollStop.current = true;
      clearTimeout(timer);
    };
  }, [result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress || !email || !consent) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/generation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: selectedAddress.address,
          email,
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
          city: selectedAddress.city,
          consentGiven: true,
          ...(brokerage.trim() ? { brokerage: brokerage.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Noe gikk galt");
        return;
      }

      setResult(data);
      if (data.status && data.status !== "pending") setLiveStatus(data.status);
      if (data.url && data.status === "completed") setResultUrl(data.url);
    } catch {
      setError("Kunne ikke sende forespørsel. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation view med live status
  if (result) {
    const done = liveStatus === "completed";
    const failed = liveStatus === "failed";
    const timedOut = liveStatus === "timeout";
    const displayUrl = resultUrl ?? result.url;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          {done ? (
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          ) : failed ? (
            <MapPin className="w-16 h-16 text-red-400 mx-auto mb-6" />
          ) : (
            <Loader2 className="w-16 h-16 text-gray-400 mx-auto mb-6 animate-spin" />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {result.existing
              ? "Kart allerede forespurt"
              : done
                ? "Nabolagskartet er klart!"
                : failed
                  ? "Genereringen feilet"
                  : "Forespørsel mottatt!"}
          </h1>
          <p className="text-gray-600 mb-6">
            {failed
              ? "Noe gikk galt under genereringen. Vi har registrert feilen — prøv gjerne igjen senere."
              : done
                ? "Kartet er generert og klart til å deles."
                : timedOut
                  ? "Genereringen tar lengre tid enn vanlig. Du får en e-post når kartet er klart."
                  : result.existing
                    ? "Denne adressen har allerede et kart under generering."
                    : "Nabolagskartet genereres — dette tar vanligvis noen minutter. Du kan vente her, eller lukke siden og få lenken på e-post."}
          </p>
          {!failed && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <p className="text-sm text-gray-500 mb-2">
                {done ? "Kartet er tilgjengelig på:" : "Kartet vil være tilgjengelig på:"}
              </p>
              <a
                href={displayUrl}
                className="text-lg font-mono font-semibold text-gray-900 hover:text-emerald-600 transition-colors break-all"
              >
                placy.no{displayUrl}
              </a>
            </div>
          )}
          {!done && !failed && (
            <p className="text-sm text-gray-500">
              Bokmerke denne lenken — du kan sjekke statusen når som helst.
            </p>
          )}
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
            Skriv inn adressen til boligen du selger, og vi genererer et interaktivt
            nabolagskart du kan dele med kjøpere.
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

          {/* Brokerage (valgfritt) */}
          <div>
            <label htmlFor="brokerage" className="block text-sm font-medium text-gray-700 mb-1.5">
              Meglerkontor{" "}
              <span className="font-normal text-gray-400">(valgfritt)</span>
            </label>
            <input
              id="brokerage"
              type="text"
              value={brokerage}
              onChange={(e) => setBrokerage(e.target.value)}
              placeholder="F.eks. Eiendomsmegler Krogsveen"
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
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
              Jeg godtar at e-postadressen min lagres for å motta varsling når kartet
              er klart.
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
