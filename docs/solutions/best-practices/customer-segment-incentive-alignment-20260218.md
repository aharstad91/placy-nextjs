---
module: System
date: 2026-02-18
problem_type: best_practice
component: development_workflow
symptoms:
  - "Pitch deck targets hotels and cruise — no proven willingness to pay"
  - "Hotel incentives misaligned: Placy delivers value after room is booked"
  - "Cruise incentives misaligned: passengers already paid for cabin"
  - "Hotels may lose F&B revenue if guests discover nearby alternatives via Placy"
root_cause: logic_error
resolution_type: workflow_improvement
severity: high
tags: [product-market-fit, customer-segment, incentive-alignment, eiendom, real-estate, go-to-market, pitch]
---

# Best Practice: Customer Segment Selection — Incentive Alignment Before Building

## Problem

Placy ble pitchet mot hoteller og cruiselinjer som primære kundesegmenter. Etter pitch til forretningsutvikler Markus ble det klart at disse segmentene har **misalignede incentiver** — Placy leverer verdi *etter* transaksjonen er gjort. Ingen bevist betalingsvilje.

## Kontekst

- Markus (forretningsutvikler): "Fantastisk prototype, men dette er ikke et produkt ennå. Dere har ikke avdekket betalingsvilje."
- Prototypen er live og imponerer, men det er et **luksusproblem** — god løsning uten bekreftet marked.

## Symptomer

1. **Hoteller**: Gjesten har allerede betalt for rommet. Hvorfor betale for Placy? I tillegg: Placy sender gjester *ut* av hotellet — potensielt kannibaliserer bar/restaurant-omsetning.
2. **Cruiselinjer**: Passasjeren har allerede betalt for lugar og tur. Hva turisten gjør i land er sekundært for operatøren.
3. **Generelt**: Ingen av segmentene har sagt "ja, jeg betaler for dette."

## Feil tilnærming

**Bygde for egen frustrasjon som turist** — "Jeg savnet dette i Barcelona/Bergen" — i stedet for å identifisere hvem som har størst betalingsvilje. Turisme er et stort marked, men "stort marked" ≠ "noen betaler meg." Google Maps er godt nok for de fleste.

**Hoppet fra demo til prisliste** i pitch — uten å vise at noen faktisk har problemet.

## Løsning: Incentiv-alignment-sjekk

### Nøkkelspørsmålet

**Hvor leverer stedsinnsikt verdi *før* en transaksjon?**

Der noen tar en kjøpsbeslutning basert på hva som er i nærområdet. Der "dette er et fantastisk nabolag" direkte påvirker om noen åpner lommeboka.

### Eiendom — alignet segment

| Dimensjon | Turisme (hotell/cruise) | Eiendom (privat/næring) |
|-----------|------------------------|------------------------|
| Beslutning | "Hvor spiser vi i kveld?" | "Skal vi kjøpe for 6M?" / "Skal vi flytte kontoret hit?" |
| Betalingsvilje | Lav (gratis alternativer) | Høy (alt som hjelper salg) |
| Kjøper | Turist (betaler ikke) | Utvikler/forvalter (markedsbudsjett) |
| Timing | Etter kjøp (reisen er bestilt) | Før kjøp (vurderer å signere) |
| Konkurrent | Google Maps, TripAdvisor | Generisk prospekttekst |

### To sub-segmenter med ulik dynamikk

**Privat eiendomsutvikling:**
- Kjøper: Utvikler (OBOS, JM, Veidekke, lokale)
- Bruk: Nabolagsrapport i salgsprospekt
- Modell: Engangs per prosjekt (15-50k)
- Risiko: Ikke recurring, må selge på nytt hver gang

**Næringseiendom:**
- Kjøper: Forvalter (Entra, Olav Thon, KLP Eiendom, Møller)
- Bruk: Markedsføre kontorbygg mot leietakere
- Modell: Porteføljebasert = recurring. Én avtale = mange eiendommer.
- Risiko: Lang salgssyklus, men mye høyere LTV

## Hva som allerede fungerer teknisk

Report og Explorer er bygd like mye for eiendom som turisme. Trips er turisme-spesifikt men har fått minst fokus. Teknisk pivot = minimal innsats:

1. **Rekkefølge/vinkling** på themes (Transport og Hverdagsbehov viktigere for kontorbygg enn Kultur)
2. **Noen manglende kategorier** (barnehage, skole, coworking)
3. **Språk og tone** — "Utforsk Scandic Nidelven" → "Nabolaget rundt Ferjemannsveien 10"
4. **Nytt prosjekt** i databasen for KLP-demo

## Neste steg (validering)

1. **Ring Kine @ KLP Eiendom** — still spørsmål, ikke pitch. "Hvordan markedsfører dere nærområdet?"
2. **Vis Ferjemannsveien-demo** bare hvis hun beskriver en smerte
3. **Ring Kristian @ EM1** etterpå — for boligmarkedet
4. **Ikke bygg mer** før betalingsvilje er validert

## Prevention — Prinsipp for fremtidige segmentvalg

Før du velger kundesegment, svar på disse tre:

1. **Incentiv-alignment:** Leverer produktet verdi *før* kundens transaksjon, eller *etter*?
2. **Betalingsvilje:** Bruker kunden allerede penger på å løse dette problemet i dag?
3. **Konkurrent:** Konkurrerer du mot et profesjonelt produkt, eller mot "godt nok" (Google Maps)?

Hvis svaret er "etter, nei, og godt nok" — gå videre til neste segment.

## Related Issues

No related issues documented yet.
