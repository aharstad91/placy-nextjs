#!/usr/bin/env python3
"""Bygger docs/research/leangenbukta-nettside/external-links.json fra crawl-raw.json."""
import json
import collections
from urllib.parse import urlsplit

ROOT = "/Users/andreasharstad/Documents/placy-lb-kundedemo"
RESEARCH = f"{ROOT}/docs/research/leangenbukta-nettside"

DOMAIN_LABELS = {
    "leangenbukta.plyo.cloud": ("Boligvelger (Plyo)", "Interaktiv boligvelger — behold som ekstern lenke/iframe til originalen, ikke kopiér funksjonaliteten."),
    "app.locka.cloud": ("Kundeportal — Byggetrinn 1 (Locka)", "Innloggingsportal for kjøpere, ekstern lenke."),
    "app.libitum.cloud": ("Kundeportal — Byggetrinn 1 (Libitum, ny)", "Locka er trolig rebrandet/migrert til Libitum — begge domenene forekommer i markup, samme funksjon."),
    "haakonviigt14.locka.cloud": ("Kundeportal — Byggetrinn 2 (Locka)", "Innloggingsportal for kjøpere, ekstern lenke."),
    "haakonviigt14.libitum.cloud": ("Kundeportal — Byggetrinn 2 (Libitum, ny)", "Se Locka/Libitum-merknad over."),
    "client.journeyapp.tech": ("Kundeportal — Saltakshus H/Knutepunktet (Journey)", "Innloggingsportal for kjøpere, ekstern lenke."),
    "koteng.no": ("Koteng (utbygger, konsern)", "Om utbygger / varsling av kritikkverdige forhold — ekstern lenke."),
    "www.koteng.no": ("Koteng (utbygger, gammelt domene)", "Eldre www.koteng.no-lenker forekommer også — samme selskap."),
    "kotengjenssen.no": ("Koteng Jenssen (utbygger)", "Utbyggers selskapsside — ekstern lenke i footer."),
    "obos.no": ("OBOS (medutbygger/forkjøpsrett)", "OBOS-medlemskap og forkjøpsrett — ekstern lenke."),
    "www.obos.no": ("OBOS (alternativt domene)", "Samme som obos.no."),
    "nye.obos.no": ("OBOS ny bolig-portal", "Digital kjøpsbekreftelse for Saltakshus J-kjøpere — ekstern lenke."),
    "maps.app.goo.gl": ("Google Maps (delt lenke)", "Kortlenke til stedets Google Maps-oppføring."),
    "www.google.com": ("Google Maps (full lenke)", "Kart-lenker i footer/kontaktseksjon."),
    "www.dropbox.com": ("Dropbox (delt mappe)", "Delt mappe, trolig bildemateriell for presse/megler."),
    "www.trondheim.no": ("Trondheim kommune", "Referanse til Ladestien i redaksjonell tekst."),
    "www.webtoffee.com": ("WebToffee (plugin-leverandør)", "Lenke til GDPR/cookie-consent-plugin-produktside, ikke kundeinnhold."),
    "youtu.be": ("YouTube", "Innebygd/lenket video."),
    "plyo.com": ("Plyo (leverandørens hovedside)", "Plyo sin egen markedsføringsside, ikke prosjektspesifikk."),
    "(mailto/tel)": ("Mailto/tel-lenker", "E-post og telefonlenker til kontaktpersoner hos utbygger/megler."),
}


def main():
    raw = json.load(open(f"{RESEARCH}/crawl-raw.json", encoding="utf-8"))
    dom_map = collections.defaultdict(lambda: {"urls": set(), "linkedFrom": set()})
    for e in raw["entries"]:
        for ob in e.get("outboundLinks", []):
            if ob.startswith("mailto:") or ob.startswith("tel:"):
                host = "(mailto/tel)"
            else:
                host = urlsplit(ob).netloc.lower()
            dom_map[host]["urls"].add(ob)
            dom_map[host]["linkedFrom"].add(e["sourceUrl"])

    out = []
    for host in sorted(dom_map):
        label, note = DOMAIN_LABELS.get(host, (host, "Ikke spesifikt kategorisert — vurder manuelt."))
        out.append({
            "domain": host,
            "label": label,
            "note": note,
            "recommendedDisposition": "external — behold som ekstern lenke til originalen",
            "urlCount": len(dom_map[host]["urls"]),
            "urls": sorted(dom_map[host]["urls"]),
            "linkedFromPageCount": len(dom_map[host]["linkedFrom"]),
            "linkedFrom": sorted(dom_map[host]["linkedFrom"]),
        })

    with open(f"{RESEARCH}/external-links.json", "w", encoding="utf-8") as f:
        json.dump({"checkedAt": "2026-09-23", "domains": out}, f, ensure_ascii=False, indent=2)
    print(f"external-links.json skrevet: {len(out)} eksterne domener")


if __name__ == "__main__":
    main()
