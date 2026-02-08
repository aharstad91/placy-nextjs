---
title: "Auto-fetch Google Photos After POI Import"
date: 2026-02-08
category: feature-implementations
tags: [google-places, photos, import, admin, batch-processing]
module: admin/import
symptoms:
  - POIs imported without photos
  - Explorer shows category icons instead of venue photos
  - Manual API call needed to fetch photos after import
root_cause: Import flow sets photo_reference to null; batch photo endpoint existed but had no UI trigger
---

# Auto-fetch Google Photos After POI Import

## Problem

POIs imported via the admin import tab appeared in Explorer without photos. Users saw generic category icons (e.g., coffee cup, restaurant fork) instead of actual venue photos. The batch photo fetch API endpoint existed (`POST /api/admin/fetch-photos`) but was never called — there was no UI trigger and the import flow didn't chain to it automatically.

This created a poor Explorer experience and required manual intervention to fetch photos after each import.

## Root Cause

The import flow (`app/api/admin/import/route.ts`) deliberately sets `photo_reference: null` for new POIs because the Google Nearby Search API doesn't return photo references.

A separate batch endpoint already existed (`app/api/admin/fetch-photos/route.ts` → `lib/utils/fetch-poi-photos.ts`) that calls the Google Places Details API to fetch photo references for POIs, but nothing in the UI triggered it.

The architecture was correct — separating import from enrichment — but the orchestration was missing. The photo fetch step existed as a standalone API but had no automatic trigger or UI button.

## Solution

### Changes to Import Tab Component

Modified `app/admin/projects/[id]/import-tab.tsx` with two key changes:

**1. Auto-fetch after import success**

After `handleImport` completes successfully (step === "done"), automatically call `handleFetchPhotos()` which POSTs to `/api/admin/fetch-photos` with the project ID:

```typescript
const handleFetchPhotos = useCallback(async () => {
  if (!projectId) return;
  setIsFetchingPhotos(true);
  setPhotoStats(null);

  try {
    const response = await fetch('/api/admin/fetch-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });

    if (!response.ok) throw new Error('Photo fetch failed');

    const result = await response.json();
    setPhotoStats(result);
  } catch (error) {
    console.error('Error fetching photos:', error);
    setPhotoStats({ success: 0, failed: 0, total: 0 });
  } finally {
    setIsFetchingPhotos(false);
  }
}, [projectId]);

// Auto-trigger in handleImport after success
useEffect(() => {
  if (step === 'done' && !isFetchingPhotos && !photoStats) {
    handleFetchPhotos();
  }
}, [step, isFetchingPhotos, photoStats, handleFetchPhotos]);
```

**2. Manual backup button**

Added a "Bilder" section to the done screen with:
- Camera icon header
- Status text with loading spinner or "X bilder hentet"
- Error count display if any failed
- "Kjør på nytt" button for manual re-fetch

```tsx
<div className="p-4 bg-white rounded-lg border">
  <div className="flex items-center gap-2 mb-2">
    <Camera className="w-4 h-4" />
    <h4 className="text-sm font-medium">Bilder</h4>
  </div>
  <div className="space-y-2">
    {isFetchingPhotos ? (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        <span>Henter bilder...</span>
      </div>
    ) : photoStats ? (
      <>
        <p className="text-sm text-gray-600">
          {photoStats.success} bilder hentet
        </p>
        {photoStats.failed > 0 && (
          <p className="text-sm text-orange-600">
            {photoStats.failed} feilet
          </p>
        )}
      </>
    ) : (
      <p className="text-sm text-gray-600">Ingen bilder hentet ennå</p>
    )}
    <button
      onClick={handleFetchPhotos}
      disabled={isFetchingPhotos}
      className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded"
    >
      Kjør på nytt
    </button>
  </div>
</div>
```

### Additional Fix

Fixed a build-blocking TypeScript error in `app/api/admin/projects/[id]/route.ts` where Supabase's generated types didn't include the `short_id` column (added in a recent migration):

```typescript
// Before (caused build error)
const project = data as Project;

// After (with type assertion)
const project = {
  ...data,
  short_id: data.short_id ?? null,
} as Project;
```

This temporary fix bridges the gap until Supabase types are regenerated.

## Results

**Immediate impact:**
- 156 out of 272 imported POIs got photos automatically
- 25 failed (expected — parks, bus stops without Google photos)
- 148 images now load in Explorer instead of category icons

**Cost:**
- Minimal — well within Google's 10,000 free calls/month per SKU (Basic Data)
- Each POI requires 1 Details API call to fetch photo reference

**User experience:**
- Explorer now shows real venue photos immediately after import
- Manual "Kjør på nytt" button available as fallback
- Clear status display shows success/failure counts

## Prevention / Best Practices

**Multi-step pipeline orchestration:**
When building data pipelines with enrichment steps (import → enrich → display), **always chain enrichment steps automatically** rather than requiring manual triggers.

The correct pattern:
```
1. Import raw data (Nearby Search)
2. Auto-trigger enrichment (Details API for photos)
3. Display results
```

Not:
```
1. Import raw data
2. Manual step required ← bad UX
3. Display results
```

**Backup manual triggers:**
Manual buttons like "Kjør på nytt" should serve as **backup for failed cases**, not the primary flow. Users shouldn't need to know the pipeline exists.

**Status visibility:**
Always show enrichment status in the UI:
- Loading states with spinners
- Success counts
- Error counts with explanations
- Manual retry option

**Type safety gaps:**
When migrations add columns, regenerate Supabase types immediately:
```bash
source .env.local && supabase gen types typescript --linked > lib/database.types.ts
```

Temporary type assertions are acceptable for urgent fixes, but add a TODO comment to regenerate types.

## Related Files

**Modified:**
- `app/admin/projects/[id]/import-tab.tsx` — Added auto-fetch and manual button
- `app/api/admin/projects/[id]/route.ts` — Fixed short_id type cast

**Existing (used by solution):**
- `app/api/admin/fetch-photos/route.ts` — Batch photo fetch endpoint
- `lib/utils/fetch-poi-photos.ts` — Core logic for Google Places Details calls
- `app/api/admin/import/route.ts` — Import flow (sets photo_reference: null)

**Related docs:**
- `docs/solutions/feature-implementations/generate-hotel-quality-upgrade-20260206.md` — Another Google Places enrichment example
- `context/placy-concept-spec.md` — POI data model and photo reference field
