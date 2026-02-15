---
title: "feat: Trips Sprint 5 — Visual Polish + Demo-readiness"
type: feat
date: 2026-02-15
---

# Trips Sprint 5 — Visual Polish + Demo-readiness

## Overview

Polish all trip views (Library, Preview, Active, Completion) to demo quality. The goal is a Scandic Nidelven demo link ready to send to a hotel contact.

Task 6 (Connect to Scandic) is already done from Sprint 4.

## Phase 1: Cover Images

- [ ] Source 3 atmospheric Trondheim/Unsplash images for the 3 featured trips
  - Bakklandet & Bryggene — colorful wooden houses along river (Bakklandet wharf area)
  - Smak av Trondheim — food/restaurant atmosphere (Trondheim dining)
  - Midtbyen på 30 min — city center/Nidarosdomen overview
- [ ] Write script to update `trips.cover_image_url` in Supabase via JS client
- [ ] Verify images display correctly in Trip Library cards and Preview hero

**Files:** `scripts/set-cover-images.ts` (temp), `TripLibraryClient.tsx`, `TripPreview.tsx`

## Phase 2: Trip Library Polish

- [ ] Improve header section — add location context ("Trondheim") and refine welcome text layout
- [ ] Polish FeaturedTripCard — ensure cover images look great, refine overlay text styling
- [ ] Polish TripCard (category rows) — ensure thumbnails + metadata are scannable
- [ ] Responsive check — verify mobile layout looks good
- [ ] Remove any placeholder/debug elements

**Files:** `app/for/[customer]/[project]/trips/TripLibraryClient.tsx`

## Phase 3: Preview Page Polish

- [ ] Hero section — ensure cover image fills nicely, refine gradient overlay
- [ ] Metadata stripe — polish layout and icons
- [ ] Map section — verify numbered markers match stops
- [ ] Stop list — refine timeline design, ensure images display well
- [ ] Rewards teaser — ensure amber section is motivating
- [ ] CTA "Start turen" — refine sticky button styling
- [ ] Overall scroll experience — smooth flow from hero → metadata → kart → stopp → reward → CTA

**Files:** `components/variants/trip/TripPreview.tsx`

## Phase 4: Active Mode Polish

- [ ] Transition text — make more visually distinct (not just italic blue)
- [ ] Progress indicator — ensure completion count and progress bar are clear
- [ ] "Merk som besøkt" button — ensure it's intuitive with GPS feedback
- [ ] Mobile title overlay — refine spacing and readability
- [ ] Mode toggle — verify Guided/Free switching works smoothly

**Files:** `components/variants/trip/TripStopDetail.tsx`, `components/variants/trip/TripPage.tsx`, `components/variants/trip/TripStopPanel.tsx`

## Phase 5: E2E Visual Verification

- [ ] Start dev server on worktree port
- [ ] Screenshot Trip Library page
- [ ] Screenshot Preview page (Bakklandet)
- [ ] Screenshot Active mode (guided)
- [ ] Screenshot Completion screen
- [ ] Fix any visual bugs found
- [ ] TypeScript check + build verification

## Acceptance Criteria

- [ ] All 3 trips have cover images that display in Library and Preview
- [ ] Trip Library feels polished and "clickable" on mobile
- [ ] Preview page has smooth scroll experience with clear CTA
- [ ] Active mode transition text and progress are clear
- [ ] Full demo flow works: Library → Preview → Active → Completion
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
