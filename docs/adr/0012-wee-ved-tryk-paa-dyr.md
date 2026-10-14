# 0012 – "Wee" når man trykker på et dyr

**Status:** Besluttet (2026-10-14). Udvider [ADR 0007](0007-indtalte-lydfiler.md) og [ADR 0010](0010-indtalte-lyde-til-rensehajer.md).

## Kontekst
Martin lagde fire optagelser (`wee1.mp3` … `wee4.mp3`, 2,4–3,1 sek.) i `public/sounds/` som lyd, når man trykker på et dyr i akvariet (Glædeshop). Indtil nu var det en lille boblelyd lavet i kode.

## Beslutning
- Et tryk på et dyr afspiller en tilfældig "wee" (aldrig den samme to gange i træk). Mens en optagelse stadig spiller, er flere tryk lydløse (visuelt hopper dyrene stadig), som med hajernes "nam".
- Mangler optagelserne, bruges boblelyden som før – spillet fejler aldrig på en manglende fil.
- Filnavne må både hedde `wee-1.mp3` og `wee1.mp3` (1–4); indlæsningen prøver begge. Det gælder nu alle optagelsesfamilier.
- Optagelserne hentes ved det første tryk (samme øjeblik som lyden vækkes), ikke ved opstart. Et allerførste tryk på et dyr kan derfor nå at lyde som boblerne.
- Som alle optagelser springes den indledende stilhed over (ca. 0,19 sek. i disse filer).
