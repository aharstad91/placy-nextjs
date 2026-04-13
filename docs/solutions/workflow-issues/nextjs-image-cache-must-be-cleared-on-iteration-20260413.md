---
title: "Next.js Image cache må slettes ved iterasjon på samme URL"
category: workflow-issues
tags: [nextjs, image-optimization, cache, hmr, dev-workflow]
module: build-tooling
created: 2026-04-13
severity: medium
---

# Next.js Image cache + iterativ bildearbeid

**Gjelder:** Enhver Next.js-workflow der man itererer på bildefiler i `public/` uten å endre filnavn/URL.

## Problem

Scenario (illustrasjons-iterasjon):
1. Generer `public/illustrations/hverdagsliv.jpg` v1
2. Åpne `localhost:3000/rapport`, se v1
3. Regenerer fila til v2 (samme path)
4. Reload browser → ser **fortsatt v1**

Browser hard-reload (`Cmd+Shift+R`) fikser det noen ganger, ikke alltid.

**Ingen feilmelding, ingen warning.** Resultat: man tror genereringen har feilet, og regenererer på nytt — uten å innse at Next serverer cache.

## Root cause

Next.js Image-optimaliserer har en persistent disk-cache i:

```
.next/cache/images/
```

Cache-nøkkelen er basert på:
- URL (path + query params)
- Size-parameters (w, q)

**IKKE basert på filens mtime eller innhold.**

Så når du regenererer samme path med nytt innhold, Next serverer uendret den gamle optimaliserte versjonen inntil cache-entry utløper (default 60 sekunder minimumTTL, men i praksis lengre).

## Løsning

### Under iterativt arbeid

```bash
rm -rf .next/cache/images/
# Deretter reload browser
```

Eller kombinert med navigasjon:

```bash
rm -rf .next/cache/images/ && curl -s http://localhost:3000/rapport > /dev/null
```

### I devtools

I Chrome DevTools reload-knappen: høyreklikk → "Empty Cache and Hard Reload". Men hvis Next har cachet det optimaliserte bildet på disk, hjelper ikke browser-cache-clear alene — Next serverer fortsatt samme optimaliserte fil.

**Konklusjon:** For bildegenerering-iterasjon → fjern `.next/cache/images/`, ikke bare browser-cache.

### Som del av en iterasjon

Hvis du bruker et script til å regenerere og verifisere, inkluder cache-rens:

```bash
python3 /tmp/gen_illustration.py && \
  rm -rf .next/cache/images/ && \
  echo "cache cleared, reload browser"
```

## Alternative tilnærminger

### Ikke anbefalt: query-param cache-busting

```tsx
<Image src={`/illustrations/hverdagsliv.jpg?v=${Date.now()}`} ... />
```

Problem: Next optimaliseringsprocess honorerer ikke query-params som cache-nøkkel for opprinnelige URL-er i `/public`. Cache-bust i URL skaper potensielt feil response i dev, og endrer ikke prod-adferd.

### Ikke anbefalt: unoptimized={true}

```tsx
<Image src="..." unoptimized ... />
```

Problem: Omgår problemet, men taper også optimalisering i prod. Bare akseptabelt hvis bildet skal leveres som-er.

### Anbefalt: disk-cache-rens

Rettferdig kompromiss — optimalisering er OK i prod, bare iterativ dev trenger cache-rens.

## Debug-trinn når bildeendring ikke vises

1. Verifiser at filen faktisk er oppdatert på disk (`ls -la` + åpne i Preview)
2. `rm -rf .next/cache/images/`
3. Hard-reload browser (eller `navigate_page ignoreCache:true`)
4. Inspiser `<img>`-tag i DevTools for å se hvilken URL Next faktisk server
5. Åpne URL-en direkte (`/_next/image?url=...`) for å bekrefte at serveren returnerer ny versjon

## Fant i context

PR #64 (Placy rapport shell) — under iterativ generering av 6 kategori-illustrasjoner + 7 spot-ikoner opplevd gjentatte ganger. Trigget både falsk "crop virker ikke"-alarm og falsk "generering feilet"-mistanke.

## Relatert

- `docs/solutions/best-practices/gemini-reference-background-override-20260413.md`
- `docs/solutions/best-practices/auto-crop-idempotency-20260413.md`
