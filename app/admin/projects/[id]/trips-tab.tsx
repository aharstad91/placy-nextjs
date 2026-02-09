"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Route,
  Plus,
  X,
  Trash2,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin";
import type { Trip, ProjectTrip } from "@/lib/types";
import type { ProjectWithRelations } from "./page";

interface TripsTabProps {
  project: ProjectWithRelations;
  projectTrips: ProjectTrip[];
  allTrips: Trip[];
  linkTripToProject: (formData: FormData) => Promise<void>;
  unlinkTripFromProject: (formData: FormData) => Promise<void>;
  updateProjectTripOverride: (formData: FormData) => Promise<void>;
}

export function TripsTab({
  project,
  projectTrips,
  allTrips,
  linkTripToProject,
  unlinkTripFromProject,
  updateProjectTripOverride,
}: TripsTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<ProjectTrip | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // IDs of trips already linked to this project
  const linkedTripIds = useMemo(
    () => new Set(projectTrips.map((pt) => pt.trip.id)),
    [projectTrips]
  );

  // Available trips (not yet linked), filtered by search
  const availableTrips = useMemo(() => {
    const unlinked = allTrips.filter((t) => !linkedTripIds.has(t.id));
    if (!searchQuery.trim()) return unlinked;
    const q = searchQuery.toLowerCase();
    return unlinked.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }, [allTrips, linkedTripIds, searchQuery]);

  // Geo-based suggestions: trips in the same city as the project
  const geoSuggestions = useMemo(() => {
    // Use the project name to find matching city trips
    // Also check if any linked trips share a city, and suggest others from those cities
    const projectCities = new Set<string>();

    // Add cities from already linked trips
    for (const pt of projectTrips) {
      projectCities.add(pt.trip.city.toLowerCase());
    }

    return allTrips.filter(
      (t) =>
        !linkedTripIds.has(t.id) &&
        projectCities.has(t.city.toLowerCase())
    );
  }, [allTrips, linkedTripIds, projectTrips]);

  const handleLinkTrip = async (tripId: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("shortId", project.short_id);
      formData.set("tripId", tripId);
      await linkTripToProject(formData);
      setSuccess("Trip koblet til prosjektet");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke koble trip");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkTrip = async () => {
    if (!unlinkTarget) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("shortId", project.short_id);
      formData.set("tripId", unlinkTarget.trip.id);
      await unlinkTripFromProject(formData);
      setUnlinkTarget(null);
      setExpandedTripId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke fjerne trip");
      setUnlinkTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOverride = async (
    overrideId: string,
    fields: Record<string, string>
  ) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("overrideId", overrideId);
      formData.set("shortId", project.short_id);
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value);
      }
      await updateProjectTripOverride(formData);
      setSuccess("Overrides lagret");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre overrides");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty state
  if (projectTrips.length === 0 && !isAddModalOpen) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Route className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ingen trips koblet
        </h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Koble trips fra Trip Library til dette prosjektet. Du kan tilpasse
          startpunkt, belønning og velkomsttekst per prosjekt.
        </p>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-amber-500/25 transition-all mx-auto"
        >
          <Plus className="w-4 h-4" /> Koble trip
        </button>

        {/* Add Trip Modal */}
        {isAddModalOpen && (
          <AddTripModal
            availableTrips={availableTrips}
            geoSuggestions={geoSuggestions}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onLink={handleLinkTrip}
            onClose={() => {
              setIsAddModalOpen(false);
              setSearchQuery("");
            }}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl text-sm">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {projectTrips.length} trip{projectTrips.length !== 1 && "s"} koblet
        </p>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-amber-500/25 transition-all"
        >
          <Plus className="w-4 h-4" /> Koble trip
        </button>
      </div>

      {/* Linked trips list */}
      <div className="space-y-3">
        {projectTrips.map((pt) => {
          const isExpanded = expandedTripId === pt.trip.id;
          return (
            <LinkedTripCard
              key={pt.trip.id}
              projectTrip={pt}
              customerSlug={project.customer_id}
              projectSlug={project.url_slug}
              isExpanded={isExpanded}
              onToggle={() =>
                setExpandedTripId(isExpanded ? null : pt.trip.id)
              }
              onUnlink={() => setUnlinkTarget(pt)}
              onSaveOverride={handleSaveOverride}
              isSubmitting={isSubmitting}
            />
          );
        })}
      </div>

      {/* Add Trip Modal */}
      {isAddModalOpen && (
        <AddTripModal
          availableTrips={availableTrips}
          geoSuggestions={geoSuggestions}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onLink={handleLinkTrip}
          onClose={() => {
            setIsAddModalOpen(false);
            setSearchQuery("");
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Unlink Confirmation */}
      <ConfirmDialog
        isOpen={!!unlinkTarget}
        title="Fjern trip fra prosjekt"
        message={`Er du sikker på at du vil fjerne "${unlinkTarget?.trip.title}" fra dette prosjektet? Trippen slettes ikke fra biblioteket.`}
        confirmLabel="Fjern"
        variant="danger"
        onConfirm={handleUnlinkTrip}
        onCancel={() => setUnlinkTarget(null)}
      />
    </div>
  );
}

// ============ ADD TRIP MODAL ============

interface AddTripModalProps {
  availableTrips: Trip[];
  geoSuggestions: Trip[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLink: (tripId: string) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

function AddTripModal({
  availableTrips,
  geoSuggestions,
  searchQuery,
  setSearchQuery,
  onLink,
  onClose,
  isSubmitting,
}: AddTripModalProps) {
  const showSuggestions = !searchQuery.trim() && geoSuggestions.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Koble trip til prosjekt
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {availableTrips.length} tilgjengelige trips
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter trip (tittel, by, kategori)..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all placeholder:text-gray-400"
              autoFocus
            />
          </div>
        </div>

        {/* Trip list */}
        <div className="flex-1 overflow-y-auto px-6">
          {/* Geo suggestions section */}
          {showSuggestions && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Foreslått (samme by)
              </h3>
              <div className="space-y-1">
                {geoSuggestions.map((trip) => (
                  <TripListItem
                    key={trip.id}
                    trip={trip}
                    onLink={onLink}
                    isSubmitting={isSubmitting}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All available trips */}
          <div>
            {showSuggestions && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Alle trips
              </h3>
            )}
            {availableTrips.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {searchQuery
                  ? "Ingen trips matcher søket"
                  : "Alle trips er allerede koblet"}
              </p>
            ) : (
              <div className="space-y-1">
                {availableTrips.map((trip) => (
                  <TripListItem
                    key={trip.id}
                    trip={trip}
                    onLink={onLink}
                    isSubmitting={isSubmitting}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ TRIP LIST ITEM (for add modal) ============

function TripListItem({
  trip,
  onLink,
  isSubmitting,
}: {
  trip: Trip;
  onLink: (tripId: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [linking, setLinking] = useState(false);

  const handleClick = async () => {
    setLinking(true);
    await onLink(trip.id);
    setLinking(false);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
        <Route className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {trip.title}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{trip.city}</span>
          {trip.category && (
            <>
              <span className="text-gray-300">&middot;</span>
              <span>{trip.category}</span>
            </>
          )}
          {trip.stopCount > 0 && (
            <>
              <span className="text-gray-300">&middot;</span>
              <span>{trip.stopCount} stopp</span>
            </>
          )}
          {!trip.published && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
              Utkast
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={isSubmitting || linking}
        className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
      >
        {linking ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
        Koble
      </button>
    </div>
  );
}

// ============ LINKED TRIP CARD ============

interface LinkedTripCardProps {
  projectTrip: ProjectTrip;
  customerSlug: string | null;
  projectSlug: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUnlink: () => void;
  onSaveOverride: (
    overrideId: string,
    fields: Record<string, string>
  ) => Promise<void>;
  isSubmitting: boolean;
}

function LinkedTripCard({
  projectTrip,
  customerSlug,
  projectSlug,
  isExpanded,
  onToggle,
  onUnlink,
  onSaveOverride,
  isSubmitting,
}: LinkedTripCardProps) {
  const { trip, override } = projectTrip;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="text-gray-400">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Route className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {trip.title}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span>{trip.city}</span>
              {trip.category && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <span className="capitalize">{trip.category}</span>
                </>
              )}
              {trip.stopCount > 0 && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <span>{trip.stopCount} stopp</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {override.enabled ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" /> Aktiv
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> Deaktivert
              </span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1 pr-3">
          {customerSlug && (
            <a
              href={`/${customerSlug}/${projectSlug}/trips/${trip.urlSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Åpne B2B-tur"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onUnlink}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Fjern fra prosjekt"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded: Override form */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <OverrideForm
            override={override}
            onSave={onSaveOverride}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  );
}

// ============ OVERRIDE FORM ============

interface OverrideFormProps {
  override: ProjectTrip["override"];
  onSave: (
    overrideId: string,
    fields: Record<string, string>
  ) => Promise<void>;
  isSubmitting: boolean;
}

function OverrideForm({ override, onSave, isSubmitting }: OverrideFormProps) {
  const [enabled, setEnabled] = useState(override.enabled);
  const [startName, setStartName] = useState(override.startName || "");
  const [startDescription, setStartDescription] = useState(
    override.startDescription || ""
  );
  const [startTransitionText, setStartTransitionText] = useState(
    override.startTransitionText || ""
  );
  const [rewardTitle, setRewardTitle] = useState(override.rewardTitle || "");
  const [rewardDescription, setRewardDescription] = useState(
    override.rewardDescription || ""
  );
  const [rewardCode, setRewardCode] = useState(override.rewardCode || "");
  const [rewardValidityDays, setRewardValidityDays] = useState(
    override.rewardValidityDays?.toString() || ""
  );
  const [welcomeText, setWelcomeText] = useState(override.welcomeText || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(override.id, {
      enabled: String(enabled),
      startName,
      startDescription,
      startTransitionText,
      rewardTitle,
      rewardDescription,
      rewardCode,
      rewardValidityDays,
      welcomeText,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Prosjekt-overrides
      </h3>

      {/* Enabled toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className={`relative w-10 h-6 rounded-full transition-colors ${
            enabled ? "bg-emerald-500" : "bg-gray-300"
          }`}
          onClick={() => setEnabled(!enabled)}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              enabled ? "translate-x-4" : ""
            }`}
          />
        </div>
        <span className="text-sm text-gray-700">
          {enabled ? "Aktiv — vises i prosjektet" : "Deaktivert — skjult"}
        </span>
      </label>

      {/* Start point overrides */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Startpunkt
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Navn
            </label>
            <input
              type="text"
              value={startName}
              onChange={(e) => setStartName(e.target.value)}
              placeholder="F.eks. Scandic Nidelven"
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Overgangstekst
            </label>
            <input
              type="text"
              value={startTransitionText}
              onChange={(e) => setStartTransitionText(e.target.value)}
              placeholder="F.eks. Gå ut hovedinngangen..."
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">
            Beskrivelse
          </label>
          <textarea
            value={startDescription}
            onChange={(e) => setStartDescription(e.target.value)}
            placeholder="Kort beskrivelse av startpunktet..."
            rows={2}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all resize-none"
          />
        </div>
      </div>

      {/* Reward overrides */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Belønning
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Tittel
            </label>
            <input
              type="text"
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="F.eks. Gratis kaffe"
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Kode
            </label>
            <input
              type="text"
              value={rewardCode}
              onChange={(e) => setRewardCode(e.target.value)}
              placeholder="F.eks. SCANDIC2026"
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Beskrivelse
            </label>
            <input
              type="text"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              placeholder="Beskrivelse av belønningen..."
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Gyldighet (dager)
            </label>
            <input
              type="number"
              value={rewardValidityDays}
              onChange={(e) => setRewardValidityDays(e.target.value)}
              placeholder="30"
              min={1}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Welcome text */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-600">
          Velkomsttekst
        </label>
        <textarea
          value={welcomeText}
          onChange={(e) => setWelcomeText(e.target.value)}
          placeholder="Velkomsttekst som vises ved start av turen..."
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all resize-none"
        />
      </div>

      {/* Save button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Lagrer...
            </>
          ) : (
            "Lagre overrides"
          )}
        </button>
      </div>
    </form>
  );
}
