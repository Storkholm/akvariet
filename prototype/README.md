# PROTOTYPER (throwaway – hører ikke til i `main`)

Denne gren (`prototype/crowd-and-turtle`) er kun en **primærkilde**: den viser, hvordan to designspørgsmål blev besvaret.
Intet her er produktionskode. Det valgte svar skal flyttes ind i den rigtige kode (M4/M5), ikke denne mappe.

## Sådan kører du dem

```
git fetch origin
git checkout prototype/crowd-and-turtle
npm install            # første gang
npm run dev -- --host
```

Vite skriver to adresser. Åbn `…/prototype/crowd/` og `…/prototype/turtle/`:

- på din Mac: `http://localhost:5173/prototype/crowd/`
- på en telefon/iPad på samme Wi-Fi: `http://<din Macs IP>:5173/prototype/crowd/` (Vite viser "Network: …")

Gå tilbage til spillet bagefter: `git checkout claude/sweet-turing-ipk6th`.

---

## 1. `prototype/crowd/` – størrelse og trængsel (til M4)

**Spørgsmål:** Hvor store skal rokkerne være, og hvor trangt føles et akvarie med op til 30?

Det rigtige akvarium med de rigtige rokker og den rigtige svømning. Varianterne **A/B/C** (knapperne nederst eller piletasterne,
`?variant=`) er tre størrelser: A = som nu (4,2), B = mindre (3,0), C = større (5,5). Skyderne justerer størrelse, antal og loft.
"Tilføj dyr" ved fuldt loft lader det ældste dyr tage **afsked** (svømmer ud af billedet og slettes). Tallene (dyr, i billedet, FPS, trekanter,
draw calls) opdateres løbende – **FPS er kun meningsfuld på en rigtig enhed**.

Forenkling: rokkernes afstand til hinanden er en konstant i `src/creature/swimmer.ts` (7 enheder) og følger ikke størrelsesskyderen.

**Foreløbigt svar** (ud fra skærmbilleder, skal bekræftes på enhed): ved 30 dyr er 4,2 tæt pakket, 3,0 luftigt og 5,5 rod.
Forslag: start omkring 3,4 og vurder, om afstanden mellem dyrene skal følge størrelsen.

## 2. `prototype/turtle/` – skildpaddens seks overlappende dele (til M5)

**Spørgsmål:** Giver den eksisterende krop-generator (`src/body`) en pæn krop af en skabelon med seks overlappende dele (skjold, hoved, 4 luffer)?

Varianter: **A** alle dele pustet op omkring samme plan (som rokken), **B** hver del bygges for sig og hoved/luffer flyttes lidt ned under skjoldet,
**C** som B med tyndere luffer. Vinkler: ovenfra, skråt, forfra, fra siden, nedefra. "Net" viser trekanterne.

**Svar:** ja. Ingen huller, gennemskæringer eller z-fighting fra nogen vinkel; skildpadden er genkendelig. Variant B (separate dele, flyttet lidt ned) ser en anelse
pænere ud end A, og C er næsten ikke til at skelne. Det der mangler til M5 er ikke generatoren, men:
1. delene skal have et id i en vertex-attribut (i dag er der kun `flex` = afstand forbi omdrejningspunktet), så skjold, hoved og luffer kan bevæges hver for sig i shaderen;
2. luffernes rødder skal ligge lidt længere ind under skjoldet, så de ser fastgjort ud;
3. undersiden skal lysnes af bug-shaderen (her er den næsten sort, fordi prototypen bruger en almindelig Lambert-farve).
