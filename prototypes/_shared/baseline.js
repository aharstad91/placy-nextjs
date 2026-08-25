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

    /* Sheeten er ikke en flate vi drar med JS — den ER en scroller, og over
       kroppen ligger en gjennomsiktig spacer. Da er «dra sheeten opp» og
       «scroll i innholdet» ÉN native bevegelse: fingeren spiser spaceren
       først, kroppen stopper når den har nådd taket (scrollerens egen
       overkant), og samme bevegelse fortsetter inn i innholdet under en
       fastlimt header. Veien tilbake er den speilvendt — ingen overlevering
       mellom to mekanismer, altså ingenting som kan ryke midt i en gest.

       Scrolleren er `pointer-events: none` og kroppen `auto`: over spaceren
       treffer fingeren kartet, så panorering er urørt. Nettleseren scroller
       nærmeste rullbare FORFAR av det fingeren treffer, og pointer-events
       endrer bare hva som treffes — derfor scroller kroppen scrolleren.

       Det gir også trykk-låsen gratis. Under en native scroll undertrykker
       nettleseren selv klikket, så et drag over lista åpner ikke en rad. */
    return `<div class="sheet-outer" data-sheet-outer>
      <div class="sheet-spacer" aria-hidden="true"></div>
      <div class="sheet" data-sheet>
        <button class="grab" data-grab>
          <span class="bar"></span>
          <span class="title">${esc(R.sheetTitle())}</span>
        </button>
        <div class="sheet-body">
          ${R.sheetTop()}${hint}${body}
          ${faqSection(S.board.globalFaq, "Om nabolaget")}
        </div>
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
      // Et kamera som lander mens fingeren står i sheeten skal IKKE rendre:
      // renderen bygger scrolleren på nytt, og en scroll som er i gang dør med
      // den gamle noden. Fingeren opplever at flaten stopper av seg selv.
      // Iterasjoner flyr kartet programmatisk (04 gjør det 420 ms etter et
      // trykk), så dette er en vanlig tilstand, ikke et kantsett.
      if (S.sheetTouching) S.renderPending = true;
      else render();
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
        // Iterasjonen kan overstyre per markør ({ dim, label, hidden }); et felt
        // som mangler betyr «behold baselinens valg». Nødvendig fordi labels
        // settes i JS — en iterasjon kan ikke navngi utvalgte punkter fra CSS.
        const o = R.marker(poi, cat) ?? {};
        if (o.hidden) continue;
        const dimmed = o.dim ?? dim;
        const showLabel = o.label ?? (active || (!dimmed && tier === "label"));
        const el = document.createElement("div");
        el.className =
          `marker${dimmed ? " dim" : ""}${active ? " active" : ""}` +
          `${tier === "dot" && !active ? " tiny" : ""}${o.className ? ` ${o.className}` : ""}`;
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
  /** Scroll-posisjonen i de rullbare flatene, tatt vare på over en render.
   *  Produksjonen er React og beholder nodene; her bygges `#app` på nytt, og
   *  uten dette hopper flaten til topps hver gang noe rendrer — å dra kartet
   *  rendrer, så det skjer midt i lesingen. Det er en portingskostnad, ikke en
   *  oppførsel fra produksjonen.
   *
   *  For mobil-sheeten er dette ikke bare lesestedet: scroll-posisjonen ER
   *  sheetens høyde (se `mobileSheet`). Mistes den, faller sheeten ned i
   *  hvilestillingen hver gang kartet rendrer. */
  const SCROLLERS = ["[data-sheet-outer]", ".catpage-scroll", ".sidebar .scroll"];
  const readScroll = () =>
    SCROLLERS.map((sel) => document.querySelector(sel)?.scrollTop ?? 0);
  function restoreScroll(tops) {
    SCROLLERS.forEach((sel, i) => {
      const el = document.querySelector(sel);
      if (el && tops[i]) el.scrollTop = tops[i];
    });
  }

  function render() {
    const app = document.getElementById("app");
    const tops = readScroll();
    if (document.querySelector("[data-sheet-outer]")) S.sheetScroll = tops[0];
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
    restoreScroll(tops); // etter sizeMobileSurface: høyden må stå før scrollen
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

    const outer = app.querySelector("[data-sheet-outer]");
    if (outer) wireSheetSurface(outer);
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

  // ---------- mobil-sheet: én scroller fra hvilestilling til tak ----------
  function surfaceBounds() {
    const frameH = document.querySelector(".frame")?.clientHeight ?? innerHeight;
    const ceiling = Math.round(frameH * REST_HIGH_FRACTION);
    const rest = clamp(
      Math.round(frameH * REST_LOW_FRACTION),
      REST_LOW_MIN_PX,
      ceiling
    );
    return { rest: S.sheetRestH ?? rest, max: ceiling, frameH };
  }

  /** Avstanden sheeten kan reise før den står i taket — altså spacerens høyde,
   *  og samtidig scroll-posisjonen der kroppen har nådd toppen. Leses av
   *  scroll-lytteren, så den skal ikke måle DOM på nytt per event. */
  let sheetTravel = 0;

  /* Hårstrek under headeren først når innholdet FAKTISK ligger under den.
     Før taket er den ingen «sticky header» — den er sheetens overkant. */
  function markPinned(outer) {
    const sheet = outer.querySelector("[data-sheet]");
    if (!sheet) return;
    // +1 fordi nøyaktig i taket ligger det ennå ingenting under headeren.
    const pinned = String(outer.scrollTop > sheetTravel + 1);
    if (sheet.dataset.pinned !== pinned) sheet.dataset.pinned = pinned;
  }

  /** Geometrien, satt én gang per render. Scrolleren er høy som taket, spaceren
   *  dekker veien ned til hvilestillingen, og kroppen er minst så høy at den
   *  fyller den høyden sheeten SKAL stå i.
   *
   *  Gulvet er ikke bare hvilestillingen: det er hvilestillingen pluss det
   *  brukeren har dratt. Ellers stjeler et kart i bevegelse høyden hen valgte —
   *  lista er utsnitts-scopet, så zoomer du inn til ett kort, krymper innholdet,
   *  scroll-området forsvinner, og nettleseren klipper scroll-posisjonen til
   *  null. Sheeten faller ned av seg selv, og zoomer du ut igjen kommer den
   *  ikke tilbake. (Den samme feilen fantes i høyde-modellen: `sizeMobileSurface`
   *  klemte høyden mot innholdet ved hver render.)
   *
   *  Over gulvet er kroppen akkurat så høy som innholdet trenger, og taket er
   *  scrollerens egen overkant — kroppen kan aldri komme over det, uansett hvor
   *  mye innhold den har. */
  function sizeMobileSurface() {
    const { rest, max, frameH } = surfaceBounds();
    const outer = document.querySelector("[data-sheet-outer]");
    if (outer) {
      sheetTravel = max - rest;
      const dragged = clamp(S.sheetScroll ?? 0, 0, sheetTravel);
      outer.style.height = `${max}px`;
      outer.querySelector(".sheet-spacer").style.height = `${sheetTravel}px`;
      outer.querySelector("[data-sheet]").style.minHeight = `${rest + dragged}px`;
      markPinned(outer);
    }
    const page = document.querySelector("[data-catpage]");
    if (page) {
      page.style.height = `${Math.round(frameH * (S.peeked ? PEEK_FRACTION : PANEL_FRACTION))}px`;
    }
  }

  /** Sheetens synlige høyde nå. Kameraet padder for den, så den må leses, ikke
   *  huskes: brukeren kan ha dratt sheeten hvor som helst siden sist. */
  function sheetVisibleH() {
    const outer = document.querySelector("[data-sheet-outer]");
    if (!outer) return 0;
    return outer.clientHeight - Math.max(0, sheetTravel - outer.scrollTop);
  }

  /* ---------- gesten: én eier for hele strøket ----------
     Fingeren flytter ÉTT tall: scroll-posisjonen. Under spacerens høyde er det
     sheetens høyde, over den er det innholdet som går under headeren. Derfor
     finnes det ingen overlevering mellom to mekanismer, og altså ingenting som
     kan ryke midt i en gest: veien opp og veien tilbake er samme bevegelse.

     Vi driver den selv i stedet for å la nettleseren scrolle, fordi iOS slutter
     å sende pointermove i det den har bestemt at strøket er en scroll. Da kan
     ikke lista gi bevegelsen tilbake til kroppen uten at fingeren løftes.
     Prisen er at farten etter slipp er vår: `SHEET_DECAY` er iOS' egen
     bremsefaktor per millisekund. */
  const SHEET_DECAY = 0.998;
  const SHEET_V_STOP = 0.02; // px/ms — under dette er bevegelsen over
  const TAP_SLOP_TOUCH_PX = 10;
  const TAP_SLOP_MOUSE_PX = 4;

  /* «Ingen gesture skal være eneste vei til noe» (prototypes/README.md): handlen
     kan trykkes, ikke bare dras. Et trykk går til det ytterpunktet du IKKE står
     nærmest. Et DRAG som ender i et trykk spises av click-låsen under. */
  /* En utsatt render slippes løs først når sheeten står HELT stille. touchend
     er for tidlig: den native utrullingen fortsetter etter at fingeren er
     borte, og en render midt i den bytter ut noden farten bor i. Vi venter
     derfor på både løftet finger og en scroll som har lagt seg. */
  const SHEET_IDLE_MS = 140;
  let sheetIdle = 0;
  function flushWhenSheetSettles() {
    clearTimeout(sheetIdle);
    sheetIdle = setTimeout(() => {
      if (S.sheetTouching || !S.renderPending) return;
      S.renderPending = false;
      render();
    }, SHEET_IDLE_MS);
  }

  /* Gest-tilstanden ligger på modulnivå, ikke per node: `wireSheetSurface`
     kjøres på nytt for hver render, og window-lytterne under skal finnes ÉN
     gang. Under en gest rendrer vi ikke (se `moveend`), så noden i `drag`
     lever så lenge gesten gjør. */
  let sheetDrag = null;
  let sheetGlide = 0; // rAF-håndtaket for utrullingen etter slipp
  let sheetEatClick = false; // draget skal ikke ende som et trykk på en rad
  const maxScrollOf = (el) => Math.max(0, el.scrollHeight - el.clientHeight);

  /** Utrullingen etter slipp: iOS' egen bremsefaktor, på vårt ene tall. */
  function sheetGlideOn(outer, v0) {
    let v = v0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(now - last, 32); // et bortfall skal ikke gi et hopp
      last = now;
      const next = clamp(outer.scrollTop + v * dt, 0, maxScrollOf(outer));
      const stopped = next === outer.scrollTop;
      outer.scrollTop = next;
      v *= Math.pow(SHEET_DECAY, dt);
      if (stopped || Math.abs(v) < SHEET_V_STOP) return flushWhenSheetSettles();
      sheetGlide = requestAnimationFrame(step);
    };
    if (Math.abs(v0) < SHEET_V_STOP) return flushWhenSheetSettles();
    sheetGlide = requestAnimationFrame(step);
  }

  /* Move og up ligger på window, ikke på sheeten: en mus som forlater flaten
     midt i draget skal fortsatt bli hørt. Touch har pointer capture implisitt,
     men musa har det ikke — og vi flytter aldri capture selv, for WebKits
     re-capture er rapportert ødelagt. */
  function wireSheetWindow() {
    addEventListener("pointermove", (ev) => {
      const d = sheetDrag;
      if (!d) return;
      const now = performance.now();
      const dt = now - d.t;
      // Fingeren opp = innholdet opp = scroll-posisjonen øker.
      if (dt > 0) d.v = (d.y - ev.clientY) / dt;
      d.y = ev.clientY;
      d.t = now;
      if (Math.abs(ev.clientY - d.startY) > d.slop) sheetEatClick = true;
      d.outer.scrollTop = clamp(d.top + (d.startY - ev.clientY), 0, maxScrollOf(d.outer));
    });

    const release = () => {
      const d = sheetDrag;
      if (!d) return;
      sheetDrag = null;
      S.sheetTouching = false;
      // Clicket kan utebli helt (endres DOM-en under bevegelsen sender iOS
      // ingen videre events), så låsen må også kunne løpe ut av seg selv.
      if (sheetEatClick) setTimeout(() => (sheetEatClick = false), 350);
      sheetGlideOn(d.outer, d.v);
    };
    addEventListener("pointerup", release);
    addEventListener("pointercancel", release);
  }

  function wireSheetSurface(outer) {
    outer.addEventListener(
      "scroll",
      () => {
        // Posisjonen huskes med vilje utenfor DOM-en: `sizeMobileSurface`
        // trenger den FØR den nye noden har fått noen scroll å lese.
        S.sheetScroll = outer.scrollTop;
        markPinned(outer);
        flushWhenSheetSettles();
      },
      { passive: true }
    );

    /* Klikk-låsen. Nettleseren undertrykker den ikke for oss: har vi hindret
       dens egen scroll, kommer clicket likevel når fingeren løftes — og fordi
       touch har implisitt pointer capture havner det på raden fingeren lå PÅ,
       ikke der den slapp. Capture-fasen er poenget: `wire()` legger all
       trykk-håndtering på `#app` som er FORELDER til sheeten, så én lytter her
       spiser clicket før det når verken raden eller `#app`. */
    outer.addEventListener(
      "click",
      (ev) => {
        if (!sheetEatClick) return;
        sheetEatClick = false;
        ev.stopPropagation();
        ev.preventDefault();
      },
      true
    );

    outer.querySelector("[data-grab]").addEventListener("click", () => {
      const up = outer.scrollTop < sheetTravel / 2;
      outer.scrollTo({ top: up ? sheetTravel : 0, behavior: "smooth" });
    });

    outer.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      cancelAnimationFrame(sheetGlide); // en ny finger stopper utrullingen
      sheetDrag = {
        outer,
        y: ev.clientY,
        startY: ev.clientY,
        top: outer.scrollTop,
        t: performance.now(),
        v: 0,
        slop: ev.pointerType === "touch" ? TAP_SLOP_TOUCH_PX : TAP_SLOP_MOUSE_PX,
      };
      S.sheetTouching = true;
    });
  }

  // ---------- utvidelsespunkter ----------
  /* En iterasjon skal overstyre KUN det den tester. Alt annet arves fra
     baselinen, så en endring i produksjonsflaten forplanter seg til alle
     prototyper i stedet for å råtne i hver sin kopi.

       Baseline.override({ mobileCard(cat, list) { ... } })

     `sidebarTop`/`sheetTop` er tomme i baselinen — de finnes for at en
     iterasjon kan legge noe FØR kategori-lista uten å røre resten.
     `onClick` returnerer true hvis iterasjonen håndterte trykket.
     `marker` overstyrer én markørs { dim, label, hidden, className }; null =
     baselinen. `className` finnes fordi to nivåer (dempet/ikke) ikke alltid er
     nok — en iterasjon kan trenge et tredje, og resten skal da stiles i CSS. */
  const R = {
    desktopCard,
    mobileCard,
    sidebarTop: () => "",
    sheetTop: () => "",
    onClick: () => false,
    marker: () => null,
    sheetTitle: () => "I nærheten",
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
      // Sheetens hvilestilling i piksler. null = baselinens brøk av rammen; en
      // iterasjon kan sette den (04 gir hele omvisningen ett fast vindu).
      sheetRestH: null,
      // Hvor langt sheeten står dratt opp, i scroll-piksler. Holdes utenfor
      // DOM-en fordi geometrien må settes før noden har en scroll å lese.
      sheetScroll: 0,
      sheetTouching: false,
      renderPending: false,
    };

    if (snap.meta.tier !== 1) {
      console.warn(
        `[baseline] ${name} er NIVÅ ${snap.meta.tier} (har avspillbar lyd). ` +
          `Baselinen gjenskaper nivå-1-flaten — velg et board uten lyd.`
      );
    }

    render();
    initMap();
    wireSheetWindow(); // én gang, ikke per render
    addEventListener("resize", () => render());
    matchMedia(DESKTOP).addEventListener("change", () => render());
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
      redrawMarkers: () => drawMarkers(),
      /** Sett `state().sheetRestH` og kall denne — geometrien settes uten en
       *  full render, så en iterasjon kan gi sheeten sin egen hvilestilling. */
      sizeSheet: () => sizeMobileSurface(),
      /** Sheetens synlige høyde nå, lest fra scroll-posisjonen. */
      sheetVisibleH,
      state: () => S,
    },
  };
})();
