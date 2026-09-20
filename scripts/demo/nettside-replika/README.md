# Nettside-replika — verktøyene

Tre skript som gjør en kundes nettsted om til en lokal demo-rute under `app/demo/<navn>-nettside/`. Brukt til Leangenbukta 16.09.2026; se `docs/demos/leangenbukta-nettside.md` for resultatet og fallgruvene.

Skriptene er skrevet for én kjøring om gangen og har stiene til den siste replikaen hardkodet øverst. Rediger `DEST`/`target` før du kjører dem på en ny kunde.

## Rekkefølge

1. **Hent forsiden og stilarkene.** Lagre HTML-en, og hent hvert `<link rel=stylesheet>` og hver inline-`<style>` i dokumentrekkefølge til `css/NN.css` med et manifest (`css-manifest.json`). Dropp stilark siden ikke bruker — de kan være over halvparten av volumet.
2. **`fetch-assets.py`** — laster ned bilder, film, fonter og ikoner både fra markupen og fra `url()` i de beholdte stilarkene, og skriver `asset-map.json` (absolutt URL → lokalt filnavn).
3. **`scope-css.mjs`** — slår sammen stilarkene, skriver om `url()` til lokale stier og avgrenser hver selektor til wrapper-klassen. Her ligger de tre reparasjonene som må være med:
   - `html`/`body`/`:root` fjernes fra selektorene, men hver fjernet rot-node erstattes av `:is(div)` så spesifisiteten holder. Uten dette snur rekkefølgen mellom regler og kolonnene kollapser.
   - Alle `-ms-`-erklæringer fjernes. `display:-ms-flexbox` rett etter `display:flex` får Lightning CSS i Next 16 til å droppe hele `display`.
   - IE-hacks (`*prop`, `_prop`, `progid:`, `expression()`) og skrivefeil som `!improtant` ryddes bort før parsing.
4. **`tojsx.py`** — konverterer HTML-fragmenter til JSX: attributtnavn, `style` som objekt, `<img>` → `next/image` med målene lest fra den nedlastede filen, inline `on*`-handlere strippet, `value` → `defaultValue` på ukontrollerte felt.

Etterpå settes fragmentene sammen for hånd til `layout.tsx`, `site-chrome.tsx` og `page.tsx`, og temaets JS-avhengige tilstander (innanimasjoner, mobilmeny, videobakgrunn) håndteres i `demo.css`.

## Sjekk før du er ferdig

Null forespørsler til kundens domene i nettverksfanen, radene på samme y-posisjon som originalen på 1440 × 900 og 390 × 844, og `robots: noindex` + produksjonssperre på ruta.
