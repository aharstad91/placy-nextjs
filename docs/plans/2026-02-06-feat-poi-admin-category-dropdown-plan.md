# Plan: POI Admin — Kategorifilter Dropdown

**Dato:** 2026-02-06
**Brainstorm:** `docs/brainstorms/2026-02-06-poi-admin-category-dropdown-brainstorm.md`
**Fil:** `app/admin/pois/poi-admin-client.tsx`

## Endring

Bytt ut den flate flex-wrap chip-lista for kategorier (linje 389-449) med en kompakt dropdown med multi-select. Alt annet i sidebar forblir uendret.

## Implementering

### Steg 1: Erstatt chip-lista med dropdown-komponent

Erstatt `<div className="flex flex-wrap gap-2">` (linje 413-448) med:

1. **Trigger-knapp** (~48px høyde):
   - Viser oppsummering: "Ingen valgt", "Kafé, Park, Restaurant" (<=3), eller "5 kategorier valgt"
   - ChevronDown-ikon som roterer ved åpning
   - Klikk toggler åpen/lukket

2. **Dropdown-panel** (åpnes under trigger):
   - Kategorisøk-felt øverst
   - Scrollbar liste med max-height ~300px
   - Checkbox per kategori med count-badge
   - Kategori-farge som venstre-border eller dot
   - Valgte kategorier sorteres først
   - Lukkes ved klikk utenfor

3. **Alle/Ingen-knapper** beholdes i header over trigger

### Steg 2: State

- Ny `const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)`
- Ny `const [categorySearch, setCategorySearch] = useState("")`
- Eksisterende `selectedCategories` og `updateCategories` gjenbrukes uendret

### Steg 3: Click-outside

- useRef + useEffect for å lukke dropdown ved klikk utenfor

## Filer som endres

- [x] `app/admin/pois/poi-admin-client.tsx` — eneste fil

## Sjekkliste

- [ ] Dropdown trigger viser kompakt oppsummering
- [ ] Dropdown åpner/lukker ved klikk
- [ ] Søk filtrerer kategorier i lista
- [ ] Checkbox toggle fungerer per kategori
- [ ] Alle/Ingen-knapper fungerer
- [ ] URL-synk bevart (ingen endring i updateCategories)
- [ ] Klikk utenfor lukker dropdown
- [ ] POI edit-skjema er synlig etter marker-klikk
