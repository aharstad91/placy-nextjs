#!/usr/bin/env python3
"""
Bygger docs/research/leangenbukta-nettside/manifest.json,
external-links.json og inventory.md fra crawl-raw.json + head-probe.json.

Klassifiseringen er delvis regelbasert (wpType fra body-class, canonical-
sammenligning for duplikater) og delvis en eksplisitt oversikt (OVERRIDES)
for byggsider, prosjektsider og kjente site-bugs, satt opp etter manuell
gjennomgang av alle 295 oppdagede URL-er 23.09.2026.

To kjente bugs på kildesiden samles til ÉN manifest-oppføring hver, i stedet
for én pr. forekomst:
  - «personvern»-lenken i cookie-banneret mangler ledende skråstrek
    (href="personvern" i stedet for href="/personvern/"), og løses derfor
    relativt til hver side. WordPress serverer da innholdet fra den ekte
    /personvern/-siden ett nivå ned (mange 200-duplikater), og 404 to nivåer
    ned (når banneret vises på selve duplikat-siden og lenken løses videre).
  - Kontakt-e-posten i footeren mangler «mailto:»-prefiks på post-sider
    (href="jan.erik.fjeldseth@obos.no"), og løses relativt -> 404.
"""
import json
import os
import re
from urllib.parse import urlsplit

ROOT = "/Users/andreasharstad/Documents/placy-lb-kundedemo"
RESEARCH = f"{ROOT}/docs/research/leangenbukta-nettside"


def load():
    raw = json.load(open(f"{RESEARCH}/crawl-raw.json", encoding="utf-8"))
    head = json.load(open(f"{RESEARCH}/head-probe.json", encoding="utf-8"))
    return raw, head


def url_id(url):
    path = urlsplit(url).path.strip("/")
    return path.replace("/", "__") or "forside"


# ---------------------------------------------------------------------------
# Eksplisitt klassifisering av kjente sider (etter manuell gjennomgang)
# key = id (se url_id)
# ---------------------------------------------------------------------------
OVERRIDES = {
    "forside": dict(kind="home", disposition="local", proposedLocalPath="/"),
    "beliggenhet": dict(kind="info", disposition="local", proposedLocalPath="/beliggenhet",
                          note="Placy-siden — allerede bygget lokalt (app/demo/leangenbukta-nettside/beliggenhet)."),

    # --- Byggsider ---------------------------------------------------------
    "saltakshusc": dict(kind="building", disposition="local", proposedLocalPath="/saltakshusc",
                          building=dict(name="Bygg C (Saltakshus C)", statusText="«Ferdigstilt» nevnt i teksten",
                                        linksToBoligvelger=False, linksToProspekt=True)),
    "tilvalgbyggc": dict(kind="building", disposition="local", proposedLocalPath="/saltakshusc/tilvalg",
                          parentId="saltakshusc",
                          building=dict(name="Bygg C — tilvalg", statusText="Undersides for bygg C, ingen egen salgsstatus",
                                        linksToBoligvelger=False, linksToProspekt=False)),
    "knutepunktet": dict(kind="building", disposition="local", proposedLocalPath="/knutepunktet",
                          building=dict(name="Knutepunktet", statusText="Ikke eksplisitt angitt i statisk tekst (boligvelger-widget)",
                                        linksToBoligvelger=True, linksToProspekt=True)),
    "saltakshush": dict(kind="building", disposition="local", proposedLocalPath="/saltakshush",
                          building=dict(name="Saltakshus H", statusText="Ikke eksplisitt angitt i statisk tekst (boligvelger-widget)",
                                        linksToBoligvelger=True, linksToProspekt=True)),
    "saltakshus-i": dict(kind="building", disposition="local", proposedLocalPath="/saltakshus-i",
                          building=dict(name="Saltakshus I", statusText="Tittel: «36 nye leiligheter for salg» — i salg",
                                        linksToBoligvelger=False, linksToProspekt=True)),
    "saltakshus-j": dict(kind="building", disposition="local", proposedLocalPath="/saltakshus-j",
                          building=dict(name="Saltakshus J", statusText="Tittel: «39 nye leiligheter for salg» — i salg",
                                        linksToBoligvelger=False, linksToProspekt=True)),
    "saltakshusk-2": dict(kind="building", disposition="local", proposedLocalPath="/saltakshusk",
                          building=dict(name="Saltakshus K", statusText="Innhold er en byggestart-nyhet («Første støp på tomta!»), ikke en ordinær byggside — «Nytt salgstrinn» nevnt",
                                        linksToBoligvelger=False, linksToProspekt=False)),
    "byvilla-1-og-2": dict(kind="building", disposition="local", proposedLocalPath="/byvilla-1-og-2",
                          building=dict(name="Byvilla 1 og 2", statusText="Tittel: «24 nye leiligheter for salg» — i salg",
                                        linksToBoligvelger=False, linksToProspekt=True)),
    "nytt-salgstrinn-bygg-l": dict(kind="building", disposition="local", proposedLocalPath="/bygg-l",
                          building=dict(name="Bygg L (Saltakshus L)", statusText="Tittel/innhold: «Nytt salgstrinn»",
                                        linksToBoligvelger=False, linksToProspekt=True)),
    "toppleilighetl504": dict(kind="building", disposition="local", proposedLocalPath="/bygg-l/toppleilighet-504",
                          parentId="nytt-salgstrinn-bygg-l",
                          building=dict(name="Toppleilighet L504 (enhet i Bygg L)", statusText="Ikke eksplisitt angitt i statisk tekst",
                                        linksToBoligvelger=False, linksToProspekt=False)),
    "rekkehus19-27": dict(kind="building", disposition="local", proposedLocalPath="/rekkehus-19-27",
                          building=dict(name="Rekkehus 19–27", statusText="«ferdigstilt», «kommer for salg» og «solgt» forekommer alle i teksten — blandet status per enhet",
                                        linksToBoligvelger=False, linksToProspekt=True)),
    "parktunet1-2": dict(kind="building", disposition="local", proposedLocalPath="/parktunet1",
                          building=dict(name="Parktunet 1 (Bygg D)", statusText="Ikke eksplisitt angitt i statisk tekst (boligvelger-widget)",
                                        linksToBoligvelger=False, linksToProspekt=True)),

    # Duplikat-slugger som WPs canonical-tag selv peker bort fra
    "byggetrinn-1-byvilla-4-og-5": dict(kind="building", disposition="duplicate", duplicateOf="saltakshusk-2",
                          note="Canonical peker til /saltakshusk-2/ — samme «Første støp på tomta!»-artikkel, gammel URL beholdt i sitemap."),
    "byggetrinn-1-rekkehus": dict(kind="building", disposition="duplicate", duplicateOf="nytt-salgstrinn-bygg-l",
                          note="Canonical peker til /nytt-salgstrinn-bygg-l/ — samme innhold om Bygg L, gammel URL beholdt i sitemap."),
    "saltakshusk": dict(kind="building", disposition="duplicate", duplicateOf="saltakshusk-2",
                          note="Canonical peker til /saltakshusk-2/."),
    "parktunet1": dict(kind="building", disposition="duplicate", duplicateOf="parktunet1-2",
                          note="Canonical peker til /parktunet1-2/."),
    "om-prosjektet": dict(kind="project", disposition="duplicate", duplicateOf="om-prosjektet-2",
                          note="Canonical peker til /om-prosjektet-2/."),

    # --- Prosjekt (om prosjektet/fasiliteter/bærekraft) ---------------------
    "om-prosjektet-2": dict(kind="project", disposition="local", proposedLocalPath="/om-prosjektet"),
    "elbil-elsykkeldeling": dict(kind="project", disposition="local", proposedLocalPath="/om-prosjektet/elbil-elsykkeldeling"),
    "innflyttingsklare-leiligheter": dict(kind="project", disposition="local", proposedLocalPath="/innflyttingsklare"),
    "galleri": dict(kind="project", disposition="local", proposedLocalPath="/galleri"),

    # --- Artikler (nyhets-/lifestyle-innlegg, wpType=post) ------------------
    "fasiliteter-som-gjor-hverdagen-enklere": dict(kind="article", disposition="local", proposedLocalPath="/nyheter/fasiliteter-som-gjor-hverdagen-enklere"),
    "fritidstilbud-for-hele-familien": dict(kind="article", disposition="local", proposedLocalPath="/nyheter/kort-vei-til-alt-fritidstilbud",
                          note="Selvstendig artikkel-URL, men canonical peker til /kort-vei-til-alt/ (samme innhold, nyere slug)."),
    "fritidstilbud-for-hele-familien-2": dict(kind="article", disposition="duplicate", duplicateOf="kort-vei-til-alt",
                          note="Canonical peker til /kort-vei-til-alt/."),
    "her-trenger-du-ikke-eie-bil": dict(kind="article", disposition="local", proposedLocalPath="/nyheter/her-trenger-du-ikke-eie-bil"),
    "kort-vei-til-alt": dict(kind="article", disposition="local", proposedLocalPath="/nyheter/kort-vei-til-alt"),
    "trygt-og-bilfritt": dict(kind="article", disposition="local", proposedLocalPath="/nyheter/trygt-og-bilfritt"),
    "vedlikeholdsfritt": dict(kind="article", disposition="local", proposedLocalPath="/nyheter/vedlikeholdsfritt"),

    # --- Info (kjøpsprosess, FAQ, praktisk) ---------------------------------
    "hvordankjopebolig": dict(kind="info", disposition="local", proposedLocalPath="/kjop/forkjopsrett-bygg-c",
                          parentId="saltakshusc"),
    "hvordankjopebolig-2": dict(kind="info", disposition="local", proposedLocalPath="/kjop/hvordan-kjope-bolig"),
    "hvordankjopebolig-3": dict(kind="info", disposition="local", proposedLocalPath="/kjop/forkjopsrett-bygg-d",
                          parentId="parktunet1-2"),
    "hvordankjopebolig-byggc": dict(kind="info", disposition="local", proposedLocalPath="/kjop/apent-salg-bygg-c",
                          parentId="saltakshusc"),
    "bli-obos-medlem": dict(kind="info", disposition="local", proposedLocalPath="/kjop/bli-obos-medlem"),
    "visning-pa-tomta": dict(kind="info", disposition="local", proposedLocalPath="/besok-salgslokale"),
    "kundeportal": dict(kind="info", disposition="local", proposedLocalPath="/kundeportal",
                          note="Siden selv er lokal, men alle fire undermenylenker (Byggetrinn 1/2, Saltakshus H, Knutepunktet) går til eksterne kundeportaler (locka.cloud/journeyapp.tech) — se external-links.json."),
    "salgsmateriell": dict(kind="info", disposition="local", proposedLocalPath="/salgsmateriell"),
    "salgsmateriell__prospekter": dict(kind="info", disposition="local", proposedLocalPath="/salgsmateriell/prospekter",
                          note="Lister opp PDF-prospekter under /wp-content/uploads/ — se document-oppføringer."),
    "salgsmateriell__prislister": dict(kind="info", disposition="local", proposedLocalPath="/salgsmateriell/prislister",
                          note="Lister opp PDF-prislister under /wp-content/uploads/ — se document-oppføringer."),
    "salgsmateriell__kjopebekreftelser": dict(kind="info", disposition="local", proposedLocalPath="/salgsmateriell/kjopebekreftelser",
                          note="Lister opp PDF-kjøpebekreftelser under /wp-content/uploads/ — se document-oppføringer."),
    "apenhetsloven": dict(kind="info", disposition="local", proposedLocalPath="/apenhetsloven",
                          note="Lenker videre til koteng.no/.../varsling-av-kritikkverdige-forhold/ (ekstern, se external-links.json)."),
    "personvern": dict(kind="info", disposition="local", proposedLocalPath="/personvern"),
    "retningslinjer-for-informasjonskapsler": dict(kind="info", disposition="local", proposedLocalPath="/cookies"),
    "fordeler-a-bo-forste-etasje": dict(kind="info", disposition="local", proposedLocalPath="/fordeler-forste-etasje"),
    "velge-nybolig": dict(kind="info", disposition="local", proposedLocalPath="/velge-nybolig"),
    "stort-til-mindre-2": dict(kind="info", disposition="local", proposedLocalPath="/stort-til-mindre"),
    "stort-til-mindre_byggc": dict(kind="info", disposition="local", proposedLocalPath="/stort-til-mindre/bygg-c",
                          parentId="saltakshusc"),
    "stort-til-mindre_parktunet": dict(kind="info", disposition="local", proposedLocalPath="/stort-til-mindre/parktunet",
                          parentId="parktunet1-2"),
    "rekkehus-for-barnefamilier-i-trondheim": dict(kind="info", disposition="local", proposedLocalPath="/rekkehus-for-barnefamilier"),
    "2roms-og3roms": dict(kind="info", disposition="local", proposedLocalPath="/2-og-3-roms"),

    # --- Testside (ikke i meny) ----------------------------------------------
    "test-framside": dict(kind="home", disposition="local", proposedLocalPath="/test-framside",
                          note="Utkast til ny forside («Leangbukta ny framside»), egen sitemap-URL men ikke lenket fra menyen. Ikke bekreftet publisert — bygg kun etter avklaring."),

    # --- Portefølje / referanseprosjekt (ikke del av Leangenbukta selv) ----
    "portfolio__sjoparken": dict(kind="info", disposition="local", proposedLocalPath="/referanse/sjoparken",
                          note="Portfolio-type, egen postid (6879), refererer trolig til et annet Koteng Jenssen-prosjekt (Sjøparken), ikke en del av Leangenbukta. Behold som kuriosum, ikke prioritert i kundedemoen."),
    "portfolio__sjoparken-2": dict(kind="info", disposition="duplicate", duplicateOf="portfolio__sjoparken",
                          note="Egen postid (6885), identisk tittel «Sjøparken» som portfolio/sjoparken/ men selvstendig canonical — trolig en dobbel WP-oppføring for samme referanseprosjekt, ikke en ekte duplikat-URL. Se note på portfolio__sjoparken."),

    # --- Arkiv ----------------------------------------------------------------
    "aktuelt": dict(kind="archive", disposition="local", proposedLocalPath="/nyheter"),
    "aktuelt__page__1": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt",
                          note="WP-paginering side 1 == samme innleggsliste som /aktuelt/."),
    "aktuelt__page__2": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt",
                          note="WP-paginering side 2 av samme innleggsliste — 18 innlegg totalt får plass på færre sider enn antatt; ikke bygget som egen side i demoen."),
    "category__aktuelt": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt",
                          note="Kategoriarkiv for «Aktuelt» viser samme 18 innlegg som /aktuelt/ (alle innlegg har denne kategorien)."),
    "category__aktuelt__page__1": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt", note="Paginering, samme liste."),
    "category__aktuelt__page__2": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt", note="Paginering, samme liste."),
    "author__ida": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt",
                          note="Forfatterarkiv viser samme 18 innlegg som /aktuelt/ (Ida er registrert forfatter på alle)."),
    "author__ida__page__1": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt", note="Paginering, samme liste."),
    "author__ida__page__2": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt", note="Paginering, samme liste."),
    "author__fredrik": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt",
                          note="Forfatterarkiv, delmengde av samme innleggsliste."),
    "author__lena": dict(kind="archive", disposition="duplicate", duplicateOf="aktuelt",
                          note="Forfatterarkiv, delmengde av samme innleggsliste."),
    "project-type__premium-kvaliteter": dict(kind="archive", disposition="local", proposedLocalPath="/premium-kvaliteter",
                          note="Portfolio-taksonomiarkiv, ett prosjekt-type-filter."),

    # --- Boligvelger-familien (leangenbukta.no/boligvelger/...) -------------
    "boligvelger": dict(kind="info", disposition="external", redirectTo="https://leangenbukta.plyo.cloud/standalone-aptcho/",
                          note="Lokal URL som viser innbygd Plyo-boligvelger; canonical peker til plyo.cloud. Selve boligvelger-funksjonaliteten er ekstern (Plyo), lenkes ikke bygget lokalt."),
    "boligvelger__knutepunktet": dict(kind="info", disposition="duplicate", duplicateOf="knutepunktet",
                          note="Canonical peker til /knutepunktet/ — boligvelger-kontekst av byggsiden, ikke eget innhold."),
    "boligvelger__rekkehus": dict(kind="info", disposition="duplicate", duplicateOf="rekkehus-for-barnefamilier-i-trondheim",
                          note="Canonical peker til /rekkehus-for-barnefamilier-i-trondheim/."),
    "boligvelger__saltakshush": dict(kind="info", disposition="duplicate", duplicateOf="saltakshush",
                          note="Canonical peker til /saltakshush/."),
    "boligvelger__byvilla-1__111-2": dict(kind="info", disposition="unavailable",
                          note="404. Enhets-dyplenke i Plyo-boligvelgeren (klientsiderute), finnes ikke som server-URL."),
    "boligvelger__saltakshush__h103": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute) i Plyo-boligvelgeren."),
    "boligvelger__saltakshush__h106": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute) i Plyo-boligvelgeren."),
    "boligvelger__saltakshush__h201": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute) i Plyo-boligvelgeren."),
    "boligvelger__saltakshush__h304": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute) i Plyo-boligvelgeren."),
    "boligvelger__saltakshusi": dict(kind="info", disposition="unavailable", note="404. Boligvelger-inngang for Saltakshus I finnes ikke på leangenbukta.no (byggets egen boligvelger er trolig ikke aktivert/lenket samme vei som de andre)."),
    "boligvelger__saltakshusi__401-2": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute)."),
    "boligvelger__saltakshusi__405-2": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute)."),
    "boligvelger__saltakshusl": dict(kind="info", disposition="unavailable", note="404. Boligvelger-inngang for Saltakshus L (bygg L) finnes ikke på leangenbukta.no."),
    "boligvelger__saltakshusl__504-2": dict(kind="info", disposition="unavailable", note="404. Enhets-dyplenke (klientsiderute)."),

    # --- Ekte, enkeltstående brukket lenke fra forsiden ----------------------
    "byvilla-3-rekkehus1-4": dict(kind="building", disposition="unavailable",
                          note="404. Ekte brukket lenke fra forsiden («Byvilla 3, Rekkehus 1-4» — omtalt sted finnes ikke lenger på egen URL)."),
}

# id-er som skal EKSKLUDERES fra enkeltvise oppføringer og heller telles inn
# i én samle-oppføring per bug-familie (se BUG_FAMILIES under).
def is_personvern_bug(url):
    last = urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1]
    return last == "personvern" and url.rstrip("/") != "https://leangenbukta.no/personvern"


def is_mailto_bug(url):
    return url.endswith("jan.erik.fjeldseth@obos.no")


def classify(url, entries, head):
    eid = url_id(url)
    e = entries[url]

    if "/wp-content/" in url:
        h = head.get(url, {})
        ct = (h.get("contentType") or e.get("contentType") or "").split(";")[0].strip()
        kind = "document" if ct == "application/pdf" else "media"
        try:
            size = int(h.get("contentLength") or e.get("contentLength") or 0)
        except (TypeError, ValueError):
            size = None
        return dict(kind=kind, disposition="external", contentType=ct, byteSize=size,
                    note="Ikke lastet ned (dokument/media under /wp-content/uploads/) — lenkes til originalen på leangenbukta.no.")

    if eid in OVERRIDES:
        return dict(OVERRIDES[eid])

    # Fallback: generisk gjetning fra wpType/canonical
    bc = e.get("bodyClass") or ""
    canon = e.get("canonical")
    if canon and canon != url:
        return dict(kind="info", disposition="duplicate", duplicateOf=url_id(canon),
                     note=f"Ikke manuelt klassifisert — canonical peker til {canon}.")
    return dict(kind="info", disposition="local", proposedLocalPath="/" + urlsplit(url).path.strip("/"),
                note="IKKE MANUELT VERIFISERT — falt gjennom til generisk regel, bør sjekkes manuelt.")


def main():
    raw, head = load()
    entries = {e["sourceUrl"]: e for e in raw["entries"]}

    personvern_bug_urls = sorted(u for u in entries if is_personvern_bug(u))
    mailto_bug_urls = sorted(u for u in entries if is_mailto_bug(u))
    bug_urls = set(personvern_bug_urls) | set(mailto_bug_urls)

    manifest_entries = []
    unverified = []

    for url in sorted(entries):
        if url in bug_urls:
            continue
        e = entries[url]
        cls = classify(url, entries, head)
        eid = url_id(url)
        wpType = None
        bc = e.get("bodyClass") or ""
        if "page page-id" in bc:
            wpType = "page"
        elif "single-post" in bc:
            wpType = "post"
        elif "single-portfolio" in bc:
            wpType = "portfolio"
        elif bc.startswith("home") or bc.startswith("blog"):
            wpType = "home/blog"
        elif "archive" in bc:
            wpType = "archive"
        entry = {
            "id": eid,
            "sourceUrl": url,
            "finalUrl": e.get("finalUrl"),
            "canonicalUrl": e.get("canonical"),
            "discoveredVia": e.get("discoveredVia", []),
            "httpStatus": e.get("httpStatus"),
            "redirectChain": e.get("redirectChain", []),
            "title": e.get("title"),
            "wpType": wpType,
            "kind": cls.get("kind"),
            "disposition": cls.get("disposition"),
        }
        if cls.get("duplicateOf"):
            entry["duplicateOf"] = cls["duplicateOf"]
        if cls.get("redirectTo"):
            entry["redirectTo"] = cls["redirectTo"]
        if cls.get("parentId"):
            entry["parentId"] = cls["parentId"]
        if cls.get("proposedLocalPath"):
            entry["proposedLocalPath"] = cls["proposedLocalPath"]
        if cls.get("building"):
            entry["building"] = cls["building"]
        if cls.get("note"):
            entry["note"] = cls["note"]
        if cls.get("contentType"):
            entry["contentType"] = cls["contentType"]
        if cls.get("byteSize") is not None:
            entry["byteSize"] = cls["byteSize"]

        entry["template"] = bc
        entry["stylesheets"] = e.get("stylesheets", [])
        entry["components"] = e.get("components", [])
        entry["forms"] = e.get("forms", [])
        entry["media"] = e.get("images", [])
        entry["outboundLinks"] = e.get("outboundLinks", [])
        entry["snapshotFile"] = e.get("snapshotFile")

        manifest_entries.append(entry)
        if cls.get("note", "").startswith("IKKE MANUELT VERIFISERT"):
            unverified.append(eid)

    # --- Samle-oppføringer for de to lenke-bugsene --------------------------
    pv_200 = [u for u in personvern_bug_urls if entries[u]["httpStatus"] == 200]
    pv_404 = [u for u in personvern_bug_urls if entries[u]["httpStatus"] != 200]
    manifest_entries.append({
        "id": "bug-relativ-personvern-lenke",
        "kind": "info",
        "disposition": "duplicate",
        "duplicateOf": "personvern",
        "httpStatus": "blandet (200/404)",
        "title": "Samle-oppføring: relativ personvern-lenke uten ledende skråstrek",
        "note": (
            f"Cookie-samtykkebanneret har href=\"personvern\" (relativ, uten ledende «/») på alle sider. "
            f"Dette gir {len(pv_200)} soft-duplikat-URL-er på formen <side>/personvern/ som WordPress svarer "
            f"200 på med innholdet fra den ekte /personvern/-siden (samme page-id 6269, canonical peker dit), "
            f"og {len(pv_404)} URL-er ett nivå til (<side>/personvern/personvern/, inkl. under /boligvelger/…) "
            f"som 404-er fordi WPs slug-fallback bare dekker ett nivå. Ekte side: /personvern/. "
            f"Ingen av disse {len(personvern_bug_urls)} URL-ene er reelle, selvstendige sider og bygges ikke lokalt."
        ),
        "affectedCount": len(personvern_bug_urls),
        "examples": personvern_bug_urls[:5] + (["…"] if len(personvern_bug_urls) > 5 else []),
    })
    manifest_entries.append({
        "id": "bug-relativ-mailto-lenke",
        "kind": "info",
        "disposition": "unavailable",
        "httpStatus": 404,
        "title": "Samle-oppføring: relativ mailto-lenke uten mailto:-prefiks",
        "note": (
            f"Footeren/kontaktlenken på post-type-sider bruker href=\"jan.erik.fjeldseth@obos.no\" uten "
            f"«mailto:»-prefiks. Nettleseren tolker dette som en relativ sti og løser den til "
            f"<side>/jan.erik.fjeldseth@obos.no, som 404-er ({len(mailto_bug_urls)} forekomster). Den ekte, "
            f"korrekte lenken (mailto:jan.erik.fjeldseth@obos.no) finnes på forsiden og fungerer. Ikke en side "
            f"— bygges ikke lokalt, men bør flagges til kunden som en reell bug på kildesiden."
        ),
        "affectedCount": len(mailto_bug_urls),
        "examples": mailto_bug_urls[:5] + (["…"] if len(mailto_bug_urls) > 5 else []),
    })

    discovered_total = len(entries)  # inkl. bug-URL-er og wp-content, for kontrollsummen
    disposed_total = len(manifest_entries) - 2 + len(personvern_bug_urls) + len(mailto_bug_urls)  # hver bug-url telles

    manifest = {
        "checkedAt": "2026-09-23",
        "source": "https://leangenbukta.no",
        "sitemaps": raw.get("sitemapCounts", {}),
        "discoveredUrlCount": discovered_total,
        "disposedUrlCount": disposed_total,
        "entries": manifest_entries,
    }
    with open(f"{RESEARCH}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"manifest.json skrevet: {len(manifest_entries)} oppføringer "
          f"({discovered_total} URL-er oppdaget totalt, {disposed_total} disponert via oppføringer+bug-grupper)")
    if unverified:
        print(f"ADVARSEL: {len(unverified)} oppføringer falt gjennom til generisk regel: {unverified}")
    else:
        print("Alle oppføringer manuelt klassifisert (ingen falt gjennom til generisk regel).")

    return manifest, entries, head, personvern_bug_urls, mailto_bug_urls


if __name__ == "__main__":
    main()
