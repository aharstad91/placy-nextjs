# Plan: Refaktor CollectionDrawer → Sentrert Modal

**Dato:** 2026-02-15
**Type:** Refaktor + ny UI-komponent
**Scope:** `components/ui/Modal.tsx` (ny), `components/variants/explorer/CollectionDrawer.tsx` (refaktor)

## Mål

1. Lage en generisk, gjenbrukbar `Modal`-komponent i `components/ui/`
2. Refaktorere `CollectionDrawer` fra sidebar til sentrert modal (~50vh)
3. Beholde all eksisterende funksjonalitet (POI-liste, e-post, QR-bekreftelse)

## Steg

### 1. Lag `components/ui/Modal.tsx`

Generisk modal med:
- **Props:** `open`, `onClose`, `children`, `title?`, `className?`, `closeOnBackdrop?` (default true)
- **Layout:** Sentrert, max-width 480px, ~50vh max-height, scrollbart innhold
- **Mobil:** Full bredde med padding, slide-up animasjon
- **Desktop:** Fade-in + scale, sentrert
- **Lukking:** Backdrop-klikk (konfigurerbar), X-knapp, Escape-tast
- **A11y:** `role="dialog"`, `aria-modal="true"`, focus trap (enkel)
- **Animasjon:** Bruke eksisterende `animate-slide-up` for mobil, legg til fade/scale for desktop i globals.css

### 2. Refaktor `CollectionDrawer.tsx`

- Erstatt den manuelle overlay/drawer-markup med `<Modal>`
- Fjern all posisjonering/backdrop-kode fra CollectionDrawer
- Behold `closeOnBackdrop={view === "list"}` for å blokkere lukking i confirmation-view
- Beholde alle props og logikk uendret
- Flytt header-innhold til Modal sin `title`-prop

### 3. Legg til modal-animasjoner i `globals.css`

- `animate-modal-in` — fade + scale for desktop
- Gjenbruk `animate-slide-up` for mobil

### 4. Verifiser i ExplorerPage

- Ingen endringer i ExplorerPage.tsx (props-grensesnittet er likt)
- Test at åpne/lukke, POI-liste, checkout, QR-kode alt fungerer

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/ui/Modal.tsx` | **NY** — generisk modal |
| `components/variants/explorer/CollectionDrawer.tsx` | Refaktor til å bruke Modal |
| `app/globals.css` | Legg til modal-animasjon |

## Ikke-mål

- Endrer ikke CollectionBar eller SaveButton
- Endrer ikke ExplorerPage integrasjon
- Ingen ny funksjonalitet — kun layout-endring

## Modal API

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeOnBackdrop?: boolean; // default true
}
```

Bruk:
```tsx
<Modal open={isOpen} onClose={handleClose} title="Min samling" footer={<button>Opprett</button>}>
  <POIList />
</Modal>
```
