/* Delte helpers for Placy-prototypene. Vanilla JS, ingen build-steg.
   Lastes ETTER _shared/env.js (genereres av `npm run proto`). */

window.Proto = {
  /** Hent board-snapshot fra _data/. Navn = "<customer>__<slug>". */
  async loadBoard(name) {
    const res = await fetch(`/_data/${name}.json`);
    if (!res.ok) {
      this.fatal(
        `Fant ikke datasnapshot <strong>${name}.json</strong>.`,
        `npm run proto:data -- ${name.replace("__", " ")}`
      );
      throw new Error(`missing snapshot: ${name}`);
    }
    return res.json();
  },

  /** Public Mapbox-token fra env.js. Feiler høyt hvis serveren ikke kjører via npm run proto. */
  mapboxToken() {
    const token = window.PROTO_ENV?.MAPBOX_TOKEN;
    if (!token) {
      this.fatal(
        `Mangler Mapbox-token — <strong>_shared/env.js</strong> er ikke generert.`,
        `npm run proto`
      );
      throw new Error("missing mapbox token");
    }
    return token;
  },

  /** Temafarge: første kategori i temaet som har farge, ellers accent. */
  themeColor(project, theme) {
    for (const catId of theme.categories ?? []) {
      const cat = project.categories.find((c) => c.id === catId);
      if (cat?.color) return cat.color;
    }
    return "#0f766e";
  },

  /** POI-ene som hører til et tema (via temaets kategori-liste). */
  poisForTheme(project, theme) {
    const cats = new Set(theme.categories ?? []);
    return project.pois.filter((p) => cats.has(p.category?.id));
  },

  /** Gangtid som lesbar streng, eller tom. */
  walkLabel(poi) {
    const w = poi.travelTime?.walk;
    return w ? `${w} min gange` : "";
  },

  /** Fullskjerm feilkort med kommandoen som fikser det. */
  fatal(messageHtml, command) {
    document.body.innerHTML = `
      <div class="proto-error">
        <p>${messageHtml}</p>
        <p style="margin-top:8px;color:var(--ink-soft)">Kjør fra repo-roten:</p>
        <code>${command}</code>
      </div>`;
    this.mountBackLink(); // feilkortet tømte body — veien ut må tilbake
  },

  /* Tilbake til galleriet. Injiseres på HVER prototype-side, uavhengig av om
     den bruker baselinen: en prototype du ikke kommer ut av, blir prøvd én
     gang. Stilen er selvstendig (ingen avhengighet til baseline.css), og
     `--proto-back-w` finnes så en prototype med eget verktøy øverst til
     venstre kan legge seg ved siden av i stedet for oppå. */
  mountBackLink() {
    if (location.pathname === "/" || document.querySelector(".proto-back")) return;
    if (!document.getElementById("proto-back-css")) {
      const css = document.createElement("style");
      css.id = "proto-back-css";
      css.textContent = `
        :root { --proto-back-w: 96px; }
        .proto-back {
          position: fixed; z-index: 60; top: 10px; left: 10px;
          display: flex; align-items: center; gap: 5px;
          padding: 6px 11px 6px 9px; border-radius: 999px;
          background: rgba(255,255,255,.92); box-shadow: 0 1px 6px rgba(0,0,0,.14);
          font: 600 12px/1 Figtree, system-ui, sans-serif; letter-spacing: .01em;
          color: #57534e; text-decoration: none;
        }
        .proto-back:hover { color: #1c1917; }
        .proto-back svg { height: 14px; width: 14px; }
        /* På desktop ligger sidekolonnen til venstre — chippen hører i kartet,
           ikke oppå kolonnens overskrift. Prototyper uten sidekolonne har
           ingen --sidebar-w og beholder venstrekanten. */
        @media (min-width: 1024px) {
          .proto-back { left: calc(var(--sidebar-w, 0px) + 10px); }
        }`;
      document.head.appendChild(css);
    }
    const a = document.createElement("a");
    a.className = "proto-back";
    a.href = "/";
    a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/>
      <path d="m12 19-7-7 7-7"/></svg>Prototyper`;
    document.body.appendChild(a);

    // Bredden måles, ikke gjettes: Figtree lastes etter første maling, så
    // et hardkodet tall ville flyttet naboverktøyet feil så snart fonten kom.
    const measure = () =>
      document.documentElement.style.setProperty("--proto-back-w", `${a.offsetWidth}px`);
    measure();
    document.fonts?.ready.then(measure);
  },
};

if (document.body) Proto.mountBackLink();
else addEventListener("DOMContentLoaded", () => Proto.mountBackLink());
