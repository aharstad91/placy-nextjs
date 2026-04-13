---
title: "Next.js redirect for legacy demo-URL-er — bevar delte lenker"
category: architecture-patterns
tags: [nextjs, redirects, url-migration, demos, seo]
module: next-config
created: 2026-04-13
---

# Next.js redirect for legacy URL-er

**Gjelder:** Når en rute flyttes eller slettes — f.eks. `/demo/wesselslokka` → `/eiendom/broset-utvikling-as/wesselslokka/rapport`.

## Problem

Demoer deles via lenke (email til megler, Slack, bookmarks, LinkedIn-posts). Når vi flytter ruten og sletter den gamle, brekker alle disse lenkene → 404. Frustrerende for mottakere, dårlig for sales-pipeline, taper potensielle oppfølgingssamtaler.

Å søke etter alle referanser er upraktisk — vi ser ikke eksterne lenker.

## Løsning: 308 Permanent Redirect i `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... andre config-felter

  async redirects() {
    return [
      {
        source: "/demo/wesselslokka",
        destination: "/eiendom/broset-utvikling-as/wesselslokka/rapport",
        permanent: true, // 308 Permanent Redirect (bevarer HTTP-metode + body)
      },
    ];
  },
};

export default nextConfig;
```

### `permanent: true` vs `false`

| Flagg | HTTP-kode | Bruk |
|-------|-----------|------|
| `true` | 308 Permanent | URL flyttet permanent (vår case) |
| `false` | 307 Temporary | Midlertidig (A/B-test, feature flag) |

Next.js bruker 308/307, ikke 301/302. 308 er "moderne 301" — bevarer HTTP-metode (POST forblir POST), som 301 ikke alltid gjør i praksis. For GET-ruter er effekten identisk.

## Rekkefølge ved rute-migrering

1. Bygg ny rute og verifiser den fungerer
2. **Legg til redirect** i `next.config.mjs`
3. Deploy redirect (før sletting av gammel kode)
4. Verifiser redirect i prod: `curl -I https://placy.no/demo/wesselslokka`
5. Slett gamle filer (`/app/demo/...`, assets, osv.)
6. Deploy sletting

Rekkefølgen er viktig: redirect-en må være live **før** gamle filer slettes, ellers får brukere 404 i vinduet mellom.

## Testing

```bash
# Lokal dev
curl -I http://localhost:3000/demo/wesselslokka
# → HTTP/1.1 308 Permanent Redirect
# → location: /eiendom/broset-utvikling-as/wesselslokka/rapport

# Prod
curl -I https://placy.no/demo/wesselslokka
```

## Flere redirects samtidig

```javascript
async redirects() {
  return [
    { source: "/demo/wesselslokka", destination: "/eiendom/broset-utvikling-as/wesselslokka/rapport", permanent: true },
    { source: "/demo/gamle-prosjekt", destination: "/eiendom/kunde/prosjekt/rapport", permanent: true },
    // Bruk wildcard for mønstre:
    { source: "/demo/:slug", destination: "/eiendom/:slug/rapport", permanent: true },
  ];
}
```

## Når NOT å bruke redirect

- **Intern navigasjon** (Link-komponenter i appen): bare oppdater Link-href-et
- **Midlertidig vedlikehold**: bruk `permanent: false` (307)
- **Hvis URL-en aldri har vært delt eksternt**: bare slett, ingen redirect nødvendig

## Checkliste ved ny demo-migrering

- [ ] Ny rute fungerer i staging/prod
- [ ] Redirect lagt til i `next.config.mjs`
- [ ] `curl -I` verifiserer 308 + riktig location
- [ ] Deploy redirect først
- [ ] Slett gamle filer i egen commit
- [ ] Sjekk WORKLOG/PR-beskrivelser etter referanser til gammel URL — oppdater der det gir mening

## Relatert

- `next.config.mjs` — levende redirects-liste for Placy
- Gjelder alle demo-opprydninger, ikke bare Wesselsløkka
