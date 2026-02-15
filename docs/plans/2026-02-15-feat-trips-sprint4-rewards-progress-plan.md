---
title: "feat: Trips Sprint 4 — Rewards/progress demo data"
type: feat
date: 2026-02-15
---

# Trips Sprint 4 — Rewards/progress i demo

## Overview

Sprint 4 focuses on making the rewards and progress system functional for the Scandic Nidelven demo. Most of the code is already built (completion screen, GPS verification, confetti, voucher card). The remaining work is data setup and end-to-end verification.

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Progress indicator (header) | Done | Shows `X/N stopp` + progress bar |
| Progress dots (mobile) | Done | Filled dots per stop in guided mode |
| "Merk som besøkt" button | Done | GPS verification + fallback timer |
| TripCompletionScreen | Done | Confetti, stats, voucher card |
| TripIntroOverlay | Done | Shows reward teaser before trip starts |
| Rewards in Preview | Done | Amber section with reward title/description |
| RewardConfig in TripConfig | Done | title, description, hotelName, validityDays |
| `project_trips` table | Done | Has reward columns |
| Demo rewards data | **Missing** | No `project_trips` rows linking Scandic to trips |

## Tasks

### Task 1: Seed `project_trips` for Scandic Nidelven
- [x] Create migration linking 3 featured trips to Scandic Nidelven project
- [x] Set reward overrides: title, description, code, validity_days
- [x] Set `start_poi_id` to Scandic Nidelven hotel POI (if available)
- [x] Set `welcome_text` for intro overlay

### Task 2: Fix `hotelName` in RewardConfig
- [x] `buildRewardConfig()` in `trip-adapter.ts` hardcodes `hotelName: ""`
- [x] Pass project name through to RewardConfig (from query context or override)

### Task 3: End-to-end verification
- [x] Trip Library shows trips for Scandic Nidelven
- [x] Preview shows reward teaser
- [x] Active mode: intro overlay shows reward
- [x] Mark all stops → completion screen with voucher
- [x] Voucher shows hotel name, reward, expiry, live clock

### Task 4: TypeScript + build verification
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes

## Acceptance Criteria

- [ ] Scandic Nidelven guest sees 3 trips with rewards
- [ ] Completing a trip shows confetti + voucher with "Scandic Nidelven" branding
- [ ] Voucher has live clock (anti-screenshot) and expiry date
- [ ] Flow works: Library → Preview → Start → Mark stops → Complete → Voucher
