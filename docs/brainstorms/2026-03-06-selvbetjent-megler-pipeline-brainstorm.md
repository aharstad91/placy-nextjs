# Brainstorm: Selvbetjent megler-pipeline

**Dato:** 2026-03-06
**Kontekst:** Samtale med Kristian (EM1-megler, privat eiendom) og Markus (forretningsutvikler). Mulighet for pipeline som treffer private singulare eiendommer, ikke bare boligprosjekter.
**Referanser:**
- Finn-profil: https://www.finn.no/meglerprofiler/4745473421
- Eksempel-bolig: https://www.eiendomsmegler1.no/boliger/mn-33260034

---

## Problemet

Placy har en kraftig generate-bolig pipeline (18 steg, Claude Code-drevet) som lager Explorer + Report for boligprosjekter. Men:

1. **Kun boligprosjekter** — ikke singulare eiendommer som utgjor storstedelen av boligsalg
2. **Krever teknisk kompetanse** — Claude Code slash-command, ikke noe en megler kan bruke
3. **Manuell prosess** — checkpoints, kvalitetsfiltre, skolekrets-oppslag

Eiendomsmeglere som Kristian selger 20-30 boliger i aret. Hver bolig trenger "hva finnes i nabolaget"-info. I dag lager de dette manuelt eller hopper over det.

## Brukerhistorie

> Som eiendomsmegler vil jeg skrive inn adressen til en bolig jeg skal selge, og fa et interaktivt nabolagskart jeg kan dele med potensielle kjopere — uten a trenge teknisk kompetanse.

## Beslutninger

### 1. Output: Explorer forst (MVP)
- Explorer (interaktivt kart med POI-er) er raskest a generere
- Ingen editorial content, ingen story generation, ingen tier-evaluering
- Report kan legges til som upsell/fase 2

### 2. Tilgang: Apen landing page (prototype)
- Deles som link direkte med meglere — ikke markedsfert apen side
- Ingen innlogging, ingen invitasjonskode
- Ingen rate limiting eller spam-beskyttelse i MVP

### 3. Input: Adresse + epost + boligtype
- Adresse med Mapbox Address Autofill (autocomplete)
- Epost for fremtidig notifikasjon
- Boligtype (valgfritt): Familie (default), Ung/Forstegangskjoper, Senior
- Boligtype pavirker hvilke temaer/kategorier som vektes

### 4. Hastighet: Async (~2-5 min)
- Megler submitter, far bekreftelse med fremtidig URL
- Pipeline kjores manuelt av Claude Code
- Epost-notifikasjon i fase 2 (manuell under testing)

### 5. Arkitektur: Claude Code-drevet pipeline
- Pipeline kjores av Claude via slash-command (`/generate-adresse`)
- Web-UI er request-form + bekreftelsesside
- Admin-side viser pending requests — trigger for a kjore pipeline
- Claude Code poller pending requests og kjorer dem

### 6. Branding: Rent kart, ingen Placy-branding
- Ingen Placy-logo, footer, eller "Powered by" pa Explorer-resultatet
- Megleren kan presentere det som sitt eget
- Generisk — ikke EM1-spesifikt

### 7. URL-struktur: placy.no/kart/{slug}
- Egen kort rute for megler-genererte kart
- Permanent URL — lever for alltid
- noindex (ikke SEO)
- Slug genereres fra adressen (f.eks. fjordveien-12-trondheim)

### 8. Landing page: Minimalistisk
- Bare skjema — ingen salgsside, ingen demo-screenshot
- Adressefelt, boligtype-velger, epost-felt, knapp
- Del av placy.no (samme Next.js-app)
- Alt pa norsk

### 9. Explorer: Forenklet
- Kart + POI-markorer + tema-sidebar (kategori/tema-filtrering)
- Lagre/bokmerke-funksjon per POI (liste for kjoperen)
- Ingen WelcomeScreen, admin-toolbar, redigeringsknapper
- Rett inn pa kartet — ingen onboarding

### 10. Boligtype-profiler
Tre profiler som pavirker temaer og kategori-vekting:

**Familie (default):**
- Vekter: skole, barnehage, lekeplass, idrett, dagligvare, park
- Alle 7 bolig-temaer aktive

**Ung / Forstegangskjoper:**
- Vekter: cafe, bar, restaurant, trening, kollektivtransport
- Nedprioriterer: skole, barnehage
- Temaer: Mat & Drikke, Transport, Trening, Hverdagsliv, Opplevelser

**Senior:**
- Vekter: lege, apotek, dagligvare, park, bibliotek
- Nedprioriterer: bar, nattklubb, idrett
- Temaer: Hverdagsliv, Natur, Transport, Trening

### 11. Kundestruktur
- En felles "Selvbetjent"-kunde i Supabase
- Alle megler-genererte prosjekter under denne kunden
- Megler-info (epost) lagres pa requesten, ikke som kunde

## Brukerflyt

```
1. Megler beseker placy.no/generer
2. Skriver inn adresse (Mapbox Address Autofill autocomplete)
3. Velger boligtype (Familie/Ung/Senior — default Familie)
4. Skriver inn epost
5. Klikker "Lag nabolagskart"
6. Ser bekreftelse: "Kartet ditt vil vaere tilgjengelig pa placy.no/kart/{slug}"
   + "Du far epost nar det er klart" + forventet ventetid
7. Request lagres i Supabase (generation_requests)
8. [Admin] Request dukker opp i /admin/requests som "pending"
9. [Claude Code] Poller pending requests, kjorer pipeline:
   - Verifiser geocoding
   - Opprett prosjekt under "Selvbetjent"-kunde
   - POI Discovery (Google + NSR + Barnehagefakta + Overpass)
   - Kvalitetsfilter
   - Opprett Explorer med boligtype-tilpassede temaer
10. Request oppdateres til "completed" med result_url
11. Megler kan na besoke placy.no/kart/{slug} og se Explorer
12. [Fase 2] Megler far epost med link
```

## Akseptansekriterier

### Landing page (placy.no/generer)
- [ ] AC1: Megler kan skrive inn adresse med Mapbox Address Autofill (autocomplete)
- [ ] AC2: Megler velger boligtype (Familie / Ung / Senior — default Familie)
- [ ] AC3: Megler oppgir epost
- [ ] AC4: Submit lagrer request i Supabase med status 'pending'
- [ ] AC5: Bekreftelsesside viser fremtidig URL: placy.no/kart/{slug}

### Admin (placy.no/admin/requests)
- [ ] AC6: Viser alle requests med status (pending/processing/completed/failed)
- [ ] AC7: Viser result-URL for ferdige requests

### Pipeline (Claude Code slash-command)
- [ ] AC8: Poller generation_requests for pending requests
- [ ] AC9: Oppretter prosjekt under "Selvbetjent"-kunde
- [ ] AC10: POI-discovery med riktige kategorier for valgt boligtype
- [ ] AC11: Oppdaterer request-status og result_url nar ferdig

### Explorer (placy.no/kart/{slug})
- [ ] AC12: Forenklet Explorer: kart + POI-markorer + tema-sidebar
- [ ] AC13: Ingen WelcomeScreen, admin-toolbar, redigeringsknapper
- [ ] AC14: Lagre/bokmerke-funksjon per POI (liste)
- [ ] AC15: Ingen Placy-branding synlig
- [ ] AC16: noindex (ikke SEO)
- [ ] AC17: Alt pa norsk

## Teknisk skisse

### Ny Supabase-tabell: generation_requests

```sql
CREATE TABLE generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  housing_type TEXT NOT NULL DEFAULT 'family'
    CHECK (housing_type IN ('family', 'young', 'senior')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  geocoded_lat DOUBLE PRECISION,
  geocoded_lng DOUBLE PRECISION,
  geocoded_city TEXT,
  address_slug TEXT,
  project_id TEXT REFERENCES projects(id),
  result_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### Nye ruter

| Rute | Type | Beskrivelse |
|------|------|-------------|
| `app/(public)/generer/page.tsx` | Public | Landing page med skjema |
| `app/kart/[slug]/page.tsx` | Public | Forenklet Explorer |
| `app/admin/requests/page.tsx` | Admin | Request-oversikt |
| `app/api/generation-requests/route.ts` | API | Server action for submit |

### Forenklet Explorer vs vanlig Explorer

| Feature | Vanlig Explorer | Forenklet (/kart) |
|---------|----------------|-------------------|
| Kart + markorer | Ja | Ja |
| Tema-sidebar | Ja | Ja |
| POI-detaljer popup | Ja | Ja |
| Lagre/bokmerke POI | Nei | Ja (nytt) |
| WelcomeScreen | Ja | Nei |
| Admin-toolbar | Ja | Nei |
| Redigeringsknapper | Ja | Nei |
| Placy-branding | Ja | Nei |

## Hva dette IKKE er (MVP)

- Ikke en SaaS-plattform med brukerkontoer
- Ikke real-time generation
- Ikke Report (fase 2)
- Ikke automatisk epost (fase 2)
- Ikke skalerbart til tusenvis av requests
- Ikke spam-beskyttet (prototype deles via direkte link)

## Fase 2 (etter MVP)

- Automatisk epost via Resend nar pipeline er ferdig
- Report-generering som upsell
- Push-varsel (ntfy.sh) nar ny request kommer
- Automatisk pipeline uten Claude Code-avhengighet
- Megler-dashboard med alle genererte kart
- Betalingslosning

## Risiko

| Risiko | Mitigering |
|--------|------------|
| Lav kvalitet pa suburbs-data | Kvalitetsfilter + bolig-kategorier fra generate-bolig |
| Mapbox Address Autofill fungerer darlig for norske adresser | Fallback til fritekst + manuell geocoding |
| Pipeline feiler midt i | Status settes til 'failed' med error_message |
