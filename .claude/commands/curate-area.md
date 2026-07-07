# /curate-area — Kuratér strøk (Lokalkunnskap / Moat-1)

Kuratér eller rediger et **strøks** `report_editorial` (drill-in-tekst + highlight-kandidater per tema) og propagér til alle boards i strøket. Dette er byggeklossen som gjør «adresse hvor som helst + nivå 2» mulig: `/provision-rapport --tier 2` ARVER fra strøket — finnes ingen kuratering, finnes ingen nivå 2.

Målet er at operatøren bare sier «kuratér strøket X» eller «endre teksten for tema Y i strøk Z».

## Modellen (les før bruk)

- **Én kuratering per strøk, delt av alle boards.** `areas.report_editorial` er kilden; hvert board arver via Steg 8 (`inherit-area-editorial`). Forbedrer du strøket, forbedres hvert nåværende og fremtidig board der — men en dårlig endring rammer alle samtidig.
- **Endringer propagerer IKKE selv.** Etter skriving til `areas` MÅ re-arv kjøres per board (steg 6 under). Strøk-endring uten re-arv = usynlig endring.
- **Form per tema:** `{ body, highlightCandidates: [4–6 POI-IDer], image? }`. Arven beholder de 3 første kandidatene som overlever boardets render-filtre (radius/kategori-cap/trust) — kurator-rekkefølgen ER prioriteringen, og 4–6 kandidater gir slack så fjerne boards i strøket også får punkter.
- **Gyldige tema-IDer = bolig-6:** `hverdagsliv`, `barn-oppvekst`, `mat-drikke`, `natur-friluftsliv`, `transport`, `trening-aktivitet` (fra `REPORT_THEME_DEFAULTS`). `opplevelser` og nærings-temaer kan IKKE strøk-kurateres i dag — staging-valideringen avviser dem.
- **`body` bærer kort-previewen også:** kortets lead avledes av `body`s første avsnitt (line-clamp-2 i UI). Skriv derfor `body` slik at første setning fungerer alene som preview.
- **Minimum-garantien:** ukuraterte boards har ALLEREDE generert kategoritekst + drill-in (deterministisk fra boardets POI-er). Kuratering ERSTATTER den genererte teksten med Lokalkunnskap — det er kvalitetsløftet, ikke tekst-vs-ingen-tekst.
- **POI-IDer er heterogene strenger** (`google-ChIJ…`, `bus-…`, `entur-NSR-…`, UUID-er) — aldri UUID-valider.

## Tekst-reglene (ratifisert av Andreas — ufravikelige)

1. **Presens — hva som ER der.** Aldri årstall, byggehistorikk eller «har lange tradisjoner», selv når verifisert.
2. **Beboer-perspektiv.** Målgruppen er boligkjøperen som blir beboer — drop turist-/besøksvinkler.
3. **Fakta, ikke poesi.** «Coop Mega med åpent til 23» > «lukten av nybakt brød».
4. **Navngi, aldri generaliser** (curator-prinsipp A): «Apotek 1 Nardo og Vitusapotek Rosenborg» > «flere apotek».
5. **Norm ~230–270 tegn per body** (etablert i de 7 første strøkene), ett avsnitt.
6. Full stemme-guide: `curator`-skillen (`.claude/skills/curator/SKILL.md`).

## Forutsetninger

- **Lokal dev-server på `:3000` med `ADMIN_ENABLED=true`** (re-arv kjører via `/api/admin/inherit-editorial`). Worktree: overstyr med `PROVISION_LOCAL_URL`.
- **Minst ett provisjonert board i strøket** — det gir POI-kandidatmenyen (`--list-pois`). Finnes ingen: kjør `/provision-rapport` (nivå 1) på en adresse i strøket først.
- Trondheim-strøk-boundary: `python3` med `pyproj` installert.

## Modus A: Kuratér NYTT strøk

### 1. Boundary + skjelett

```bash
# Trondheim-strøk (barneskolekrets er markedsenheten — samme kilde som de 7 første):
python3 scripts/extract-skolekrets-boundary.py --list                # se kretsnavn
python3 scripts/extract-skolekrets-boundary.py --krets <NAVN> --out data/areas/<slug>.staging.json

# Hel kommune (Malvik-modellen):
npx tsx scripts/fetch-area-boundary.ts --kommune <nr> --out data/areas/<slug>.staging.json
```

Skjelettet får boundary + 6 tomme tema-templates. **Finnes `areas`-raden ikke fra før** (sjekk med GET mot `v2.areas`), legg til `meta`-blokk i staging-fila — påkrevd for INSERT:

```json
"meta": {
  "name_no": "<Navn>", "name_en": "<Navn>",
  "slug_no": "<slug>", "slug_en": "<slug>",
  "center_lat": 63.4, "center_lng": 10.4,
  "level": "strok", "parent_id": "trondheim"
}
```

### 2. Highlight-kandidater (kurateringsmeny)

```bash
npx tsx scripts/curate-area.ts --list-pois <projectId>[,<projectId>…] --area <areaId> [--theme <temaId>]
```

Viser boardets POIer per tema, sortert på avstand fra strøkets senter. Velg 4–6 per tema i prioritert rekkefølge. Foretrekk POIer nær strøkets senter (kandidater i ytterkant dropper som `utenfor-board` på boards i motsatt ende).

### 3. Skriv tekstene

Web-research per tema (fakta som ER: åpningstider, linjer, anleggsnavn) → skriv `body` per tema etter tekst-reglene over. Fyll `report_editorial` i staging-fila.

### 4. Validér og skriv

```bash
npx tsx scripts/curate-area.ts --file data/areas/<slug>.staging.json --dry-run   # plan + diff mot DB
npx tsx scripts/curate-area.ts --file data/areas/<slug>.staging.json --yes       # skriv til v2.areas
```

Pass ALLTID `--file` (default er ranheim). Merk: `areas` har ingen `updated_at` → ingen optimistisk lås — én operatør om gangen.

### 5. Re-arv til boards i strøket

List prosjekter (GET `v2.projects` med `Accept-Profile: v2`), og for hvert board med senter i strøket:

```bash
curl -s -X POST http://localhost:3000/api/admin/inherit-editorial \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<id>","customerSlug":"<kunde>","projectSlug":"<slug>","lat":<lat>,"lng":<lng>}'
```

Idempotent — ruten resolver strøket selv (`areaName` i responsen bekrefter treff). Rapportér `themesInherited` + `highlights.dropped` med årsak per board.

### 6. Revalidér + verifiser

```bash
# Lokal cache:
curl -s -X POST http://localhost:3000/api/admin/revalidate \
  -H "Content-Type: application/json" \
  -d '{"paths":["/eiendom/<kunde>/<slug>/rapport-board"]}'
```

Prod plukker opp via ISR innen 1 time (`revalidate: 3600`) — manuell prod-bust finnes ikke i dag (admin av i prod, `REVALIDATE_SECRET` ikke satt).

**Akseptanse (rapportér fullstendighet):**
- [ ] Alle 6 temaer har `editorial` på hvert re-arvet board (DB-sjekk mot `v2.products.config`)
- [ ] Helst ≥1 highlight per tema — 0 highlights er gyldig (body bærer), men flagg det
- [ ] Body-snippet gjenfinnes i boardets klient-payload (curl + grep)
- [ ] Drill-in åpner i sidebaren (chevron på temakortene)

## Modus B: REDIGER eksisterende strøk

1. Hent gjeldende rad: GET `v2.areas?id=eq.<areaId>&select=report_editorial`.
2. Oppdater staging-fila i `data/areas/` (den er sannhetskilde-speil). **Merge-semantikk ved update:** staging overskriver `boundary` + temaene den har; temaer som ikke er i staging BEHOLDES; `meta` ignoreres.
3. Kjør steg 4–6 fra Modus A (dry-run → apply → re-arv → revalidér). Uten re-arv ser ingen boards endringen.

## Feilhåndtering

| Feil | Handling |
|------|----------|
| Staging-validering: ukjent tema-id | Kun bolig-6 er gyldige — fjern/rename temaet |
| Staging-validering: ring ikke lukket / [lat,lng]-bytte | GeoJSON er `[lng, lat]`; første == siste punkt per ring |
| INSERT feiler: NOT NULL | `meta`-blokk mangler — se steg 1 |
| Re-arv: `skipped: true` uten areaName | Boardets senter ligger utenfor polygonet — sjekk boundary |
| Re-arv: highlight droppet `utenfor-board` | Kandidat utenfor boardets radius/filtre — velg nærmere kandidater, re-apply |
| Re-arv: highlight droppet `ikke-i-db`/`under-trust` | POI-ID feilstavet, eller trust < terskel — bytt kandidat |
| Ingen `--list-pois`-kandidater | Ingen provisjonert board i strøket — `/provision-rapport` nivå 1 først |

## Relaterte kommandoer/skills

- `/provision-rapport` — board-provisjonering; `--tier 2 --update` løfter eksisterende board etter kuratering
- `curator` — stemme/stil-guiden tekstene skrives med
- `manus-curator` — VO-manus (ORTOGONALT lag, ikke del av nivå 2)
- `/validate-poi-trust` — POI-QA før man velger highlight-kandidater i tvilstilfeller
