export default function ExploreLoading() {
  return (
    <div className="h-[calc(100vh-3rem)] w-screen relative overflow-hidden bg-white">
      {/* ===== DESKTOP SKELETON (lg+) ===== */}
      <div className="hidden lg:flex h-full">
        {/* Map placeholder */}
        <div className="flex-1 relative bg-[#f0ece7] animate-pulse" />

        {/* Sidebar skeleton */}
        <div className="w-[40%] flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
          {/* Filter chips area */}
          <div className="px-8 pt-6 pb-4 border-b border-gray-100">
            <div className="flex gap-2">
              {[80, 64, 72, 56].map((w, i) => (
                <div
                  key={i}
                  className="h-8 rounded-full bg-gray-100 animate-pulse"
                  style={{ width: w }}
                />
              ))}
            </div>
          </div>

          {/* POI card skeletons */}
          <div className="flex-1 overflow-hidden px-8 pt-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-50 rounded w-1/2" />
                  <div className="h-3 bg-gray-50 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>

          {/* Collection footer skeleton */}
          <div className="flex-shrink-0 border-t bg-gray-200/50 border-gray-200/40 px-8 py-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-gray-300" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-gray-300 rounded w-24" />
                <div className="h-3 bg-gray-200 rounded w-40" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MOBILE SKELETON (below lg) ===== */}
      <div className="lg:hidden absolute inset-0">
        {/* Map placeholder */}
        <div className="absolute inset-0 bg-[#f0ece7] animate-pulse" />

        {/* Bottom sheet skeleton */}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg" style={{ height: 180 }}>
          <div className="flex justify-center pt-2 pb-3">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="px-4 space-y-3">
            <div className="flex gap-2">
              {[64, 56, 72, 48].map((w, i) => (
                <div
                  key={i}
                  className="h-7 rounded-full bg-gray-100 animate-pulse"
                  style={{ width: w }}
                />
              ))}
            </div>
            <div className="flex gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-50 rounded w-1/2" />
              </div>
            </div>
            <div className="flex gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-50 rounded w-1/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
