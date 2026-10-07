# Ordliste (domænesprog)

Disse ord bruges ens i samtaler, dokumenter og kode. Kodenavnet står i parentes.
Når et nyt begreb opstår, tilføjes det her **før** det bruges i koden.

| Begreb | Kode | Betydning |
|---|---|---|
| **Art** | `Species` | En dyretype man kan vælge: i v1 **rokke** (`ray`) og **skildpadde** (`turtle`). En art har én skabelon og én svømmestil. |
| **Skabelon** | `Template` | Artens 2D-omrids set lige oppefra (ryggen), delt i én eller flere **dele**. Det er det barnet farvelægger, og det er grundlaget for kroppen. |
| **Del** | `Part` | Et stykke af skabelonen, der bliver sin egen bevægelige del af kroppen (skildpadde: skjold, hoved, fire luffer; rokke: krop og hale). Alle dele deler samme tegning. |
| **Artsvælger** | `SpeciesPicker` | Startvisningen hvor arterne svæver i bobler over akvariet; tryk på en boble for at begynde at tegne. |
| **Tegnefladen** | `DrawingPanel` | Visningen hvor skabelonen ligger stort og kan farvelægges. Ligger oven på akvariet, som kører dæmpet bagved. |
| **Farveblyant** | `Crayon` | Én af de 12 farver i bakken nederst til venstre. Den valgte blyant stikker længere frem end de andre. |
| **Grundfarve** | `baseColor` | Skabelonens lyse farve på ufarvede områder. Viskelæderet maler den tilbage. |
| **Viskelæder** | `Eraser` | Værktøj der maler skabelonens grundfarve tilbage. |
| **Fyld-spand** | `FillBucket` | Værktøj: tryk et sted inde i figuren, og det sammenhængende område i samme farve fyldes med den valgte farve. |
| **Stregtykkelse** | `BrushSize` | Tre faste tykkelser: tynd, mellem, tyk. |
| **Fortryd** | `undo()` | Fjerner seneste streg eller udfyldning (mindst 20 trin tilbage). |
| **Tegning** | `Drawing` | Det barnet har farvelagt – et billede i skabelonens format. Bliver dyrets **ryg**. |
| **Slip løs** | `release()` | Knappen der afslutter tegningen. Dyret skabes og svømmer ud i akvariet. |
| **Dyr** | `Creature` | Ét konkret, tegnet individ: art + tegning + oprettelsestidspunkt. Det er dyr der lever i akvariet og gemmes. |
| **Krop** | `Body` | 3D-formen der genereres ud fra skabelonens dele; tegningen ligger på ryggen. |
| **Bug** | `Belly` | Kroppens underside: tegningen i en lysere, blegere udgave – aldrig tegnet direkte. |
| **Akvariet** | `Aquarium` | 3D-scenen med bund, koraller, lys, baggrundsliv og alle dyrene. Kører altid. |
| **Baggrundsliv** | `AmbientLife` | Simple fiskestimer og bevægelige planter der ikke er tegnet af barnet og ikke gemmes. |
| **Rev** | `Reef` | Akvariets faste pynt på bunden: koraller, planter, sten og sand. Bygges i kode (seedet), ikke tegnet af barnet. |
| **Fiskestime** | `FishSchool` | Én flok af baggrundslivet (boids) der tegnes med instancing. Akvariet har flere stimer med hver sin fiskeart. |
| **Glædeshop** | `react()` | Det et dyr gør, når man trykker på det i akvariet: lille hop eller salto + bobler + lyd. |
| **Svømmer** | `Swimmer` | Bevægelsestilstanden for ét dyr i akvariet: position, retning, fart og næste mål. Ren logik uden tegning; styrer uden om sand, overflade, vægge og andre dyr. |
| **Overgang** | `Transition` | Øjeblikket efter Slip løs: den flade tegning bliver til krop på samme sted og i samme størrelse, folder sig ud, drejer og svømmer ind i akvariet. |
| **Loft** | `MAX_CREATURES` | Højst 30 dyr svømmer i akvariet. Ved nr. 31 tager det ældste dyr afsked. |
| **Dyrelager** | `CreatureStore` | Stedet på enheden (IndexedDB) hvor dyrene gemmes mellem besøg. Kun det barnet har tegnet gemmes: art, tegning (512×512 PNG) og oprettelsestidspunkt. |
| **Afsked** | `farewell()` | Når akvariet er fuldt og et nyt dyr kommer ind, svømmer det ældste dyr ud af billedet og slettes. |
| **Voksentilstand** | `AdultMode` | Skjult tilstand (hold låse-ikonet nede i 3 sek.), hvor man kan slette enkelte dyr. |

## Undgå

- *Fisk* som fællesbetegnelse – brug **dyr** (rokker og skildpadder er ikke fisk). "Fisk" bruges kun om baggrundslivet.
- *Model* om dyrene – vi har ingen 3D-modeller; brug **krop**.
- *Pensel*, *pen* – brug **farveblyant**.
- *Level*, *point*, *score*, *liv* – spillet har ingen af delene.
