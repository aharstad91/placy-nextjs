---
title: "Placy Basic 1-2-3 tier-modell: gated kategori-drill-in i rapport-board"
date: 2026-06-08
category: feature-implementations
tags:
  - rapport-board
  - feature-flags
  - tiering
  - editorial
  - sidebar
  - drill-in
  - unstable_cache
  - supabase-config
module: report
symptom: |
  - Rapport-board hadde to ytterpunkter: auto-generert basic (ingen kuratering)
    og full voice-over/reels (Stasjonskvartalet). Manglet et selgbart MELLOMLAG.
  - Trengte en måte å tilby "litt kuratering" (egendefinert tekst + et par
    referanse-POIer per kategori) uten å bygge en helt ny rendering-vei.
root_cause: |
  Ingen mellomtier eksisterte. hasVoiceOver skilte kun nivå 1 (alle POIs +
  bla-bar empty-state) fra nivå 3 (kuratert anker-sett + reels + VO). Det fantes
  intet per-kategori innholdslag mellom disse.
solution: |
  Innførte en eksplisitt 1-2-3 tier-modell der nivå 2 ("Bedre") er et GATED
  drill-in detalj-panel per kategori, gated på tilstedeværelse av et nytt
  `editorial`-objekt på reportConfig.themes[]. Gjenbruker eksisterende sidebar-
  skjelett (header + scroll-område + sticky megler-footer) og board-state
  (activeCategoryId) — panelet swapper kun scroll-området. Highlight-POIer
  resolves til render-klare chips i board-data og åpner POI på kartet via OPEN_POI.
files_changed:
  - lib/types.ts
  - components/variants/report/report-data.ts
  - components/variants/report/report-themes.ts
  - components/variants/report/board/board-data.ts
  - components/variants/report/reels/DesktopStorySidebar.tsx
  - components/variants/report/reels/ReportReelsPage.tsx
commit: null
---

# Placy Basic 1-2-3 tier-modell: gated kategori-drill-in

## Tier-modellen

Rapport-board selges nå i tre trinn, der oppgradering 1→2 er et **felt-fyll i
Supabase** (ingen kodeendring/deploy), og 2→3 er den eksisterende voice-over-veien.

| Nivå | Navn | Innhold | Gating-signal |
|------|------|---------|---------------|
| 1 | Bra | Auto-genererte POI-er + kategorier, ingen kuratering. Klikk på temakort = velg på kart. | (default) |
| 2 | Bedre | Nivå 1 + kuratert drill-in detalj-panel per kategori (tekst + highlight-POIer). | `theme.editorial` finnes (body eller highlights) |
| 3 | Best | Full kuratering + reels + voice-over (Stasjonskvartalet). | `hasVoiceOver` (avledet av reels-lyd) |

## Hvorfor gated (ikke alltid-på)

Beslutning tatt i konsept-fasen: panelet er det som **skiller** nivå 1 fra 2. En
kategori får drill-in KUN når den har kuratert `editorial`. Viktig konsekvens for
implementasjonen: gating-signalet må være en **eksplisitt presence-marker**, ikke
et auto-fylt felt. `BoardCategory.body` fylles alltid fra grounding/intro, så den
kan ikke brukes som gate — derfor et dedikert `editorial`-objekt.

## Datamodell (gjenbruker reportConfig.themes[], ingen ny tabell)

```ts
// lib/types.ts
export interface ReportThemeEditorial {
  body: string;              // dobbelt linjeskift = nytt avsnitt
  highlightPoiIds?: string[]; // POIs i SAMME kategori; ukjente IDer ignoreres
  image?: string;            // /public eller absolutt; fallback til kategori-illustrasjon
}
// ReportThemeConfig.editorial?  +  ReportThemeDefinition.editorial?  (merge-typing)
```

Kjede: `reportConfig.themes[].editorial` → `ReportTheme.editorial` (threades i
report-data.ts) → `BoardCategory.editorial` (mappes i `adaptCategory`).

**`adaptCategory` gjør to ting:**
1. Resolver `highlightPoiIds` mot kategoriens `allPOIs` til render-klare
   `{ id, name }`-chips (ukjente IDer filtreres bort).
2. **Gater bort** editorial når det verken finnes ikke-tom body eller resolvede
   highlights → kategorien forblir nivå 1 (intet panel).

```ts
const editorial = ((): BoardCategoryEditorial | undefined => {
  if (!theme.editorial) return undefined;
  const trimmedBody = theme.editorial.body?.trim() ?? "";
  const highlights = (theme.editorial.highlightPoiIds ?? [])
    .map((pid) => theme.allPOIs.find((p) => p.id === pid))
    .filter((p): p is POI => Boolean(p))
    .map((p) => ({ id: p.id as BoardPOIId, name: p.name }));
  if (!trimmedBody && highlights.length === 0) return undefined; // gating
  return { body: trimmedBody, image: theme.editorial.image, highlights };
})();
```

## UI: drill-in i DesktopStorySidebar

`SidebarContentPreview` er bygd som `header (fast) + scroll-område + sticky
megler-footer`. Nivå-2-drill-in swapper KUN scroll-området:

- Aktiv kategori har editorial → render `CategoryDetailView` (tilbake-pil,
  hero-bilde `object-cover`, brødtekst-avsnitt, "Verdt å merke seg"-chips).
- Ellers → index-lista som før. Nivå-2-kort får en `›`-chevron-affordans.
- Tilbake-pil → `RESET_TO_DEFAULT`. Highlight-chip → `OPEN_POI` (kameraet flyr
  til POI, panelet blir stående fordi `activeCategoryId` er uendret).

Ingen ny board-state: drill-in drives av eksisterende `activeCategoryId` (settes
allerede av rail-klikket som flyr/filtrerer kartet). Megler-footeren rendres i
begge visninger. Nivå-1-kategorier og Stasjonskvartalet (nivå 3) er uendret.

## Seeding på et nytt prosjekt (agent-kjørbar oppskrift)

> Dette er resepten en agent kan følge for å løfte et hvilket som helst basic-tier
> rapport-board (nivå 1) til nivå 2. `editorial` legges på
> `products.config.reportConfig.themes[<theme-id>]` (jsonb) via read-modify-write
> PATCH. **Tier er per prosjekt:** får én kategori `editorial`, skal ALLE kategoriene
> få det — ellers blir drill-in-affordansen (chevron-mini-knappen) inkonsistent
> mellom kortene. Gjør hele settet i én PATCH.

### Steg 1 — Innholds-retningslinjer (teksten i `body`)

Hver kategori får 1–2 avsnitt (skill avsnitt med dobbelt linjeskift `\n\n`). Tonen
arver Placy-prinsippene fra reels-manus:

- **Beboer-perspektiv** — megleren selger til boligkjøperen som blir beboer. Skriv
  hva det betyr å BO her, ikke turist/severdighet-vinkler ("ting å gjøre", "lett
  for besøkende"). Se `[[feedback_reels_beboer_perspektiv]]`.
- **Fakta-orientert, ikke poetisk** — beskriv hva som ER (konkrete skoler, linjer,
  avstander), ikke "lukten av…", "følelsen av…". Se `[[feedback_manus_fakta_orientert]]`.
- **Konkret og verifiserbart** — navngi faktiske steder i nærområdet. Avsnitt 1:
  oppsummer hva kategorien tilbyr i nabolaget. Avsnitt 2: trekk frem 2–3 konkrete
  anker-steder med litt kontekst.

Eksempel (`barn-oppvekst`, Overvik):

```
Overvik er et nabolag bygget for barnefamilier. Innenfor kort avstand ligger flere
skoler, et tett nett av barnehager og en rekke lekeplasser mellom boligene.

Ranheim skole og Markaplassen skole ligger begge i nærområdet, og barnehagedekningen
er god med flere alternativer å velge mellom — flere av dem helt nye nede ved
Grillstadfjæra og Ranheimsfjæra.
```

### Steg 2 — Finn theme-IDer og POI-IDer

`highlightPoiIds` (2–3 per kategori) MÅ matche faktiske `pois.id` som ligger i den
kategorien. Slå opp produktets `id`, theme-IDene og POI-ene per tema:

`PROJECT_ID` er `{customer}_{slug}`-strengen (f.eks. `placy-demo_overvik`) — IKKE en
UUID. Den brukes likt på `products.project_id` og `project_pois.project_id`.

```bash
set -a && source .env.local && set +a
# Produktets UUID + reportConfig.themes (id + categories per tema):
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=id,config&project_id=eq.<PROJECT_ID>" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -m json.tool
# POI-er i prosjektet (id + navn + category_id) — for å plukke highlights:
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/project_pois?select=pois(id,name,category_id)&project_id=eq.<PROJECT_ID>" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -m json.tool
```

(`products.id` (UUID) → `PRODUCT_ID` i steg 3. Themens `categories`-array sier hvilke
POI-`category_id`-verdier som hører til temaet, så du plukker highlights fra riktig sett.)

### Steg 3 — PATCH editorial inn i config

Generalisert read-modify-write (config kan være lagret som jsonb ELLER json-streng —
scriptet bevarer formen). Fyll `PRODUCT_ID` og `EDITORIAL_BY_THEME`:

```python
import os, json, urllib.request

BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PRODUCT_ID = "<PRODUCT_UUID>"

# Ett innslag per theme-id (gjør ALLE kategoriene for å holde tier-en konsistent).
EDITORIAL_BY_THEME = {
    "barn-oppvekst": {
        "body": "Avsnitt 1…\n\nAvsnitt 2…",
        "highlightPoiIds": ["<poi-uuid-1>", "<poi-uuid-2>", "<poi-uuid-3>"],
    },
    # "hverdagsliv": {...}, "mat-drikke": {...}, ...
}

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
req = urllib.request.Request(f"{BASE}/rest/v1/products?select=id,config&id=eq.{PRODUCT_ID}", headers=H)
raw = json.loads(urllib.request.urlopen(req).read())[0]["config"]
was_string = isinstance(raw, str)
cfg = json.loads(raw) if was_string else raw

for theme in cfg["reportConfig"]["themes"]:
    ed = EDITORIAL_BY_THEME.get(theme["id"])
    if ed:
        theme["editorial"] = ed

new_config = json.dumps(cfg, ensure_ascii=False) if was_string else cfg
payload = json.dumps({"config": new_config}).encode("utf-8")
patch = urllib.request.Request(
    f"{BASE}/rest/v1/products?id=eq.{PRODUCT_ID}", data=payload,
    headers={**H, "Prefer": "return=minimal"}, method="PATCH",
)
print("PATCH", urllib.request.urlopen(patch).status, "| stored as", "string" if was_string else "jsonb")
```

Kjør: `set -a && source .env.local && set +a && python3 seed_editorial.py`

### Steg 4 — Bust cache

Se gotchaen under — i dev: restart dev-server. I prod: `revalidateTag` /
`/api/revalidate?tag=product:{customer}_{slug}`.

### Gating-kontrakt (hva adapteren krever)

`adaptCategory` (`board-data.ts`) gater bort editorial som verken har ikke-tom `body`
eller minst én resolvbar highlight. Ukjente POI-IDer filtreres stille bort — så feil
POI-id gir ingen feilmelding, bare en manglende chip. Verifiser at IDene stemmer.

### ⚠️ Highlights må overleve report-data-filteret (ikke bare ligge i kategorien)

`adaptCategory` resolver `highlightPoiIds` mot `theme.allPOIs` — og `theme.allPOIs` er
det **FILTRERTE** board-settet (`transformToReportData` → `allPOIs: filtered`), ikke
hele DB-kategorien. En highlight som finnes i Supabase men er filtrert bort, blir stille
ignorert (manglende chip), selv om den er det nærmeste/beste stedet. Filteret (i
`report-data.ts`) dropper POIs på tre måter:

1. **Per-kategori-cap** (`CATEGORY_FILTER_RULES`): `bus`/`tram`/`bike` beholder kun de
   **5 nærmeste**, `idrett` 3, `skole` kun skolekrets-match. Eks: en bysykkel-stasjon
   utenfor topp-5-nærmeste finnes i DB men ikke i board-settet.
2. **Child-POI-fjerning**: POIs med `parent_poi_id` som peker på en parent i samme tema
   merges inn i parenten og fjernes fra topp-nivå (kan ikke være highlight).
3. **Relevans-/visningsfilter** som reduserer antallet (board viser f.eks. «28 steder»
   selv om DB har 42 i temaet).

**Konsekvens for seeding:** plukk highlights fra det som FAKTISK er i board-settet, ikke
fra et rå DB-spørring. Grunnsannheten er board-markørene per kategori — de er nøyaktig
`theme.allPOIs` (samme sett highlights resolver mot). Praktisk verifisering: åpne board-et,
velg kategorien, og bekreft at hver tiltenkt highlight finnes som markør (a11y-snapshot
lister dem ved navn). Hendte på Teknostallen: 2 av 3 nabolag-highlights (Høgskoleparken,
Finalebanen) var filtrert bort og ga tomme chips før de ble byttet til survivors.

## Gotcha: in-memory unstable_cache i dev

`app/eiendom/[customer]/[project]/rapport-board/page.tsx` wrapper produkt-
hentingen i `unstable_cache` med tag `product:{customer}_{slug}` og
`revalidate: 3600`. I dev holdes denne **in-memory** i dev-server-prosessen.

Etter en Supabase-config-endring (f.eks. nytt `editorial`) ble den IKKE synlig
fordi:
- Sletting av `.next/cache/fetch-cache`-filer påvirker ikke in-memory-kopien.
- `revalidatePath` (via `/api/admin/revalidate`) buster ikke den tag-keyede
  `unstable_cache`-entryen — bare den implisitte path-taggen.
- `/api/revalidate?tag=…&secret=…` krever `REVALIDATE_SECRET` (ofte ikke satt lokalt).
- En lang-kjørende dev-server plukket heller ikke opp en ny midlertidig route
  eller `.env.local`-endring.

**Spak som faktisk virker under demo-iterasjon:** restart dev-serveren, ELLER
sett `REVALIDATE_SECRET` lokalt og kall `/api/revalidate?tag=product:{customer}_{slug}`.

## Verifisering

- `tsc` rent · ESLint 0 errors · 270 tester (+6 board-data editorial-mapping,
  +6 sidebar drill-in).
- Live (chrome-devtools MCP, Overvik): markør-filtrering bekreftet i 3D (66 → 29
  barn, 66 → 8 mat + prosjekt-pin) og 2D (9 opaque / 58 faded markører). NB:
  2D-markørene beholder stabil DOM-identitet og fades via `isVisible`-flag, så
  a11y-treet viser alle 67 — tell faktisk opacity, ikke node-antall, ved
  verifisering av 2D-filtrering.
