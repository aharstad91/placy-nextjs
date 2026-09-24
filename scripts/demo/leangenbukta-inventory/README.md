# Leangenbukta-inventory — U1-skriptene

Fire skript som til sammen bygger `docs/research/leangenbukta-nettside/manifest.json`
(inventar/dekningsregnskap for hele leangenbukta.no). Kjør i denne
rekkefølgen fra repo-roten:

1. **`crawl.py`** — henter `wp-sitemap.xml` og alle undersitemaps, følger
   deretter alle interne lenker rekursivt (BFS) fra forsiden, menyen, footer
   og hver oppdaget side. Kun `text/html`-svar leses/lagres som snapshot
   (`docs/research/leangenbukta-nettside/snapshot/<id>.html`);
   `/wp-content/`-lenker (dokumenter/bilder) registreres, men følges ALDRI
   videre og body leses ALDRI. Skriver `crawl-raw.json`.
2. **`head_probe.py`** — HEAD-sjekker alle `/wp-content/`-URL-er som
   `crawl.py` fant, for status/content-type/størrelse — uten å laste ned
   body. Skriver `head-probe.json`.
3. **`build_manifest.py`** — klassifiserer hver URL (`kind`/`disposition`)
   ut fra en manuelt gjennomgått oversikt (`OVERRIDES`-dict i skriptet) pluss
   generiske regler (canonical-sammenligning for duplikater,
   content-type for dokument/media). To kjente lenke-bugs på kildesiden
   (relativ personvern-lenke, relativ mailto-lenke) samles til én
   manifest-rad hver i stedet for én per forekomst. Skriver `manifest.json`.
4. **`build_external_links.py`** — katalogiserer alle utgående lenker til
   andre domener (boligvelger, kundeportaler, utbygger, sosiale medier
   osv.). Skriver `external-links.json`.
5. **`download_assets.py`** — laster ned bilder som `disposition: local`-
   sider faktisk bruker, til `public/demo/leangenbukta-nettside/pages/`.
   Velger WordPress' MELLOMSTORE srcset-variant (800–1600 px bredde)
   fremfor originalen når flere størrelser finnes for samme bilde. Har et
   internt bytes-budsjett (300 MB) som stopper nedlasting hvis det
   overskrides. Hopper alltid over video (finnes fra før). Skriver
   `asset-map.json`.
6. **`download_new_css.py`** — laster ned stilark som lokale sider bruker og
   som IKKE allerede er dekket av `app/demo/leangenbukta-nettside/original.css`
   (forsidens tidligere nedlasting), til `docs/research/leangenbukta-nettside/css/`.
   Skriver `css-manifest.json` (rekkefølge + hvilke sider som bruker hvert
   stilark).

## Viktig ved ny kjøring

- **Diskplass.** Skript 1 og 2 laster aldri ned dokument/media-body — bare
  status/metadata. Skript 5 har et hardt budsjett; øk `BUDGET_BYTES` med
  omhu på en nesten full disk.
- **Høflighet.** Alle skript kjører ett kall om gangen med ~0,3–0,4 s pause.
  Ikke parallelliser mot kundens server.
- **`OVERRIDES` i `build_manifest.py` er manuelt vedlikeholdt.** Nye sider
  på leangenbukta.no havner i en generisk fallback-regel og flagges med
  `"IKKE MANUELT VERIFISERT"` i `note`-feltet — sjekk konsollutskriften fra
  `build_manifest.py` og oppdater `OVERRIDES` før du stoler på resultatet.
- **Personvern-/mailto-bugen** er identifisert ved URL-mønster
  (`is_personvern_bug`/`is_mailto_bug` i `build_manifest.py`), ikke
  hardkodet liste — fungerer automatisk på nye sider som rammes av samme
  kildekode-bug.
