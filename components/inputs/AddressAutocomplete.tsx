"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export interface AddressResult {
  address: string;
  lat: number;
  lng: number;
  city: string;
}

interface AddressAutocompleteProps {
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  onSelect,
  placeholder = "Skriv inn adresse...",
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    setIsSearching(true);

    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(searchQuery)}`,
        { signal: searchAbortRef.current.signal }
      );
      const data = await res.json();

      if (requestId !== searchRequestIdRef.current) return;

      const items: Suggestion[] =
        data.features?.map(
          (f: { id: string; place_name: string; center: [number, number] }) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          })
        ) ?? [];

      setSuggestions(items);
      setShowDropdown(items.length > 0);
      setIsSearching(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, 300);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(-1);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const [lng, lat] = suggestion.center;

      // Extract city from place_name (typically the second-to-last comma-separated part)
      const parts = suggestion.place_name.split(",").map((p) => p.trim());
      const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

      setQuery(suggestion.place_name);
      setShowDropdown(false);
      setSuggestions([]);

      onSelect({
        address: suggestion.place_name,
        lat,
        lng,
        city,
      });
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    },
    [showDropdown, suggestions, selectedIndex, handleSelectSuggestion]
  );

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="address-suggestions"
          role="combobox"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {!isSearching && query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            aria-label="Tøm"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelectSuggestion(item)}
              className={cn(
                "px-4 py-3 cursor-pointer text-sm",
                index === selectedIndex
                  ? "bg-gray-100 text-gray-900"
                  : "hover:bg-gray-50 text-gray-700"
              )}
            >
              {item.place_name}
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {showDropdown && suggestions.length === 0 && !isSearching && query.length >= 3 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm text-gray-500">Ingen resultater funnet</p>
        </div>
      )}
    </div>
  );
}
