# Stasjonskvartalet: 3D-modell fra bilder alene — hvor bra blir det, og hvor mye arbeid?

**Dato:** 2026-06-02
**Companion til:** `2026-06-02-stasjonskvartalet-3d-modell-i-google-3d-tiles.md` (det dokumentet konkluderte med at *plattformen* ikke er flaskehalsen — `Model3DElement` + eksisterende imperativt mønster løser integrasjonen. Dette dokumentet svarer på oppfølgeren: vi har **ingen GLB/BIM**, bare bilder — kan vi *generere* modellen selv, og hva koster det i kvalitet og arbeid?)
**Metode:** Fokusert multi-agent research-workflow (6 image-only-veier × uavhengig bevis). NB: verifiserings- og syntese-stegene ble avbrutt av en session-limit; funnene under er research-agentenes egne vurderinger med selvrapportert konfidens og uavhengige (ikke-vendor) kilder. Kjerne-påstandene om AI-svakhet ble verifisert i forrige workflow.

---

## Utgangspunktet er verste fall for ren AI

Vårt eneste input er **ett fugleperspektiv-render av et helt kvartal** (Gryta 12 A/B/C + Gryta 8 A + torg + sjøfront), med grafikk-overlegg. Det er det dårligst egnede inputet for AI image-to-3D, av tre strukturelle grunner:

1. **Fugleperspektiv = skjulte fasader.** AI ser taket godt, men må *hallusinere* alle fire sider og bakkeplan. Front-flater får ~80–95 % formnøyaktighet; okkluderte flater er rent gjett.
2. **Sammensatt scene, ikke ett objekt.** Verktøyene er trent på isolerte objekter (figurer, våpen, kjøretøy). Fire separate blokker + torg + havn tolkes som *ett* objekt og smelter til én klump.
3. **Grafikk-overlegg bakes inn.** Kart-pin, etiketter og fargede omriss blir del av teksturen og forvirrer geometri-rekonstruksjonen. (En ren render uten overlegg er et minstekrav for enhver bilde-basert vei.)

---

## Kvalitet + arbeid per vei

Kvalitet: 1 = ubrukelig blob, 5 = arkitekt-grad. Vurdert for **dette** caset (kvartal i fugleperspektiv, 150–250 m).

| Vei | Kvalitet | Arbeid (erfaren artist / utvikler-fra-null / freelance) | Kostnad | Dom |
|-----|:---:|---|---|---|
| **Manuell massing i Blender/SketchUp** (render som referanse + fasade-tekstur) | **3** | 4–8 t / **2–4 dager læring (urealistisk på en helg)** / $100–300 (Fiverr) eller 4 000–12 000 kr (norsk) | Blender gratis | ✅ **Anbefalt** |
| **Multi-view AI** (2–4 rene vinkler → Tripo/Hunyuan3D/Rodin) | 2 | 2–4 t / 1 dag / 2 000–5 000 kr | $5–30 i credits | ⚠️ Mulig hvis du får flere vinkler |
| **AI-assistert / hybrid** (AI grov-mesh → Blender-cleanup, el. Buildify prosedyre) | 2 | 6–12 t / 20–40+ t / $200–600 | $20–50 | ⚠️ Mulig, cleanup eskalerer uforutsigbart |
| **Single-image AI** (ett render rett inn i Meshy/Tripo/TRELLIS/Hunyuan) | 1 | 0 t gen + 8–20 t reparasjon / 40–80 t / – | $0–50 | ❌ Frarådet for dette inputet |
| **Fotogrammetri / Gaussian Splatting** (fra renders) | 1 | – / 1–3 dager uten resultat / – | gratis verktøy | ❌ Frarådet (umulig fra få renders) |

---

## Den brutale sannheten om AI for dette bildet

**Ren «last opp ett bilde, få en GLB» kommer til å skuffe.** Uavhengig produksjonstest (SimInsights 2025) på Rodin/Meshy/Tripo for *hus*: «poor geometry and unclear transitions» (Rodin), «warped textures» (Meshy), «large gaps» (Tripo) — og bare **~1 av 10** genereringer var klientklar uten manuelt etterarbeid, for *enkle, isolerte* objekter. Et kvartal med fire blokker er mange ganger vanskeligere. Selv Tripos egen dokumentasjon innrømmer at single-image «must hallucinate the unseen geometry». Forventet resultat: en sammensmeltet, organisk klump som ligner bygget *vagt* fra den ene vinkelen og bryter sammen når du roterer — som er nettopp det du gjør i et 3D-kart.

**Multi-view løfter det noe**, men bare hvis du skaffer 2–4 *konsistente* vinkler (lik belysning/avstand) — og marketing-renders er typisk inkonsistente, et dokumentert problem Tripo selv advarer mot. Selv da blir det grov volum-masse, ikke et gjenkjennelig Gryta 12.

**Fotogrammetri/splatting er utelukket:** krever 30+ overlappende bilder i 360° orbital bane med ekte parallakse. Syntetiske renders er *verre* enn ekte foto for feature-matching, og Google ToS forbyr derivative Gaussian-splats fra 3D Tiles.

---

## Anbefalt vei (gitt at vi bare har bilder)

**Manuell massing-modellering** er den realistiske «fra bilder»-veien som faktisk funker — bygge enkle blokk-volumer med renderen som referanse + fasade-tekstur/farge fra renderen. Fra fugleperspektiv ser det ut som et **gjenkjennelig kvartal med riktig volum og fasadetone** — proff massing-modell, ikke blob. Det vil *ikke* se fotorealistisk integrert ut (flat tekstur, ingen glass-reflekser, mangler omgivelses-detaljer) — det leser som et 3D-overlay. **For en salgs-pitch i fugleperspektiv er det fullt akseptabelt.**

Men vær ærlig om hvem som gjør det:
- **Du selv fra null i Blender: ikke en helg.** UV-unwrapping og tekstur-projeksjon har reell lærekurve (2–4 dager til et brukbart, ikke bra, resultat — med risiko for amatørmessig output).
- **Freelance er den rasjonelle ROI-en:** $100–300 på Fiverr/Upwork (median $25/t for arkitektur-modellører), 2–5 dagers leveringstid, mot 20–40 t egeninnsats med usikkert resultat. Brief: *«simple massing model of a residential block of 4 buildings from provided bird's-eye render, clean volumes, basic facade texture, exported as GLB, no interior detail.»* Be om eksempler på tidligere massing-arbeid (ikke bare renders).
- **Mellomting hvis du vil lære:** Blender-pluginen **Buildify** genererer rene LoD2-volumer prosedyrelt fra en footprint-skisse — bypasser AI-støyen helt, mer forutsigbart enn AI-cleanup.

### Den smarte snarveien som sidesteg hele problemet

`vei D` fra forrige dokument — **cinematisk `flyCameraTo` inn mot tomta + CSS-crossfade til markedsrenderen** — krever **null 3D-modell** og bruker nøyaktig den asset-en du allerede har. Gitt at image-only → god 3D-modell enten er svakt (AI) eller krever freelance/læring (manuell), er crossfade-til-render en seriøs kandidat for demoen, ikke bare en fallback. Vurder den parallelt før du bruker penger/tid på en GLB.

---

## Hva en ren render + flere vinkler endrer

Lavthengende frukt for å løfte enhver bilde-basert vei:
- **Be utbygger/arkitekt om ren render uten grafikk-overlegg** (minstekrav).
- **Be om 2–3 vinkler til** (front fra sjøsiden + profil per blokk). Dobler nytten for både manuell modellering (lese takprofil/fasade korrekt) og multi-view AI.
- **Be om etasjeantall / gesimshøyder** — sparer gjettearbeid på vertikal skala.

---

## Tekniske gotchas (gjelder uansett vei)

- **Ellipsoid vs. geoid: ~40–45 m differanse i Norge.** Google 3D bruker ellipsoid-høyde; uten korreksjon synker modellen i bakken eller flyter i lufta. Kjent, løsbart (cs2cs / manuelt oppslag), men må planlegges. *Dette er en konkret tilleggsnote til spike-planen i hoveddokumentet.* (Kilde brukte Cesium — verifiser at samme logikk gjelder `maps3d.Model3DElement` før høyde-regning.)
- **Skala-kalibrering er manuell** — Blender-enheter matcher ikke Googles koordinatsystem automatisk; kalibrer mot kjent bygningshøyde × etasjer.
- **Multi-blokk-separasjon** — AI-verktøy slår de fire blokkene sammen; manuell modellering holder dem adskilt.

---

## Konkret førsteforsøk (billigst mulig, denne uka)

1. **Test AI gratis (~30 min):** skaff en ren render, last opp i Meshy/Tripo gratis-tier. Se klumpen med egne øyne → da *vet* du i stedet for å gjette. Forventning: bekrefter at det ikke holder.
2. **Parallelt — vurder crossfade (vei D):** ~4 t kode, null modell. Kan være det smarteste demo-trekket.
3. **Hvis du vil ha bygget i kartet:** legg ut et lite freelance-oppdrag ($100–300) med ren render + vinkler + etasjeantall, ELLER sett av 2–4 dager til Blender/Buildify selv.

---

## Kilder (utvalg, uavhengige)

- https://www.siminsights.com/ai-3d-generators-2025-production-readiness/ — produksjonstest Rodin/Meshy/Tripo på hus; ~1/10 klientklar
- https://ravelin3d.com/blog/ai-in-architectural-visualization-revolution-or-hype-2025-2026-reality-check.html — archviz-spesialist avviser ren AI-output
- https://arxiv.org/abs/2503.18527 — AIM2PC: aerial-to-3D er åpent forskningsproblem (okklusjon/topologi-tap)
- https://bertt.wordpress.com/2023/07/11/adding-objects-to-google-photorealistic-3d-tiles/ — uavhengig: GLB i Google 3D Tiles + ellipsoid-gotcha
- https://spatialized.io/insights/google-maps/data-layers-and-overlays/immersive-3d-maps — Model3DElement GLB-krav, manuell skala-kalibrering
- https://www.cgchannel.com/2022/07/download-free-blender-3d-building-generator-buildify/ — Buildify prosedyre-massing
- https://blog.afi.io/blog/add-a-3d-polygon-to-a-google-photorealistic-3d-map — bransjen anbefaler low-poly modell fra arkitekt/byplan, ikke AI
- https://www.upwork.com/hire/architectural-modelers/ · https://www.fiverr.com/jwright_media/create-high-quality-architectural-massing-models-and-visualisations — freelance massing-priser
