# Gjenoppbygging av Lillebytunet-datagrunnlaget

Skrevet 2026-09-09, samme dag som `~/klienter/placy/lillebytunet` ble slettet ved et uhell.
Dette er planen for å få kjeden kjørbar igjen, og en ærlig grense for hva som **ikke** kan
gjenskapes.

Ingen leveranse er tapt. Begge modellene ligger i git og fungerer i demoen. Det som er
tapt, er inputene som produserte dem.

## Hva som skjedde

En `for`-løkke med `set -- $pair` satte ikke de posisjonelle variablene som antatt, så
`rm -rf "$D/$2"` ble `rm -rf "$D/"` og fjernet hele datamappa. Den etterfølgende
hash-sammenligningen meldte «IDENTISK» for alle seks GLB-er, fordi `shasum` feilet på
begge sider og to tomme strenger er like. To feil på rad: en destruktiv kommando og en
kontroll som skjulte den.

Læringen ligger i
[destruktive kommandoer krever eksplisitte stier](../../solutions/workflow-issues/destruktiv-sletting-krever-eksplisitte-stier.md).

## Hva som er trygt, og hva som er tapt

| Innhold | Status |
|---|---|
| `public/models/lillebytunet/husB-v2.glb` (`96137b94…`), `husB.glb` (`753c512e…`), `husC-v1.glb` (`109fab8f…`) | I git. Demoen virker. |
| Alle skript og konfigurasjoner i `scripts/lillebytunet/` | I git. |
| Begge byggs `registration.json`, `parameters.json`, `massing.json`, `frame-fit.json` (C), `georef-C.json`, `surface-sources.json`, `glb-validation.json` | I git under `docs/research/lillebytunet-3d/`. |
| Alle kontrollbilder, Google-opptak og `capture.json` | I git. |
| `renders/` — 576 kildebilder | **Tapt.** Kan lastes ned på nytt. |
| `api/` — 8 API-svar + OSM-uttrekk | **Tapt.** Kan hentes på nytt. |
| `colmap-b/`, `colmap-c/`, `colmap-ov/` — rekonstruksjoner og `.npy` | **Tapt.** Kan beregnes på nytt, men ikke identisk. |
| `quality-v2/final/`, `hus-c-v1/final/` — teksturer og `.blend` | **Tapt.** Teksturer kan bygges på nytt; `.blend` kan lages på nytt fra GLB. |
| `manifest.json`, `variant-probe.json`, kontaktark | **Tapt.** Lages på nytt av innhentingsskriptet. |

## Hvorfor byte-identisk gjenoppbygging ikke er målet

COLMAPs inkrementelle løser er ikke deterministisk mellom kjøringer, og den fikserer
koordinatsystemets målestokk og orientering vilkårlig. En ny løsning vil derfor skille seg
fra den gamle med en **global likhetstransform**.

Det er mindre ille enn det høres. Alle mål nedstrøms er uttrykt i byggets eget lokale
rammeverk, og rammeverket er utledet av kameraposisjonene i samme løsning
(`frame_fit.py:23-43`). En global rotasjon og translasjon forsvinner derfor av seg selv.
Det som **ikke** forsvinner, er skalaen: hvis den nye løsningen er `s` ganger den gamle,
blir alle lokale koordinater `s` ganger større.

`s` er målbar, fordi banen er registrert:

| Anker | Hus B | Hus C |
|---|---:|---:|
| Orbit-radius, enheter | 3,762 | 3,744041 |
| Pitch nedover, grader | 19,87 | 19,886515 |
| Vinkelsteg, grader | 3,75 | 3,751132 |
| Fotavtrykk, enheter | 1,296 × 2,237 | 1,25554 × 1,89099 |
| `scale_m_per_unit` i konfigurasjonen | 12,4 | 12,766 |

`s = ny orbit-radius / radius i tabellen`. Deretter gjelder: nye lokale koordinater er de
gamle ganger `s`, og `scale_m_per_unit` skal deles på `s` for at modellen skal havne på
samme meter. Pitch og vinkelsteg er skalafrie og skal komme ut uendret — de er
kontrollen på at det virkelig bare er en likhetstransform.

**Akseptansetesten er ikke hashen, det er geometrien.** Den leverte GLB-en ligger i git og
er i meter. En gjenoppbygd modell er god nok når dens punkter faller sammen med den
leverte GLB-ens punkter innenfor toleranse — det er en direkte, målbar sammenligning som
ikke krever at inputene var identiske.

## Kjøreoppskrift

```bash
MODEL_REPO=/Users/andreasharstad/Documents/placy-lillebytunet
MODEL_DATA=/Users/andreasharstad/klienter/placy/lillebytunet
MODEL_SCRIPTS="$MODEL_REPO/scripts/lillebytunet/model"
MODEL_PY="$MODEL_DATA/.venv/bin/python"

# 0. Miljø
mkdir -p "$MODEL_DATA" && cd "$MODEL_DATA"
python3 -m venv .venv
.venv/bin/pip install -r "$MODEL_SCRIPTS/requirements.txt"

# 1. Kildebilder og API-svar. Skriptet er idempotent og henter tokenet selv.
node "$MODEL_REPO/scripts/lillebytunet/fetch-scenes.mjs"
"$MODEL_REPO/scripts/lillebytunet/make-contact-sheets.sh"
#    Kontroll: 6 serier x 96 = 576 filer, alle 1920x1080, alle sha256 unike.
#    Avvik i antall eller oppløsning betyr at boligvelgeren er endret siden 8. september.

# 2. OSM-uttrekk. Stedfestingen trenger nabokvartalenes fotavtrykk.
#    Ståltaugen 1 = way 1206556797, Ståltaugen 2 = way 1206556798.
#    Lagres som api/osm_buildings.json i Overpass' egen «geometry»-form.

# 3. COLMAP per serie. ~2 min hver uten GPU. Gjenta for bygg-b, bygg-c og oversikt.
for S in b c ov; do
  case $S in b) SER=bygg-b;; c) SER=bygg-c;; ov) SER=oversikt;; esac
  mkdir -p "colmap-$S" && ln -sfn "../renders/$SER" "colmap-$S/images" && cd "colmap-$S"
  colmap feature_extractor --database_path db.db --image_path images \
    --ImageReader.camera_model PINHOLE --ImageReader.single_camera 1 --FeatureExtraction.use_gpu 0
  colmap sequential_matcher --database_path db.db --FeatureMatching.use_gpu 0 --SequentialMatching.overlap 12
  mkdir -p sparse && colmap mapper --database_path db.db --image_path images --output_path sparse
  colmap model_converter --input_path sparse/0 --output_path sparse/0 --output_type TXT
  cd ..
done
#    Kontroll: 96 av 96 bilder registrert per serie. Færre = kjør på nytt før du går videre.

# 4. Rammeverk og fotavtrykk. Les orbit-radiusen ut av rapporten og regn ut s.
"$MODEL_PY" "$MODEL_SCRIPTS/frame_fit.py" --data "$MODEL_DATA" --colmap colmap-c \
  --scenes bygg-c --report "$MODEL_DATA/rebuild/frame-fit-c.json" --write
"$MODEL_PY" "$MODEL_SCRIPTS/frame_fit.py" --data "$MODEL_DATA" --colmap colmap-b \
  --scenes bygg-b --report "$MODEL_DATA/rebuild/frame-fit-b.json" --write
#    s_C = orbit_radius_units / 3.744041   og   s_B = orbit_radius_units / 3.762
#    Kontroll: pitch ~19,89 og vinkelsteg ~3,751 skal komme ut uendret.

# 5. Oversiktens punktsky og byggklynger. georef1.py er en prototype som leser
#    fra arbeidsmappa, så den må kjøres derfra. Den lager pts.npy, bpts.npy og frame.npy.
cd "$MODEL_DATA/colmap-ov" && "$MODEL_PY" "$MODEL_SCRIPTS/georef1.py" && cd "$MODEL_DATA"

# 6. Registrering. Forskyvningen er per serie: Hus B −10, Hus C +2.
"$MODEL_PY" "$MODEL_SCRIPTS/register_sources.py" --data "$MODEL_DATA" --colmap colmap-c \
  --pairs 0:2,12:14,24:26,36:38,48:50,60:62,72:74,84:86 \
  --output "$MODEL_DATA/rebuild/registration-c.json"
"$MODEL_PY" "$MODEL_SCRIPTS/register_sources.py" --data "$MODEL_DATA" \
  --output "$MODEL_DATA/rebuild/registration-b.json"
#    Kontroll: medianrest ~0,10 m. Ny scale x 35,114 / s skal gi ~12,77 (C) og ~12,72 (B).

# 7. Skalér konfigurasjonene. Alle lokale koordinater ganges med s, og
#    scale_m_per_unit deles på s. Dette er et rent regnestykke over JSON-en,
#    ikke en ny tolkning av bildene.

# 8. Bygg og sammenlign mot det som ligger i git.
"$MODEL_PY" "$MODEL_SCRIPTS/build_quality.py" --data "$MODEL_DATA" \
  --registration "$MODEL_DATA/rebuild/registration-c.json" \
  --config "$MODEL_SCRIPTS/hus_c_quality.json" --output "$MODEL_DATA/rebuild/husC"
"$MODEL_PY" "$MODEL_SCRIPTS/check_glb.py" "$MODEL_DATA/rebuild/husC/husC-hybrid.glb" \
  --height 22,28 --width 12,20 --depth 20,30
#    Akseptanse: bounds mot docs/research/lillebytunet-3d/hus-c/glb-validation.json
#    (16,08 x 24,89 x 25,75 m, 11 550 trekanter), og punktvis sammenligning mot
#    public/models/lillebytunet/husC-v1.glb. Tilsvarende for Hus B mot
#    quality-v2/glb-validation.json (20 352 trekanter, høyde 19,31 m).

# 9. Redigerbar kilde på nytt fra GLB-en som ligger i git — den trenger ingen input.
/Applications/Blender.app/Contents/MacOS/Blender -b --python "$MODEL_SCRIPTS/blender_quality.py" -- \
  --input "$MODEL_REPO/public/models/lillebytunet/husC-v1.glb" \
  --output-dir "$MODEL_DATA/rebuild/husC" --name husC-v1 --radius 62 --camera-height 44 --aim-height 13
```

## Rekkefølge og hva som kan gjøres uavhengig

Steg 9 kan gjøres nå: `.blend`-filene bygges fra GLB-ene som ligger i git og trenger
ingenting av det som ble slettet. Steg 1–2 er nettverksarbeid uten avhengigheter.
Steg 3 avhenger av 1, og alt fra 4 og opp avhenger av 3.

Ingenting av dette er nødvendig for å **vise** modellene. Demoen leser GLB-ene fra
`public/`, og begge svarte 200 etter slettingen.

## Grenser

- **Kildebildene er ikke garantert de samme.** API-øyeblikksbildet var fra 8. september,
  og enhetspolygonene følger salgsstatus. Endrer polygonene seg, endrer punktutvalget seg,
  og med det fotavtrykket. Kontrollen i steg 1 fanger antall og oppløsning, ikke innhold.
- **`.blend`-filene fra runden er tapt.** De som bygges på nytt i steg 9 er geometrisk
  identiske med de leverte GLB-ene, men er ikke de samme filene.
- **Hus Bs teksturer i `quality-v2/final/`** var de eneste kopiene utenfor GLB-en.
  De ligger fortsatt inne i `husB-v2.glb` som JPEG-buffere og kan trekkes ut derfra hvis
  noen trenger dem som filer.
- **Den byte-identiske reproduksjonen som ble dokumentert 9. september kan ikke
  demonstreres på nytt.** Beviset står i `reproduction.json`, men det kan ikke etterprøves
  uten de opprinnelige inputene. Det skal sies rett ut hvis noen spør.

## Relatert

- [Arbeidsmåte for neste bygg og agent](../../solutions/workflow-issues/render-til-byggmodell-krever-visuelle-akseptansekriterier.md)
- [Hus C: pilot, kjøreoppskrift og restavvik](05-hus-c.md)
- [Hus B: kvalitetsrunde](04-kvalitetsrunde.md)
- [Datagrunnlaget: API-struktur, 576 bilder, negative funn](01-datainnhenting.md)
