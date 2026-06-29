# Rebuild — Decisions Queue

Beads som krever et EKTE produkt-/scope-/sekvenserings-valg (ikke en teknisk
avstemming utledbar fra PRD/kode) eller en xhigh-prod-kjøring. Den autonome
build-loopen køer dem her i stedet for å gjette, og velger en annen byggbar bead.

Format: `## <bead-id> — <kort tittel>` + kontekst + det åpne spørsmålet +
hvorfor loopen ikke kan avgjøre det selv.

---

## placy-ralph-r06.8 — Verifikasjon (nystartet Chrome) av 3D-motor: sekvensering + miljø

**Kategori:** sekvenserings-valg + miljø-/human-observasjons-blocker (ikke ren mekanikk).

**Kontekst.** r06.1–r06.7 er lukket (motor-porten verifisert mot AC + tester grønne).
r06.8 er Fase-3-verifikasjonen: «Bevis at motoren FUNGERER, ikke bare kompilerer» —
åpne et `has3dAddon`-board i nystartet Chrome, kjør ≥10 sykluser 3D↔2D-toggle +
kategori-nav + intro→outro, og bekreft via DevTools: ingen «Too many active WebGL
contexts», ingen `gmp-map-3d`-unmount, `?film=1` gir pin-løst kart, reveal-kaskade
uten WebGL-churn (full opacity, scale-bounce). PRD 06 §"Fase 3" / §"Utviklingsløp"
markerer autonomi-nivå **Middels**: «Krever live board-flate (`has3dAddon`) + Chrome
DevTools-observasjon — ikke ren mekanikk».

**Det åpne spørsmålet (2 koblede valg):**
1. **Sekvensering / chicken-and-egg.** r06.8 verifiserer mot «et `has3dAddon`-board».
   Men v2-board-skallet (PRD 9, r09.1/r09.3) som MONTERER motoren er i bead-grafen
   *blokkert av* r06.8 — det finnes altså ingen v2-board-rute å åpne ennå. Skal
   r06.8 i stedet verifiseres mot **eksisterende prod-board** (motoren er verbatim-port
   ⇒ behaviorelt identisk), eller skal r06.8 **flyttes til ETTER** at PRD 9 har montert
   et v2-board? Dette endrer dep-grafen og er et sekvenserings-valg, ikke en kode-avstemming.
2. **Human-observasjon.** AC krever visuell dom («markører full opacity», «bounce er
   scale-animasjon», WebGL-context-telling over 10+ sykluser) + et live Google Maps 3D-miljø
   (API-nøkkel + nett). Memory `project_3d_default_map_engine` rammer «nystartet Chrome»
   som et human-in-the-loop-ritual. Headless-loopen kan ikke avgi denne dommen pålitelig
   uten risiko for falsk-lukking av en P1-verifikasjons-bead.

**Hvorfor loopen ikke avgjør selv.** Begge ledd krever input loopen ikke har: (1) en
graf-/sekvenserings-beslutning som Andreas eier, og (2) en human-attendert fresh-Chrome-
sesjon mot et kjørende board. Bygges derfor IKKE autonomt; venter på avklaring/sesjon.

**Anbefaling (til avgjørelse).** Behold r06.8 som ekte port-with-verify, men kjør den i
en human-attendert sesjon mot eksisterende prod-board (verbatim-port ⇒ samme motor-atferd),
og fjern den kunstige r06.8→r09-blokkeringen slik at PRD 9-skallet kan porteres parallelt.
Ikke ratifisert — Andreas avgjør.
