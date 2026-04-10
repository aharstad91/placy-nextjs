"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { MapPin, PersonStanding, Bike, Car, Loader2, X } from "lucide-react";

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

interface TravelTimeResult {
  walk: number | null;
  bike: number | null;
  car: number | null;
}

type SelectionState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "suggestions"; items: Suggestion[] }
  | { status: "calculating"; address: string }
  | { status: "complete"; address: string; result: TravelTimeResult }
  | { status: "error"; message: string };

interface ReportAddressInputProps {
  propertyCoordinates: [number, number];
  propertyName: string;
}

export default function ReportAddressInput({
  propertyCoordinates,
  propertyName,
}: ReportAddressInputProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState(searchParams.get("from") ?? "");
  const [state, setState] = useState<SelectionState>({ status: "idle" });

  // Abort controllers for race condition handling
  const searchAbortRef = useRef<AbortController | null>(null);
  const selectionAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  // Input ref for focus management
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      selectionAbortRef.current?.abort();
    };
  }, []);

  // Check for existing address in URL on mount
  useEffect(() => {
    const fromAddress = searchParams.get("from");
    if (fromAddress) {
      setQuery(fromAddress);
    }
  }, [searchParams]);

  // Debounced search with race condition handling
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setState({ status: "idle" });
      return;
    }

    // Cancel previous request
    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    setState({ status: "searching" });

    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(searchQuery)}`,
        { signal: searchAbortRef.current.signal }
      );
      const data = await res.json();

      // CRITICAL: Only update if this is still the latest request
      if (requestId !== searchRequestIdRef.current) return;

      setState({
        status: "suggestions",
        items:
          data.features?.map((f: { id: string; place_name: string; center: [number, number] }) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          })) ?? [],
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (requestId === searchRequestIdRef.current) {
        setState({ status: "error", message: "Kunne ikke s\u00f8ke etter adresse" });
      }
    }
  }, 300);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      // Cancel any ongoing selection calculation
      selectionAbortRef.current?.abort();
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      // Cancel previous selection
      selectionAbortRef.current?.abort();
      selectionAbortRef.current = new AbortController();

      setState({ status: "calculating", address: suggestion.place_name });
      setQuery(suggestion.place_name);

      // Update URL for shareability
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", suggestion.place_name);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      try {
        const [lng, lat] = suggestion.center;
        const [propLng, propLat] = propertyCoordinates;

        // Fetch all modes in parallel
        const profiles = ["walking", "cycling", "driving"] as const;
        const times = await Promise.all(
          profiles.map(async (profile) => {
            const res = await fetch(
              `/api/directions?origin=${lng},${lat}&destination=${propLng},${propLat}&profile=${profile}`,
              { signal: selectionAbortRef.current!.signal }
            );
            const data = await res.json();
            return data.duration ?? null;
          })
        );

        if (selectionAbortRef.current?.signal.aborted) return;

        setState({
          status: "complete",
          address: suggestion.place_name,
          result: { walk: times[0], bike: times[1], car: times[2] },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setState({ status: "error", message: "Kunne ikke beregne reisetid" });
      }
    },
    [propertyCoordinates, searchParams, router, pathname]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setState({ status: "idle" });

    // Remove from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });

    inputRef.current?.focus();
  }, [searchParams, router, pathname]);

  // Keyboard navigation for suggestions
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (state.status !== "suggestions") return;

      const items = state.items;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(items[selectedIndex]);
      } else if (e.key === "Escape") {
        setState({ status: "idle" });
        setSelectedIndex(-1);
      }
    },
    [state, selectedIndex, handleSelectSuggestion]
  );

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [state.status === "suggestions" ? state.items : null]);

  return (
    <div className="bg-[#f8f6f4] rounded-xl p-4 md:p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <MapPin className="w-4 h-4 text-[#7a7062] shrink-0" />
            <span className="text-sm font-semibold text-[#1a1a1a]">Reisetid fra {propertyName}</span>
          </div>
          <p className="text-sm text-[#6a6a6a]">
            Skriv inn din arbeidsplass eller et annet reisemål og se hvor lang tid det tar.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <PersonStanding className="w-3.5 h-3.5 text-[#a0937d] opacity-50" />
          <Bike className="w-3.5 h-3.5 text-[#a0937d] opacity-50" />
          <Car className="w-3.5 h-3.5 text-[#a0937d] opacity-50" />
        </div>
      </div>

      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a6a6a]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Arbeidsplass, skole eller adresse..."
            className="w-full pl-10 pr-10 py-3 text-base border border-[#d4cfc8] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#7a7062] focus:border-transparent"
            aria-autocomplete="list"
            aria-expanded={state.status === "suggestions"}
            aria-controls="address-suggestions"
            role="combobox"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6a6a6a] hover:text-[#1a1a1a]"
              aria-label="T\u00f8m"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Loading state */}
        {state.status === "searching" && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-[#d4cfc8] rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2 text-sm text-[#6a6a6a]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Søker...
            </div>
          </div>
        )}

        {/* Suggestions dropdown */}
        {state.status === "suggestions" && state.items.length > 0 && (
          <ul
            id="address-suggestions"
            role="listbox"
            className="absolute z-10 w-full mt-1 bg-white border border-[#d4cfc8] rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {state.items.map((item, index) => {
              const [main, ...rest] = item.place_name.split(",");
              const secondary = rest.slice(0, 2).join(",").trim();
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleSelectSuggestion(item)}
                  className={`px-4 py-2.5 cursor-pointer ${
                    index === selectedIndex ? "bg-[#f8f6f4]" : "hover:bg-[#f8f6f4]"
                  }`}
                >
                  <div className="text-sm text-[#1a1a1a]">{main}</div>
                  {secondary && <div className="text-xs text-[#8a8a8a] mt-0.5">{secondary}</div>}
                </li>
              );
            })}
          </ul>
        )}

        {/* No results */}
        {state.status === "suggestions" && state.items.length === 0 && query.length >= 3 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-[#d4cfc8] rounded-lg shadow-lg p-3">
            <p className="text-sm text-[#6a6a6a]">Ingen resultater funnet</p>
          </div>
        )}
      </div>

      {/* Calculating state */}
      {state.status === "calculating" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#6a6a6a]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Beregner reisetid til {propertyName}...
        </div>
      )}

      {/* Results */}
      {state.status === "complete" && (() => {
        const [propLng, propLat] = propertyCoordinates;
        const mapsBase = `https://www.google.com/maps/dir/?api=1&origin=${propLat},${propLng}&destination=${encodeURIComponent(state.address)}`;
        return (
          <div className="mt-4">
            <p className="text-xs text-[#a0937d] uppercase tracking-[0.1em] font-medium mb-3">
              Fra {propertyName} til {state.address.split(",")[0]}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {state.result.walk !== null && (
                <a href={`${mapsBase}&travelmode=walking`} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all">
                  <div className="w-7 h-7 rounded-full bg-[#8a8a8a15] flex items-center justify-center shrink-0">
                    <PersonStanding className="w-3.5 h-3.5 text-[#8a8a8a]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1a1a1a] leading-none">{state.result.walk} min</div>
                    <div className="text-[11px] text-[#8a8a8a]">Google Maps ↗</div>
                  </div>
                </a>
              )}
              {state.result.bike !== null && (
                <a href={`${mapsBase}&travelmode=bicycling`} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all">
                  <div className="w-7 h-7 rounded-full bg-[#3b82f615] flex items-center justify-center shrink-0">
                    <Bike className="w-3.5 h-3.5 text-[#3b82f6]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1a1a1a] leading-none">{state.result.bike} min</div>
                    <div className="text-[11px] text-[#8a8a8a]">Google Maps ↗</div>
                  </div>
                </a>
              )}
              {state.result.car !== null && (
                <a href={`${mapsBase}&travelmode=driving`} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all">
                  <div className="w-7 h-7 rounded-full bg-[#10b98115] flex items-center justify-center shrink-0">
                    <Car className="w-3.5 h-3.5 text-[#10b981]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1a1a1a] leading-none">{state.result.car} min</div>
                    <div className="text-[11px] text-[#8a8a8a]">Google Maps ↗</div>
                  </div>
                </a>
              )}
            </div>
          </div>
        );
      })()}

      {/* Error state */}
      {state.status === "error" && (
        <div className="mt-4 text-sm text-red-600">{state.message}</div>
      )}
    </div>
  );
}
