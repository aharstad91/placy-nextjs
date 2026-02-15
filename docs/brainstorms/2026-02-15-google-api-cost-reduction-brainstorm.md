# Brainstorm: Kutt Google Maps Platform-forbruk

**Dato:** 2026-02-15
**Kontekst:** 339 NOK forbruk 1-15. februar. Mål: nær null.

---

## Problemanalyse

### Tre lekkasjer identifisert

**1. Places Photo proxy — høyest volum**
`featured_image` i databasen inneholder proxy-URLer som `/api/places/photo?photoReference=...&maxWidth=800`. ALLE bildevisninger (Explorer, Report, Guide, offentlige sider) trigger Google Places Photo API via serverless-funksjonen. Hvert bilde = 1 API-kall. Med hundrevis av POI-er og sidevisninger er dette tusenvis av kall.

**2. useOpeningHours hook — dyreste per kall**
`lib/hooks/useOpeningHours.ts` henter Places Details (8 felt: Basic + Contact + Atmosphere) for opptil 10 POI-er per viewport-endring i Explorer og Trip. Contact + Atmosphere data faktureres ekstra utover Basic.

**3. In-memory cache på Vercel — fungerer ikke**
`/api/places/[placeId]` har en `Map()`-cache med 24t TTL, men på Vercel serverless resettes den ved cold start/deploy. Effektivt null caching.

### Eksisterende assets som allerede løser deler

- `resolveGooglePhotoUrl()` — løser foto-redirect til direkte `lh3.googleusercontent.com`-URL. Brukt for 2 LCP-bilder per kategoriside (sesjon 2026-02-14). **Fungerer, men bare for 2 bilder per side.**
- `fetchAndCachePOIPhotos()` — admin batch-script som lagrer `photo_reference` + proxy-URL i `featured_image`. **Problemet: den lagrer proxy-URLer, ikke direkte CDN-URLer.**
- Google CDN-URLer er stabile, offentlige, og inneholder ingen API-nøkkel.

---

## Beslutning 1: Batch-resolve alle featured_image til CDN-URLer

**Tilnærming:** Migrasjon/script som:
1. Henter alle POI-er med `featured_image LIKE '/api/places/photo%'`
2. Extracter `photoReference` fra URL-strengen
3. Kaller `resolveGooglePhotoUrl()` for å få direkte CDN-URL
4. Oppdaterer `featured_image` med CDN-URL

**Kost:** Ca. 1 Google Places Photo API-kall per POI (engangskostnad). Med ~1000 POI-er = ~1000 kall = godt innenfor gratis-tier (10k/SKU/mnd).

**Effekt:** Eliminerer ALL runtime foto-proxy-trafikk. Etter migrering trenger ingen klient å kalle Google for å vise bilder.

**Fallback:** Beholder `photo_reference` i DB. Hvis CDN-URL utløper (sjeldent), kan vi re-resolve.

**Endring i fetch-poi-photos:** Fremtidige import-kjøringer lagrer direkte CDN-URL i `featured_image` i stedet for proxy-URL.

## Beslutning 2: Fjern/erstatt useOpeningHours

**Alternativ A: Fjern helt**
Åpningstider er nice-to-have i Explorer/Trip. Fjern hooken, fjern visningen. Null API-kall.

**Alternativ B: Cache i Supabase**
Legg til `opening_hours JSONB` og `is_open_now` (beregnet) på `pois`-tabellen. Oppdater via batch-script (admin-knapp eller cron) — én gang per 24t. Null runtime API-kall.

**Anbefaling:** Alternativ A. Åpningstider endres ofte, caching gir uansett stale data. Google Maps-lenken (som allerede finnes på kortene) viser alltid oppdaterte åpningstider. Brukerens behov dekkes.

## Beslutning 3: Fjern in-memory cache i /api/places/[placeId]

Etter beslutning 1 og 2 trengs denne endpointen knapt. Men den brukes fortsatt av `MapPopupCard` og `poi-card-expanded` for on-demand data.

**Tilnærming:**
- Kort sikt: Beholde endpointen, men den brukes nå kun av MapPopupCard (Report) og poi-card-expanded (Explorer). Volumet er lavt (brukerinitiell, ikke automatisk).
- Mellomlangt sikt: Lagre Places Details-data i Supabase ved import-tid, eliminer runtime-kall.

## Beslutning 4: Oppdater resolveGooglePhotoUrl bruk i category pages

I dag resolver `[area]/[category]/page.tsx` kun de 2 første LCP-bildene. Etter batch-migreringen er dette unødvendig — alle `featuredImage`-er er allerede CDN-URLer. Forenkle koden.

---

## Scope og prioritering

| # | Oppgave | Effekt | Innsats |
|---|---------|--------|---------|
| 1 | Batch-script: resolve alle proxy-URLer → CDN | Eliminerer ~80% av kall | Medium |
| 2 | Oppdater `fetchAndCachePOIPhotos` til å lagre CDN-URLer | Forhindrer fremtidig lekkasje | Lav |
| 3 | Fjern `useOpeningHours` fra Explorer og Trip | Eliminerer dyreste per-kall-lekkasjene | Lav |
| 4 | Fjern ISR-resolve i category page (forenkle) | Renere kode, færre ISR-tid API-kall | Lav |
| 5 | Rydd opp foto-proxy referanser i komponenter | Komponenter bruker `featuredImage` direkte | Lav |

### Ut av scope
- Migrasjon til Places API (New) — stor endring, liten gevinst nå
- Caching av Places Details i Supabase — lav prioritet etter at foto og åpningstider er fikset
- Fjerne `/api/places`-endpointene helt — kan gjøres senere

---

## Forventet resultat

**Før:** ~7 500 Places API-kall per halvmåned, 339 NOK
**Etter:** ~50-100 kall/mnd (kun MapPopupCard on-demand + nye imports), < 10 NOK

**Varig løsning:** Nye POI-imports lagrer CDN-URLer direkte. Ingen runtime Google API-avhengighet for bildevisning.
