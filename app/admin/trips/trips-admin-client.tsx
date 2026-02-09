"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Circle } from "lucide-react";
import type { Trip, TripCategory, TripSeason } from "@/lib/types";
import { TRIP_CATEGORY_LABELS } from "@/lib/types";

const SEASON_LABELS: Record<TripSeason, string> = {
  spring: "Vår",
  summer: "Sommer",
  autumn: "Høst",
  winter: "Vinter",
  "all-year": "Helår",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Enkel",
  moderate: "Moderat",
  challenging: "Krevende",
};

interface TripsAdminClientProps {
  trips: Trip[];
  cities: string[];
}

export function TripsAdminClient({ trips, cities }: TripsAdminClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
  const [filterPublished, setFilterPublished] = useState<
    "all" | "published" | "draft"
  >("all");

  const filtered = useMemo(() => {
    return trips.filter((trip) => {
      if (
        searchQuery &&
        !trip.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (filterCity && trip.city !== filterCity) return false;
      if (filterCategory && trip.category !== filterCategory) return false;
      if (filterSeason && trip.season !== filterSeason) return false;
      if (filterPublished === "published" && !trip.published) return false;
      if (filterPublished === "draft" && trip.published) return false;
      return true;
    });
  }, [trips, searchQuery, filterCity, filterCategory, filterSeason, filterPublished]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            {trips.length} trips totalt
          </p>
        </div>
        <Link
          href="/admin/trips/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Ny trip
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Søk i tittel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>

        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Alle byer</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Alle kategorier</option>
          {Object.entries(TRIP_CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterSeason}
          onChange={(e) => setFilterSeason(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Alle sesonger</option>
          {Object.entries(SEASON_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterPublished}
          onChange={(e) =>
            setFilterPublished(e.target.value as "all" | "published" | "draft")
          }
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">Alle statuser</option>
          <option value="published">Publisert</option>
          <option value="draft">Utkast</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">Ingen trips funnet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Tittel
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  By
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Kategori
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Sesong
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Stopp
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trip) => (
                <tr
                  key={trip.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/trips/${trip.id}`}
                      className="text-gray-900 font-medium hover:text-emerald-600 transition-colors"
                    >
                      {trip.title}
                    </Link>
                    {trip.featured && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        Featured
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{trip.city}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {trip.category
                      ? TRIP_CATEGORY_LABELS[trip.category as TripCategory]
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {SEASON_LABELS[trip.season] || trip.season}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {trip.stopCount}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Circle
                      className={`w-3 h-3 inline-block ${
                        trip.published
                          ? "fill-emerald-500 text-emerald-500"
                          : "fill-gray-300 text-gray-300"
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
