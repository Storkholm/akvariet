# 0001 – 3D-kroppen genereres ud fra skabelonens omrids

**Status:** Besluttet (2026-10-06)

## Kontekst
Barnet tegner i 2D, men dyret skal svømme i 3D. Mulighederne var (a) færdige 3D-modeller med tegningen som tekstur, (b) en krop genereret i kode ud fra omridset, (c) en flad "papirfigur" der bølger.

## Beslutning
Vi vælger (b). Hver art defineres af sit **omrids set oppefra**. Koden bygger en let "oppustet" krop ud fra omridset (tykkest i midten, tynd ud mod kanterne), og **tegningen bruges direkte som tekstur på ryggen** – skabelonen *er* UV-kortet, så tegning og krop passer altid sammen. Svømning laves som bølge-/vingeslag direkte på kroppens punkter (ingen skelet-animation).

## Konsekvenser
- Ingen eksterne 3D-filer, licenser eller modelværktøjer – alt kan bygges og testes af Claude Code.
- En ny art = et nyt omrids + nogle få svømmeparametre.
- Dyr med lemmer der stikker langt ud (f.eks. skildpaddens hoved og luffer) skal enten tegnes med i omridset eller laves som separate små "plader" der bevæges hver for sig.
- Ser mindre fotorealistisk ud end (a) – passer til en tegnet, legende stil.
