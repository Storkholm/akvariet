# Akvariet – designdokument

> Et tegne- og akvariespil til børn på tablet og mobil. Man vælger et havdyr, farvelægger det med fingeren og slipper det løs i et levende 3D-akvarie, hvor alle de dyr man har tegnet, svømmer rundt.

Læs også: [CONTEXT.md](CONTEXT.md) (ordliste – brug de ord) · [docs/adr/](docs/adr/) (beslutninger) · [docs/reference/](docs/reference/) (fotos af forbilledet).

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

## 6. Uden for v1 (bevidst fravalgt)

Fælles akvarie på tværs af enheder · flere end to arter · fodring · kamerastyring · musik · konti/login · deling af tegninger · app-butikker.

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
