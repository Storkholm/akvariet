# Ordliste (domænesprog)

Disse ord bruges ens i samtaler, dokumenter og kode. Kodenavnet står i parentes.
Når et nyt begreb opstår, tilføjes det her **før** det bruges i koden.

| Begreb | Kode | Betydning |
|---|---|---|
| **Art** | `Species` | En dyretype man kan vælge. v1: **rokke** (`ray`), **skildpadde** (`turtle`). v2: **klovnefisk** (`clownfish`), **pufferfisk** (`pufferfish`), **haj** (`shark`), **søstjerne** (`starfish`), **søpindsvin** (`seaUrchin`), **søpølse** (`seaCucumber`). En art har én skabelon og én svømmestil. |
| **Skabelon** | `Template` | Artens 2D-omrids, delt i én eller flere **dele**. Det er det barnet farvelægger, og det er grundlaget for kroppen. Har en **retning**. |
| **Retning** | `view: 'top' \| 'side'` | Hvordan skabelonen ses: `top` = oppefra (ryggen; rokke, skildpadde, bunddyr), `side` = fra venstre side (fisk; tegningen spejles på begge sider). ADR 0005. |
| **Bunddyr** | `Crawler` | Art der kravler på sandet i stedet for at svømme (søstjerne, søpindsvin, søpølse). Følger sandets højde og hældning, går udenom koralpletter og hinanden, forlader aldrig bunden og tæller med i loftet. Efter Slip løs daler de blødt ned på sandet. |
| **Ruden** | `GlassClimb` | Akvariets usynlige forrude, som søstjerner af og til kravler op på, bliver et stykke tid og kravler ned fra igen. Tegnes oven på alt andet; kan ikke følges eller hugges, mens den sidder der. |
| **Del** | `Part` | Et stykke af skabelonen, der bliver sin egen bevægelige del af kroppen (skildpadde: skjold, hoved, fire luffer; rokke: krop og hale). Alle dele deler samme tegning. |
| **Artsvælger** | `SpeciesCarousel` | Startvisningen hvor arterne svæver i bobler over akvariet; tryk på en boble for at begynde at tegne. Fra v2 en **karrusel** (v1's `SpeciesPicker` er erstattet). |
| **Karrusel** | `SpeciesCarousel` | Artsvælgerens vandrette række af bobler, man swiper i. |
| **Kigge-knap / tegne-knap** | `ViewToggle` | Én knap: som øje folder den karrusellen væk, så man kan se akvariet; som blyant folder den den frem igen. |
| **Kamera** | `CameraRig` | Det man ser akvariet igennem. Kan glide langs akvariet (én finger) og zoome 1×–2,5× (knib); glider tilbage efter 30 sek. og kan aldrig forlade akvariet. ADR 0006. |
| **Følg** | `follow()` | Dobbelttryk på et dyr: kameraet følger det, og navneskiltet vises. |
| **Boble** | `PickerBubbles` | Den gennemsigtige kugle med et ufarvet dyr i (3D), som artsvælgeren består af. Tryk på den, så popper den, og tegnefladen kommer frem. |
| **Tegnefladen** | `DrawingPanel` | Visningen hvor skabelonen ligger stort og kan farvelægges. Ligger oven på akvariet, som kører dæmpet bagved. |
| **Farveblyant** | `Crayon` | Én af de 15 farver i bakken nederst til venstre (v2: + grå, hvid og regnbue). Den valgte blyant stikker længere frem end de andre. |
| **Regnbueblyant** | `rainbow` | Blyant hvis farve løber gennem regnbuen langs stregen. |
| **Bakkeside** | `TrayPage` | Bakken har to sider – blyanter og mønstre – som man skifter mellem med swipe eller små faner. |
| **Stempel** | `Stamp` | En figur (stjerne, hjerte …) der sættes med ét tryk i den valgte farve. |
| **Mønsterfyld** | `PatternFill` | Som fyld-spanden, men fylder med et mønster (striber, prikker, skæl, zigzag). |
| **Zoom** | `DrawingZoom` | Knib/to-finger-træk på tegnefladen, 1×–4×. Stregtykkelser er i skærm-pixel. |
| **Navn** | `name` | Valgfrit navn på et dyr (højst 12 tegn), skrives i navnefeltet på tegnefladen. |
| **Navneskilt** | `NameTag` | Lille skilt over et dyr med dets navn, ved glædeshop og når kameraet følger det. |
| **Nedtælling** | `ReleaseCountdown` | Det store 3-2-1 midt på skærmen, mens man holder Slip løs nede. Slipper man før tid, sker intet. |
| **Grundfarve** | `baseColor` | Skabelonens lyse farve på ufarvede områder. Viskelæderet maler den tilbage. |
| **Viskelæder** | `Eraser` | Værktøj der maler skabelonens grundfarve tilbage. |
| **Fyld-spand** | `FillBucket` | Værktøj: tryk et sted inde i figuren, og det sammenhængende område i samme farve fyldes med den valgte farve. |
| **Stregtykkelse** | `BrushSize` | Tre faste tykkelser: tynd, mellem, tyk. |
| **Fortryd** | `undo()` | Fjerner seneste streg eller udfyldning (mindst 20 trin tilbage). |
| **Tegning** | `Drawing` | Det barnet har farvelagt – et billede i skabelonens format. Bliver dyrets **ryg**. |
| **Slip løs** | `release()` | Knappen der afslutter tegningen. Fra v2 skal den holdes nede under nedtællingen. Dyret skabes og svømmer ud i akvariet. |
| **Dyr** | `Creature` | Ét konkret, tegnet individ: art + tegning + oprettelsestidspunkt (+ evt. navn). Det er dyr der lever i akvariet og gemmes. |
| **Krop** | `Body` | 3D-formen der genereres ud fra skabelonens dele; tegningen ligger på ryggen. |
| **Bug** | `Belly` | Kroppens underside: tegningen i en lysere, blegere udgave – aldrig tegnet direkte. |
| **Akvariet** | `Aquarium` | 3D-scenen med bund, koraller, lys, baggrundsliv og alle dyrene. Kører altid. |
| **Baggrundsliv** | `AmbientLife` | Simple fiskestimer og bevægelige planter der ikke er tegnet af barnet og ikke gemmes. |
| **Rev** | `Reef` | Akvariets faste pynt på bunden: koraller, planter, sten og sand. Bygges i kode (seedet), ikke tegnet af barnet. Fra v2 bygget i **bidder** langs bredden, så kun det synlige tegnes (ADR 0006). |
| **Fiskestime** | `FishSchool` | Én flok af baggrundslivet (boids) der tegnes med instancing. Akvariet har flere stimer med hver sin fiskeart. |
| **Glædeshop** | `react()` | Det et dyr gør, når man trykker på det i akvariet: lille hop (60 %) eller salto (40 %) + bobler (`BubbleBursts`) + lyd. Et tryk lige ved siden af tæller også. |
| **Svømmer** | `Swimmer` | Bevægelsestilstanden for ét dyr i akvariet: position, retning, fart og næste mål. Ren logik uden tegning; styrer uden om sand, overflade, vægge og andre dyr. |
| **Pigge** | `UrchinSpikes` | Søpindsvinets 3D-pigge (instancing), farvet efter tegningen ved hver piggs rod; de vifter let. |
| **Overgang** | `Transition` | Øjeblikket efter Slip løs: den flade tegning bliver til krop på samme sted og i samme størrelse, folder sig ud, drejer og svømmer ind i akvariet. |
| **Loft** | `MAX_CREATURES` | Højst 30 dyr svømmer i akvariet. Ved nr. 31 tager det ældste dyr afsked. |
| **Dyrelager** | `CreatureStore` | Stedet på enheden (IndexedDB) hvor dyrene gemmes mellem besøg. Kun det barnet har tegnet gemmes: art, tegning (v2: 1024×1024 PNG), navn og oprettelsestidspunkt. ADR 0009. |
| **Afsked** | `farewell()` | Når akvariet er fuldt og et nyt dyr kommer ind, svømmer det ældste dyr ud af billedet og slettes. |
| **Lyd** | `AudioEngine` | Alle lyde, lavet med Web Audio i koden (ingen lydfiler): en blød tone pr. farveblyant (15 toner i en pentatonisk skala fra A3) og en tone pr. tal i nedtællingen, svup ved Slip løs, pop ved boblen, bobler ved glædeshop, bloop ved sletning og en svag underlig brummen i vandet. Starter først efter første tryk; lydknappen (højttaler, øverst til højre) slår det fra, og valget huskes. |
| **Voksentilstand** | `AdultMode` | Skjult tilstand (hold låse-ikonet nede i 3 sek.), hvor man kan slette enkelte dyr og få hjælp til fuldskærm. Er aldrig tændt samtidig med samurai-mode. |
| **Samurai-mode** | `SamuraiMode` | Tilstand (hold sværd-knappen i 2 sek.), hvor swipe er sværdhug. ADR 0008. |
| **Hug** | `slash()` | Ét sværdhug: et lysende spor; dyr det krydser, deles i to stykker og slettes. |
| **Stykke** | `Fragment` | En del af et hugget dyr. Synker til bunds; gemmes aldrig. Kan hugges igen og igen (ADR 0011; højst 40 ad gangen). |
| **Rensehajer** | `CleanupSharks` | Grå baggrundshajer, der kommer efter 3 hug og spiser stykkerne. Rører aldrig levende dyr. Ikke det samme som arten **haj**. |
| **Brøl** | `Kiai` | Familiens indtalte samurai-brøl (lydfiler `kiai-1…4.mp3`, ADR 0007). |
| **Nam** | `nam()` | Lyden, når en rensehaj bider et stykke: familiens optagelser (`haj-1…4.mp3`, ADR 0010), ellers en lille lyd lavet i kode. |
| **Sværdspor** | `.slash-trail` | Det lysende hvide spor, et swipe tegner i samurai-mode; falmer på 0,3 sek. |

## Undgå

- *Fisk* som fællesbetegnelse – brug **dyr** (rokker og skildpadder er ikke fisk). "Fisk" bruges kun om baggrundslivet.
- *Model* om dyrene – vi har ingen 3D-modeller; brug **krop**.
- *Pensel*, *pen* – brug **farveblyant**.
- *Level*, *point*, *score*, *liv* – spillet har ingen af delene (heller ikke i samurai-mode).
- *Dræbe*, *dø*, *blod* – i samurai-mode bliver dyr **hugget over** til **stykker**.
- *Haj* om rensehajerne – det er **rensehajer**; **haj** er en art børnene tegner.
