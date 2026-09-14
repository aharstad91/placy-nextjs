# Servering: liten innholdsprøve i aktiv demo

14. september 2026. Andreas valgte en liten prøve etter å ha vurdert den større innholdspakken som mulig overarbeid før Lene-demoen. Den store pakken er fortsatt et forslag; bare denne prøven er lagt inn.

Fire korte bakgrunnsnotater for Dora Kaffebar, Snurr, Nyhavna BistroBar og Ladejarlen er lagt til i hovedarbeidskopiens `data/demo/nyhavna-lokal/topics.json`. To spesifikke kilder er lagt til i `sources.json`. Eksakt tillegg er bevart i [prøvedataene](2026-09-14-servering-liten-prove.json). Hovedarbeidskopiens eksisterende oppføringer er bevart. Kartsteder, FAQ, manus og kode er ikke endret av denne prøven.

Notatene bygger på kildekontrollen i [innholdspakken](2026-09-14-servering-innholdspakke.md). Alle 4 av 4 notater er kontrollert, validert og funnet som første treff ved søk med sted og relevant oppfølging. Aktivt datasett: 13 → 17 notater og 61 → 63 kilder. Alle 34 eksisterende tester i `dataset.test.ts` og `voice.test.ts` passerte; demosiden svarte HTTP 200. Ingen faktisk talesamtale er gjennomført i denne økten.

Last `http://localhost:3103/demo/nyhavna-lokal` på nytt og start en ny samtale. Prøv «Hvor kan vi spise med venner?», «Hva slags mat har BistroBar?» og «Bruker de lokale leverandører?». Prøv deretter spørsmål om Snurrs veganske alternativ, om Dora er for besøkende og om Ladejarlens barnepizza. Samtalen må vise om mengde og tone passer demoen.

## Fjerne prøven

Fjern bare disse fire ID-ene fra aktiv `topics.json`:

- `servering-prove-dora`
- `servering-prove-snurr`
- `servering-prove-bistro`
- `servering-prove-ladejarlen`

Fjern deretter `s-servering-prove-nyhavna` og `s-servering-prove-bistro-meny` fra `sources.json` hvis ingen øvrige oppføringer bruker dem. Last siden på nytt og start en ny samtale. Ikke tilbakestill hele filene; de inneholder også den tekniske øktens arbeid.

Tillegget og dette revisjonssporet lagres i innholdsarbeidskopien. De aktive JSON-filene i hovedarbeidskopien forblir ukommittert sammen med den andre øktens endringer. Ingen push.
