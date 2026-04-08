---
title: "Eiendom URL-arkitektur — migration fra /for/ og /kart/ til /eiendom/"
category: architecture-patterns
date: 2026-03-07
tags: [url-arkitektur, migration, redirect, route-group, middleware, next-js, eiendom]
severity: high
---

# Eiendom URL-arkitektur — komplett migrasjon

## Problem

Placy hadde tre ulike URL-strukturer for eiendomsprosjekter:
- `/for/{kunde}/{prosjekt}/explore` — B2B Explorer
- `/for/{kunde}/{prosjekt}/report` — Report
- `/kart/{slug}` — Selvbetjent Explorer (hardkodet "selvbetjent"-kunde)

Problemene: ingen vertikal-identitet i URL, selvbetjent-prosjekter uten kobling til megler, ingen Visningsassistent, ingen lead-gen-verktøy, spredte path-referanser.

## Løsning — 5 arkitekturmønstre

### 1. Route Group `(tools)/` for slug-konflikt

**Problem:** `/eiendom/generer` og `/eiendom/tekst` kolliderer med `[customer]`-segmentet — Next.js kan ikke vite om "generer" er en kunde eller en statisk side.

**Løsning:** Route group med parenteser — usynlig i URL, men resolves før dynamiske segmenter:

```
app/eiendom/
├── (tools)/           ← Route group: usynlig i URL
│   ├── generer/       → /eiendom/generer (ikke /eiendom/(tools)/generer)
│   └── tekst/         → /eiendom/tekst
└── [customer]/        ← Dynamisk segment (resolves ETTER statiske)
    └── [project]/
```

**Hvorfor det fungerer:** Next.js resolves statiske ruter (inkl. route groups) før dynamiske segmenter. Parentesene gjør mappen "usynlig" i URL-en. Samme mønster som `(public)/` for SEO-sider.

**Referanse:** `docs/solutions/architecture-patterns/public-seo-site-route-architecture-20260213.md`

### 2. ProductNav `exact` match for root-path Explorer

**Problem:** Explorer er root path (`/eiendom/X/Y`), som er et prefiks av `/eiendom/X/Y/rapport`. Standard `.startsWith()`-logikk highlighter begge tabs.

**Løsning:** Legg til `exact?: boolean` på `ProductLink`:

```typescript
// components/shared/ProductNav.tsx
export interface ProductLink {
  label: string;
  href: string;
  exact?: boolean; // Exact pathname match only
}

// Active-tab matching:
const isActive = (p: ProductLink) =>
  p.exact
    ? pathname === p.href
    : pathname === p.href || pathname.startsWith(p.href + "/");
```

**I layout:** Explorer-tab settes med `exact: true`, sub-path tabs bruker prefix matching.

### 3. Middleware redirect med frozen-path exclusion

**Problem:** `/for/` passthrough (`if (firstSegment === "for") return NextResponse.next()`) kortsluttet alle redirects. Men trips-sider er frosne og MÅ forbli.

**Løsning:** Fjern blanket passthrough, legg til eksplisitt exclude:

```typescript
if (firstSegment === "for") {
  // Frozen paths: passthrough
  if (segments.length >= 4) {
    const subPath = segments[3];
    if (["trips", "trip"].includes(subPath)) {
      return NextResponse.next();
    }
  }

  // /for/X/Y/explore → /eiendom/X/Y (301)
  if (segments.length >= 4 && segments[3] === "explore") {
    return NextResponse.redirect(
      new URL(`/eiendom/${segments[1]}/${segments[2]}${search}`, request.url),
      301
    );
  }
  // ... osv for report → rapport, landing → root
}
```

**Viktig:** Bruk `301` (ikke `308`) for redirect-status. `permanentRedirect()` i thin server components, `NextResponse.redirect(url, 301)` i middleware.

### 4. Thin server component for DB-avhengig redirect

**Problem:** `/kart/{slug}` trenger DB-lookup for å finne riktig kunde. Middleware kjører på HVER request — DB-lookup der gir unødvendig latens.

**Løsning:** Behold `app/kart/[slug]/page.tsx` som thin redirect:

```typescript
import { permanentRedirect, notFound } from "next/navigation";

export default async function KartRedirect({ params }) {
  const { slug } = await params;
  const { data } = await supabase
    .from("generation_requests")
    .select("address_slug, customer_id")
    .eq("address_slug", slug)
    .single();

  if (!data) notFound();
  permanentRedirect(eiendomUrl(data.customer_id ?? "selvbetjent", data.address_slug));
}
```

**Fordel:** Bare `/kart/`-trafikk treffer DB. Next.js route cache cacher resultatet.

### 5. Customer upsert med reserved slug denied-list

**Problem:** Parallelle requests kan opprette duplikate kunder. Kunde-slug kan kollidere med statiske ruter ("generer", "tekst").

**Løsning:**

```typescript
const RESERVED_SLUGS = ["generer", "tekst", "admin", "api"];

// Validering
if (RESERVED_SLUGS.includes(customerSlug)) {
  throw new Error("Ugyldig meglerkontor-navn");
}

// Race-safe upsert (customers.id = slug)
await supabase
  .from("customers")
  .upsert({ id: customerSlug, name: brokerageName }, { onConflict: "id" });
```

## Sentralisert URL-helper

All eiendom-path-bygging via `lib/urls.ts`:

```typescript
export function eiendomUrl(customer: string, slug: string, mode?: "rapport" | "visning") {
  const base = `/eiendom/${customer}/${slug}`;
  return mode ? `${base}/${mode}` : base;
}
```

Aldri hardkod `/eiendom/` paths inline — bruk `eiendomUrl()`.

## Filstruktur etter migrering

```
app/eiendom/
├── layout.tsx                    — Mapbox CSS + Plausible analytics
├── (tools)/generer/              — Bestillingsskjema
├── (tools)/tekst/                — Beliggenhetstekst-generator
└── [customer]/[project]/
    ├── layout.tsx                — ProductNav (dynamiske tabs)
    ├── page.tsx                  — Explorer (default) + generation status
    ├── rapport/page.tsx          — Report
    └── visning/page.tsx          — Visningsassistent
```

## Forebygging

- **Bruk alltid `eiendomUrl()`** for path-referanser — aldri hardkod
- **Test robots.txt og sitemap.xml** etter middleware-endringer (kjent gotcha)
- **Route group `(tools)/`** for alle statiske sider under dynamisk segment
- **`exact: true`** på ProductNav tabs som er root path
- **Reserved slug denied-list** ved kunde-opprettelse

## Relaterte dokumenter

- [public-seo-site-route-architecture-20260213.md](../architecture-patterns/public-seo-site-route-architecture-20260213.md) — Samme `()` route group mønster
- [sitemap-robots-404-production-PublicSite-20260213.md](../integration-issues/sitemap-robots-404-production-PublicSite-20260213.md) — Middleware whitelist for root routes
- [selvbetjent-megler-pipeline-20260306.md](../feature-implementations/selvbetjent-megler-pipeline-20260306.md) — Pipeline som nå bruker /eiendom/
