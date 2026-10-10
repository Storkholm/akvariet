# Akvariet – designdokument

> Et tegne- og akvariespil til børn på tablet og mobil. Man vælger et havdyr, farvelægger det med fingeren og slipper det løs i et levende 3D-akvarie, hvor alle de dyr man har tegnet, svømmer rundt.

Læs også: [CONTEXT.md](CONTEXT.md) (ordliste – brug de ord) · [docs/adr/](docs/adr/) (beslutninger) · [docs/reference/](docs/reference/) (fotos af forbilledet).

> **Version 2 (M7–M13)** er beskrevet i [afsnit 8](#8-version-2--forbedringer-m7m13). Hvor afsnit 8 og afsnit 3–4 siger noget forskelligt, gælder afsnit 8.

## 1. Vision og forbillede

Forbilledet er en "digital akvarie"-installation fotograferet i Japan (se `docs/reference/`):

| Foto | Viser |
|---|---|
| `01-vaelg-dyr.jpg` | Arterne svæver i bobler over et levende akvarie |
| `02-tegn.jpg` | Tegnefladen: skabelonen set oppefra, farvekridt nederst, viskelæder, tykkelse, "færdig"-knap |
| `03-svoemmer-vaek.jpg` | Efter "færdig" svømmer rokken væk ind i dybet |
| `04-ankomst-i-boble.jpg` | Dyret ankommer i akvariet i en boble |
| `05`–`07` | Den tegnede rokke svømmer frit som bøjelig 3D-krop med tegningen på ryggen |

Vores version samler det hele på én skærm: akvariet kører altid, og tegnefladen ligger oven på det ([ADR 0003](docs/adr/0003-tegneflade-oven-paa-akvariet.md)).

## 2. Målgruppe og designprincipper

- **Børn ca. 4–10 år på tablet/mobil.** Touch først; mus og pen skal også virke.
- **Ingen læsning nødvendig.** Alle knapper er ikoner; den eneste tekst er "Slip løs" (stor knap med ikon).
- **Kan ikke gå galt.** Farve klippes ved omridset, alt kan fortrydes, intet kan slettes ved et uheld.
- **Rolig og legende.** Ingen point, ingen tid, ingen fejl. Tegnet stil frem for fotorealisme.
- **Tommelfingerregler:** trykflader ≥ 48 px, reaktion på input < 100 ms, 60 fps på en almindelig iPad / mellemklasse-Android.
- **Skærmretning:** liggende er primær; stående skal fungere (bakken nederst, figuren mindre).
- UI-tekst på **dansk**; kode, kommentarer og commit-beskeder på **engelsk**, men domænenavne følger kodekolonnen i CONTEXT.md.

## 3. Spilflow

```
[Artsvælger] --tryk på boble--> [Tegnefladen] --Slip løs--> [Overgang] --> [Akvariet m. artsvælger igen]
      ^                              |
      +-------- hjem-knap -----------+  (spørger "Smid tegningen væk?" hvis der er tegnet)
```

### 3.1 Artsvælger
- Akvariet kører i baggrunden, let dæmpet.
- Rokke og skildpadde svæver hver i sin gennemsigtige boble og vugger blidt. Dyrene i boblerne er ufarvede (grundfarve).
- Tryk på en boble → boblen "popper", og tegnefladen glider ind med den arts skabelon.

### 3.2 Tegnefladen
- Akvariet er sløret/dæmpet bagved; skabelonen ligger stort i midten, set lige oppefra, med en svag kontur og øjne som eneste detaljer. Ufarvede områder har en lys grundfarve.
- **Farveblyanter:** 12 blyanter i en bakke **nederst til venstre**, der stikker frem fra kanten. Den valgte blyant stikker tydeligt længere frem. Farver: rød, orange, gul, lysegrøn, mørkegrøn, turkis, lyseblå, mørkeblå, lilla, lyserød, brun, sort.
- **Værktøjer** (ved siden af bakken): viskelæder, fyld-spand, stregtykkelse (3 trin), fortryd.
- **Øverst til venstre:** lille hjem-knap.
- **Nederst til højre:** stor "Slip løs"-knap.
- Tegning sker med finger/mus/pen. Streger er bløde, let kridt-agtige (svag tekstur som på foto 02) og glatte (interpolér mellem pointer-punkter, også ved hurtige bevægelser).
- **Alt klippes ved omridset** – farve uden for figuren vises aldrig.
- **Fyld-spand** fylder det sammenhængende område i samme farve (med lidt tolerance), altid begrænset af omridset.
- **Fortryd** mindst 20 trin.
- Multitouch: kun én finger tegner; en finger mere ignoreres (ingen zoom i v1).

### 3.3 Slip løs (overgang)
1. Tegnefladens lag toner ud, mens akvariet bliver skarpt igen.
2. Den flade tegning erstattes af 3D-kroppen **på samme sted og i samme størrelse på skærmen** og "folder sig ud" (vinger/luffer begynder at bevæge sig).
3. Dyret drejer og svømmer ind i akvariet, som på foto 03.
4. Dyret gemmes ([ADR 0002](docs/adr/0002-dyr-gemmes-lokalt.md)). Er akvariet fuldt (30 dyr), tager det ældste dyr **afsked**.
5. Artsvælgeren dukker op igen efter et øjeblik.

### 3.4 Akvariet
- 3D-scene: sandbund, koraller og planter der bølger let, lysstråler oppefra, blå dybde med tåge.
- **Baggrundsliv:** et par simple fiskestimer (boids eller enkle baner) og bølgende planter. Det er pynt – de tegnede dyr er stjernerne.
- **Dyrene svømmer frit** inden for en usynlig kasse, undgår bund, overflade og hinanden blødt og vender sig naturligt. Hver art har sin svømmestil:
  - **Rokke:** langsomme, svævende vingeslag (bølge der løber fra krop ud mod vingespidser), let krængning i sving, halen slæber efter.
  - **Skildpadde:** roligt skjold; forluffer tager lange, synkrone tag, bagluffer styrer; hovedet drejer lidt i sving.
- **Tryk på et dyr → glædeshop:** lille hop eller salto, en sky af bobler og en lyd.
- **Kamera:** fast eller langsomt drivende; ingen kamerastyring for barnet i v1.

### 3.5 Voksentilstand
- Et lille, diskret låse-ikon i et hjørne. Holdes nede i 3 sek. → voksentilstand (synlig ramme).
- I voksentilstand: tryk på et dyr → "Slet dette dyr?" (ja/nej). Tryk på låsen igen for at afslutte.

### 3.6 Lyd
- Blid undervandsstemning (filtreret støj + af og til bobler), "pling" ved valg af blyant, "plask"/swoosh ved slip løs, bobler ved glædeshop.
- Alt genereres med Web Audio – ingen lydfiler. Lydknap (højttaler-ikon) i et hjørne; lyden starter først efter første tryk (browserkrav).

## 4. Teknisk design

Se [ADR 0001](docs/adr/0001-krop-genereres-fra-omrids.md) og [ADR 0004](docs/adr/0004-webspil-threejs-github-pages.md).

### 4.1 Skabeloner
- En skabelon beskrives i kode/data som en eller flere **dele**, hver med et **omrids** (polygon eller SVG-sti) i et fælles koordinatsystem (f.eks. 0–1 × 0–1), plus et **omdrejningspunkt** for dele der bevæges for sig.
  - Rokke: `body` (diamant-/vingeform) + `tail` (smal strimmel).
  - Skildpadde: `shell`, `head`, `flipperFL`, `flipperFR`, `flipperBL`, `flipperBR`.
- Skabelonen tegnes på tegnefladen som foreningen af alle dele. Tegningen er ét billede (f.eks. 1024 × 1024) der dækker hele skabelonen.
- En ny art tilføjes ved at skrive en ny skabelon + svømmeparametre – intet andet skal ændres.

### 4.2 Krop
- Hver del bliver til et mesh: omridset trianguleres med indre punkter, og punkterne "pustes op" (tykkelse aftager mod kanten, f.eks. ud fra afstand til kant), så kroppen er tyk i midten og tynd i kanterne.
- **UV = skabelonkoordinater**, så tegningen passer præcist på ryggen.
- **Bug:** undersiden bruger samme tekstur, men lysnet og afmættet (f.eks. blandet ~65 % mod en lys cremefarve) – i en shader eller som en afledt tekstur.
- **Svømning** laves i vertex-shaderen (eller ved at flytte punkter pr. frame): rokkens vinger bølger efter afstand fra midterlinjen; skildpaddens dele roterer om deres omdrejningspunkter.
- Kroppen skal kunne laves fra en tegning på under ca. 100 ms, så overgangen ikke hakker.

### 4.3 Data og gemning
```ts
interface Creature {
  id: string;           // uuid
  species: 'ray' | 'turtle';
  drawing: Blob;        // PNG/WebP af tegningen, f.eks. 512×512
  createdAt: number;    // ms
}
```
- Gemmes i IndexedDB. Ved start indlæses alle dyr og sættes ud i akvariet.
- Loft: 30 dyr. Ved nr. 31 tager det ældste afsked og slettes.

### 4.4 Ydeevne
- Mål: 60 fps med 30 dyr + baggrundsliv på en almindelig iPad.
- Tegning reduceres til 512 × 512 som tekstur i akvariet; baggrundsfisk tegnes med instancing.
- Renderingsopløsning begrænses (f.eks. `devicePixelRatio` max 2).

## 5. Milepæle

Hver milepæl skal ende med noget der kan spilles i browseren, være committet og (fra M0) udgivet.

| # | Indhold | Færdig når |
|---|---|---|
| **M0** | Projekt: Vite + TS + Three.js, lint, Vitest, Playwright, GitHub Actions → GitHub Pages | En tom blå scene er online |
| **M1** | Akvariet: bund, koraller, lys, tåge, baggrundsliv | Ser levende ud uden tegnede dyr |
| **M2** | Tegnefladen med rokke-skabelon: 12 farveblyanter, stregtykkelse, viskelæder, fyld-spand, fortryd, klip ved omrids, hjem-knap | Man kan farvelægge en rokke pænt med finger og mus |
| **M3** | Rokkens krop + Slip løs: generering, tekstur, bug, svømning, overgang | Den tegnede rokke svømmer i akvariet og ligner tegningen |
| **M4** | Gemning, loft på 30 med afsked, voksentilstand | Dyrene er der stadig efter genindlæsning |
| **M5** | Skildpadde + artsvælger med bobler | Begge arter kan vælges, tegnes og svømme |
| **M6** | Glædeshop, lyd, PWA/offline, finpudsning på rigtig tablet | Kan installeres på hjemmeskærmen og spilles offline |
| **M7** | Småting og sikkerhed (8.1): hold-nede Slip løs med 3-2-1, nyt fyld-spand-ikon, grå og regnbue-blyant, fuldskærm og hjælp i voksentilstand | Et dyr kan ikke slippes løs ved et uheld; 14 blyanter; fuldskærm virker på Android og iPad |
| **M8** | Kamera og karrusel (8.2–8.3): bredere akvarie, swipe/knib, følg dyr, artskarrusel med kigge-/tegne-knap | Man kan gå på opdagelse i et akvarie med 30 dyr uden trængsel og se det uden vælger |
| **M9** | Tegnefladen 2 (8.4): zoom, tegning i 1024, stempler, mønsterfyld, bakkesider med swipe og faner | Et barn kan zoome ind, tegne et øje og stemple stjerner på en rokke |
| **M10** | Navne (8.6): navnefelt, dyrelager v2, navn på bugen, navneskilt | Et navngivet dyr viser sit navn og har det stadig efter genindlæsning; v1-dyr virker stadig |
| **M11** | Fisk (8.5): sideskabeloner, klovnefisk, pufferfisk, haj | Tre nye arter kan vælges, tegnes og svømme; pufferfisken puster sig op |
| **M12** | Bunddyr (8.5): søstjerne (også på ruden), søpindsvin, søpølse | Bunddyrene kravler på sandet; søstjerner kravler af og til op på ruden |
| **M13** | Samurai-mode (8.7): sværd, hug, stykker, rensehajer, brøl | Tre hug kalder rensehajerne, som spiser stykkerne og aldrig levende dyr |

**Model pr. milepæl (v2):** Sonnet 5.5 med effort *high* til det hele. To milepæle har en kendt risiko, hvor Opus 5.5 kan være nødvendig: **M11** (kroppen pustes op til siderne og tegningen spejles) og **M13** (snittet med klippeplaner). Sessionen skriver selv `ANBEFALER OPUS:` i sin opsummering, hvis den kører fast (se CLAUDE.md).

## 6. Uden for v2 (bevidst fravalgt)

Fælles akvarie på tværs af enheder · fodring · musik · konti/login · deling af tegninger · app-butikker · flere hug i samme dyr · to forskellige sider på fisk · bunddyr der kravler op ad koraller.

## 7. Åbne spørgsmål

- Præcis kunstnerisk stil for akvariet (tegnet/blød vs. mere realistisk som forbilledet) – afgøres efter M1 ud fra skærmbilleder.
- Skal dyr kunne få et navn? (Kræver tekst – ikke i v1.)

### Valg truffet under bygningen (skal bekræftes)

- **M1 – akvariets stil:** vi gik med *blød, let lavpoly-tegnet* stil (Lambert-lys, glatte farver, vertex-farver) frem for realistisk. Forbilledets reb har langt mere detaljerede koraller; vores er enklere former (grenkoraller, kupler, bordkoraller, anemoner, græs) i mættede farver. Kan hæves senere uden at ændre resten, fordi hele revet er samlet i `src/aquarium/reef.ts`.
- **M1 – ydeevne er kun målt i software-GL:** revet er ca. 250.000 trekanter og 17–19 draw calls. Det burde være fint på en iPad, men kan ikke bekræftes uden en rigtig enhed (M6). Skal revet lettes, er det grenkoralerne (`maxDepth` i `addBranching`) der koster mest.
- **M1 – stående format:** i stående bruges bredere synsvinkel og kun ca. 10 enheder af revet i bredden, så højre og venstre rev ses delvist. Der er stadig noget bar sand nederst; justeres i `cameraRig.ts`, når tegnefladens layout er kendt.
- **M1 – tågefarve = baggrundens horisontfarve:** ellers dukker en mørk horisontlinje op. Ændres baggrunden, skal `FOG_COLOR` følge med.
- **M2 – fortryd-knappen sidder øverst til venstre ved siden af hjem** (som på foto 02), ikke ved siden af bakken som afsnit 3.2 skriver. Grunden: på 1024 px brede iPads og på mobil er der ikke plads til både 12 blyanter, seks værktøjer og "Slip løs" på én række. Flyttes let i `DrawingPanel.ts`.
- **M2 – bakken er en bred trælist nederst** (som på foto 02) med blyanterne stikkende op af kanten (valgt blyant ca. 26 px længere frem), værktøjerne på listen og "Slip løs" til højre. Under ca. 1100 px bredde ligger værktøjerne under blyanterne; i stående format (og under 760 px) ligger blyanterne i 2×6 og "Slip løs" har en række for sig.
- **M2 – stregtykkelser** er 10 / 24 / 50 px i den 1024 px store tegning (halen er kun ca. 26 px bred ved roden, så "tynd" skal kunne ramme den). Viskelæderet er 1,6 × bredere end blyanten.
- **M2 – kridttekstur er uigennemsigtig** (lysere/mørkere 2 px-felter af blyantens farve), ikke gennemsigtig: så ophobes der ikke farve ved overlap, og fyld-spanden kan ikke sive gennem en let streg. Fyld-spandens tolerance er 36 pr. kanal og den dækker anti-alias-kanten (ca. 1 px) ved streger.
- **M2 – fortryd** gemmer kun den ændrede firkant pr. trin (op til 30 trin) i stedet for hele 4 MB-billedet.
- **M2 – øjnene** ligger i et overlay *oven på* tegningen og er ikke en del af selve tegningen (`Drawing`). I M3 skal vi vælge, om kroppen får øjne som 3D-detalje eller om de males ind i teksturen.
- **M2 – "Smid tegningen væk?"** er den eneste tekst ud over "Slip løs" (som DESIGN 3.0 selv foreskriver); svarene er ikon-knapper (✓/✗).
- **M2 – artsvælgeren er en midlertidig platholder:** én boble med rokkens omrids i. Den rigtige artsvælger med 3D-dyr i bobler kommer i M5. "Slip løs" gemmer indtil videre bare tegningen i `app.lastRelease` og går tilbage til vælgeren – selve dyret kommer i M3.
- **M2 – kendt svaghed:** på en telefon på langs (844×390) bliver skabelonen kun ca. 210 px høj. Stående og tablet er verificeret med skærmbilleder.
- **M2 – testflag:** `?still` i URL'en pauser akvariets rendering. Det bruges kun af e2e-testene, fordi software-GL i containeren ellers æder hele hovedtråden og får touch-hændelser til at timeout'e.
- **M3 – skabelonen er ændret efter M2:** rokkens krop er presset ca. 18 % fladere og halen er forlænget fra ca. 25 % til ca. 42 % af skabelonens højde. Grunden er foto 02/05: skiven er ca. 1,8 × så bred som lang, og halen er næsten lige så lang som kroppen. Skabelonen er stadig 0–1 × 0–1, og M2-skærmbillederne er taget om. (Test: `tests/species.test.ts`.)
- **M3 – kroppens form:** hver del pustes op efter afstanden til omridset med en kvartcirkel-profil (stejl ved kanten, flad på toppen) og blødgøres lidt. Rokkens krop er 0,13 (ryg) og 0,07 (bug) skabelonenheder tyk i midten, dvs. ca. 20 % af vingefanget, og 0 ved kanten. Halen er næsten flad. Kroppen er 764 vertices / 1.338 trekanter, bygges på ca. 45 ms koldt (ca. 9 ms varmt) og deles af alle rokker. Tegningen er UV på ryggen (v = 1 − y), og den lyse bug er samme tekstur blandet 65 % mod creme med ekstra lys nedefra, så den ikke er sort i skyggen.
- **M3 – størrelse:** rokken svømmer med 4,2 verdensenheder pr. skabelonenhed (vingefang ca. 4). Det er stort nok til at man kan se sin tegning, men 30 rokker i kassen bliver trangt. Skal vurderes i M4, når loftet på 30 er der.
- **M3 – øjne:** øjnene males ind i *teksturen* ved bygning af kroppen (på samme sted som i tegnefladen). Den gemte tegning (`Creature.drawing`, 512×512) er stadig ren, så M4 gemmer kun det barnet har tegnet.
- **M3 – svømning:** vingerne bølger fra kroppen ud mod spidserne (bølgelængde ca. 6 enheder, spidserne hænger lidt), bagkanten haler ind efter forkanten, og halen svinger blødt med forsinkelse mod spidsen. Alt kører i vertex-shaderen; krængning i sving og tempo kommer fra `Swimmer`. Rokkerne holder sig ca. 3 enheder over sandet (revets toppe; hård grænse 2,5), og svømmekassens bredde følger skærmformatet, så et dyr ikke svømmer uden for billedet på en stående telefon.
- **M3 – overgangen** (3,4 s): kroppen ligger fladt over tegningen (afstanden til kameraet er regnet ud, så den dækker præcis tegningens firkant; kanten afviger under 1 px, testet), tegnelaget toner ud mens akvariet bliver skarpt (inden for ca. 0,7 s), vingerne folder sig ud (0,3–1,1 s), og kroppen svømmer langs en kurve væk fra beskueren, så perspektivet krymper den. Artsvælgeren kommer tilbage efter 1,9 s. Da banen er i verdensrum, følger den ikke kameraets langsomme drift efter starten.
- **M3 – ikke med endnu:** dyrene gemmes ikke (alt forsvinder ved genindlæsning), der er intet loft på 30 og ingen afsked – det er M4. Der er heller ingen glædeshop og ingen lyd (M6).
- **M3 – kendt svaghed / risiko til M5:** krop-generatoren er testet på rokken (en brem + en hale, der ikke overlapper meget). Skildpaddens seks overlappende dele kan give gennemskæringer, hvor delene mødes; det må løses med delenes tykkelse eller ved at lade luffer ligge under skjoldet.
- **M2 – stående telefon (feedback efter prøve på rigtig enhed):** hjem-knappen sidder øverst til venstre og fortryd-knappen øverst til *højre* (i liggende format ligger de stadig sammen øverst til venstre). De ser mindre ud (40 px), men trykfladen er stadig 48 px. Figuren får en reserveret stribe under dem og kan aldrig overlappe eller ligge under bunden (testet på seks størrelser fra 320×568 til 430×932). Blyanterne er mindre (52 × 56 px), så bunden fylder 273 px i stedet for 339.
- **M4 – gemning:** dyrene ligger i IndexedDB (via `idb-keyval`, som ADR 0004 nævner) i databasen `akvariet`, lageret `creatures`, ét objekt pr. dyr: `{ id, species, drawing: PNG 512×512 (uden øjne), createdAt }`. Der er ingen versionsstyring endnu (ingen migrering). Findes IndexedDB ikke (nogle private tilstande), virker spillet stadig, men glemmer ved genindlæsning. Fejl ved gemning vælter aldrig spillet. *Ikke prøvet på en rigtig iPad i privat browsing.*
- **M4 – afsked:** ved fuldt akvarie (30) svømmer det ældste dyr til nærmeste side, lidt væk fra beskueren, og slettes, når det er ude af billedet. Det slettes fra *lageret* med det samme afskeden begynder (ikke først når det er væk), så lageret aldrig har mere end 30. Lukkes siden midt i en afsked, kommer dyret altså ikke tilbage. Gamle dyr udover 30 i lageret (fx hvis loftet sænkes) ryddes ved indlæsning.
- **M4 – indlæsning:** gemte dyr dukker op på tilfældige steder ved start (de svømmer ikke ind fra siden). Kan pyntes i M6.
- **M4 – trængsel:** 30 rokker i størrelse 4,2 er tætpakket, og rokker overlapper ofte (se prototypen `prototype/crowd` på grenen `prototype/crowd-and-turtle`). Afstanden mellem dyrene er en fast konstant (7 enheder). Afgøres efter test på enhed: enten mindre rokker (ca. 3,4), eller at afstanden følger størrelsen.
- **M4 – voksentilstand:** låse-ikonet sidder nederst til venstre, er kun 50 % synligt og kræver 3 sekunders hold (en ring fylder op). Så kommer en orange ramme rundt om skærmen, og artsvælgeren viger. Tryk på et dyr → "Slet dette dyr?" med en miniature af tegningen og ✓/✗. Sletning er øjeblikkelig (ingen afsked-animation). Et almindeligt tryk på låsen afslutter. Låsen findes ikke, mens man tegner eller slipper et dyr løs.
- **M4 – tryk på dyr:** vælges med en stråle mod dyrets *uformede* krop, så ved vingespidserne kan der være en lille afvigelse fra det man ser. I normal tilstand sker der intet ved tryk på et dyr (glædeshop er M6).
- **M5 – skildpaddens skabelon** er bygget efter prototypen (`prototype/turtle`): skjold, hoved og fire luffer som glatte ellipser (skjoldet 0,48 bredt, med luffer ud til ca. 0,92 af skabelonen). Lufferne er rodfæstet godt ind under skjoldet, og hoved og luffer ligger en anelse *under* skjoldets plan. Er den forskydning på, mens kroppen endnu er flad? Nej: `lift` fjernes i shaderen, indtil dyret er foldet ud, så kroppen ved overgangens start ligger præcis over den flade tegning (testet: kanten afviger under 1 px for alle seks dele). Skildpaddens "skjoldmønster" kommer kun fra barnets tegning; der er ingen indbygget tegning af skjoldplader.
- **M5 – delene har id i shaderen:** kroppen har nu attributterne `part` (delens nummer), `pivot` (omdrejningspunkt) og `lift`; `flex` regnes nu langs hver dels egen retning fra omdrejningspunktet mod spidsen (ikke kun lodret), så den virker for både rokkens hale og skildpaddens luffer.
- **M5 – skildpaddens svømning:** forluffer tager lange synkrone tag (±0,55 rad om kroppens længdeakse, ca. 0,32 tag i sekundet, lidt frem og tilbage), bagluffer styrer (±0,3 rad, og drejer med i sving), hovedet drejer op til 0,5 rad ind i svinget og nikker langsomt, og kroppen hæver og sænker sig lidt med tagene. Den svømmer langsommere end rokken (0,7–1,2 mod 1,0–1,7 enheder i sekundet) og drejer langsommere. Alt i vertex-shaderen; tallene står i `src/species/turtle.ts`. *Ikke set i bevægelse på en rigtig enhed; kun stillbilleder og tal.*
- **M5 – artsvælgeren:** to 3D-bobler i selve akvariet (som foto 01), anbragt side om side i liggende format og over hinanden i stående. De er forankret til skærmen, så kameraets drift ikke flytter dem. Dyrene i boblerne er ufarvede, svømmer på stedet og vugger. Tryk → boblen popper (0,45 s, med små bobler), den anden toner ud, og tegnefladen glider ind 0,2 s efter. Tilbage vender boblerne med et lille hop. Over boblerne ligger usynlige runde knapper med navn ("Rokke", "Skildpadde"), så tastatur og skærmlæser virker. DESIGN 3.1 siger at akvariet er "let dæmpet" bag valget; det har jeg *ikke* gjort, fordi boblerne læser fint uden og akvariet er det der inviterer.
- **M5 – blandet akvarium:** rokker og skildpadder deler samme svømmekasse og undviger hinanden. På en stående telefon er kassen smal, og 12 dyr kan komme helt ned på ca. 0,5 enhed fra hinanden (testet); ved 30 dyr overlapper de, som det også ses ved rokker alene.
- **M6 – glædeshop:** et tryk på et dyr giver enten et hop (0,95 s, 60 %) eller en salto (1,4 s, 40 %) om vingeaksen, plus en sky af 28 bobler (`BubbleBursts`, en punkt-sprite-shader). Bevægelsen ligger oven på svømmeren, så dyret fortsætter sin kurs og ender præcis hvor det ville have været. Et dyr kan ikke reagere igen, mens det allerede reagerer, og ikke mens det slippes løs eller tager afsked. Små fingre rammer sjældent en lille rokke, så et tryk inden for ca. 30 px af dyrets midte tæller også (kun hvis strålen ikke rammer noget). Der sker intet i voksentilstand, mens man tegner eller under en overgang.
- **M6 – lyd:** alt er syntetiseret i `src/audio/sounds.ts` (opskrifter der tager en `BaseAudioContext`, så de også kan køres offline og måles). *Jeg kan ikke høre lyd her*, så karakteren er kun målt: hver lyd er hørbar (peak > 0,02), klipper ikke (peak < 0,95, desuden en kompressor på master), og dør ud inden for ca. 1 s. WAV-kopier af alle lyde ligger i `docs/sounds/` (genereres af `e2e/m6.spec.ts`), så de kan afspilles på en Mac. Farveblyanterne er 12 toner i en pentatonisk skala fra C4 (kun hele trin og lille terts, så hvad som helst klinger pænt), alle mellem 260 og 1.250 Hz, så intet er skingert. Den underliggende brummen er brun støj gennem et lavpasfilter (380 Hz) med en 0,07 Hz-bølge plus et svagt skær, og tilfældige små bobler hvert 2,5–7 sekund. Alle tal står øverst i `sounds.ts` og er lette at skrue på.
- **M6 – lyd, kendte begrænsninger:** browsere tillader først lyd efter et tryk, så alt er stille indtil det første tryk et vilkårligt sted (også på lydknappen). Mute huskes i `localStorage` (`akvariet.muted`). Faner i baggrunden suspenderer lyden, og slås lyd fra, suspenderes lydmotoren helt (batteri). iPad-kontakten for lydløs kan stadig dæmpe Web Audio – det kan ikke løses i koden. *Lydens karakter og styrke skal prøves på en rigtig enhed.*
- **M6 – lydknap:** øverst til højre, 44–48 px, `aria-pressed` = lyd tændt. På den stående telefon rykker den til siden for fortryd-knappen, når tegnefladen er åben (testet: ingen overlap).
- **M6 – PWA/offline:** `public/manifest.webmanifest` (dansk, `display: standalone`, ikoner 192/512 og et maskerbart 512) og ikoner genereret af `scripts/render-icons.mjs` ud fra rokkens skabelon (`public/icon.svg`). Der er ingen runtime-afhængighed: `vite.config.ts` skriver en lille håndskrevet service worker (`dist/sw.js`), som lægger alle byggede filer i en cache ved installation (cachenavnet er en hash af fillisten, så en ny version erstatter den gamle), svarer cache-først og falder tilbage til `index.html` ved navigation. Den registreres kun i produktionsbygget. Testet: Chromium finder ingen installationsfejl, og siden åbner offline *med* de gemte dyr (de ligger i IndexedDB). *Tilføjelse til hjemmeskærmen på en rigtig iPad (Del → Føj til hjemmeskærm) er ikke prøvet.* En ny version er først aktiv ved næste genindlæsning efter den er hentet (`skipWaiting` + `clients.claim` gør den aktiv straks, men siden kører stadig den gamle kode til den lukkes).
- **M6 – finpudsning:** gemte dyr vokser ind ét ad gangen (0,15 s imellem, højst 2,5 s i alt) i stedet for at stå der fra første billede; langt tryk (kontekstmenu), iOS' knibe-gestus og dobbelttryk-zoom er slået fra; skærmen auto-tilpasser opløsningen (`PixelRatioGovernor`): er billedet langsomt (> 24 ms pr. billede i 2 s i træk), sænkes pixeltætheden i trin à 0,8, aldrig under 1. *Billedrate på en rigtig iPad (mål 60 fps) er stadig ikke målt – software-GL i containeren siger intet om det.*
- **M6 – ikke gjort:** ingen separate lydvarianter at lytte til (A/B/C) – lyden kan ikke høres her, og et prototype-udvalg giver først mening, når du lytter selv. Hvis lyden ikke lyder rigtig, så sig hvad der er galt (for høj, for skinger, for mange bobler), så justerer jeg tallene.
- **M7 – nedtællingen kører på ægte tid, ikke akvariets ur** (`setInterval` hvert 30 ms + `performance.now()`), så den virker, også mens akvariet er sat på pause (`?still`) eller faner er langsomme. Et kort tryk viser et øjeblik et "3", som krymper væk, mens knappen vipper; selve afbrydelsen sker, når fingeren løftes eller glider uden for knappens rektangel (berøring "fanger" ellers fingeren på knappen, så vi tester positionen selv). Et almindeligt `click` (fx fra en skærmlæser) slipper **ikke** løs – kun den holdte nedtælling gør. Tastatur: hold Enter eller mellemrum.
- **M7 – ringen** om Slip løs-knappen er en `conic-gradient` på en ramme om knappen (altid svagt synlig som "hold mig", fyldes gult med uret under nedtællingen), ikke en SVG-streg: det passer til knappens afrundede hjørner uden at måle den.
- **M7 – tonerne i nedtællingen** er tre bløde plings (nodeindeks 7, 9, 11 i blyanternes skala), lidt runere og svagere end blyant-tonerne. *Kan ikke høres her – prøves på enhed.*
- **M7 – 14 blyanter ændrede lyden:** med 14 toner ville den pentatoniske skala fra C4 ramme ca. 1,57 kHz på regnbueblyanten. For at holde "intet skingert" (loft ca. 1,3 kHz fra M6) er grundtonen sænket til **A3 (220 Hz)**; tonerne ligger nu 220–1.318 Hz. Det betyder, at de første 12 blyanter lyder en lille terts dybere end i M6.
- **M7 – bakkens bredde:** 14 blyanter er bredere. Værktøjerne ligger nu *under* blyanterne (som på 1024-skærme før) op til 1359 px bredde, ikke kun under 1100 px; først på en 1366 px iPad Pro ligger de ved siden af. På stående telefon er blyanterne 2 × 7 og fylder (390 px) 51 px pr. stk.; på 360 px 48 px; **på 320 px kun ca. 42 px** (under de 48 px). 320 px brede skærme er sjældne, og det er den mindste sag at tage det forbehold.
- **M7 – regnbueblyanten:** farven skifter ved at stregen skæres i stumper på ca. 8 px, hver i sin farve (48 trin pr. runde, 600 px pr. runde); en streg starter et sted i regnbuen, der afhænger af hvor man sætter fingeren (ellers ville alle prikker være røde). Fyld-spanden giver **6 vandrette bånd** (rød, orange, gul, grøn, blå, lilla) fordelt over *områdets egen højde* – ikke tegningens – så selv et lille område (fx en luffe) får hele regnbuen. Bånd, ikke glidende overgang: det læser bedre for et barn og er en tydelig forskel fra stregen.
- **M7 – fuldskærm:** knappen findes kun, hvis `document.fullscreenEnabled` (eller Safaris `webkitFullscreenEnabled`) er sand; på iPhone i Safari er de falske, så den vises ikke (testet ved at forfalske egenskaberne; en rigtig iPhone er ikke prøvet). `manifest` har `display: fullscreen` + `display_override`. *Fuldskærm på en rigtig Android/iPad og den installerede app er ikke prøvet.*
- **M7 – voksenhjælpen** er en lille boks nederst i midten i voksentilstand. "Allerede installeret" afgøres med `display-mode: standalone | fullscreen | minimal-ui` og iOS' `navigator.standalone`. Teksterne om Guidet adgang/Fastgør app er skrevet ud fra hukommelsen og bør læses igennem af en voksen med en rigtig enhed (menunavne skifter mellem versioner).
- **M7 – fyld-spand-ikonet** er en hvid malerspand med blåt bånd, hanke og en dråbe, vippet 38°. Set i 6 × størrelse (`docs/screenshots/M7-fyld-spand-ikon.png`) er det genkendeligt; i 52 px er dråben det, der røber, at det er maling.
- **M8 – akvariets størrelse:** den bevægelige del er ±37,5 enheder (75 i alt = tre skærme på en liggende tablet, hvor ca. 25 enheder ses ved midten). Dyrene svømmer i hele bredden (±36); revet og sandet rækker til ±48, så kanten aldrig ses (kanten dækkes af store blå koralmasser ved ±43/±45). Kameraet kan højst glide, til billedets kant rammer ±37,5: på en tablet ±25 enheder fra midten ved zoom 1 og ±32,5 ved zoom 2,5, på en stående telefon ±32,5 og ±35,5. Op/ned: −1,8…+3 enheder fra hvilehøjden (kameraet kommer aldrig under 1,4–2 enheders højde, dvs. aldrig ned i sandet).
- **M8 – rev i bidder:** `buildReef` deler nu revet i bidder på 7 enheders bredde × 3 dybdebånd (foran z > 3, midten, bag ved z = −7), og hver bid er **ét mesh** (hårde koraller og sten har svajvægt 0 og bevæger sig ikke, så de kunne lægges sammen med de bløde). I stedet for three.js' kuglebaserede frustum-culling bruges en **boks pr. bid** (`Reef.cull`, kaldt hver frame): en lang bid har en enorm kugle, som aldrig bliver skåret væk. Samme teknik bruges til stimerne (`FishSchool.cull`). Midten (±24) er præcis v1's rev (samme seed, samme rækkefølge); det nye rev uden for er skrevet i samme stil (`EXTRA_PATCHES`) og er lidt lettere. Hvad der skulle til for at komme under v1's trekanttal: kun firkantede kviste (4 sider) og færre forgreningsniveauer på koraller langt væk eller langt ude til siden, sandet har 4-enheders felter (v1: 2), og boblernes skal har 36×22 segmenter (v1: 48×32). Hvad der skulle til for at holde draw calls nede (M1-testen kræver under 40): fast og blødt koral i ét mesh pr. bid, de 18 lysstråler i ét mesh (hver falmer med sin egen vertex-alfa), og de to glimt på en boble i ét mesh. Kompromiset mellem bidstørrelse og draw calls er målt: 5 enheder × 3 bånd gav 244.000 trekanter men 46 draw calls; 7 × 3 giver 248.000 og 39.
- **M8 – målt ydeevne** (headless Chromium med software-GL, tablet 1180×820 uden dyr, to bobler som i v1's måling – *ikke en rigtig iPad*): v1 tegnede **259.406 trekanter** og 28 draw calls hver frame (hele revet, også det uden for billedet). v2 tegner højst **247.738** trekanter, uanset hvor kameraet står (målt i 3 zoomniveauer × 14 vandrette × 2 lodrette positioner; alle tal i `docs/screenshots/M8-triangles.txt`), ned til ca. 97.000 ved fuld zoom ved kanten; stående telefon højst 197.494. **Draw calls:** 26–44 (v1: 28; 39 ved start i midten). Billedrate i den rigtige løkke med 30 dyr, software-GL: tablet 2,3 fps (v1: 2,2; 269.000 trekanter og 54 draw calls mod 278.000 og 42), telefon 5,8 (v1: 4,5; 238.000 og 59 mod 300.000 og 56) – absolutte tal siger intet om en rigtig enhed, men v2 er ikke langsommere end v1. *Billedraten på en rigtig iPad/Android er stadig ikke målt.*
- **M8 – baggrundslivet:** 8 nye stimer i hele bredden (rød-orange, sardiner, tang, bannerfisk – to af hver ude til siderne) ud over v1's fire; i alt ca. 310 fisk mod 180. De nye har mindre kasser og færre fisk, så en stime uden for billedet slet ikke tegnes. Lysstråler 18 (v1: 9, nu ét mesh, så de ikke skæres væk enkeltvis), havsne 520 punkter, 10 bobleudspring.
- **M8 – kameraets bevægelse** (`CameraRig` + `CameraControls`): ét fingers glid flytter kameraet 1:1 (`worldPerPixel`); slippes fingeren i fart, glider kameraet lidt videre (⅗ af fingerens fart, aftagende) og bremser blødt ved kanten, fordi målet klippes til kanten og selve kameraet glider efter. Knib zoomer omkring skærmens midte (ikke omkring fingrene), og midtpunktets bevægelse flytter også billedet; scrollhjul zoomer også omkring midten (ikke markøren). Zoom sker med linsens `zoom` (ikke ved at flytte kameraet), så kameraet aldrig kommer ind i dyrenes boks. En meget langsom drift (±0,9 enheder) er bevaret oven på. Et træk regnes fra 10 px; det der er bevæget før grænsen tæller med, så billedet ikke hopper.
- **M8 – dobbelttryk:** to tryk med højst 450 ms fra første løft til andet tryk og højst 44 px imellem. Det første tryk har allerede fået dyret til at hoppe, og dyret har flyttet sig, når det andet lander, så dobbelttrykket bruger *det dyr det første tryk ramte*. Dobbelttryk på tomt vand stopper følgningen. Følg-zoom er 2× for en rokke (større dyr følges lidt længere væk). Kameraet slipper dyret af sig selv efter 2 minutter uden berøring, eller hvis dyret forsvinder (slettes, tager afsked). **Navneskiltet** (8.2/8.6) er ikke med: det kommer i M10.
- **M8 – fuld teksturopløsning ved følg:** `Creature.setFullDetail` lægger tegningen i fuld størrelse på det fulgte dyr og går tilbage til 512×512, når følgningen stopper. Det virker kun for dyr, hvis fulde tegning stadig er kendt (et dyr, man har sluppet løs inden for det sidste minut); gemte dyr er 512×512 indtil M9 gemmer 1024 (ADR 0009) – så gør følg ingen synlig forskel for dem endnu.
- **M8 – kameraet holdes stille under tegning og udslip:** `rig.frozen` er sandt, fra man vælger en art, til tegnefladen lukker. Ellers kunne kameraet begynde at glide hjem (30 sek.) midt i overgangen, hvor kroppen ligger i verdensrum og skal ligge præcist over tegningen (testet med zoom 2,2×: kanten afviger under 1 px). Overgangen starter altså, hvor kameraet står, og dyret svømmer ind i den del af akvariet, man ser (testet).
- **M8 – afsked:** det ældste dyr svømmer nu mod den nærmeste side *af billedet* (set fra kameraet), ikke af akvariet; er det uden for billedet, fjernes det med det samme.
- **M8 – karrusellen:** `SpeciesCarousel` (HTML) + `CarouselScroll` (ren logik) + 3D-boblerne i `PickerBubbles`. Ca. 3 bobler ses på tablet, 1½ på en stående telefon, afstanden følger skærmbredden; bobleradius er højst 17 % af højden (mindst 120 px på alle testede skærme, også 320×568 og 844×390). Et swipe i båndet ruller med fart og lander altid med en boble i midten (eller ved enden); to bobler på en tablet ruller ikke, de ligger i midten. Ud over enden giver rækken kun en tredjedel af vejen og springer tilbage. Tastaturfokus på en boble ruller den ind. Båndet fanger kun swipes inden for rækken – resten af skærmen er kameraets. Artsrækkefølgen er nu rokke, skildpadde (som DESIGN 8.3), ikke skildpadde, rokke som i M5. **Der er kun 2 arter endnu**, så karrusellen kan ikke prøves med 8 i det rigtige spil: **testflag `?bubbles=8`** gentager arterne til 8 pladser (som `?still` kun brugt af testene og screenshots).
- **M8 – kigge-/tegne-knappen** sidder nederst til højre (64 px) og har samme plads i begge tilstande; den er væk, mens man tegner og i voksentilstand. Når rækken foldes væk, falder boblerne ud af bunden efter hinanden (0,6 s + 0,07 s pr. boble) og er så usynlige og uden tryk-flader; tilbage kommer de på samme pladser (testet). Øje og blyant er tegnet som ikoner (blyanten er gul med lyserødt viskelæder). Tryk-fladen på bobler og knapper følger boblerne mens de folder, ruller og vender tilbage.
- **M8 – voksentilstand og kamera:** slette-spørgsmålet åbnes nu kun af et *tryk* (ikke af et swipe); kameraet kan flyttes i voksentilstand.
- **M8 – ikke gjort / ikke prøvet:** rigtig enhed (fingre, fart, billedrate); knib *omkring fingrene* (kun omkring midten); at zoome ud over 1× (ikke ønsket); en skærm bredere end ca. 1,8:1 (zoom 1 viser da mere end en tredjedel). Det faste billede ved start er midten af akvariet; dyr indlæst fra lageret ligger spredt over hele bredden og kommer ind ét ad gangen, også de uden for billedet.
- **M13 – bygget før M9–M12** (Martin bad om det): samurai-mode virker på de to arter, der findes (rokke, skildpadde). Den er skrevet, så den kan bruges på alle kroppe, men to ting skal kontrolleres, når M11/M12 kommer: (1) *hit-testen* (`CreatureManager.crossed`) projicerer skabelonens omrids oppefra, som for `top`-arter; for `side`-arter (ADR 0005) skal omridset i stedet gå gennem sidekroppen. (2) *Bunddyr* ligger på sandet og kan hugges som alle andre (de har ingen særregel i ADR 0008).
- **M13 – snittet** (`Fragment`, `cutPlane`; risikoen i planen): et swipe giver et plan gennem kameraet og swipe-linjen (kryds af to stråler). Det fungerer uden ny geometri: dyret erstattes af to kopier af den samme krop, hver klippet af sit eget plan (`material.clippingPlanes`, `renderer.localClippingEnabled`; planen er fastgjort til kroppen, så den følger stykket, når det flytter og tumler). Snitfladen er lukket ved, at skallen set indefra (bagsiderne) males i artens grundfarve (`gl_FrontFacing`), så man ser en flad, lys flade – ingen indre, intet blod. Kroppen er en tynd, lukket skal, så det ser rigtigt ud; set meget skråt kan man se igennem den tynde kant. *Det virkede på første forsøg og ser rent ud på skærmbillederne (`docs/screenshots/M13-*`), så der er ikke brug for Opus til denne del.* Linjens retning tages fra et punkt mindst 36 px bagud på sporet, så en rystende finger giver en rolig linje; to dyr, som samme swipe krydser, deles langs samme plan.
- **M13 – hvad der krydses:** swipet rammer et dyr, når det skærer eller ligger inden i et af dyrets projicerede delomrids (rokke: krop + hale; skildpadde: skjold, hoved og luffer hver for sig, så et hug mellem to luffer ikke rammer). Omridset er den *flade* skabelon; vingernes bølgeslag og skildpaddens luffeslag er ikke med, så kanten kan afvige med nogle få pixel. Kun dyr, der svømmer frit, kan hugges (ikke et, der slippes løs, tager afsked eller vokser ind). Hvert dyr kan kun hugges én gang (stykkerne er ikke dyr).
- **M13 – stykkerne:** skubbes 0,9 enheder/sek. væk fra hinanden (vandret langs planens retning), tumler lidt, synker højst 0,9 enheder/sek. (vand bremser) og lægger sig fladt på ryggen 0,18 over sandet inden for ca. 0,8 sek. efter landing. De ligger, til en rensehaj har spist dem (ingen tidsfrist). Stykker deler tekstur og krop; teksturen frigives, når begge halvdele er væk. De gemmes aldrig, og dyret slettes fra dyrelageret i samme øjeblik, det hugges (testet: efter genindlæsning er der ingen stykker, og dyret er væk).
- **M13 – rensehajerne** (`CleanupSharks`): 5 grå hajer (3,2 enheder lange, samme krop som baggrundsfiskene med grå ryg og lys bug), ét instanced mesh. De kommer ind fra *begge sider af det, barnet ser* (uden for billedet), tager nærmeste ledige stykke hver (ét stykke pr. haj), nikker med hovedet, bider (stykket skrumper væk på 0,6 sek. med 26 bobler) og tager næste. Når der ikke er flere, svømmer de ud til hver sin side og forsvinder. Tælleren (3 hug) nulstilles, når de er væk; stykker, der kommer til, mens de er der, spises også. **Levende dyr røres aldrig:** hver haj styrer udenom alle levende dyr (dyrets halve størrelse + 1,9) og skubbes ud, hvis den alligevel kommer for tæt (0,7 × afstanden). Målt i e2e med to dyr lige ved stykkerne: nærmeste afstand fra en hajs midte til et dyrs midte var aldrig under dyrets radius + 1,2. Hajerne svømmer ikke under sandet (mindst 0,45 over).
- **M13 – adgang og afslutning:** sværd-knappen (56 px, øverst til venstre; en gul ring fylder op i løbet af 2 sek.) er væk, mens man tegner og i voksentilstand, og låsen er væk, mens samurai-mode er tændt – de to er aldrig tændt samtidig. Starten folder karrusellen væk og skjuler kigge-knappen (efter afslutning kommer de tilbage, som de var), slår kameraets ét-fingers-træk fra (knib zoomer stadig, to fingre afbryder et hug) og spiller gong. Et tryk på et dyr gør ingenting i samurai-mode (ingen glædeshop, ingen følg). 60 sek. uden hug afslutter; tallet kan ændres i e2e via `session.idleLimit`, og 60 er testet i enhedstesten (`SamuraiSession`).
- **M13 – lyd:** *kan ikke høres her.* Gong (lav klokke, fire toner, 2,6 sek.), "ping" (to høje toner, en kvint fra hinanden) og swoosh ved hvert hug laves i kode. Brøl: `kiai-1.mp3`, `kiai-2.mp3` fra Martin (2,5 og 1,3 sek.) – tilfældigt, aldrig det samme to gange. **Kun to brøl af de fire, ADR 0007 nævner**; koden bruger dem, der findes (1–4), så flere kan lægges i mappen uden ændringer. Haj-lyde (`haj-1`, `haj-2`; 3,5 og 4,3 sek.): se [ADR 0010](docs/adr/0010-indtalte-lyde-til-rensehajer.md). Mangler filerne, bruges koden-lyde (testet med blokerede filer). Optagelsernes styrke i forhold til resten er ikke justeret (de spilles på 0,9) – prøv på enhed.
- **M13 – ikke gjort / ikke prøvet:** hugget på en rigtig enhed (fingerens fart, om sporet føles som en klinge); lydbalance; en finger, der bliver liggende uden at bevæge sig, hugger ikke (kræver bevægelse). Mange stykker (op til 60) er ikke målt for ydeevne; i praksis kommer hajerne ved tredje hug, så der ligger sjældent mere end ca. 6.
- **Efter M13 (feedback fra Martin, 2026-10-10):**
  - *Brøllet kom for sent:* optagelserne har 0,2–0,4 sek. stilhed først i filen (målt med ffmpeg `silencedetect`). Spillet finder nu første hørbare sample (`leadingSilence`, grænse 0,02, 15 ms før) og starter afspilningen derfra – for både brøl og haj-lyde. Filerne er uændrede.
  - *Baggrundslyden stoppede:* kunne ikke genskabes her (ingen rigtig enhed). Sandsynlig årsag: browseren/telefonen sætter lyden på pause uden besked (opkald, skærmlås, hukommelse), og spillet genoptog kun ved synlighedsskift og tryk. Der er nu en vagthund hvert 3. sekund, som genoptager lyden, hvis den ikke kører og siden er synlig og ikke slået fra. *Ikke bekræftet på en rigtig iPad.*
  - *Flere snit:* stykker kan hugges igen og igen (ADR 0011), loft 40 stykker.
  - *Hvid blyant:* 15. blyant, placeret efter sort og før regnbue (ikke bag regnbuen, som skal stå sidst). Brættet i højformat har nu 5 pr. række (3 rækker à 5; 8 pr. række ville give under 48 px brede blyanter på en 390 px telefon). Tonen er den 15. i skalaen (ca. 1,48 kHz; testloftet hævet til 1,5 kHz). Basisfarven er næsten hvid (#f1f4f6), så hvid kan næsten ikke ses på det blanke dyr – den er til streger og prikker ovenpå andre farver (og som 'viskelæder' ovenpå farve; det rigtige viskelæder maler stadig basisfarven tilbage).

## 8. Version 2 – forbedringer (M7–M13)

Bygget på ønsker fra test med børn (oktober 2026). Beslutninger: [ADR 0005](docs/adr/0005-sideskabeloner-til-fisk.md)–[0009](docs/adr/0009-dyrelager-v2-navn-og-stoerre-tegning.md). Designprincipperne i afsnit 2 gælder stadig: ingen læsning nødvendig, kan ikke gå galt, rolig og legende. Nye trykflader er også ≥ 48 px.

### 8.1 Småting og sikkerhed (M7)

**Slip løs skal holdes nede.** Børn kom til at slippe dyr løs uden at ville det.
- Et tryk gør ingenting ud over en lille "hold mig"-vippen og en ring der viser, at knappen skal holdes.
- Mens knappen holdes, tæller et stort **3 – 2 – 1** ned midt på skærmen (0,5 sek. pr. tal, i alt 1,5 sek.), med en blød tone pr. tal. Ringen om knappen fylder op samtidig.
- Slippes knappen (eller glider fingeren af den) før nedtællingen er færdig, krymper tallet væk, og intet sker.
- Når nedtællingen når til ende, starter overgangen som i 3.3. Mus: hold museknappen nede. Tastatur: hold Enter/mellemrum nede.
- **Nedtælling** (`ReleaseCountdown`) testes med Vitest (afbrydelse, fuldførelse) og e2e (et kort tryk slipper intet løs).

**Fyld-spand-ikon:** det nuværende ikon ligner ikke en spand. Nyt ikon: en tydelig malerspand, der hælder, med en dråbe, der falder ud – genkendeligt for et barn på 4 år.

**To nye farveblyanter** – i alt 14:
- **Grå**, placeret mellem brun og sort.
- **Regnbue** (sidst i bakken; blyanten selv er stribet i regnbuens farver). Stregens farve løber gennem regnbuen langs stregens længde (én hel runde pr. ca. 600 px i tegningen). Fyld-spanden med regnbue fylder området med vandrette regnbuebånd. Stempler (8.4) i regnbue får hver sin farve.
- Bakken skal stadig passe på 1024 px brede iPads og stående telefoner (fx 2 × 7 på telefon).

**Fuldskærm** – børnene kommer let væk fra siden:
- `manifest.webmanifest`: `"display": "fullscreen"` med `"display_override": ["fullscreen", "standalone"]`, så den installerede app på Android er i fuldskærm og iOS falder tilbage til standalone.
- **Fuldskærm-knap** (firkant med pile) ved siden af lydknappen, men kun hvor Fullscreen API findes (Android Chrome, iPad Safari, computer). På iPhone i Safari vises den ikke.
- I **voksentilstand** vises en lille hjælpeboks (voksentekst er tilladt her) med: "Læg spillet på hjemmeskærmen" (iOS: Del → Føj til hjemmeskærm; Android: menu → Installer app) og "Lås barnet inde i spillet" (iOS: Guidet adgang; Android: Fastgør app). Den vises ikke, når spillet allerede kører installeret.

### 8.2 Bredere akvarie, kamera og følg dyr (M8)

Se [ADR 0006](docs/adr/0006-bredere-akvarie-og-kamera.md).
- Akvariet er ca. 3 skærmbredder bredt. Revet bygges i bidder, så kun det synlige tegnes; baggrundslivet fordeles i hele bredden.
- **Én finger** (eller mus-træk): glid til siden og lidt op/ned. **Knib** (eller scrollhjul): zoom 1×–2,5×. Kameraet bremser blødt ved kanterne og kan aldrig komme uden for akvariet eller under sandet.
- **Dobbelttryk på et dyr** (eller dobbeltklik): kameraet følger dyret i passende afstand, dyrets navneskilt vises (8.6), og dyret får fuld teksturopløsning. Et swipe eller dobbelttryk på tom plads stopper følgningen.
- Efter 30 sek. uden berøring glider kameraet roligt tilbage til midten (ikke mens det følger et dyr – så stopper følgningen først efter 2 min).
- Glædeshop ved kort tryk virker som før. Et træk regnes først fra ca. 10 px bevægelse.
- Ydeevne: det synlige antal trekanter må ikke overstige v1's. Mål og skriv tallene i "Åbne spørgsmål".

### 8.3 Artskarrusel og kigge-knap (M8)

Erstatter artsvælgeren i 3.1. Der bliver 8 arter.
- **Karrusel** (`SpeciesCarousel`): boblerne ligger på en vandret række, man swiper i (med fart og fast "snap" til en boble). Ca. 3 bobler ses ad gangen på tablet, ca. 1½ på stående telefon. Kun det bånd, karrusellen fylder, reagerer på swipe som karrusel; uden for båndet styrer swipe kameraet.
- Boblerne er stadig 3D og forankret til skærmen, med ufarvede dyr der svømmer på stedet. Tryk = pop og tegnefladen, som før.
- **Kigge-knap** (`ViewToggle`, et øje): folder karrusellen væk (boblerne svæver ned og ud), så man kan se akvariet frit. Knappen skifter da til en **tegne-knap** (en blyant), som folder karrusellen frem igen. Knappen sidder samme sted hele tiden (nederst til højre, så den ikke kolliderer med låsen nederst til venstre).
- Rækkefølge i karrusellen: rokke, skildpadde, klovnefisk, pufferfisk, haj, søstjerne, søpindsvin, søpølse (de nye kommer med i M11/M12).

### 8.4 Tegnefladen 2: zoom, stempler og mønstre (M9)

**Zoom:**
- **Knib** med to fingre zoomer 1×–4× omkring midten af fingrene; **to fingre trækker** flytter rundt. Én finger tegner altid. Lander en anden finger midt i en streg, fjernes stregen igen (så knib aldrig efterlader en streg).
- **Dobbelttryk med to fingre** (eller en lille "hele dyret"-knap, der kun vises, når man er zoomet ind): tilbage til hele dyret.
- Mus: scrollhjul zoomer omkring markøren; træk med mellemste knap eller mellemrum+træk flytter.
- **Stregtykkelserne er i skærm-pixel**, så en tynd streg bliver tyndere i tegningen, når man zoomer ind – det er det, der gør detaljer mulige. Det gælder også viskelæder og stempler.
- Tegningen er 1024 × 1024 og gemmes nu i fuld størrelse ([ADR 0009](docs/adr/0009-dyrelager-v2-navn-og-stoerre-tegning.md)).

**Bakkesider (`TrayPage`):** bakken har to sider – **blyanter** og **mønstre**. Man skifter ved at swipe bakken til siden eller trykke på to små faner på bakkens venstre kant (et blyant- og et stjerne-ikon); den aktive fane er tydelig. Den valgte farve gælder på begge sider og vises som en farveklat på mønstersiden.

**Stempler (`Stamp`)** – ca. 10 figurer: stjerne, hjerte, prik, blomst, øje, skæl, sol, måne, lyn, smil. Tryk sætter ét stempel i den valgte farve; træk lægger en række stempler med jævn afstand. Størrelsen følger stregtykkelsen (og zoom). Stempler klippes ved omridset og kan fortrydes som én handling pr. tryk/træk.

**Mønsterfyld (`PatternFill`)** – 4 mønstre: striber, prikker, skæl, zigzag. Virker som fyld-spanden (samme område og tolerance), men fylder med mønstret i den valgte farve oven på områdets nuværende farve. Mønstret ligger i tegningens koordinater (ikke skærmens), så det ser ens ud uanset zoom.

### 8.5 Nye arter (M11 og M12)

Alle nye arter tilføjes som skabelon + svømmeparametre (4.1). Bemærk at **`side`-skabeloner** er nye ([ADR 0005](docs/adr/0005-sideskabeloner-til-fisk.md)).

| Art | Kode | Skabelon | Bevægelse |
|---|---|---|---|
| Klovnefisk | `clownfish` | side: krop, halefinne, rygfinne, bugfinne | Hurtig, kvik; korte sving; holder sig gerne nær revet |
| Pufferfisk | `pufferfish` | side: rund krop, lille hale, små finner | Langsom, "vralter" med små finner. **Glædeshop:** puster sig op til en kugle med små pigge i 2 sek. og bliver normal igen |
| Haj | `shark` | side: krop, halefinne (høj øvre lap), rygfinne, brystfinner | Langsom, rolig, glidende; større end de andre (ca. 1,4 × rokken). Fredelig – spiser aldrig noget |
| Søstjerne | `starfish` | top: midte + fem arme | **Bunddyr.** Kravler meget langsomt på sandet med bløde armbevægelser. Af og til kravler den op på **ruden** (se nedenfor) |
| Søpindsvin | `seaUrchin` | top: rund krop | **Bunddyr.** Ruller/kravler langsomt. Får 3D-pigge (instancing), farvet efter tegningen ved piggens rod, der vifter let |
| Søpølse | `seaCucumber` | top: aflang krop | **Bunddyr.** Kravler med en bølge, der løber gennem kroppen (strækker og trækker sig sammen) |

**Bunddyr (`Crawler`):** bevæger sig på sandets overflade (følger dens højde og hældning), undgår koraller og hinanden og forlader aldrig bunden. De tæller med i loftet på 30. Overgangen efter Slip løs ender med, at de daler blødt ned på sandet.

**Ruden (`Glass`):** et usynligt plan lige foran kameraets udgangsposition. En søstjerne kan (ca. hvert 2.–3. minut, højst én ad gangen) kravle hen til forreste kant af sandet, op på ruden og langsomt hen over den, med **ryggen mod beskueren** (kunstnerisk frihed: barnet skal se sin tegning), og ned igen. Rudens søstjerne flytter sig ikke med kameraet; den sidder på akvariets forrude.

### 8.6 Navne (M10)

- **Navnefelt** på tegnefladen: et lille felt med "Aa" øverst i midten. Tryk åbner tastaturet; højst 12 tegn (bogstaver inkl. æøå, tal, mellemrum). Feltet er valgfrit. Skabelonen må ikke skjules af tastaturet på telefon (rul/skalér, mens tastaturet er åbent).
- Navnet gemmes på dyret ([ADR 0009](docs/adr/0009-dyrelager-v2-navn-og-stoerre-tegning.md)).
- **På bugen:** for `top`-arter, der svømmer (rokke, skildpadde), skrives navnet midt på bugen i en mørkere tone af bugens farve, så det kan læses, når man ser dyret nedefra (ikke spejlvendt).
- **Navneskilt (`NameTag`):** en lille afrundet skilt-boble, der svæver over dyret i 3 sek. ved glædeshop og hele tiden, mens kameraet følger det. Gælder alle arter. Dyr uden navn har intet skilt.
- Voksentilstandens slette-dialog viser navnet ved miniaturen.

### 8.7 Samurai-mode (M13)

Se [ADR 0008](docs/adr/0008-samurai-snit-og-rensehajer.md) og [ADR 0007](docs/adr/0007-indtalte-lydfiler.md).
- **Sværd-knap** (`SamuraiMode`) i akvariet (øverst til venstre). Holdes nede i 2 sek. (ring fylder op). Ved start: et gong, en tynd rød-guld ramme om skærmen, karrusellen folder sig væk, og kamera-træk slås fra (knib virker stadig). Et tryk på sværdet igen, eller 60 sek. uden hug, afslutter.
- **Hug (`slash`):** swipe tegner et lysende hvidt sværdspor, der falmer på 0,3 sek. Dyr, hvis krop sporet krydser, deles i to **stykker** (`Fragment`) langs hugget: rent snit, snitfladen lukket i dyrets grundfarve, ingen blod. Stykkerne glider lidt fra hinanden, tumler og synker til bunds. Bobler og et "pling".
- **Brøl (`Kiai`):** ved hvert hug et tilfældigt indtalt brøl + swoosh. Mangler filerne, kun swoosh.
- Dyret slettes fra dyrelageret ved hugget. Stykker gemmes aldrig.
- **Rensehajer (`CleanupSharks`):** ved 3 huggede dyr (eller ved afslutning, hvis der ligger stykker) kommer 4–5 grå hajer ind fra siden, spiser stykkerne (snap, stykket krymper i bobler, "nam") og svømmer ud. De rører aldrig levende dyr og viger for dem. Tælleren nulstilles, når de er gået.
- **Optagelser:** Martin lægger `kiai-1.mp3` … `kiai-4.mp3` i `public/sounds/`. Er de der ikke, når M13 bygges, så byg med swoosh-fallback og skriv det under "Åbne spørgsmål".

### 8.8 Stadig åbne valg fra v1

- Dæmpning af akvariet bag artsvælgeren (3.1) blev ikke lavet – den gælder ikke længere, da karrusellen kan foldes væk.
- Ydeevnen på en rigtig iPad er stadig ikke målt; M8 skal skrive målte tal (fps, trekanter, draw calls) ind under "Åbne spørgsmål", målt i headless-browseren som det bedste vi har.
