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
