# 0002 – Dyrene gemmes lokalt på enheden

**Status:** Besluttet (2026-10-06)

## Kontekst
Visionen er at alle dyr man har lavet over tid svømmer i akvariet. Mulighederne var: ingen gemning (dyret lever nogle minutter), lokal gemning i browseren, eller et fælles akvarie på tværs af enheder via en server.

## Beslutning
Dyr gemmes i browserens lager (IndexedDB) på den enhed, de er tegnet på. Hvert dyr gemmes som art + tegning (billede) + oprettelsestidspunkt. Der svømmer højst **30 dyr** samtidig; når et nyt dyr slippes løs i et fuldt akvarie, tager det ældste dyr **afsked** (svømmer ud af billedet) og slettes. Derudover kan en voksen slette enkelte dyr i **voksentilstand**.

## Konsekvenser
- Ingen server, ingen login, ingen persondata – fungerer offline.
- Dyrene følger enheden og browseren; rydder man browserdata, forsvinder de.
- Et fælles akvarie på tværs af enheder kan komme senere uden at ændre hvordan et dyr beskrives.
