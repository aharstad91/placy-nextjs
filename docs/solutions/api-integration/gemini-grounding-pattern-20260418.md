---
title: "Gemini Grounding for Report Content"
category: api-integration
tags: [gemini-api, google-search, grounding, report-generation, build-time-llm, ssrf, deep-merge]
module: report-generation
date: 2026-04-18
symptom: "Claude's WebSearch finds 1-3 sources per category; Google AI Mode finds 6-17 with hyperlocal coverage"
root_cause: "WebSearch is single-query, single-source. Google Search grounding triangulates automatically via Gemini."
---

# Gemini Grounding for Report Content

## Problem

Placy's `/generate-rapport`-skill bruker Claude's WebSearch for å finne fakta om nabolag (skoler, transport, kultur). Retrieval-kvaliteten matcher ikke Google AI Mode — vi finner færre kilder, mister hyperlokal kunnskap (Estenstadmarka km-fakta, busslinje-nummer, barnehage-historikk), og må manuelt triangulere framtids-fakta (Steg 3.5).

Samtidig sendte `readMoreQuery`-knappen bruker ut til `google.com/search?udm=50` — brukeren forlot Placy.

## Environment

- Module: `.claude/skills/generate-rapport`, `lib/gemini/`, `scripts/gemini-grounding.ts`
- Stack: Next.js 14, TypeScript, Supabase JSONB, Gemini 2.5 Flash
- API: `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` med `google_search`-tool
- Date: 2026-04-18

## Solution

Én Gemini-kall per kategori (7 totalt, parallellt ~12s) populærer `products.config.reportConfig.themes[].grounding` med narrative + kilder + `searchEntryPointHtml`. Build-time only (ingen runtime LLM). Skill leser `grounding.narrative` som fact-feed i Steg 7; UI viser `searchEntryPointHtml` i egen drawer (Google ToS-krav).

### Nøkkel-mønstre

**1. Build-time LLM, aldri runtime**
Placy-regel: ingen runtime API-kall til LLM. Grounding genereres én gang per prosjekt via CLI-script, lagres i JSONB.

**2. `x-goog-api-key`-header, ikke URL-querystring**
URL-querystring leker API-nøkkel i logs (Nginx, Vercel, Sentry). Header er standard.

**3. searchEntryPointHtml er Google ToS-påkrevd**
`groundingMetadata.searchEntryPoint.renderedContent` må rendres verbatim med styling. DOMPurify server-side før lagring (Google garanterer ikke trygg HTML). Hvis feltet mangler → omit hele kategorien (vi kan ikke vise grounding uten attribution).

**4. Deep-merge PATCH, aldri flat replace**
`scripts/seed-wesselslokka-summary.ts` er golden pattern: whitelist-guard på `reportConfig`-nøkler → backup full row → match themes på `id` → shallow-merge → PATCH med `updated_at=eq.{read_value}` (optimistic lock) → post-write deep-equal for preserved keys. Flat replace ville klobret `summary`/`brokers`/`cta`/`trails`/`heroIntro`.

**5. Parallell Gemini + URL-resolve**
`Promise.allSettled` over 7 kategorier (sekvensielt = 60-100s, parallellt = 10-15s). URL-resolve (redirect-følging for å vise domene-pill i UI) med `p-limit(5)` per kategori.

**6. SSRF-safe URL-resolve**
Redirect-følging uten SSRF-guard kan treffe intranett (169.254.169.254 AWS-metadata, 10/8 osv.). Mønster: DNS pre-resolve via `dns.lookup(host, { all: true })` → `ipaddr.js` `range() === "unicast"` → fetch med `redirect: "manual"` + re-sjekk per hop → final må være https → max 3 hops. Blokkerer både direkte-IP-URLer og DNS-rebinding via alt-addresses.

**7. Omit ved feil, ikke null**
Per-kategori-feil → ikke sett `grounding: null`. Behold optional `grounding?:` i TS — `undefined` matcher "skjul knapp" i UI null-kontrakten. Totalfeil-abort ved ≥5/7 failure.

**8. Zod-parse ved render-boundary**
`ReportThemeGroundingViewSchema` med `groundingVersion: z.literal(1)` parses i `report-data.ts`. Silent skip + `console.error` ved invalid shape. Version-bump (fra 1 til 2) tvinger regenerering av alle prosjekter.

## Refaktor-triggers

**Når dette mønsteret bør endres:**
- Grounding-shape endres → bump `groundingVersion` + oppdater Zod-schema + re-kjør script uten `--force`-check
- Gemini introduserer breaking change i `google_search`-tool → fall tilbake til Steg 3.5 manuell triangulering midlertidig
- Locale EN trengs → `grounding: { no, en }` struktur, 14 kall per prosjekt
- Grounding-volum ≫100 prosjekter → cron + cache-TTL (i dag: manuelt rerun på kundeforespørsel)

## References

- `scripts/gemini-grounding.ts` (CLI)
- `lib/gemini/{types,sanitize,url-resolver,grounding,index}.ts`
- `lib/gemini/*.test.ts` (44 tester, inkl. SSRF-matrix + Zod + DOMPurify-whitelist)
- `lib/types.ts:172-260` (`ReportThemeGrounding` + view-schema)
- `app/api/revalidate/route.ts` (revalidateTag-hook)
- `scripts/seed-wesselslokka-summary.ts` (golden pattern for PATCH)
- Plan: `docs/plans/2026-04-18-feat-gemini-grounding-rapport-plan.md`
- POC: `scripts/poc-gemini-grounding.mjs` (validert mot Stasjonskvartalet + Wesselsløkka)
