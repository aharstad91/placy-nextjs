"use client";

import { useEffect, useRef, useState } from "react";
import AddressAutocomplete from "@/components/inputs/AddressAutocomplete";
import type { AddressResult } from "@/components/inputs/AddressAutocomplete";
import { slugify } from "@/lib/utils/slugify";
import { CheckCircle, Loader2, Sparkles, XCircle } from "lucide-react";

/**
 * Kanonisk provisjon-inngang (PRD 12 Unit 4) — adresse + profil/nivå-valg,
 * INGEN Mapbox-radius-UI (2D-kart-avhengigheten er droppet; radius eies av
 * pipeline-defaults per by). Trigger POST /api/admin/provision
 * (fire-and-poll) og poller jobb-status til completed/failed.
 */

interface GenerateClientProps {
  customers: { id: string; name: string }[];
}

interface JobState {
  id: string;
  url: string;
  status: "pending" | "completed" | "failed" | "timeout";
  resultUrl?: string | null;
  errorMessage?: string | null;
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

const NEW_CUSTOMER = "__new__";

export function GenerateClient({ customers }: GenerateClientProps) {
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [name, setName] = useState("");
  const [customerChoice, setCustomerChoice] = useState(customers[0]?.id ?? NEW_CUSTOMER);
  const [newCustomerSlug, setNewCustomerSlug] = useState("");
  const [profile, setProfile] = useState<"bolig" | "naering">("bolig");
  const [reportTier, setReportTier] = useState<1 | 2>(1);
  const [has3dAddon, setHas3dAddon] = useState(false);
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollStop = useRef(false);

  const customerSlug =
    customerChoice === NEW_CUSTOMER ? slugify(newCustomerSlug) : customerChoice;
  const canSubmit = selectedAddress && customerSlug.length >= 2 && !submitting;

  useEffect(() => {
    if (!job || job.status !== "pending") return;
    pollStop.current = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (pollStop.current) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setJob((j) => (j ? { ...j, status: "timeout" } : j));
        return;
      }
      try {
        const res = await fetch(`/api/generation-requests?id=${job.id}`);
        if (res.ok) {
          const data: {
            status: string;
            resultUrl: string | null;
            errorMessage: string | null;
          } = await res.json();
          if (data.status === "completed" || data.status === "failed") {
            setJob((j) =>
              j
                ? {
                    ...j,
                    status: data.status as JobState["status"],
                    resultUrl: data.resultUrl,
                    errorMessage: data.errorMessage,
                  }
                : j
            );
            return;
          }
        }
      } catch {
        // nettverksglipp under polling — prøv igjen neste tick
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    const timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      pollStop.current = true;
      clearTimeout(timer);
    };
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress || !customerSlug) return;

    setSubmitting(true);
    setError(null);
    setJob(null);

    try {
      const res = await fetch("/api/admin/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: selectedAddress.address,
          ...(name.trim() ? { name: name.trim() } : {}),
          customer: customerSlug,
          profile,
          reportTier,
          has3dAddon,
          allowUpdate,
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
          city: selectedAddress.city,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Noe gikk galt");
        return;
      }
      setJob({ id: data.id, url: data.url, status: "pending" });
    } catch {
      setError("Kunne ikke starte provisjon. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          Generator
        </h1>
        <p className="text-gray-600 mt-1">
          Provisjonér et rapport-board fra adresse — samme pipeline-kjerne som CLI-en
          (geocode → POI-discovery → trust → hydrering → editorial-arv).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
          <AddressAutocomplete
            onSelect={setSelectedAddress}
            placeholder="Skriv inn prosjektets adresse..."
          />
          {selectedAddress && (
            <p className="mt-1.5 text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {selectedAddress.address}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
            Prosjektnavn{" "}
            <span className="font-normal text-gray-400">(valgfritt — default adressen)</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              selectedAddress ? selectedAddress.address.split(",")[0] : "F.eks. Solsiden Terrasse"
            }
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1.5">
            Kunde
          </label>
          <select
            id="customer"
            value={customerChoice}
            onChange={(e) => setCustomerChoice(e.target.value)}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
            <option value={NEW_CUSTOMER}>+ Ny kunde…</option>
          </select>
          {customerChoice === NEW_CUSTOMER && (
            <input
              type="text"
              value={newCustomerSlug}
              onChange={(e) => setNewCustomerSlug(e.target.value)}
              placeholder="ny-kunde-slug (kebab-case)"
              className="mt-2 w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Profil</label>
            <div className="flex gap-2">
              {(["bolig", "naering"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProfile(p)}
                  className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    profile === p
                      ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900 text-gray-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p === "bolig" ? "Bolig" : "Næring"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nivå</label>
            <div className="flex gap-2">
              {([1, 2] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReportTier(t)}
                  className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    reportTier === t
                      ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900 text-gray-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  Nivå {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              checked={has3dAddon}
              onChange={(e) => setHas3dAddon(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            3D-addon
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowUpdate}
              onChange={(e) => setAllowUpdate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            Oppdater eksisterende prosjekt
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3.5 px-6 rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starter…
            </>
          ) : (
            "Provisjonér rapport-board"
          )}
        </button>
      </form>

      {job && (
        <div className="mt-8 bg-gray-50 rounded-xl p-6">
          {job.status === "pending" && (
            <div className="flex items-center gap-3 text-gray-700">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <div>
                <p className="font-medium">Pipelinen kjører…</p>
                <p className="text-sm text-gray-500">
                  Geocode → POI-discovery → trust → hydrering → editorial. Tar typisk
                  noen minutter.
                </p>
              </div>
            </div>
          )}
          {job.status === "completed" && (
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Board provisjonert</p>
                <a
                  href={job.resultUrl ?? job.url}
                  className="text-sm font-mono text-emerald-700 hover:underline break-all"
                >
                  {job.resultUrl ?? job.url}
                </a>
              </div>
            </div>
          )}
          {job.status === "failed" && (
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Provisjon feilet</p>
                <p className="text-sm text-red-600">{job.errorMessage ?? "Ukjent feil"}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Se Requests-fanen for retry når feilen er rettet.
                </p>
              </div>
            </div>
          )}
          {job.status === "timeout" && (
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Tar lengre tid enn vanlig</p>
                <p className="text-sm text-gray-500">
                  Jobben kjører fortsatt — sjekk status i Requests-fanen.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
