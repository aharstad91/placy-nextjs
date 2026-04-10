---
date: 2026-04-10
topic: kjopesenter-anker
---

# Kjøpesenter-anker i Hverdagsliv

## What We're Building

En "senter-anker"-feature som viser kjøpesenteret som et samlet sted i rapporten — istedenfor å spredte enkeltbutikker. Senteret blir en egen POI med markør på kartet og beriket rad i hero insight-kortet. Butikkene inne i senteret (Coop Mega, Boots, etc.) knyttes til senteret via `parentPoiId` og vises innfoldet under senteret, ikke som egne markører/rader.

To flater, samme data:
1. **Hero insight-kortet**: Senter-raden berikes med kort oppsummering av hva senteret tilbyr + lenke til senterets nettside + Google AI-lenke
2. **Kartet**: Senteret er en egen markør. Klikk åpner drawer med senter-info, oppsummering, barn-POI-er, og viderelenking

Filosofi: Vise nok til at leseren forstår verdien, så sende videre. S&J-stil — kontekstuell teaser, ikke komplett oversikt.

## Why This Approach

Senteret er et fysisk sted — det bør modelleres som en POI. Det gir markør på kart, drawer-funksjonalitet, og walkTime gratis via eksisterende infrastruktur. Alternativet (konfigurasjonsobjekt) ville krevd spesialbehandling overalt.

`parentPoiId` løser duplikat-problemet: barn-POI-er filtreres fra kart-markører og hero-kort-rader, men er synlige inne i senter-draweren. Enkelt konsept, ingen ny datamodell.

## Key Decisions

- **Senteret blir en egen POI** med kategori `shopping_center` — gir markør, drawer, walkTime automatisk
- **`parentPoiId` på barn-POI-er** — kobler Coop Mega, Boots etc. til senteret
- **Barn filtreres fra kart + hero-kort** — vises bare i senter-drawer og senter-raden i hero-kortet
- **Nye felter**: `websiteUrl` (senterets nettside) + `anchorSummary` (kort oppsummering, f.eks. "dagligvare, apotek, frisør, post, vinmonopol")
- **Viderelenking**: Nettside-URL + Google AI mode (`udm=50`) — to klikk-muligheter for brukeren
- **Generisk**: Fungerer for alle sentre (City Lade, Sirkus Shopping, etc.) — data per POI, ikke hardkodet

## Open Questions

- Ikon for `shopping_center`-kategori — ShoppingBag? Store? Building2?
- Skal `anchorSummary` genereres automatisk fra barn-POI-enes kategorier, eller skrives manuelt?
- Markør-stil på kart — bør senteret ha en distinkt visuell stil (større, annen form)?

## Next Steps
→ `/workflows:plan` for implementation details
