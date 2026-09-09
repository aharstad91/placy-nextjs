---
title: "Destruktiv sletting krever eksplisitte stier — og en kontroll som ikke kan bestå på tomme strenger"
date: 2026-09-09
category: workflow-issues
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - "En kommando sletter, overskriver eller flytter, og stien er satt sammen av variabler."
  - "Et skript sammenligner hasher, filstørrelser eller antall for å bekrefte at noe stemmer."
  - "Arbeidsdata ligger utenfor git og har ingen backup."
tags: [destructive-commands, shell, verification, data-loss, backup, workflow]
---

# Destruktiv sletting krever eksplisitte stier

## Hva som skjedde

Under en opprydding etter Hus C-runden ble hele `~/klienter/placy/lillebytunet` slettet —
576 kildebilder, tre COLMAP-rekonstruksjoner, alle `.npy`-rammeverk og begge byggs
redigerbare modellkilder, omtrent 1 GB. Kommandoen var ment å fjerne to undermapper:

```bash
for pair in "hus_b_quality.json quality-v2/regress-final quality-v2/final husB" \
            "hus_c_quality.json hus-c-v1/build-final hus-c-v1/build5 husC"; do
  set -- $pair
  rm -rf "$D/$2"          # ment: .../quality-v2/regress-final
  ...
done
```

`set -- $pair` satte ikke de posisjonelle variablene slik det var antatt i dette skallet.
`$2` var tom, så uttrykket ble `rm -rf "$D/"` — rotmappa.

**Og kontrollen bestod.** Samme løkke sammenlignet hasher slik:

```bash
A=$(shasum -a 256 "$D/$3/$f" | cut -d' ' -f1)
B=$(shasum -a 256 "$D/$2/$f" | cut -d' ' -f1)
[ "$A" = "$B" ] && echo "IDENTISK $f"
```

Da filene var borte, feilet `shasum` på begge sider, `A` og `B` ble tomme strenger, og
`[ "" = "" ]` er sant. Alle seks GLB-er ble meldt «IDENTISK» i samme sekund som
grunnlaget for dem forsvant. Feilen ble oppdaget først da neste kommando ikke fant
`.venv/bin/python`.

## Reglene som følger

**Skriv stien ut i en destruktiv kommando.** `rm -rf ~/klienter/placy/lillebytunet/quality-v2/regress-final`
er lengre å skrive og umulig å misforstå. Er stien satt sammen av variabler, må hvert ledd
være verifisert ikke-tomt før kommandoen kjører:

```bash
target="$D/$sub"
[ -n "$sub" ] && [ -d "$target" ] || { echo "avbryter: sub='$sub'"; exit 1; }
rm -rf "$target"
```

**Ikke bruk `set --` for å pakke ut felt i en løkke.** Bruk navngitte variabler, ett
felt per linje, eller `IFS`-lesing:

```bash
while IFS='|' read -r config out reference name; do ...; done <<'EOF'
hus_b_quality.json|quality-v2/regress-final|quality-v2/final|husB
EOF
```

**En kontroll som kan bestå på tom input er ikke en kontroll.** Sammenlign aldri to
kommandosubstitusjoner uten å kreve at de faktisk inneholder noe:

```bash
[ -n "$A" ] && [ "$A" = "$B" ] || { echo "AVVIK eller manglende fil"; exit 1; }
```

Det samme gjelder alt som teller: null rader, null filer og null treff skal aldri kunne
leses som «alt stemmer». Samme klasse feil dukket opp i takutsnittet i
[Hus C-runden](../../research/lillebytunet-3d/05-hus-c.md), der et mål som belønnet
jevnhet valgte nettopp prøven som hadde truffet noe annet: **et mål som ikke kan feile,
måler ikke.**

## Hvorfor tapet ble håndterbart, og hva som ikke var på plass

Det som lå i git overlevde: begge leverte modeller, alle skript, alle konfigurasjoner og
hele bevismappa med målinger, registreringer og kontrollbilder. Demoen virket uendret
etterpå, fordi den leser GLB-ene fra `public/`.

Det som lå **utenfor** git var borte, og det fantes ingen kopi. Time Machine-destinasjonen
var ikke montert. `~/klienter/placy/backup/` og `backups/` inneholdt bare enkeltfiler fra
andre spor.

To ting å gjøre annerledes:

1. **Arbeidsdata utenfor git trenger et uttalt gjenoppbyggingsspor.** Det som ikke kan
   committes — 1 GB bilder, COLMAP-databaser — må ha en dokumentert vei tilbake *før*
   noen jobber i mappa. For Lillebytunet finnes den nå:
   [gjenoppbyggingsplanen](../../research/lillebytunet-3d/06-gjenoppbygging.md).
2. **Legg de avledede ankrene i git, ikke bare resultatet.** Gjenoppbyggingen er mulig
   fordi orbit-radius, pitch, vinkelsteg og fotavtrykk ble skrevet til JSON i repoet.
   En ny COLMAP-løsning skiller seg fra den gamle med en global likhetstransform, og de
   tallene er nok til å måle skalaforskjellen og skalere konfigurasjonen tilbake. Uten
   dem hadde modellene måttet tolkes på nytt fra bildene.

## Relatert

- [Gjenoppbygging av Lillebytunet-datagrunnlaget](../../research/lillebytunet-3d/06-gjenoppbygging.md).
- [Arbeidsmåte fra render til byggmodell](render-til-byggmodell-krever-visuelle-akseptansekriterier.md).
- [Parallelle sesjoner krever worktrees](parallel-sessions-require-worktrees-20260208.md).
