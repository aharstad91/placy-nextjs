#!/usr/bin/env npx tsx
/**
 * Rendrer kategorimalene til en lesbar HTML-side.
 *
 * HVORFOR GENERERT OG IKKE SKREVET: en oversikt som vedlikeholdes ved siden av
 * koden begynner å sprike samme dag den lages, og da er den verre enn ingen
 * oversikt — den ser autoritativ ut mens den lyver. Denne siden har ingen egen
 * sannhet: alt kommer fra CATEGORY_SPECS og PLANLAGTE_KATEGORIER. Endrer du en
 * mal i koden, kjør scriptet på nytt, og siden stemmer igjen.
 *
 * TETTHET ER ET KRAV, IKKE EN SMAKSSAK (Andreas, 2026-08-16): siden skal romme
 * ti maler. Første utkast brukte én smal lesespalte per mal og ble en
 * rullegardin allerede på to. Derfor: full bredde, en oversiktsmatrise som
 * svarer på «hvordan står det til» uten scrolling, og hver mal som ett bredt
 * kort delt i tre spalter i stedet for én lang kolonne.
 *
 *   npx tsx scripts/render-category-specs.ts --out <fil.html>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  CATEGORY_SPECS,
  PLANLAGTE_KATEGORIER,
  type CategorySpec,
  type FaktaKilde,
  type SpecQuestion,
} from "../lib/editorial/category-specs";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args[outIdx + 1] : undefined;
if (!OUT) {
  console.error("Usage: npx tsx scripts/render-category-specs.ts --out <fil.html>");
  process.exit(1);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const KILDE_NAVN: Record<FaktaKilde, string> = {
  register: "Offentlig register",
  eget: "Våre egne data",
  søk: "Websøk",
};

function kildeKlasse(k: FaktaKilde): string {
  return k === "register" ? "k-reg" : k === "eget" ? "k-eget" : "k-sok";
}

/**
 * Ett merke bærer begge aksene: farge = hvor faktumet kommer fra, fylt eller
 * åpen = kjerne eller valgfri. Alternativet var to merker per spørsmål, altså
 * rundt 80 på en ferdig side — støy som hadde skjult mønsteret merket finnes
 * for å vise.
 */
function merke(q: SpecQuestion): string {
  return `<span class="mrk ${kildeKlasse(q.kilde)} ${q.kjerne ? "fylt" : "aapen"}" title="${esc(
    `${KILDE_NAVN[q.kilde]} · ${q.kjerne ? "kjerne" : "valgfri"}`,
  )}"></span>`;
}

function spørsmålRad(q: SpecQuestion, svartAv: ReadonlySet<string>): string {
  const board = q.lag === "board";
  // Haken viser hva PRØVEN svarte på — ikke hva som er obligatorisk. Uten den
  // ser et eksempel som lar tre spørsmål stå ubesvart ut som et hull.
  const hake = svartAv.has(q.id) ? `<span class="hake" title="besvart i tekstprøven">✓</span>` : "";
  return `<li class="q ${q.kjerne ? "" : "valgfri"} ${board ? "boardlag" : ""}">${merke(
    q,
  )}<span class="q-t">${esc(q.spørsmål)}${
    board ? ` <span class="lagmerke">boardet, ikke teksten</span>` : ""
  }</span>${hake}${q.felt ? `<code class="felt">${esc(q.felt)}</code>` : ""}</li>`;
}

function malKort(spec: CategorySpec): string {
  const kjerne = spec.spørsmål.filter((q) => q.kjerne).length;
  const svartAv = new Set(spec.eksempel.god.svarer);
  return `
  <article class="mal" id="${esc(spec.kategorier[0])}">
    <header class="mal-topp">
      <h2>${esc(spec.navn)}</h2>
      <span class="mal-tall">${spec.antall} steder</span>
      <span class="mal-tall">${kjerne} av ${spec.spørsmål.length} kjerne</span>
      <span class="mal-kat">${spec.kategorier.map((k) => `<code>${esc(k)}</code>`).join(" ")}</span>
    </header>

    <p class="lead"><b>Led med</b> ${esc(spec.lead)}</p>
    <p class="lead tom"><b>Tom tekst</b> ${esc(spec.naarTom)}</p>

    <div class="kolonner">
      <div class="kol">
        <h3>Skal svare på <span class="tell">✓ = besvart i prøven</span></h3>
        <ul class="q-liste">
          ${spec.spørsmål.map((q) => spørsmålRad(q, svartAv)).join("\n          ")}
        </ul>
        <p class="q-fot">Prøven svarer på ${svartAv.size} av ${
          spec.spørsmål.filter((q) => (q.lag ?? "tekst") === "tekst").length
        }. Det er meningen — de øvrige har ikke svar for akkurat det stedet, og da utelates de.</p>
      </div>

      <div class="kol">
        <h3>Aldri</h3>
        <ul class="aldri">
          ${spec.aldri.map((a) => `<li>${esc(a)}</li>`).join("\n          ")}
        </ul>
      </div>

      <div class="kol">
        <h3>Tekstprøver</h3>
        <div class="proeve p-god">
          <span class="pl">Svarer på malen <span class="sted">${esc(spec.eksempel.god.sted)}</span></span>
          <p>${esc(spec.eksempel.god.tekst)}</p>
        </div>
        <div class="proeve p-daarlig">
          <span class="pl">Gjør det ikke <span class="sted">${esc(spec.eksempel.dårlig.sted)}</span></span>
          <p>${esc(spec.eksempel.dårlig.tekst)}</p>
        </div>
        <p class="hvorfor">${esc(spec.eksempel.dårlig.hvorfor)}</p>
      </div>
    </div>
  </article>`;
}

function oversiktRad(spec: CategorySpec): string {
  const chips = spec.spørsmål
    .filter((q) => q.kjerne)
    .map((q) => `<span class="chip ${kildeKlasse(q.kilde)}">${esc(q.id)}</span>`)
    .join("");
  return `<tr>
      <td class="navn"><a href="#${esc(spec.kategorier[0])}">${esc(spec.navn)}</a></td>
      <td class="tall">${spec.antall}</td>
      <td><span class="status s-ferdig">Skrevet</span></td>
      <td class="chips">${chips}</td>
    </tr>`;
}

const ferdigAntall = CATEGORY_SPECS.length;
const totaltPlanlagt = ferdigAntall + PLANLAGTE_KATEGORIER.length;
const dekket =
  CATEGORY_SPECS.reduce((s, c) => s + c.antall, 0) +
  PLANLAGTE_KATEGORIER.reduce((s, p) => s + p.antall, 0);
const skrevetSteder = CATEGORY_SPECS.reduce((s, c) => s + c.antall, 0);

const html = `<title>Malverket</title>
<style>
  :root {
    --paper: #eef1f4;
    --card: #fafbfc;
    --ink: #16202b;
    --ink-soft: #5a6773;
    --rule: #d2dae1;
    --register: #1b4f8a;
    --eget: #8a5712;
    --sok: #4d6459;
    --forbud: #98291f;
    --skygge: 0 1px 2px rgba(22, 32, 43, .05), 0 4px 14px rgba(22, 32, 43, .04);
    --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #10161c; --card: #18212a; --ink: #e3e9ee; --ink-soft: #97a5b1;
      --rule: #2c3844; --register: #7fb3e8; --eget: #dda94f; --sok: #8fb3a2;
      --forbud: #e28379;
      --skygge: 0 1px 2px rgba(0,0,0,.4), 0 4px 14px rgba(0,0,0,.28);
    }
  }
  :root[data-theme="dark"] {
    --paper: #10161c; --card: #18212a; --ink: #e3e9ee; --ink-soft: #97a5b1;
    --rule: #2c3844; --register: #7fb3e8; --eget: #dda94f; --sok: #8fb3a2;
    --forbud: #e28379;
    --skygge: 0 1px 2px rgba(0,0,0,.4), 0 4px 14px rgba(0,0,0,.28);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; }

  .wrap {
    max-width: 88rem;
    margin: 0 auto;
    padding: clamp(1.5rem, 3vw, 2.75rem) clamp(1rem, 2.5vw, 2.25rem) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  /* ── Topp: tittel og tese side om side ─────────────────── */
  .topp {
    display: grid;
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
    gap: clamp(1rem, 3vw, 2.5rem);
    align-items: start;
  }
  @media (max-width: 60rem) { .topp { grid-template-columns: 1fr; } }
  .kicker {
    font-family: var(--mono); font-size: .68rem; letter-spacing: .14em;
    text-transform: uppercase; color: var(--ink-soft); margin: 0 0 .3rem;
  }
  h1 { font-size: clamp(1.9rem, 4vw, 2.6rem); line-height: 1.05; margin: 0; font-weight: 600; letter-spacing: -.02em; }
  .tese { margin: 0; color: var(--ink-soft); }
  .tese + .tese { margin-top: .55rem; }
  .tese b { color: var(--ink); font-weight: 600; }

  /* ── Merke og forklaring ───────────────────────────────── */
  .mrk {
    flex: 0 0 auto; width: .55rem; height: .55rem; border-radius: 50%;
    border: 1.5px solid currentColor; margin-top: .42rem;
  }
  .mrk.fylt { background: currentColor; }
  .k-reg { color: var(--register); }
  .k-eget { color: var(--eget); }
  .k-sok { color: var(--sok); }

  .tegnforklaring {
    display: flex; flex-wrap: wrap; gap: .35rem 1.1rem; align-items: center;
    font-family: var(--mono); font-size: .69rem; letter-spacing: .04em;
    color: var(--ink-soft); margin: 0; padding: 0; list-style: none;
  }
  .tegnforklaring li { display: flex; align-items: center; gap: .38rem; }
  .tegnforklaring .mrk { margin-top: 0; }

  /* ── Oversikt ──────────────────────────────────────────── */
  .panel {
    background: var(--card); border: 1px solid var(--rule); border-radius: 4px;
    box-shadow: var(--skygge); padding: clamp(.9rem, 2vw, 1.4rem);
  }
  h2.seksjon, .mal h3 {
    font-family: var(--mono); font-size: .68rem; letter-spacing: .13em;
    text-transform: uppercase; color: var(--ink-soft); font-weight: 400; margin: 0;
  }
  .seksjon-topp {
    display: flex; flex-wrap: wrap; justify-content: space-between;
    align-items: baseline; gap: .5rem 1rem; margin-bottom: .7rem;
  }
  .tell { font-family: var(--mono); font-size: .72rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }

  .tabell-skall { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: .42rem .6rem; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  th {
    font-family: var(--mono); font-size: .64rem; letter-spacing: .1em;
    text-transform: uppercase; color: var(--ink-soft); font-weight: 400; white-space: nowrap;
  }
  td.navn { font-weight: 600; white-space: nowrap; }
  td.navn a { text-decoration: none; border-bottom: 1px solid var(--rule); }
  td.navn a:hover, td.navn a:focus-visible { border-bottom-color: currentColor; }
  td.tall { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  td.grunn { color: var(--ink-soft); }
  .chips { display: flex; flex-wrap: wrap; gap: .28rem; padding-top: .5rem; padding-bottom: .5rem; }
  .chip {
    font-family: var(--mono); font-size: .63rem; letter-spacing: .04em;
    padding: .16em .45em; border-radius: 2px; border: 1px solid currentColor; white-space: nowrap;
  }
  .status { font-family: var(--mono); font-size: .63rem; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
  .s-ferdig { color: var(--register); }
  .s-koe { color: var(--ink-soft); }
  tr.koe td.navn { font-weight: 400; color: var(--ink-soft); }

  /* ── Mal-kort: tre spalter ─────────────────────────────── */
  .mal {
    background: var(--card); border: 1px solid var(--rule); border-radius: 4px;
    box-shadow: var(--skygge); padding: clamp(.9rem, 2vw, 1.4rem);
    display: flex; flex-direction: column; gap: .85rem;
    scroll-margin-top: 1rem;
  }
  .mal-topp { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem .85rem; }
  .mal h2 { font-size: 1.35rem; margin: 0; font-weight: 600; letter-spacing: -.015em; }
  .mal-tall, .mal-kat {
    font-family: var(--mono); font-size: .68rem; color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
  .mal-kat { margin-left: auto; }
  code { font-family: var(--mono); font-size: .95em; }
  .mal-kat code, .felt {
    color: var(--ink-soft);
    background: color-mix(in srgb, var(--ink) 6%, transparent);
    border-radius: 2px; padding: .1em .35em;
  }
  .felt { font-size: .66rem; white-space: nowrap; }

  .lead { margin: 0; padding-left: .7rem; border-left: 3px solid var(--ink); }
  .lead.tom { border-left-color: var(--rule); color: var(--ink-soft); }
  .lead b {
    font-family: var(--mono); font-size: .64rem; letter-spacing: .1em;
    text-transform: uppercase; color: var(--ink-soft); margin-right: .35rem; font-weight: 400;
  }

  .kolonner {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, .85fr) minmax(0, 1.05fr);
    gap: clamp(1rem, 2.5vw, 2rem);
  }
  @media (max-width: 72rem) { .kolonner { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 46rem) { .kolonner { grid-template-columns: 1fr; } }
  .kol { display: flex; flex-direction: column; gap: .5rem; min-width: 0; }
  .kol > h3 { padding-bottom: .35rem; border-bottom: 1px solid var(--rule); }

  .q-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .42rem; }
  .q { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem .45rem; }
  .q-t { flex: 1 1 12rem; min-width: 0; }
  .q.valgfri .q-t { color: var(--ink-soft); }
  .hake { color: var(--register); font-family: var(--mono); font-size: .8rem; }
  .q.boardlag .q-t { color: var(--ink-soft); }
  .lagmerke {
    font-family: var(--mono); font-size: .6rem; letter-spacing: .07em;
    text-transform: uppercase; color: var(--eget);
    border: 1px solid currentColor; border-radius: 2px; padding: .1em .35em;
    white-space: nowrap;
  }
  .q-fot { margin: .15rem 0 0; font-size: .84rem; color: var(--ink-soft); }

  .aldri { list-style: none; margin: 0; padding: 0 0 0 .7rem; border-left: 3px solid var(--forbud); display: flex; flex-direction: column; gap: .42rem; }
  .aldri li { font-size: .93rem; color: var(--ink-soft); }

  .proeve { display: flex; flex-direction: column; gap: .18rem; }
  .pl { font-family: var(--mono); font-size: .62rem; letter-spacing: .09em; text-transform: uppercase; }
  /* Stedsnavnet gjør prøven etterprøvbar — den skal kunne slås opp. */
  .sted { color: var(--ink-soft); text-transform: none; letter-spacing: .02em; }
  .sted::before { content: "· "; }
  .p-god .pl { color: var(--register); }
  .p-daarlig .pl { color: var(--forbud); }
  .proeve p {
    margin: 0; padding: .5rem .65rem; border-radius: 3px;
    background: color-mix(in srgb, var(--ink) 4%, transparent); font-size: .95rem;
  }
  .p-god p { box-shadow: inset 3px 0 0 var(--register); }
  .p-daarlig p { box-shadow: inset 3px 0 0 var(--forbud); color: var(--ink-soft); }
  .hvorfor { margin: 0; font-size: .86rem; color: var(--ink-soft); }

  footer { color: var(--ink-soft); font-size: .82rem; border-top: 1px solid var(--rule); padding-top: .9rem; }
</style>

<div class="wrap">
  <header class="topp">
    <div>
      <p class="kicker">Placy · Lokalkunnskap</p>
      <h1>Malverket</h1>
    </div>
    <div>
      <p class="tese">
        En mal bestemmer hvilke <b>spørsmål</b> en stedtekst skal svare på — ikke hvordan setningene
        skal se ut. Da vi skrev 158 tekster på Ranheim oppsto det en felles setningsmal av seg selv:
        41 åpnet likt, 52 hadde samme rytme, og samlet så de maskinlagde ut. Én felles form på tvers
        av kategorier er skadelig. Én mal per kategori er det motsatte — svarer to kategorier på
        ulike spørsmål, får de ulik form uten at noen har bestemt formen.
      </p>
      <p class="tese">
        <b>Malen dikter aldri.</b> «Kjerne» betyr at faktumet skal stå <i>når vi har det</i> — aldri
        at det skal finnes på. Mangler kilden svaret, utelates punktet og teksten blir kortere.
      </p>
    </div>
  </header>

  <section class="panel">
    <div class="seksjon-topp">
      <h2 class="seksjon">Oversikt</h2>
      <ul class="tegnforklaring">
        <li><span class="mrk k-reg fylt"></span> Offentlig register</li>
        <li><span class="mrk k-eget fylt"></span> Våre egne data</li>
        <li><span class="mrk k-sok fylt"></span> Websøk</li>
        <li><span class="mrk k-reg fylt"></span> fylt = kjerne</li>
        <li><span class="mrk k-reg aapen"></span> åpen = valgfri</li>
      </ul>
      <span class="tell">${ferdigAntall} av ${totaltPlanlagt} maler · ${skrevetSteder} av ${dekket} steder dekket</span>
    </div>
    <div class="tabell-skall">
      <table>
        <thead>
          <tr><th>Kategori</th><th style="text-align:right">Steder</th><th>Status</th><th>Kjernespørsmål · hvorfor den står i kø</th></tr>
        </thead>
        <tbody>
          ${CATEGORY_SPECS.map(oversiktRad).join("\n          ")}
          ${PLANLAGTE_KATEGORIER.map(
            (p) => `<tr class="koe">
            <td class="navn">${esc(p.navn)}</td>
            <td class="tall">${p.antall}</td>
            <td><span class="status s-koe">I kø</span></td>
            <td class="grunn">${esc(p.hvorfor)}</td>
          </tr>`,
          ).join("\n          ")}
        </tbody>
      </table>
    </div>
  </section>

${CATEGORY_SPECS.map(malKort).join("\n")}

  <footer>
    Generert fra <code>lib/editorial/category-specs.ts</code>. Siden har ingen egen sannhet — endre
    malen i koden og kjør <code>scripts/render-category-specs.ts</code> på nytt.
  </footer>
</div>
`;

fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Skrevet: ${OUT}`);
console.log(`  ${ferdigAntall} maler, ${PLANLAGTE_KATEGORIER.length} i kø, ${dekket} steder`);
