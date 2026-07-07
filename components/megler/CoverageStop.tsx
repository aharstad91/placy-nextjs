"use client";

import { useState } from "react";
import { MapPin, Bell, CheckCircle, Loader2 } from "lucide-react";

/**
 * Geofence-stopp (R5/R17): høflig avvisning når adressen ligger utenfor kuratert
 * dekning. Delt mellom kontor-siden (OfficeGenererForm) og den åpne siden
 * (GenererForm) — samme tone, ett vedlikeholdssted.
 *
 * Avvisningen er ikke en blindvei: megleren kan be om varsel når stedet dekkes.
 * `onNotify` re-poster mot API-et med notifyWhenCovered=true (den EKSPLISITTE
 * andre opt-in-en — POST-samtykket gjaldt board-varsling, ikke dekningsvarsel);
 * e-posten lagres i coverage_demand først da (PII-grensen, Unit 2).
 */

interface CoverageStopProps {
  /** Stedet vi ikke dekker — vist i «varsle meg når <place> dekkes». */
  place: string;
  /** Navn på kuraterte strøk vi faktisk dekker. */
  coveredAreas: string[];
  /** Allerede innsamlet e-post (vises i opt-in-etiketten). */
  email: string;
  /** Re-poster med notifyWhenCovered=true; kaster ved feil. */
  onNotify: () => Promise<void>;
}

export default function CoverageStop({
  place,
  coveredAreas,
  email,
  onNotify,
}: CoverageStopProps) {
  const [notifyState, setNotifyState] = useState<
    "idle" | "sending" | "done" | "error"
  >("idle");

  const handleNotify = async () => {
    setNotifyState("sending");
    try {
      await onNotify();
      setNotifyState("done");
    } catch {
      setNotifyState("error");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Vi dekker ikke {place} ennå
        </h1>
        <p className="text-gray-600 mb-6">
          Placy lager nabolagskart for områder vi kjenner redaksjonelt. {place}{" "}
          er ikke kartlagt ennå — vi vil heller vente enn å levere et kart uten
          lokalkunnskapen som gjør det verdt å dele.
        </p>

        {coveredAreas.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Områder vi dekker i dag:
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">
              {coveredAreas.join(", ")}
            </p>
          </div>
        )}

        {notifyState === "done" ? (
          <p className="text-sm text-emerald-600 flex items-center justify-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            Takk! Vi gir deg beskjed på {email} når {place} er dekket.
          </p>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleNotify}
              disabled={notifyState === "sending"}
              className="w-full py-3 px-6 rounded-lg font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {notifyState === "sending" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sender...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Varsle meg når {place} dekkes
                </>
              )}
            </button>
            {notifyState === "error" && (
              <p className="text-sm text-red-600">
                Kunne ikke registrere varselet. Prøv igjen.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
