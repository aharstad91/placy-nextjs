"use client";

import { useState, useCallback, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Search,
  X,
  Loader2,
  Circle,
  ExternalLink,
} from "lucide-react";
import type { Trip, TripStop, TripCategory, TripSeason } from "@/lib/types";
import { TRIP_CATEGORY_LABELS } from "@/lib/types";
import { ConfirmDialog } from "@/components/admin";
import { slugify } from "@/lib/utils/slugify";

// --- Types ---

interface PoiSearchResult {
  id: string;
  name: string;
  address?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
}

interface TripEditorClientProps {
  trip: Trip | null;
  isNew: boolean;
  createTrip: (formData: FormData) => Promise<void>;
  updateTrip: (formData: FormData) => Promise<void>;
  deleteTrip: (formData: FormData) => Promise<void>;
  togglePublish: (formData: FormData) => Promise<void>;
  addTripStop: (formData: FormData) => Promise<void>;
  updateTripStop: (formData: FormData) => Promise<void>;
  deleteTripStop: (formData: FormData) => Promise<void>;
  reorderTripStops: (formData: FormData) => Promise<void>;
  searchPois: (formData: FormData) => Promise<PoiSearchResult[]>;
}

const SEASON_OPTIONS: { value: TripSeason; label: string }[] = [
  { value: "all-year", label: "Helår" },
  { value: "spring", label: "Vår" },
  { value: "summer", label: "Sommer" },
  { value: "autumn", label: "Høst" },
  { value: "winter", label: "Vinter" },
];

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Ikke satt" },
  { value: "easy", label: "Enkel" },
  { value: "moderate", label: "Moderat" },
  { value: "challenging", label: "Krevende" },
];

// --- Component ---

export function TripEditorClient({
  trip,
  isNew,
  createTrip,
  updateTrip,
  deleteTrip,
  togglePublish,
  addTripStop,
  updateTripStop,
  deleteTripStop,
  reorderTripStops,
  searchPois,
}: TripEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"details" | "stops">(
    isNew ? "details" : "details"
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Details form state
  const [title, setTitle] = useState(trip?.title ?? "");
  const [urlSlug, setUrlSlug] = useState(trip?.urlSlug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(trip?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    trip?.coverImageUrl ?? ""
  );
  const [city, setCity] = useState(trip?.city ?? "");
  const [region, setRegion] = useState(trip?.region ?? "");
  const [country, setCountry] = useState(trip?.country ?? "NO");
  const [centerLat, setCenterLat] = useState(
    trip?.center.lat?.toString() ?? ""
  );
  const [centerLng, setCenterLng] = useState(
    trip?.center.lng?.toString() ?? ""
  );
  const [category, setCategory] = useState(trip?.category ?? "");
  const [difficulty, setDifficulty] = useState(trip?.difficulty ?? "");
  const [season, setSeason] = useState<TripSeason>(trip?.season ?? "all-year");
  const [tags, setTags] = useState(trip?.tags?.join(", ") ?? "");
  const [distanceMeters, setDistanceMeters] = useState(
    trip?.distanceMeters?.toString() ?? ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    trip?.durationMinutes?.toString() ?? ""
  );
  const [defaultRewardTitle, setDefaultRewardTitle] = useState(
    trip?.defaultRewardTitle ?? ""
  );
  const [defaultRewardDescription, setDefaultRewardDescription] = useState(
    trip?.defaultRewardDescription ?? ""
  );
  const [featured, setFeatured] = useState(trip?.featured ?? false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Stop editing
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [showPoiSearch, setShowPoiSearch] = useState(false);

  // Auto-generate slug from title (only for new trips that haven't been manually edited)
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (isNew && !slugEdited) {
      setUrlSlug(slugify(newTitle));
    }
  };

  const handleSlugChange = (newSlug: string) => {
    setUrlSlug(newSlug);
    setSlugEdited(true);
  };

  // --- Form submission ---

  const handleSaveDetails = () => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        if (!isNew && trip) {
          formData.set("tripId", trip.id);
        }
        formData.set("title", title);
        formData.set("urlSlug", urlSlug);
        formData.set("description", description);
        formData.set("coverImageUrl", coverImageUrl);
        formData.set("city", city);
        formData.set("region", region);
        formData.set("country", country);
        formData.set("centerLat", centerLat);
        formData.set("centerLng", centerLng);
        formData.set("category", category);
        formData.set("difficulty", difficulty);
        formData.set("season", season);
        formData.set("tags", tags);
        formData.set("distanceMeters", distanceMeters);
        formData.set("durationMinutes", durationMinutes);
        formData.set("defaultRewardTitle", defaultRewardTitle);
        formData.set(
          "defaultRewardDescription",
          defaultRewardDescription
        );
        formData.set("featured", featured ? "true" : "false");

        if (isNew) {
          await createTrip(formData);
          // redirect happens in server action
        } else {
          await updateTrip(formData);
          setSuccess("Trip oppdatert");
          setTimeout(() => setSuccess(null), 3000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Noe gikk galt");
      }
    });
  };

  const handleDelete = () => {
    if (!trip) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("tripId", trip.id);
        await deleteTrip(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke slette");
        setShowDeleteConfirm(false);
      }
    });
  };

  const handleTogglePublish = () => {
    if (!trip) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("tripId", trip.id);
        formData.set("published", (!trip.published).toString());
        await togglePublish(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke endre status");
      }
    });
  };

  // --- Stops ---

  const handleMoveStop = (stopIndex: number, direction: "up" | "down") => {
    if (!trip) return;
    const stops = [...trip.stops];
    const swapIndex = direction === "up" ? stopIndex - 1 : stopIndex + 1;
    if (swapIndex < 0 || swapIndex >= stops.length) return;

    // Swap
    [stops[stopIndex], stops[swapIndex]] = [stops[swapIndex], stops[stopIndex]];

    // Build new order
    const order = stops.map((s, i) => ({
      id: s.id as string,
      sort_order: i,
    }));

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("tripId", trip.id);
        formData.set("order", JSON.stringify(order));
        await reorderTripStops(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke endre rekkefølge");
      }
    });
  };

  const handleDeleteStop = (stopId: string) => {
    if (!trip) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("stopId", stopId);
        formData.set("tripId", trip.id);
        await deleteTripStop(formData);
        setExpandedStopId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke fjerne stopp");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/trips"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? "Ny trip" : trip?.title}
            </h1>
            {!isNew && trip && (
              <p className="text-sm text-gray-500">/{trip.urlSlug}</p>
            )}
          </div>
        </div>

        {!isNew && trip && (
          <div className="flex items-center gap-2">
            <a
              href={`/trips/${trip.urlSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Åpne
            </a>
            <button
              onClick={handleTogglePublish}
              disabled={isPending}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                trip.published
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Circle
                className={`w-2.5 h-2.5 ${
                  trip.published
                    ? "fill-emerald-500 text-emerald-500"
                    : "fill-gray-400 text-gray-400"
                }`}
              />
              {trip.published ? "Publisert" : "Utkast"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Slett trip"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Error/success messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "details"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Detaljer
          </button>
          <button
            onClick={() => setActiveTab("stops")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "stops"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Stopp ({trip?.stops.length ?? 0})
          </button>
        </div>
      )}

      {/* Details tab */}
      {(activeTab === "details" || isNew) && (
        <DetailsForm
          title={title}
          onTitleChange={handleTitleChange}
          urlSlug={urlSlug}
          onSlugChange={handleSlugChange}
          isNew={isNew}
          description={description}
          onDescriptionChange={setDescription}
          coverImageUrl={coverImageUrl}
          onCoverImageUrlChange={setCoverImageUrl}
          city={city}
          onCityChange={setCity}
          region={region}
          onRegionChange={setRegion}
          country={country}
          onCountryChange={setCountry}
          centerLat={centerLat}
          onCenterLatChange={setCenterLat}
          centerLng={centerLng}
          onCenterLngChange={setCenterLng}
          category={category}
          onCategoryChange={setCategory}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          season={season}
          onSeasonChange={setSeason}
          tags={tags}
          onTagsChange={setTags}
          distanceMeters={distanceMeters}
          onDistanceMetersChange={setDistanceMeters}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          defaultRewardTitle={defaultRewardTitle}
          onDefaultRewardTitleChange={setDefaultRewardTitle}
          defaultRewardDescription={defaultRewardDescription}
          onDefaultRewardDescriptionChange={setDefaultRewardDescription}
          featured={featured}
          onFeaturedChange={setFeatured}
          onSave={handleSaveDetails}
          isPending={isPending}
        />
      )}

      {/* Stops tab */}
      {activeTab === "stops" && trip && (
        <StopsTab
          trip={trip}
          expandedStopId={expandedStopId}
          onExpandStop={setExpandedStopId}
          onMoveStop={handleMoveStop}
          onDeleteStop={handleDeleteStop}
          updateTripStop={updateTripStop}
          addTripStop={addTripStop}
          searchPois={searchPois}
          showPoiSearch={showPoiSearch}
          onShowPoiSearch={setShowPoiSearch}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Slett trip"
        message={`Er du sikker på at du vil slette "${trip?.title}"? Alle stopp fjernes også.`}
        confirmLabel="Slett"
        cancelLabel="Avbryt"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
    </div>
  );
}

// --- Details Form (extracted for clarity) ---

function DetailsForm({
  title,
  onTitleChange,
  urlSlug,
  onSlugChange,
  isNew,
  description,
  onDescriptionChange,
  coverImageUrl,
  onCoverImageUrlChange,
  city,
  onCityChange,
  region,
  onRegionChange,
  country,
  onCountryChange,
  centerLat,
  onCenterLatChange,
  centerLng,
  onCenterLngChange,
  category,
  onCategoryChange,
  difficulty,
  onDifficultyChange,
  season,
  onSeasonChange,
  tags,
  onTagsChange,
  distanceMeters,
  onDistanceMetersChange,
  durationMinutes,
  onDurationMinutesChange,
  defaultRewardTitle,
  onDefaultRewardTitleChange,
  defaultRewardDescription,
  onDefaultRewardDescriptionChange,
  featured,
  onFeaturedChange,
  onSave,
  isPending,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  urlSlug: string;
  onSlugChange: (v: string) => void;
  isNew: boolean;
  description: string;
  onDescriptionChange: (v: string) => void;
  coverImageUrl: string;
  onCoverImageUrlChange: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  region: string;
  onRegionChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  centerLat: string;
  onCenterLatChange: (v: string) => void;
  centerLng: string;
  onCenterLngChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  difficulty: string;
  onDifficultyChange: (v: string) => void;
  season: TripSeason;
  onSeasonChange: (v: TripSeason) => void;
  tags: string;
  onTagsChange: (v: string) => void;
  distanceMeters: string;
  onDistanceMetersChange: (v: string) => void;
  durationMinutes: string;
  onDurationMinutesChange: (v: string) => void;
  defaultRewardTitle: string;
  onDefaultRewardTitleChange: (v: string) => void;
  defaultRewardDescription: string;
  onDefaultRewardDescriptionChange: (v: string) => void;
  featured: boolean;
  onFeaturedChange: (v: boolean) => void;
  onSave: () => void;
  isPending: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Title + slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tittel *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Trondheim Byvandring"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL slug *
          </label>
          <input
            type="text"
            value={urlSlug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="trondheim-byvandring"
            readOnly={!isNew}
            className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 ${
              !isNew ? "bg-gray-50 text-gray-500" : ""
            }`}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Beskrivelse
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          placeholder="En vakker byvandring gjennom Trondheims historiske sentrum..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        />
      </div>

      {/* Cover image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cover image URL
        </label>
        <input
          type="text"
          value={coverImageUrl}
          onChange={(e) => onCoverImageUrlChange(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        />
      </div>

      {/* Geography */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">
          Geografi
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">By *</label>
            <input
              type="text"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="Trondheim"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              placeholder="Trøndelag"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Breddegrad *
            </label>
            <input
              type="text"
              value={centerLat}
              onChange={(e) => onCenterLatChange(e.target.value)}
              placeholder="63.4305"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Lengdegrad *
            </label>
            <input
              type="text"
              value={centerLng}
              onChange={(e) => onCenterLngChange(e.target.value)}
              placeholder="10.3951"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Classification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategori
          </label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Ikke satt</option>
            {Object.entries(TRIP_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vanskelighetsgrad
          </label>
          <select
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sesong
          </label>
          <select
            value={season}
            onChange={(e) => onSeasonChange(e.target.value as TripSeason)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {SEASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags (kommaseparert)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
          placeholder="historie, arkitektur, utsiktspunkt"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        />
      </div>

      {/* Distance + duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Avstand (meter)
          </label>
          <input
            type="number"
            value={distanceMeters}
            onChange={(e) => onDistanceMetersChange(e.target.value)}
            placeholder="2500"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Varighet (minutter)
          </label>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => onDurationMinutesChange(e.target.value)}
            placeholder="45"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Default reward */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">
          Standard belønning
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tittel</label>
            <input
              type="text"
              value={defaultRewardTitle}
              onChange={(e) => onDefaultRewardTitleChange(e.target.value)}
              placeholder="Gratis kaffe"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Beskrivelse
            </label>
            <input
              type="text"
              value={defaultRewardDescription}
              onChange={(e) =>
                onDefaultRewardDescriptionChange(e.target.value)
              }
              placeholder="Vis denne skjermen i resepsjonen"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Featured toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => onFeaturedChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-sm text-gray-700">Featured (vis øverst)</span>
      </label>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          disabled={isPending || !title || !urlSlug || !city || !centerLat || !centerLng}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isNew ? "Opprett trip" : "Lagre endringer"}
        </button>
      </div>
    </div>
  );
}

// --- Stops Tab ---

function StopsTab({
  trip,
  expandedStopId,
  onExpandStop,
  onMoveStop,
  onDeleteStop,
  updateTripStop,
  addTripStop,
  searchPois,
  showPoiSearch,
  onShowPoiSearch,
  isPending,
  startTransition,
  setError,
}: {
  trip: Trip;
  expandedStopId: string | null;
  onExpandStop: (id: string | null) => void;
  onMoveStop: (index: number, direction: "up" | "down") => void;
  onDeleteStop: (id: string) => void;
  updateTripStop: (formData: FormData) => Promise<void>;
  addTripStop: (formData: FormData) => Promise<void>;
  searchPois: (formData: FormData) => Promise<PoiSearchResult[]>;
  showPoiSearch: boolean;
  onShowPoiSearch: (v: boolean) => void;
  isPending: boolean;
  startTransition: (cb: () => Promise<void>) => void;
  setError: (err: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Stop list */}
      {trip.stops.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-3">Ingen stopp ennå</p>
          <button
            onClick={() => onShowPoiSearch(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Legg til første stopp
          </button>
        </div>
      ) : (
        <>
          {trip.stops.map((stop, index) => (
            <StopCard
              key={stop.id as string}
              stop={stop}
              index={index}
              totalStops={trip.stops.length}
              isExpanded={expandedStopId === (stop.id as string)}
              onToggleExpand={() =>
                onExpandStop(
                  expandedStopId === (stop.id as string) ? null : (stop.id as string)
                )
              }
              onMoveUp={() => onMoveStop(index, "up")}
              onMoveDown={() => onMoveStop(index, "down")}
              onDelete={() => onDeleteStop(stop.id as string)}
              onSave={(formData) => {
                startTransition(async () => {
                  try {
                    await updateTripStop(formData);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Kunne ikke lagre stopp"
                    );
                  }
                });
              }}
              tripId={trip.id}
              isPending={isPending}
            />
          ))}

          <button
            onClick={() => onShowPoiSearch(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Legg til stopp
          </button>
        </>
      )}

      {/* POI search panel */}
      {showPoiSearch && (
        <PoiSearchPanel
          tripCity={trip.city}
          tripId={trip.id}
          onAdd={(poiId) => {
            startTransition(async () => {
              try {
                const formData = new FormData();
                formData.set("tripId", trip.id);
                formData.set("poiId", poiId);
                await addTripStop(formData);
                onShowPoiSearch(false);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Kunne ikke legge til stopp"
                );
              }
            });
          }}
          onClose={() => onShowPoiSearch(false)}
          searchPois={searchPois}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// --- Single Stop Card ---

function StopCard({
  stop,
  index,
  totalStops,
  isExpanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSave,
  tripId,
  isPending,
}: {
  stop: TripStop;
  index: number;
  totalStops: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSave: (formData: FormData) => void;
  tripId: string;
  isPending: boolean;
}) {
  const [nameOverride, setNameOverride] = useState(stop.nameOverride ?? "");
  const [descriptionOverride, setDescriptionOverride] = useState(
    stop.descriptionOverride ?? ""
  );
  const [imageUrlOverride, setImageUrlOverride] = useState(
    stop.imageUrlOverride ?? ""
  );
  const [transitionText, setTransitionText] = useState(
    stop.transitionText ?? ""
  );
  const [localInsight, setLocalInsight] = useState(stop.localInsight ?? "");

  const handleSave = () => {
    const formData = new FormData();
    formData.set("stopId", stop.id as string);
    formData.set("tripId", tripId);
    formData.set("nameOverride", nameOverride);
    formData.set("descriptionOverride", descriptionOverride);
    formData.set("imageUrlOverride", imageUrlOverride);
    formData.set("transitionText", transitionText);
    formData.set("localInsight", localInsight);
    onSave(formData);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Compact view */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Number */}
        <span className="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-600 text-sm font-medium rounded-full flex-shrink-0">
          {index + 1}
        </span>

        {/* POI info (clickable) */}
        <button
          onClick={onToggleExpand}
          className="flex-1 text-left"
        >
          <span className="text-sm font-medium text-gray-900">
            {stop.nameOverride || stop.poi.name}
          </span>
          {stop.poi.category && (
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: stop.poi.category.color + "20",
                color: stop.poi.category.color,
              }}
            >
              {stop.poi.category.name}
            </span>
          )}
          {stop.transitionText && (
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
              {stop.transitionText}
            </p>
          )}
        </button>

        {/* Move buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0 || isPending}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Flytt opp"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalStops - 1 || isPending}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Flytt ned"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-4">
          {/* Read-only POI info */}
          <div className="text-xs text-gray-500">
            <span className="font-medium">POI:</span> {stop.poi.name}
            {stop.poi.address && ` — ${stop.poi.address}`}
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Navneoverride
              </label>
              <input
                type="text"
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                placeholder={stop.poi.name}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bilde-URL override
              </label>
              <input
                type="text"
                value={imageUrlOverride}
                onChange={(e) => setImageUrlOverride(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Beskrivelse-override
            </label>
            <textarea
              value={descriptionOverride}
              onChange={(e) => setDescriptionOverride(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Overgangstekst
            </label>
            <textarea
              value={transitionText}
              onChange={(e) => setTransitionText(e.target.value)}
              rows={2}
              placeholder="Gå videre mot..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Lokalkunnskap
            </label>
            <textarea
              value={localInsight}
              onChange={(e) => setLocalInsight(e.target.value)}
              rows={2}
              placeholder="Visste du at..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white"
            />
          </div>

          <div className="flex justify-between pt-1">
            <button
              onClick={onDelete}
              disabled={isPending}
              className="text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              Fjern stopp
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Lagre stopp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- POI Search Panel ---

function PoiSearchPanel({
  tripCity,
  tripId,
  onAdd,
  onClose,
  searchPois,
  isPending,
}: {
  tripCity: string;
  tripId: string;
  onAdd: (poiId: string) => void;
  onClose: () => void;
  searchPois: (formData: FormData) => Promise<PoiSearchResult[]>;
  isPending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PoiSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const formData = new FormData();
          formData.set("query", searchQuery);
          formData.set("city", tripCity);
          const res = await searchPois(formData);
          setResults(res);
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [searchPois, tripCity]
  );

  return (
    <div className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Legg til stopp</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Søk etter POI..."
            autoFocus
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {results.length > 0 ? (
          <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {results.map((poi) => (
              <li key={poi.id}>
                <button
                  onClick={() => onAdd(poi.id)}
                  disabled={isPending}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-sm font-medium text-gray-900 flex-1">
                    {poi.name}
                  </span>
                  {poi.categoryName && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: (poi.categoryColor || "#6b7280") + "20",
                        color: poi.categoryColor || "#6b7280",
                      }}
                    >
                      {poi.categoryName}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : query.length >= 2 && !isSearching ? (
          <p className="text-center text-sm text-gray-500 py-4">
            Ingen POI-er funnet
          </p>
        ) : null}
      </div>
    </div>
  );
}
