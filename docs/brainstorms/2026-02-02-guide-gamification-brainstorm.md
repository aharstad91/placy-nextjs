# Brainstorm: Guide Gamification med Hotellbelønninger

**Dato:** 2026-02-02
**Status:** Utforsket
**Neste steg:** `/workflows:plan`

---

## Hva vi bygger

Et belønningssystem for Placy Guide der hotelgjester får en konkret belønning (F&B-rabatt eller gratis produkt) når de fullfører en kuratert byvandring. Systemet verifiserer fullføring gjennom en kombinasjon av **tidskrav** og **GPS-sjekk** (når tilgjengelig).

### Kjerneflyt

1. **Start:** Gjest åpner guiden, ser intro med belønningsinfo ("Fullfør turen og få 15% i baren!")
2. **Underveis:** Marker hvert stopp som besøkt (GPS-hint hjelper, tidskrav validerer)
3. **Fullført:** Konfetti-animasjon, statistikk, digital voucher-visning
4. **Innløsning:** Vis skjerm i resepsjon → få belønning

---

## Hvorfor denne tilnærmingen

### Hotellverdi (alle fire)
- **Mersalg:** Gjesten kommer tilbake til hotellet og bruker penger i bar/restaurant
- **Gjesteopplevelse:** Differensiering, bedre anmeldelser, gjester føler seg ivaretatt
- **Lojalitet:** Gjesten husker hotellet, kommer tilbake neste gang
- **Markedsføring:** "Vi tilbyr gratis byvandring med belønning" som salgsargument

### Verifiseringslogikk (hybrid)
- **Tidskrav:** Minimum gangtid mellom stopp (kalkulert fra rute, -10% buffer)
- **GPS:** Sjekk om bruker er innenfor ~50m radius (når tilgjengelig)
- **Fallback:** Hvis GPS er utilgjengelig, er tidskravet alene tilstrekkelig
- **Anti-juks:** Må bruke realistisk tid på hele turen (ikke bare klikke gjennom)

### MVP-scope (Minimal)
- Ingen backend — alt i localStorage
- Manuell verifisering i resepsjon (vis skjerm)
- Kan bygges uten Supabase-integrasjon

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Verifisering | Tid + GPS (fallback til kun tid) | Balanse mellom integritet og UX |
| Innløsning | Vis skjerm i resepsjon | Enklest, ingen integrasjon nødvendig |
| Belønningstyper | F&B-rabatt, gratis enkeltprodukt | Realistisk for hotell, driver mersalg |
| Teknisk kompleksitet | Minimal (ingen backend) | YAGNI — bevis konseptet først |
| Fullført-skjerm | Badge + konfetti + stats + voucher-kort | Full feiring for motivasjon |

---

## Designdetaljer

### Tidskrav-logikk

```
minTidMellomStopp = (kalkulertGangtid * 0.9)

Eksempel for "10,000 skritt Trondheim":
- Stopp 1→2: 8 min kalkulert → minimum 7.2 min før stopp 2 kan markeres
- Stopp 2→3: 12 min kalkulert → minimum 10.8 min
- osv.
```

### GPS-sjekk (når tilgjengelig)

```
radius = 50 meter
hvis (avstand til stopp < radius) {
  vis "Du er her!" hint
  tillat markering uten tidskrav-venting
}
```

### Fullført-skjerm

1. **Konfetti-animasjon** (canvas-basert, 2-3 sek)
2. **Badge:** Guide-logo i stor versjon med "Fullført!"-banner
3. **Statistikk:** Total tid, km gått, antall stopp, dato
4. **Voucher-kort:**
   - Hotellnavn + logo
   - Belønningsbeskrivelse ("15% rabatt i Scandic Bar")
   - "Vis denne skjermen i resepsjonen"
   - Tidsstempel for når turen ble fullført

### Lagring (localStorage)

```typescript
interface GuideCompletion {
  guideId: string;
  hotelId: string;
  startedAt: string;
  completedAt: string;
  stops: {
    stopId: string;
    markedAt: string;
    verifiedByGPS: boolean;
    coordinates?: { lat: number; lng: number };
  }[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
}
```

---

## Edge Cases

| Scenario | Løsning |
|----------|---------|
| **Lang pause** (2+ timer mellom stopp) | Maksimum tid mellom stopp = 4x kalkulert. Overskrides → stopp må re-markeres |
| **Delt telefon** (familie) | Fullføring knyttet til enhet, ikke person. Én belønning per enhet per guide |
| **Nett-avbrudd** | Alt i localStorage. GPS fungerer offline. Kun første lasting trenger nett |
| **Avbrutt tur** | State bevares i localStorage. Kan fortsette senere (innenfor maks-tid) |
| **Bytter telefon** | Fullføring følger ikke med. Må starte på nytt |

---

## Fremtidige muligheter: Guide-segmenter

Guider kan tilpasses ulike målgrupper med forskjellig tone, stopp-utvalg, og gamification:

| Segment | Guide-type | Belønning |
|---------|-----------|-----------|
| **Barnefamilier** | Treasure hunt med hint og skjulte markører | Is/snacks |
| **Business-reisende** | Effektiv kulturtur (45 min) | Gratis kaffe |
| **Eldre par** | Rolig tempo, benker markert, kortere avstander | Rabatt i restaurant |
| **Foodies** | Kulinarisk rute med smaksstopp | Rabatt hos partner-restaurant |
| **Ungdom** | Pokemon Go-stil med achievements | Gamified badges |

*Notert for senere — ikke del av MVP.*

---

## Åpne spørsmål

1. **Utløpstid:** Hvor lenge er en fullført voucher gyldig? (forslag: til utsjekk)
2. **Flere guider:** Kan gjest få belønning for flere guider? (forslag: én per guide per opphold)
3. **Deling:** Skal gjest kunne dele fullføringen på sosiale medier? (forslag: ja, enkel "Del"-knapp)

---

## Tekniske hensyn

### Eksisterende infrastruktur å bygge på
- `completedStops` state i GuidePage.tsx
- "Merk som besøkt"-knapp i GuideStopPanel.tsx
- `useGeolocation` hook for GPS
- `precomputedDurationMinutes` per stopp (kan utvides til per-segment)

### Nye komponenter trengs
- `GuideCompletionScreen.tsx` — konfetti + badge + voucher
- `useGuideCompletion` hook — tidskrav-logikk, localStorage
- Utvidelse av `GuideStopConfig` med `estimatedMinutesFromPrevious`

### Konfetti-bibliotek
- Forslag: `canvas-confetti` (lett, populært)
- Alternativ: Egenbygd CSS-animasjon

---

## Neste steg

Kjør `/workflows:plan` for å lage implementasjonsplan med:
- Komponentstruktur
- Data-skjema-utvidelser
- Steg-for-steg implementasjon
- Testscenarier
