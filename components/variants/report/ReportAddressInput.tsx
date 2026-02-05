"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { MapPin, Navigation, Bike, Car, Loader2, X } from "lucide-react";

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

  const [isOpen, setIsOpen] = useState(false);
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
    if (fromAddress && !isOpen) {
      setIsOpen(true);
      setQuery(fromAddress);
      // Trigger a search to restore state
    }
  }, [searchParams, isOpen]);

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

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

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

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a1a1a] bg-white border border-[#d4cfc8] rounded-lg hover:bg-[#f8f6f4] transition-colors"
      >
        <MapPin className="w-4 h-4" />
        Sjekk din reisetid
      </button>
    );
  }

  return (
    <div className="bg-[#f8f6f4] rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#6a6a6a]">
          Hvor bor eller jobber du?
        </h3>
        <button
          onClick={() => {
            setIsOpen(false);
            handleClear();
          }}
          className="p-1 text-[#6a6a6a] hover:text-[#1a1a1a] transition-colors"
          aria-label="Lukk"
        >
          <X className="w-4 h-4" />
        </button>
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
            placeholder="Skriv inn adresse..."
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
              S\u00f8ker...
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
            {state.items.map((item, index) => (
              <li
                key={item.id}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => handleSelectSuggestion(item)}
                className={`px-4 py-3 cursor-pointer text-sm ${
                  index === selectedIndex
                    ? "bg-[#f8f6f4] text-[#1a1a1a]"
                    : "hover:bg-[#f8f6f4] text-[#4a4a4a]"
                }`}
              >
                {item.place_name}
              </li>
            ))}
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
      {state.status === "complete" && (
        <div className="mt-4">
          <p className="text-sm text-[#6a6a6a] mb-3">
            Fra <span className="font-medium text-[#1a1a1a]">{state.address}</span> til{" "}
            <span className="font-medium text-[#1a1a1a]">{propertyName}</span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            {state.result.walk !== null && (
              <div className="bg-white rounded-lg p-3 text-center border border-[#e8e4e0]">
                <Navigation className="w-5 h-5 mx-auto mb-1 text-[#7a7062]" />
                <div className="text-xl font-semibold text-[#1a1a1a]">
                  {state.result.walk}
                </div>
                <div className="text-xs text-[#6a6a6a]">min gange</div>
              </div>
            )}
            {state.result.bike !== null && (
              <div className="bg-white rounded-lg p-3 text-center border border-[#e8e4e0]">
                <Bike className="w-5 h-5 mx-auto mb-1 text-[#7a7062]" />
                <div className="text-xl font-semibold text-[#1a1a1a]">
                  {state.result.bike}
                </div>
                <div className="text-xs text-[#6a6a6a]">min sykkel</div>
              </div>
            )}
            {state.result.car !== null && (
              <div className="bg-white rounded-lg p-3 text-center border border-[#e8e4e0]">
                <Car className="w-5 h-5 mx-auto mb-1 text-[#7a7062]" />
                <div className="text-xl font-semibold text-[#1a1a1a]">
                  {state.result.car}
                </div>
                <div className="text-xs text-[#6a6a6a]">min bil</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {state.status === "error" && (
        <div className="mt-4 text-sm text-red-600">{state.message}</div>
      )}
    </div>
  );
}
