# 0013 – Tastatur og pile på computer

**Status:** Besluttet (2026-10-14). Udvider [ADR 0006](0006-bredt-akvarie-kamera-og-karrusel.md).

## Kontekst
På en computer var det svært at gå på opdagelse: kameraet kunne kun trækkes med musen, og artsrækken kun trækkes i en af boblerne. Martin: "ikke helt intuitivt".

## Beslutning
- **Piletaster og W A S D** glider kameraet (så længe tasten holdes; blødt stop), **+ og −** zoomer, **Home** stiller kameraet tilbage. Følgning stopper, som ved et swipe.
- **Mens artsrækken er fremme** hører ← → (og A D) til rækken: ét dyr pr. tryk. ↑ ↓ og W S flytter stadig kameraet. Er rækken foldet væk (Kig-knappen), flytter alle piletaster kameraet.
- **Artsrækken** får to **pile-knapper** (‹ ›) i siderne (kun for mus: `hover: hover` og `pointer: fine`; touch-skærme swiper) og **musehjulet** ruller rækken ét dyr pr. hjulklik (ét trin pr. swipe på en pegeplade).
- Tasterne gør **intet**, mens tegnefladen er åben, mens et ja/nej-spørgsmål er fremme, med ctrl/cmd/alt nede, og i tekstfelter.

## Konsekvenser
- Skærmlæsere/tastatur: bobler kan stadig nås med Tab; piletaster på en fokuseret boble ruller rækken (fokus bliver, hvor det er).
- Der står ingen hjælpetekst om tasterne i spillet (børn læser ikke); de er til forældre og større børn på computer.
