# 0009 – Dyrelager v2: navn og større tegning

**Status:** Besluttet (2026-10-09). Udvider ADR 0002.

## Kontekst
Med zoom på tegnefladen kan børnene tegne detaljer, som går tabt i den gemte tegning på 512 × 512. Dyr skal også kunne have et navn.

## Beslutning
- Tegningen gemmes som **1024 × 1024 PNG** (i stedet for 512 × 512). I akvariet bruges stadig en nedskaleret tekstur, *undtagen* for det dyr kameraet følger eller er zoomet tæt på, som får fuld opløsning.
- `Creature` får et valgfrit **`name`** (højst 12 tegn, bogstaver inkl. æøå, tal og mellemrum).
- Hvert objekt i lageret får **`version: 2`**. Dyr uden version (v1) indlæses som før: 512-tegningen skaleres op og de får intet navn. Der skrives ikke om i gamle dyr.
- Arterne udvides med de nye arter (ADR 0005 og DESIGN 8.5). Ukendte arter ved indlæsning springes over i stedet for at vælte spillet.

## Konsekvenser
- Lageret bliver større (ca. 30 × 0,3–1 MB) – fint i IndexedDB.
- Voksentilstandens slette-dialog viser navnet, hvis dyret har et.
