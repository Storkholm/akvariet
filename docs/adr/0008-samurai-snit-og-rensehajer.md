# 0008 – Samurai-mode: rene snit, stykker og rensehajer

**Status:** Besluttet (2026-10-09)

## Kontekst
Samurai-mode er en sjov måde at gøre plads i akvariet på: man hugger dyr over med et sværd, og en stime hajer spiser stykkerne. Det skal være tegneserieagtigt og aldrig uhyggeligt, og det må ikke ske ved et uheld, fordi choppede dyr slettes for altid (også søskendes).

## Beslutning
- **Adgang:** sværd-knap i akvariet, der skal holdes nede i 2 sek. (en ring fylder op, som ved voksentilstandens lås). Et tryk på knappen igen afslutter. Samurai-mode afsluttes også selv efter 60 sek. uden hug.
- **Hug:** et swipe tegner et lysende sværdspor. Ethvert dyr, hvis krop sporet krydser på skærmen, deles i to.
- **Snit uden ny geometri:** dyrets krop vises som to kopier, hver med et klippeplan gennem huglinjen og kameraet, så hver kopi kun viser sin halvdel. Snitfladen er lukket med dyrets grundfarve (ingen blod, intet indvendigt). De to **stykker** får et lille skub væk fra hinanden, tumler og synker til bunds, hvor de ligger stille.
- **Sletning:** dyret slettes fra dyrelageret i det øjeblik, det hugges over. Stykker gemmes aldrig.
- **Rensehajer:** når 3 dyr er blevet hugget over (eller når samurai-mode afsluttes, og der ligger stykker), svømmer en stime på 4–5 grå **rensehajer** ind fra siden. De svømmer hen til stykkerne, snapper (kæben/hovedet nikker, stykket krymper og forsvinder i bobler med en "nam"-lyd) og svømmer ud igen, når alt er spist. Rensehajer **rører aldrig levende dyr** og viger for dem som andre svømmere. De er baggrundsliv, ikke tegnede dyr, og gemmes ikke.
- Tegnede hajer (arten haj) er fredelige dyr som alle andre og deltager ikke.

## Konsekvenser
- Samurai-mode er en legende sletning, som børn selv kan bruge; voksentilstandens sletning består.
- ~~Kun ét snit pr. dyr i v2~~ – ændret af [ADR 0011](0011-stykker-kan-hugges-igen.md): stykker kan hugges igen.
- Kameraets én-finger-træk er slået fra i samurai-mode (swipe = hug); knib-zoom virker stadig.
