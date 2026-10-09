# 0006 – Bredere akvarie med kamera man kan flytte

**Status:** Besluttet (2026-10-09). Ændrer DESIGN 3.4 ("ingen kamerastyring i v1").

## Kontekst
Med 30 dyr i ét skærmbillede er der trængsel, og børnene vil gerne se de enkelte dyr bedre.

## Beslutning
- Akvariet bliver ca. **3 skærmbredder** bredt (i liggende tablet-format); dybde og højde som nu. Dyrene fordeler sig i hele bredden.
- **Kameraet kan flyttes:** én finger glider langs akvariet (og lidt op/ned), to fingre zoomer (1×–2,5×). Kameraet kan ikke forlade akvariet. Efter 30 sek. uden berøring glider det roligt tilbage til midten.
- **Følg dyr:** dobbelttryk på et dyr får kameraet til at følge det (navneskiltet vises), indtil man swiper eller dobbelttrykker et tomt sted.
- Et kort tryk på et dyr er stadig glædeshop. Et træk først efter ca. 10 px bevægelse, så tryk og træk ikke forveksles.
- Revet bygges i **bidder** langs bredden, så det der er uden for billedet, ikke tegnes (frustum culling). Det synlige antal trekanter må ikke vokse i forhold til v1.

## Konsekvenser
- Trængslen ved 30 dyr forsvinder uden mindre dyr eller lavere loft.
- Artsvælgerens bobler og tegnefladen er stadig forankret til skærmen, ikke til akvariet.
- Overgangen efter Slip løs starter, hvor kameraet står; dyret svømmer ind i den synlige del.
- Ved start vises midten af akvariet.
