---
title: Editorial Hooks — Aldri bruk ferskvare-informasjon
category: best-practices
tags: [editorial-hooks, generate-hotel, content-quality, data-integrity]
date: 2026-02-08
symptoms:
  - Editorial hook inneholder spesifikke priser som endrer seg
  - Editorial hook refererer til åpningstider som ikke stemmer
  - Editorial hook plasserer POI feil (f.eks. "inne i City Syd" når det ikke stemmer)
  - Kunden får klager på feil informasjon i rapporten
---

# Problem

Editorial hooks generert av `/generate-hotel` inneholdt "ferskvare-informasjon" — data som raskt blir utdatert:

1. **Spesifikke priser:** "Pizza til 159 kr på hverdager" — prisen endres uten at vi fanger det opp
2. **Åpningstider:** "Åpent mandag-lørdag kl. 18-22" — tider endres jevnlig
3. **Beliggenhet inne i bygg:** "Hurtigmatalternativet inne i City Syd" — POI var ikke inne i City Syd
4. **Tidsbegrensede tilbud:** "Lunsjtilbud kl. 11-15 til 159 kr" — kampanjer endres kontinuerlig

## Konsekvens

Feil info i Placy → slår direkte tilbake på oss OG kunden (hotellet). Hotellet har solgt dette som en kvalitetstjeneste til sine gjester. Feil priser eller tider undergraver tilliten.

# Løsning

Lagt til eksplisitt "ferskvare-regel" i `/generate-hotel` Steg 10 som forbyr:

| ALDRI bruk | Bruk i stedet |
|------------|---------------|
| Spesifikke priser (kr, NOK) | "Rimelig prisnivå" / "Kjent for god pris" |
| Åpningstider (kl. X-Y) | "Populært for middag" / "Godt lunsjsted" |
| Tidsbegrensede tilbud | Utelat |
| Beliggenhet inne i bygg (med mindre verifisert) | Bruk faktisk gateadresse |
| Spesifikke menyer med pris | "Kjent for sesongmenyen" |
| Spesifikke leveringstjenester | "Tilbyr levering" |

**Holdbar informasjon (bruk dette):**
- Etableringsår og historie
- Kategori/kjøkkentype
- Atmosfære og karakter
- Nabolagskontekst (gatenavn, nærhet til kjente steder)
- Generelle tips uten tall

# Prinsipp

> Editorial hooks skal være **tidløse** — de skal være like korrekte om 6 måneder som i dag. Alt som kan endre seg innen uker, er ferskvare og skal unngås.
