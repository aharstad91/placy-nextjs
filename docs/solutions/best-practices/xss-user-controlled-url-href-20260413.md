---
title: "XSS via user-controlled URL i href — defense in depth"
category: best-practices
tags: [xss, security, url-validation, defense-in-depth, supabase]
module: theme-utils
created: 2026-04-13
severity: high
---

# XSS via user-controlled URL i href

**Gjelder:** Alle steder der en DB-lagret URL renderes i `<a href={...}>` eller andre URL-attributes.

## Problem

Når en kolonne som `projects.homepage_url` er `TEXT NULL` uten validering, kan angriper (eller uheldig input) lagre farlige URL-schemes:

```
javascript:alert(document.cookie)
data:text/html,<script>...</script>
vbscript:...
```

Renderes i `<a href={homepageUrl}>Besøk</a>` → klassisk XSS når bruker klikker.

**Hvorfor dette er en reell risiko:**
- Admin-UI kan komme til å la noen lime inn URL
- Seed-scripts fra fremtidige kunder kan inneholde feil
- Bulk-imports fra CSV/Google Sheets osv. er uhyggelig easy å forurense

## Løsning: Defense in depth (DB + client)

### Lag 1: DB CHECK-constraint

```sql
ALTER TABLE projects
ADD COLUMN homepage_url TEXT NULL
CONSTRAINT homepage_url_format CHECK (
  homepage_url IS NULL
  OR homepage_url ~* '^https?://'
);
```

Blokkerer alle farlige schemes på DB-nivå. Admin kan ikke lagre dårlig data selv om applikasjonen svikter.

**Hvorfor regex er bevisst løs (`~*`, case-insensitive, tillater HTTP):**
- HTTP er greit for dev/staging
- Vi blokkerer kun schemes som ikke er http(s)
- Strengere validering (f.eks. kun HTTPS) gjøres i applikasjonskode hvis nødvendig

### Lag 2: Client-side validering

```typescript
export function safeHref(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.includes(".")) return null;
  try {
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(normalized);
    // Defense in depth: sjekk protokoll igjen
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
```

- `new URL()` kaster ved ugyldig input — try/catch håndterer dette
- Protokoll-sjekk etter parsing fanger edge cases
- Returnerer `null` → render skjuler linken (`{href ? <a> : null}`)

### Bruk i komponenten

```tsx
import { safeHref, displayDomain } from "@/lib/theme-utils";

const href = safeHref(project.homepageUrl);
const domain = displayDomain(project.homepageUrl);

{href && domain && (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {domain}
  </a>
)}
```

### Bonus: `rel="noopener noreferrer"`

`target="_blank"` uten `rel="noopener"` lar den åpnede siden manipulere `window.opener` (tabnabbing). `noreferrer` hindrer også Referer-header-lekkasje til kundens side. **Alltid begge** for external links.

## Generell regel

**Enhver user-controlled URL som går inn i et attribute må valideres på TO lag:**
1. DB-nivå (CHECK-constraint eller trigger)
2. Applikasjonskode (URL-parser + protokoll-sjekk)

Én av lagene kan svikte (bug, feature-flag, deploy-order). Begge skal fange.

## Hvorfor ikke bare escape?

React escaper innhold automatisk, men **IKKE URL-protokoller**. `<a href={userInput}>` vil fortsatt rendere `javascript:...` som klikkbar link. Escaping hjelper ikke her.

## Relatert

- `lib/theme-utils.ts` — `safeHref` + `displayDomain`-implementasjoner
- Migration 061 — CHECK-constraint-eksempel
- [OWASP: Unvalidated Redirects and Forwards](https://owasp.org/www-community/attacks/Unvalidated_Redirects_and_Forwards)
