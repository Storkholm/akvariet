# 0012 – "Wee" når man trykker på et dyr

**Status:** Besluttet (2026-10-14). Udvider [ADR 0007](0007-indtalte-lydfiler.md) og [ADR 0010](0010-indtalte-lyde-til-rensehajer.md).

## Kontekst
Martin lagde fire optagelser (`wee1.mp3` … `wee4.mp3`, 2,4–3,1 sek.) i `public/sounds/` som lyd, når man trykker på et dyr i akvariet (Glædeshop). Indtil nu var det en lille boblelyd lavet i kode.

## Beslutning
- **Hvert** tryk på et dyr afspiller en tilfældig "wee" (aldrig den samme to gange i træk), også mens en tidligere stadig spiller. Højst tre lyder ad gangen: kommer en fjerde, toner den ældste ud på 80 ms. (Første udgave lod kun én lyde ad gangen; Martin: "lyden skal afspille hver gang man trykker".)
- Mangler optagelserne, bruges boblelyden som før – spillet fejler aldrig på en manglende fil.
- Filnavne må både hedde `wee-1.mp3` og `wee1.mp3` (1–4); indlæsningen prøver begge. Det gælder nu alle optagelsesfamilier.
- Optagelserne hentes ved det første tryk (samme øjeblik som lyden vækkes), ikke ved opstart. Et allerførste tryk på et dyr kan derfor nå at lyde som boblerne.
- Starten springes over, så lyden følger trykket: alt under en lydstyrke på 0,08 (RMS) springes over. `wee1` starter ved 0,18 sek., `wee2` ved 0,91, `wee3` ved 1,03 og `wee4` ved 0,76 sek.: de tre sidste har en svag indledning på ca. 0,7 sek., som ellers fik lyden til at komme for sent.
