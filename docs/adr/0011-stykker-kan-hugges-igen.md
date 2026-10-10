# 0011 – Stykker kan hugges igen

**Status:** Besluttet (2026-10-10). Erstatter punktet "kun ét snit pr. dyr" i [ADR 0008](0008-samurai-snit-og-rensehajer.md).

## Kontekst
I ADR 0008 kunne et dyr kun hugges én gang; de to stykker var urørlige, til en rensehaj spiste dem. Martin: børnene vil gerne kunne hugge et dyr i flere stykker, også selv om det allerede er hugget over én gang.

## Beslutning
- Et **Stykke** kan hugges, så længe det ikke er ved at blive spist. Hugget deler det i to nye stykker, som hver bevarer **alle** tidligere snit (klippeplanerne lægges oven i hinanden: et stykke er det, der ligger på den positive side af alle sine planer).
- Rammer-testen (`Fragment.crossedBy`) prøver punkter langs swipet mod kroppens omrids **og** mod de tidligere snit, så den del, der er klippet væk, ikke kan rammes.
- Et hug tæller som ét hug mod rensehajerne (ligesom et hugget dyr), også når det kun rammer stykker.
- **Loft:** højst 40 stykker i akvariet på én gang (`MAX_PIECES`). Er der fyldt op, hugger swipet kun levende dyr. Det holder både tegneomkostning og oprydning i ave; hajerne spiser stykkerne, som før.
- Teknisk: stykkerne deler stadig krop (tekstur og geometri) med referencetælling; et nyt stykke tager det gamle stykkes position, retning og tilstand, skubbes væk fra sin søster og falder/hviler som før.

## Konsekvenser
- Mange snit giver mange klippeplaner pr. materiale (WebGL klipper med et antal planer pr. materiale). Med loftet og hajerne er det i praksis få; et stykke med flere end 8 snit er ikke afprøvet.
- Små stykker kan blive meget små; de spises på lige fod med de store.
