/* ============================================================
   Nivå-1-baseline — dagens board, portert til vanilla.

   Nivå 1 = board UTEN avspillbar lyd. Det er den forgreiningen
   produksjonen faktisk gjør (`isPlayableAudio` → `hasPlayableContent`
   på desktop, `hasAudioMobile` på mobil), ikke om `editorial` finnes.
   Kuratert vs. ukuratert tekst er en UAVHENGIG akse: begge boardene
   her er nivå 1, men det ene har kuratert strøkstekst og det andre
   deterministisk generert.

   Desktop og mobil er BEVISST ulike flater — det er ikke drift:
     desktop-kort  = illustrasjon + kuratert lead-prosa, ingen POI-rader
     mobil-kort    = ikon-tint + dekningstall + 3 POI-rader + «Se alle N»
     desktop drill-in = KUN det som er i kartutsnittet
     mobil drill-in   = HELE kategorien (ellers ville «se alle 17» løyet)
     mobil-lista      = utsnitts-scopet; å dra kartet ER filteret
   ============================================================ */

window.Baseline = (() => {
  const DESKTOP = "(min-width: 1024px)";
  const MODES = [
    { id: "walk", label: "Gange", icon: "footprints" },
    { id: "bike", label: "Sykkel", icon: "bike" },
    { id: "car", label: "Bil", icon: "car" },
  ];

  // Mobil-sheetens grenser (NeighbourhoodSheet.tsx)
  const REST_LOW_FRACTION = 0.34;
  const REST_HIGH_FRACTION = 0.86;
  const REST_LOW_MIN_PX = 236;
  const SNAP_THRESHOLD_PX = 44;
  const TAP_SLOP_PX = 6;
  const SNAP_DURATION_MS = 380;
  const SETTLE_MIN_MS = 130;
  const MOMENTUM_PROJECTION_MS = 190;
  const PANEL_FRACTION = 0.58;
  const PEEK_FRACTION = 0.2;
  const ROWS_PER_CATEGORY = 3;

  let S; // state

  // ---------- hjelpere ----------
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const kebab = (n) =>
    String(n ?? "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const icon = (name, size = 16) =>
    `<i data-lucide="${esc(kebab(name))}" style="width:${size}px;height:${size}px"></i>`;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  /** Precomputet reisetid i aktiv modus, eller undefined. Aldri et estimat. */
  const minutesOf = (poi) => {
    const v = poi.raw?.travelTime?.[S.travelMode];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  const byMinutesThenName = (a, b) => {
    const ma = minutesOf(a), mb = minutesOf(b);
    if (ma !== undefined && mb !== undefined && ma !== mb) return ma - mb;
    if (ma === undefined && mb !== undefined) return 1;
    if (ma !== undefined && mb === undefined) return -1;
    return a.name.localeCompare(b.name, "no");
  };

  /** Eksakt samme formatering som lib/board/neighbourhood-list.ts */
  function categorySubline({ visibleCount, totalCount, minMinutes, maxMinutes }) {
    const coverage =
      visibleCount === totalCount
        ? `${totalCount} ${totalCount === 1 ? "sted" : "steder"}`
        : `${visibleCount} av ${totalCount} synlig`;
    if (minMinutes === undefined || maxMinutes === undefined) return coverage;
    const span =
      minMinutes === maxMinutes ? `${minMinutes} min` : `${minMinutes}–${maxMinutes} min`;
    return `${coverage} · ${span}`;
  }

  /** Kategoriens punkter, eventuelt scopet til kartutsnittet. */
  function buildList(cat, { scoped }) {
    const all = cat.pois;
    const bounds = scoped && S.map ? S.map.getBounds() : null;
    const visible = bounds
      ? all.filter((p) => bounds.contains([p.coordinates.lng, p.coordinates.lat]))
      : all;
    const sorted = visible.slice().sort(byMinutesThenName);
    const mins = sorted.map(minutesOf).filter((m) => m !== undefined);
    const activeRow =
      S.activePoiId && sorted.some((p) => p.id === S.activePoiId)
        ? sorted.find((p) => p.id === S.activePoiId)
        : S.activePoiId
          ? all.find((p) => p.id === S.activePoiId) ?? null
          : null;
    return {
      rows: sorted.filter((p) => p.id !== S.activePoiId),
      activeRow,
      visibleCount: sorted.length,
      totalCount: all.length,
      hiddenCount: all.length - sorted.length,
      minMinutes: mins.length ? Math.min(...mins) : undefined,
      maxMinutes: mins.length ? Math.max(...mins) : undefined,
    };
  }

  /** [tekst](poi:id) → klikkbar <button>. Ukjente referanser blir ren tekst. */
  function linkedText(answer) {
    return String(answer ?? "").replace(
      /\[([^\]]+)\]\((poi|category):([^)]+)\)/g,
      (_m, label, kind, id) => {
        const known =
          kind === "poi"
            ? !!S.board.poisById[String(id).toLowerCase()]
            : S.board.categories.some((c) => c.id === id);
        if (!known) return esc(label);
        return `<button class="poi-link" data-${kind}="${esc(id)}">${esc(label)}</button>`;
      }
    );
  }

  // ---------- delte seksjoner ----------
  function faqSection(entries, title) {
    if (!entries || entries.length === 0) return ""; // aldri en tom overskrift
    return `<section class="section">
      <p class="eyebrow">${esc(title ?? "Spørsmål og svar")}</p>
      <div class="faq-list">
        ${entries
          .map(
            (e) => `<div class="faq-item">
          <button class="faq-q" aria-expanded="false" data-faq="${esc(e.id)}">
            <span class="t">${esc(e.question)}</span>${icon("chevron-down", 16)}
          </button>
          <div class="faq-a" data-expanded="false"><p>${linkedText(e.answer)}</p></div>
        </div>`
          )
          .join("")}
      </div>
    </section>`;
  }

  function highlightsSection(highlights) {
    if (!highlights || highlights.length === 0) return "";
    const head = `<p class="eyebrow">Verdt å merke seg</p>`;
    const row = (h) => {
      const poi = S.board.poisById[String(h.id).toLowerCase()];
      const m = poi ? minutesOf({ raw: poi }) : undefined;
      return `<button class="hl-row" data-poi="${esc(h.id)}">
        <span class="hl-icon" style="background:${esc(h.color)}">${icon(h.icon, 14)}</span>
        <span class="n">${esc(h.name)}</span>
        ${m !== undefined ? `<span class="m">${m} min</span>` : ""}
      </button>`;
    };
    // Ett punkt: ingen toggle, raden står åpen.
    if (highlights.length === 1)
      return `<section class="section">${head}${row(highlights[0])}</section>`;
    return `<section class="section">${head}
      <button class="hl-toggle" aria-expanded="false" data-hl-toggle>
        <span class="hl-icons">${highlights
          .slice(0, 4)
          .map(
            (h) =>
              `<span><span class="hl-icon" style="background:${esc(h.color)}">${icon(h.icon, 14)}</span></span>`
          )
          .join("")}</span>
        <span style="min-width:0;flex:1">
          <span class="t">${highlights.length} steder å merke seg</span>
          <span class="s" data-hl-label>Se hvilke</span>
        </span>
        ${icon("chevron-down", 16)}
      </button>
      <div class="hl-panel" data-expanded="false">${highlights.map(row).join("")}</div>
    </section>`;
  }

  const meglerCard = () => `<div class="megler"><div class="megler-card">
      <span class="megler-avatar">${icon("user", 20)}</span>
      <div style="min-width:0;flex:1">
        <p class="n">Ansvarlig megler</p>
        <p class="s">Kontaktinfo legges til per prosjekt</p>
        <div class="megler-actions">
          <span class="fill">${icon("phone", 14)}Ring</span>
          <span class="outline">${icon("mail", 14)}E-post</span>
        </div>
      </div>
    </div></div>`;

  // ---------- DESKTOP ----------
  function desktopSidebar() {
    const cat = S.board.categories.find((c) => c.id === S.activeCategoryId);
    const detail = cat?.editorial;
    const home = S.board.home;
    const subline = [home.district, home.city].filter(Boolean).join(", ");

    const header = `<div class="sidebar-header">
      <h2>${esc(home.name)}</h2>
      ${subline ? `<p class="subline">${esc(subline)}</p>` : ""}
    </div>`;

    if (detail) return header + desktopDetail(cat, detail);

    const total = S.board.categories.reduce((n, c) => n + c.pois.length, 0);
    const cards = S.board.categories.map((c) => R.desktopCard(c)).join("");

    return (
      header +
      `<div class="scroll">
        ${R.sidebarTop()}
        <button class="cat-card" aria-current="${!S.activeCategoryId}" data-showall>
          <span class="cat-thumb dark">${icon("map", 22)}</span>
          <span class="cat-body">
            <span class="cat-top">
              <span class="cat-label">Hele nabolaget</span>
              <span class="cat-count">${total} steder</span>
            </span>
            <span class="cat-lead">Vis alle steder på kartet</span>
          </span>
        </button>
        ${cards}
        ${faqSection(S.board.globalFaq, "Om nabolaget")}
        ${meglerCard()}
      </div>`
    );
  }

  /** Desktop-kortet: illustrasjon + kuratert lead-prosa, ingen POI-rader. */
  function desktopCard(c) {
    const img = c.illustration?.src;
    return `<button class="cat-card" aria-current="${c.id === S.activeCategoryId}" data-cat="${esc(c.id)}">
      <span class="cat-thumb">${img ? `<img src="${esc(img)}" alt="">` : ""}</span>
      <span class="cat-body">
        <span class="cat-top">
          <span class="cat-label">${esc(c.label)}</span>
          <span class="cat-count">${c.pois.length} steder</span>
        </span>
        ${c.lead ? `<span class="cat-lead">${esc(c.lead)}</span>` : ""}
      </span>
      ${c.editorial ? `<span class="cat-chevron">${icon("chevron-right", 16)}</span>` : ""}
    </button>`;
  }

  function desktopDetail(cat, detail) {
    const list = buildList(cat, { scoped: true });
    // `intro` vinner når den finnes: da bærer FAQ-en substansen og prosaen
    // skal bare sette scenen (degradasjonsregelen ligger i board-data).
    const paragraphs = (detail.intro || detail.body || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const hero = detail.image ?? cat.illustration?.src;

    return `<div class="detail">
      <div class="detail-nav">
        <button class="btn-back" data-showall>${icon("arrow-left", 15)}Tilbake</button>
        <div class="theme-select">
          <button class="theme-trigger" data-theme-trigger aria-expanded="false">
            <span class="dot" style="background:${esc(cat.color)}"></span>
            <span class="lbl">${esc(cat.label)}</span>
            ${icon("chevron-down", 15)}
          </button>
        </div>
      </div>

      <div class="detail-scroll">
        ${hero ? `<div class="detail-hero"><img src="${esc(hero)}" alt=""></div>` : ""}
        <h3>${esc(cat.label)}</h3>
        <p class="detail-subline">${esc(categorySubline(list))}</p>
        ${
          paragraphs.length
            ? `<div class="detail-prose">${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
            : ""
        }
        ${faqSection(detail.faq)}
        ${highlightsSection(detail.highlights)}

        <section class="section">
          <p class="eyebrow">I utsnittet</p>
          ${
            list.rows.length === 0 && !list.activeRow
              ? `<p style="padding:8px 0;font-size:13px;color:var(--stone-500)">Ingen av kategoriens steder er i utsnittet. Zoom ut, eller ramm inn kategorien igjen.</p>`
              : `<ul>${list.rows
                  .map((p) => {
                    const m = minutesOf(p);
                    return `<li><button class="vp-row" data-poi="${esc(p.id)}">
                      <span class="n">${esc(p.name)}</span>
                      ${m !== undefined ? `<span class="m">${m} min</span>` : ""}
                    </button></li>`;
                  })
                  .join("")}</ul>`
          }
          ${
            list.hiddenCount > 0
              ? `<div class="vp-outside">
                  <span>${list.hiddenCount} ${list.hiddenCount === 1 ? "sted ligger" : "steder ligger"} utenfor utsnittet</span>
                  <button data-reframe>Ramm inn</button>
                </div>`
              : ""
          }
        </section>
        ${meglerCard()}
      </div>

      ${
        list.activeRow
          ? `<div class="pinned-active">
              <p class="eyebrow">Åpent nå</p>
              <div class="row">
                <span class="n">${esc(list.activeRow.name)}</span>
                ${minutesOf(list.activeRow) !== undefined ? `<span class="m">${minutesOf(list.activeRow)} min</span>` : ""}
              </div>
            </div>`
          : ""
      }
    </div>`;
  }

  // ---------- MOBIL ----------
  function mobileSheet() {
    const hint = S.viewportGestures === 0
      ? `<p class="hint">Dra i kartet — lista viser stedene i utsnittet, med gangtid hjemmefra.</p>`
      : "";

    const cards = S.board.categories
      .map((c) => {
        const list = buildList(c, { scoped: true });
        if (list.visibleCount === 0) return "";
        return R.mobileCard(c, list);
      })
      .join("");

    const body = cards
      ? cards
      : `<p class="m-empty">Ingen steder i dette utsnittet. Zoom ut, eller dra kartet tilbake mot boligen.</p>`;

    return `<div class="sheet" data-sheet>
      <button class="grab" data-grab>
        <span class="bar"></span>
        <span class="title">I nærheten</span>
      </button>
      <div class="sheet-scroll">
        ${R.sheetTop()}${hint}${body}
        ${faqSection(S.board.globalFaq, "Om nabolaget")}
      </div>
    </div>`;
  }

  /** Mobil-kortet: ikon-tint + dekningstall + 3 POI-rader + «Se alle N». */
  function mobileCard(c, list) {
    const rows = list.rows.slice(0, ROWS_PER_CATEGORY);
    const hasMore = list.totalCount > rows.length;
    return `<section class="m-card" data-cat-card="${esc(c.id)}">
      <button class="m-head" data-cat="${esc(c.id)}">
        <span class="m-icon" style="background:${esc(c.color)}1f;color:${esc(c.color)}">${icon(c.icon, 17)}</span>
        <span class="m-label">
          <span class="n">${esc(c.label)}</span>
          <span class="s">${esc(categorySubline(list))}</span>
        </span>
        ${icon("chevron-right", 18)}
      </button>
      ${
        rows.length
          ? `<ul class="m-rows">${rows
              .map((p) => {
                const m = minutesOf(p);
                return `<li><button data-poi="${esc(p.id)}">
                  <span class="n">${esc(p.name)}</span>
                  ${m !== undefined ? `<span class="m">${m} min</span>` : ""}
                </button></li>`;
              })
              .join("")}</ul>`
          : ""
      }
      ${
        hasMore
          ? `<button class="m-more" data-cat="${esc(c.id)}">Se alle ${list.totalCount}${icon("chevron-right", 16)}</button>`
          : ""
      }
    </section>`;
  }

  function mobileCategoryPage() {
    const cat = S.board.categories.find((c) => c.id === S.activeCategoryId);
    if (!cat) return "";
    // Kategorisiden er IKKE scopet til utsnittet — «se alle 17» må vise 17.
    const list = buildList(cat, { scoped: false });
    const ed = cat.editorial;
    const paragraphs = (ed?.intro || ed?.body || cat.lead || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const peeked = S.peeked;

    return `<button class="back-float" data-showall>${icon("arrow-left", 15)}Tilbake</button>
      <div class="catpage" data-catpage>
        <button class="catpage-head" data-peek-toggle>
          <span class="m-icon" style="background:${esc(cat.color)}1f;color:${esc(cat.color)}">${icon(cat.icon, 17)}</span>
          <span class="m-label">
            <span class="n">${esc(cat.label)}</span>
            <span class="s">${peeked ? "Trykk for å se lista igjen" : esc(categorySubline(list))}</span>
          </span>
        </button>
        <div class="catpage-scroll">
          ${
            paragraphs.length
              ? `<div class="detail-prose">${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
              : ""
          }
          ${faqSection(ed?.faq)}
          <section class="section">
            <ul class="poi-list">${list.rows
              .concat(list.activeRow ? [list.activeRow] : [])
              .map((p) => {
                const m = minutesOf(p);
                return `<li><button data-poi="${esc(p.id)}">
                  <span class="n">${esc(p.name)}</span>
                  ${m !== undefined ? `<span class="m">${m} min</span>` : ""}
                </button></li>`;
              })
              .join("")}</ul>
          </section>
        </div>
      </div>`;
  }

  // ---------- POI-modal (på mobil ER dette POI-flaten) ----------
  function poiModal() {
    if (!S.modalPoiId) return "";
    const poi = S.board.poisById[String(S.modalPoiId).toLowerCase()];
    if (!poi) return "";
    const cat = poi.category ?? {};
    const narrative =
      poi.grounding?.curated?.narrative ??
      poi.grounding?.generated?.narrative ??
      poi.editorialHook ??
      "Vi har ikke noe redaksjonelt innhold om dette stedet ennå.";
    return `<div class="modal-backdrop" data-modal-backdrop>
      <div class="modal-panel" role="dialog" aria-modal="true">
        <div class="modal-head">
          <span class="ic" style="background:${esc(cat.color ?? "#78716c")}1f;color:${esc(cat.color ?? "#78716c")}">${icon(cat.icon ?? "map-pin", 18)}</span>
          <span style="min-width:0;flex:1">
            <span class="n">${esc(poi.name)}</span>
            ${poi.address ? `<span class="a" style="display:block">${esc(poi.address)}</span>` : ""}
          </span>
          <button data-modal-close aria-label="Lukk">${icon("x", 18)}</button>
        </div>
        <div class="modal-body">${esc(narrative)}</div>
      </div>
    </div>`;
  }

  // ---------- kart ----------
  function initMap() {
    mapboxgl.accessToken = Proto.mapboxToken();
    const home = S.board.home;
    S.map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: [home.coordinates.lng, home.coordinates.lat],
      zoom: 14.4,
      attributionControl: false,
    });

    const el = document.createElement("div");
    el.className = "marker home";
    el.innerHTML = `<div class="pin"></div><div class="lbl">${esc(home.name.split(",")[0])}</div>`;
    new mapboxgl.Marker({ element: el })
      .setLngLat([home.coordinates.lng, home.coordinates.lat])
      .addTo(S.map);

    S.map.on("load", () => {
      drawMarkers();
      render();
    });
    // Å dra kartet ER filteret på mobil — lista og dekningstallene
    // rekalkuleres på hver utsnitts-endring.
    S.map.on("moveend", () => {
      if (S.userGesture) {
        S.viewportGestures++;
        S.userGesture = false;
      }
      drawMarkers(); // zoom kan ha krysset et markør-nivå
      render();
    });
    S.map.on("dragstart", () => (S.userGesture = true));
    S.map.on("zoomstart", () => (S.userGesture = true));
  }

  /** Zoom-nivåene fra produksjonens `useBoardZoomTier`: prikk → ikon →
   *  ikon+label. Uten dem drukner et board med 182 punkter i navn. */
  function zoomTier() {
    const z = S.map ? S.map.getZoom() : 14;
    if (z < 13.5) return "dot";
    if (z < 15.2) return "icon";
    return "label";
  }

  function drawMarkers() {
    for (const m of S.markers) m.remove();
    S.markers = [];
    const tier = zoomTier();
    for (const cat of S.board.categories) {
      const dim = S.activeCategoryId && S.activeCategoryId !== cat.id;
      for (const poi of cat.pois) {
        const active = poi.id === S.activePoiId;
        const showLabel = active || (!dim && tier === "label");
        const el = document.createElement("div");
        el.className = `marker${dim ? " dim" : ""}${active ? " active" : ""}${tier === "dot" && !active ? " tiny" : ""}`;
        el.innerHTML =
          `<div class="pin" style="background:${esc(cat.color)}"></div>` +
          (showLabel ? `<div class="lbl">${esc(poi.name)}</div>` : "");
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openPoi(poi.id);
        });
        S.markers.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([poi.coordinates.lng, poi.coordinates.lat])
            .addTo(S.map)
        );
      }
    }
  }

  function fitCategory(catId) {
    const cat = S.board.categories.find((c) => c.id === catId);
    if (!cat || !cat.pois.length) return;
    const b = new mapboxgl.LngLatBounds();
    b.extend([S.board.home.coordinates.lng, S.board.home.coordinates.lat]);
    for (const p of cat.pois) b.extend([p.coordinates.lng, p.coordinates.lat]);
    const isDesktop = matchMedia(DESKTOP).matches;
    S.map.fitBounds(b, {
      padding: isDesktop
        ? { top: 60, right: 60, bottom: 60, left: 60 }
        : { top: 80, right: 40, bottom: Math.round(innerHeight * 0.6), left: 40 },
      maxZoom: 15.4,
      duration: 900,
    });
  }

  // ---------- handlinger ----------
  function selectCategory(id) {
    // Toggle-semantikk som i produksjon: re-klikk på aktiv kategori = reset.
    S.activeCategoryId = S.activeCategoryId === id ? null : id;
    S.activePoiId = null;
    S.peeked = false;
    if (S.activeCategoryId) fitCategory(S.activeCategoryId);
    drawMarkers();
    render();
  }

  function showAll() {
    S.activeCategoryId = null;
    S.activePoiId = null;
    S.peeked = false;
    drawMarkers();
    render();
  }

  /** Markørklikk eier IKKE kategori-konteksten — kategori-state røres ikke. */
  function openPoi(poiId, { fromProse = false } = {}) {
    S.activePoiId = poiId;
    const poi = S.board.poisById[String(poiId).toLowerCase()];
    if (poi) {
      S.map.flyTo({
        center: [poi.coordinates.lng, poi.coordinates.lat],
        zoom: Math.max(S.map.getZoom(), 15.6),
        duration: 800,
      });
    }
    // Mobil: modalen ER POI-flaten og åpnes direkte. Men et stedsnavn trykket
    // i FAQ-prosa flyr kameraet FØRST — modalen venter på et direkte pin-trykk.
    if (!matchMedia(DESKTOP).matches) {
      if (fromProse) S.peeked = true;
      else S.modalPoiId = poiId;
    } else {
      S.modalPoiId = poiId;
    }
    drawMarkers();
    render();
  }

  // ---------- render ----------
  function render() {
    const app = document.getElementById("app");
    const isDesktop = matchMedia(DESKTOP).matches;
    const inCategory = !!S.activeCategoryId;

    app.innerHTML = `<div class="shell">
      <aside class="sidebar desktop-only">${isDesktop ? desktopSidebar() : ""}</aside>
      <div class="map-col">
        <div id="map"></div>
        ${modeControls()}
        ${boardSwitch()}
        ${
          !isDesktop
            ? `<div class="frame">${inCategory ? mobileCategoryPage() : mobileSheet()}</div>`
            : ""
        }
      </div>
    </div>${poiModal()}`;

    // Kartet er dyrt: flytt den eksisterende canvasen inn i den nye DOM-en
    // i stedet for å bygge kartet på nytt ved hver render.
    if (S.mapEl) {
      const slot = document.getElementById("map");
      slot.replaceWith(S.mapEl);
    } else {
      S.mapEl = document.getElementById("map");
    }

    if (window.lucide?.createIcons) lucide.createIcons();
    wire();
    if (!isDesktop) sizeMobileSurface();
    if (S.map) S.map.resize();
  }

  const modeControls = () => {
    // Vises bare når boardet har data for mer enn én modus.
    const avail = MODES.filter((m) =>
      S.board.categories.some((c) => c.pois.some((p) => p.raw?.travelTime?.[m.id] != null))
    );
    if (avail.length < 2) return "";
    return `<div class="map-controls">${avail
      .map(
        (m) =>
          `<button aria-current="${m.id === S.travelMode}" data-mode="${m.id}">${icon(m.icon, 15)}${m.label}</button>`
      )
      .join("")}</div>`;
  };

  const boardSwitch = () => {
    if (!S.opts?.boards) return "";
    return `<div class="proto-switch">
      <span class="tier">NIVÅ ${S.meta.tier}</span>
      ${Object.keys(S.opts.boards)
        .map((k) => {
          // Behold iterasjonens egne parametre — å bytte board skal ikke
          // nullstille varianten du sammenligner.
          const q = new URLSearchParams(location.search);
          q.set("board", k);
          return `<a href="?${q}" aria-current="${k === S.opts.active}">${k === "ranheim" ? "Kuratert" : "Ukuratert"}</a>`;
        })
        .join("")}
    </div>`;
  };

  // ---------- events ----------
  function wire() {
    const app = document.getElementById("app");

    app.onclick = (ev) => {
      const t = ev.target;
      const hit = (sel) => t.closest(sel);

      // Iterasjonens egne trykk går først — den kan overstyre baselinen.
      if (R.onClick(t, ev)) return;

      if (hit("[data-showall]")) return showAll();
      if (hit("[data-modal-close]") || t.matches("[data-modal-backdrop]")) {
        S.modalPoiId = null;
        S.activePoiId = null;
        drawMarkers();
        return render();
      }
      const mode = hit("[data-mode]");
      if (mode) {
        // Modusbytte rører ALDRI navigasjons-state — bare tallene oppdateres.
        S.travelMode = mode.dataset.mode;
        return render();
      }
      const poiLink = hit(".poi-link[data-poi]");
      if (poiLink) return openPoi(poiLink.dataset.poi, { fromProse: true });
      const catLink = hit(".poi-link[data-category]");
      if (catLink) return selectCategory(catLink.dataset.category);
      const poiBtn = hit("[data-poi]");
      if (poiBtn) return openPoi(poiBtn.dataset.poi);
      const catBtn = hit("[data-cat]");
      if (catBtn) return selectCategory(catBtn.dataset.cat);
      if (hit("[data-reframe]")) return fitCategory(S.activeCategoryId);

      // Disclosure: begge tilstander står i DOM, vekslet med CSS. Ingen auto-scroll.
      const faq = hit("[data-faq]");
      if (faq) {
        const open = faq.getAttribute("aria-expanded") === "true";
        faq.setAttribute("aria-expanded", String(!open));
        faq.parentElement.querySelector(".faq-a").dataset.expanded = String(!open);
        return;
      }
      const hlT = hit("[data-hl-toggle]");
      if (hlT) {
        const open = hlT.getAttribute("aria-expanded") === "true";
        hlT.setAttribute("aria-expanded", String(!open));
        hlT.parentElement.querySelector(".hl-panel").dataset.expanded = String(!open);
        hlT.querySelector("[data-hl-label]").textContent = open ? "Se hvilke" : "Skjul lista";
        return;
      }
      const trigger = hit("[data-theme-trigger]");
      if (trigger) return openThemeMenu(trigger);
      const peek = hit("[data-peek-toggle]");
      if (peek && S.peeked) {
        S.peeked = false;
        return render();
      }
    };

    const grab = app.querySelector("[data-grab]");
    if (grab) wireSheetDrag(grab);
  }

  function openThemeMenu(trigger) {
    const wrap = trigger.parentElement;
    if (wrap.querySelector(".theme-menu")) return;
    trigger.setAttribute("aria-expanded", "true");
    const backdrop = document.createElement("div");
    backdrop.className = "theme-backdrop";
    const menu = document.createElement("div");
    menu.className = "theme-menu";
    menu.innerHTML =
      `<button data-showall>Vis alle</button>` +
      S.board.categories
        .map(
          (c) =>
            `<button data-cat="${esc(c.id)}" aria-current="${c.id === S.activeCategoryId}">
              <span class="dot" style="background:${esc(c.color)};height:8px;width:8px;border-radius:999px;flex:none"></span>${esc(c.label)}
            </button>`
        )
        .join("");
    // Klikk-utenfor via backdrop-knapp, ikke document-listener — ellers faller
    // lukke-klikket gjennom til kartet.
    backdrop.onclick = () => {
      backdrop.remove();
      menu.remove();
      trigger.setAttribute("aria-expanded", "false");
    };
    // Valg av aktivt tema skal bare lukke velgeren (ikke toggle bort boardet).
    menu.onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      ev.stopPropagation();
      if (b.hasAttribute("data-showall")) return showAll();
      if (b.dataset.cat === S.activeCategoryId) return backdrop.onclick();
      S.activeCategoryId = b.dataset.cat;
      S.activePoiId = null;
      fitCategory(S.activeCategoryId);
      drawMarkers();
      render();
    };
    wrap.appendChild(backdrop);
    wrap.appendChild(menu);
  }

  // ---------- mobil-sheet: fri drag mellom to grenser ----------
  function surfaceBounds() {
    const frameH = document.querySelector(".frame")?.clientHeight ?? innerHeight;
    const ceiling = Math.round(frameH * REST_HIGH_FRACTION);
    const min = clamp(Math.round(frameH * REST_LOW_FRACTION), REST_LOW_MIN_PX, ceiling);
    return { min, max: ceiling, frameH };
  }

  function sizeMobileSurface() {
    const { min, max, frameH } = surfaceBounds();
    const sheet = document.querySelector("[data-sheet]");
    if (sheet) {
      const content = sheet.scrollHeight;
      const cap = content > 0 ? clamp(content, min, max) : max;
      S.sheetH = clamp(S.sheetH ?? min, min, cap);
      sheet.style.height = `${S.sheetH}px`;
    }
    const page = document.querySelector("[data-catpage]");
    if (page) {
      page.style.height = `${Math.round(frameH * (S.peeked ? PEEK_FRACTION : PANEL_FRACTION))}px`;
    }
  }

  function wireSheetDrag(grab) {
    const sheet = grab.closest("[data-sheet]");
    let startY = 0, startH = 0, lastY = 0, lastT = 0, velocity = 0, moved = 0, dragging = false;

    grab.addEventListener("pointerdown", (ev) => {
      dragging = true;
      moved = 0;
      startY = lastY = ev.clientY;
      startH = sheet.getBoundingClientRect().height;
      lastT = performance.now();
      velocity = 0;
      sheet.style.transition = "none";
      grab.setPointerCapture(ev.pointerId);
    });

    grab.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const { min, max } = surfaceBounds();
      moved = Math.max(moved, Math.abs(ev.clientY - startY));
      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) velocity = (lastY - ev.clientY) / dt; // px/ms, opp = positiv
      lastY = ev.clientY;
      lastT = now;
      // Høyden settes imperativt under drag — ingen re-render per frame.
      sheet.style.height = `${clamp(startH + (startY - ev.clientY), min, max)}px`;
    });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      const { min, max } = surfaceBounds();
      let h = sheet.getBoundingClientRect().height;

      // Tap uten bevegelse: hopp til det ytterpunktet du IKKE er nærmest.
      if (moved < TAP_SLOP_PX) {
        h = Math.abs(h - min) < Math.abs(h - max) ? max : min;
      } else {
        h = clamp(h + velocity * MOMENTUM_PROJECTION_MS, min, max);
        if (Math.abs(h - min) < SNAP_THRESHOLD_PX) h = min;
        else if (Math.abs(h - max) < SNAP_THRESHOLD_PX) h = max;
      }

      const dur = clamp(Math.abs(h - sheet.getBoundingClientRect().height) * 1.4, SETTLE_MIN_MS, SNAP_DURATION_MS);
      sheet.style.transition = `height ${Math.round(dur)}ms cubic-bezier(.32,.72,0,1)`;
      sheet.style.height = `${Math.round(h)}px`;
      S.sheetH = Math.round(h);
    };
    grab.addEventListener("pointerup", end);
    grab.addEventListener("pointercancel", end);
  }

  // ---------- utvidelsespunkter ----------
  /* En iterasjon skal overstyre KUN det den tester. Alt annet arves fra
     baselinen, så en endring i produksjonsflaten forplanter seg til alle
     prototyper i stedet for å råtne i hver sin kopi.

       Baseline.override({ mobileCard(cat, list) { ... } })

     `sidebarTop`/`sheetTop` er tomme i baselinen — de finnes for at en
     iterasjon kan legge noe FØR kategori-lista uten å røre resten.
     `onClick` returnerer true hvis iterasjonen håndterte trykket. */
  const R = {
    desktopCard,
    mobileCard,
    sidebarTop: () => "",
    sheetTop: () => "",
    onClick: () => false,
  };

  // ---------- oppstart ----------
  async function start(name, opts) {
    const snap = await Proto.loadBoard(name);
    S = {
      meta: snap.meta,
      board: snap.board,
      opts,
      travelMode: "walk",
      activeCategoryId: null,
      activePoiId: null,
      modalPoiId: null,
      peeked: false,
      viewportGestures: 0,
      userGesture: false,
      markers: [],
      map: null,
      mapEl: null,
      sheetH: null,
    };

    if (snap.meta.tier !== 1) {
      console.warn(
        `[baseline] ${name} er NIVÅ ${snap.meta.tier} (har avspillbar lyd). ` +
          `Baselinen gjenskaper nivå-1-flaten — velg et board uten lyd.`
      );
    }

    render();
    initMap();
    addEventListener("resize", () => render());
    matchMedia(DESKTOP).addEventListener("change", () => {
      S.sheetH = null;
      render();
    });
  }

  return {
    start,
    /** Overstyr én eller flere renderere. Må kalles FØR `start`. */
    override: (fns) => Object.assign(R, fns),
    /** Originalene, så en override kan delegere tilbake til baselinen. */
    baseDesktopCard: desktopCard,
    baseMobileCard: mobileCard,
    /** Byggeklossene baselinen selv bruker, så en iterasjon ikke må finne dem opp. */
    util: {
      esc,
      icon,
      minutesOf,
      categorySubline,
      buildList,
      linkedText,
      byMinutesThenName,
      selectCategory,
      openPoi,
      showAll,
      fitCategory,
      rerender: () => render(),
      state: () => S,
    },
  };
})();
