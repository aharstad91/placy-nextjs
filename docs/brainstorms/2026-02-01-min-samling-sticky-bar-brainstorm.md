# Brainstorm: "Min samling" sticky bar i POI-lista

**Dato:** 2026-02-01
**Status:** Klar for planlegging

## Hva vi bygger

Flytte "Min samling" fra navbaren og ned i selve POI-lista som en sticky bar i bunnen. Baren skal alltid vaere synlig — ogsaa i empty state — for aa invitere brukeren til aa samle steder. Den lever kontekstuelt naer POI-ene den faktisk samler.

### Posisjonering

- **Sticky bottom** i lista naar lista er lang nok til aa scrolle
- **Flyter med innholdet** naar lista er kort (ikke dekker hele hoeyden)
- Ligger oppaa en gradient-fade i bunnen av lista for oeekt kontrast og fin visuell overgang

### States

| State | Visuelt |
|-------|---------|
| **Tom** | Inviterende tekst ("Lagre steder du liker"), bookmark-ikon, dempet stil |
| **1 sted** | Viser "1 sted lagret", CTA-knapp for aa aapne drawer |
| **N steder** | Viser "N steder lagret", CTA-knapp, animert teller |
| **Nytt sted lagt til** | Bounce-animasjon paa teller + subtil "pop" paa hele baren |

### CTA

Knappen aapner CollectionDrawer (eksisterende drawer med full liste, e-post, QR-kode, deling). Ingen endring i drawer-logikk.

### Gradient overlay

En gradient fra transparent til hvit i bunnen av lista (ca. 48-64px hoey), som samlings-baren ligger oppaa. Gir fin fade-effekt paa siste POI-kort og kontrast paa baren.

## Hvorfor denne tilnaermingen

- **Kontekstuell plassering**: Samlingen lever der POI-ene er, ikke gjemt i en navbar
- **Alltid synlig**: Empty state inviterer til bruk, oeeker oppdagbarhet
- **Bounce-animasjon**: Gir umiddelbar feedback naar noe lagres, uten aa vaere forstyrrende
- **Enkel arkitektur**: Gjenbruker eksisterende CollectionDrawer, kun ny bar-komponent

## Viktige beslutninger

1. **Fjernes fra navbar** — Kun i lista. Ryddigere navbar.
2. **Alltid synlig** — Ogsaa i empty state med inviterende tekst.
3. **Drawer beholdes** — CTA aapner eksisterende CollectionDrawer.
4. **Bounce + teller-animasjon** — Tallet bouncer/pulser naar nytt punkt legges til.

## Aapne spoersmaal

- Skal mobile bottom sheet ogsaa faa samlings-baren, eller kun desktop-lista?
- Noyaktig visuelt design (farger, stoerrelse, skrift) kan itereres under implementering.
