---
module: Explorer
date: 2026-03-10
problem_type: logic_error
component: database
symptoms:
  - "Day filter not visible on Open House Oslo Explorer page"
  - "All POIs show event_dates: null despite being a multi-day event"
  - "Project missing Event tag so bransjeprofil features not activated"
root_cause: config_error
resolution_type: config_change
severity: medium
tags: [event-dates, day-filter, bransjeprofil, open-house-oslo, kml-import, event-tag]
---

# Enabling Day Filter for KML-Imported Event Projects

## Problem

Open House Oslo 2025 was imported via KML (`import-kml.ts`) which doesn't set event-specific fields. The Explorer page showed all 77 POIs but no day filter, despite the event running over 3 days (April 25-27, 2025) with buildings open on different days.

## Environment
- Module: Explorer / Database
- Stack: Next.js 14, Supabase
- Affected Component: ExplorerDayFilter, bransjeprofiler.ts
- Date: 2026-03-10

## Symptoms
- No day filter tabs visible on `/for/open-house-oslo/open-house-oslo-2025/explore`
- All 77 POIs had `event_dates: null` in database
- Project had `tags: []` — no bransjeprofil match

## What Didn't Work

**Direct solution:** The problem was identified and fixed on the first attempt by tracing the feature flag chain.

## Solution

Two changes were needed:

### 1. Set `tags: ["Event"]` on the project

The day filter is gated behind `features.dayFilter` which comes from the "Event" bransjeprofil. Without the tag, `getBransjeprofil([])` returns the fallback profile (no event features).

```bash
# Set Event tag on project
curl -X PATCH "${SUPABASE_URL}/rest/v1/projects?id=eq.open-house-oslo_open-house-oslo-2025" \
  -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["Event"]}'
```

### 2. Populate `event_dates` on each POI from the official program

Scraped the day-by-day program from openhouseoslo.no/programmer/ and matched each building to its POI in the database. Most buildings are open only one day; some span two.

```bash
# Example: single day
curl -X PATCH "${SUPABASE_URL}/rest/v1/pois?id=eq.open-house-oslo-frogner-majorstuen-villa-otium" \
  -d '{"event_dates": ["2025-04-25"]}'

# Example: multi-day
curl -X PATCH "${SUPABASE_URL}/rest/v1/pois?id=eq.open-house-oslo-frogner-majorstuen-vigelandmuseet" \
  -d '{"event_dates": ["2025-04-26","2025-04-27"]}'
```

**Final distribution:** Fri: 8 POIs, Sat: 43 POIs, Sun: 34 POIs (some overlap for multi-day buildings).

### Name matching challenges

KML import uses building names from Google My Maps which sometimes differ from the official program:

| Database name | Program name | Match logic |
|--------------|-------------|-------------|
| Familiebolig i bratt terreng | Tryms vei 11 | Address-based |
| Sigrun Bergs verksted | Damstredet 20 | Address-based |
| Studio Heimat | Geitmyrsveien 35A | Address-based |
| Enebolig Bjart Mohr | Guldbergsvei 24 | Address-based |
| Huset som fikk være i fred | Slyngveien 3 | Address-based |
| Long House on Pillars | House on pillars | Fuzzy name match |

## Why This Works

The feature flag chain is:
1. `project.tags` contains `"Event"` → `getBransjeprofil()` returns Event profile
2. Event profile has `features: { dayFilter: true }` → passed to ExplorerPage
3. `ExplorerPage` checks `!!features?.dayFilter` → enables `useEventDays()` hook
4. `useEventDays()` extracts unique dates from POI `eventDates` arrays → renders tabs
5. `useEventDayFilter()` filters visible POIs when a day tab is selected

Without the Event tag, step 1 fails and the entire chain is inactive.

## Prevention

1. **KML imports for events:** After importing via `import-kml.ts`, always check if the project needs:
   - `tags: ["Event"]` set on the project
   - `event_dates` populated on POIs
   - `event_time_start` / `event_time_end` if available
2. **Use purpose-built importers when possible:** The `import-oslo-open.ts` script handles event fields automatically. KML import is a generic tool that doesn't know about event semantics.
3. **Verify day filter after import:** Open the Explorer URL and confirm the day filter tabs appear with correct counts.

## Related Issues

- See also: [event-import-pipeline-pattern-20260309.md](../data-import/event-import-pipeline-pattern-20260309.md) — documents the reusable event import pipeline including event_dates and Event tag requirements
