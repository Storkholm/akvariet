# 0005 – Fisk tegnes fra siden og spejles

**Status:** Besluttet (2026-10-09)

## Kontekst
ADR 0001 forudsætter, at skabelonen er dyret set oppefra. Det passer til rokke, skildpadde og bunddyr, men ikke til fisk (klovnefisk, pufferfisk, haj): set oppefra er de smalle, og mønstret sidder på siderne.

## Beslutning
En skabelon får en **retning** (`view: 'top' | 'side'`).
- `top` (rokke, skildpadde, søstjerne, søpindsvin, søpølse): som hidtil – kroppen pustes op og ned fra skabelonens plan, tegningen ligger på ryggen, og bugen er en lysere udgave.
- `side` (klovnefisk, pufferfisk, haj): skabelonen er fisken set fra venstre side. Kroppen pustes op **til siderne** (tyk i midten, tynd mod kanten og ud i finnerne), og **samme tegning sidder på begge sider** (spejlet, så hovedet vender rigtigt på begge sider). Der er ingen automatisk lys bug.
- Krop-generatoren (ADR 0001) genbruges; kun den akse der pustes op langs, og UV-spejlingen på den ene side, er forskellige.

## Konsekvenser
- Fisk kan farvelægges med et rigtigt mønster, som ses tydeligt, når de svømmer forbi.
- Barnet kan ikke give de to sider forskelligt mønster.
- Svømning for `side`-arter er en sideværts bølge gennem kroppen og halen (vertex-shaderen får en ny `style`).
- Navnet kan ikke stå på bugen af en fisk (der er ingen bug at se); fisk viser kun navnet som navneskilt.
