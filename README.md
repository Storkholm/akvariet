# Akvariet 🐢

Et tegne- og akvariespil til børn: vælg et havdyr, farvelæg det med fingeren, og slip det løs i et levende 3D-akvarie.

- [DESIGN.md](DESIGN.md) – designdokument og milepæle
- [CONTEXT.md](CONTEXT.md) – ordliste
- [docs/adr/](docs/adr/) – beslutninger

## Kør det

```sh
npm install
npm run dev       # dev-server (Vite)
npm test          # Vitest (logik)
npm run test:e2e  # Playwright: bygger, kører headless Chromium med touch, gemmer skærmbilleder i docs/screenshots/
npm run build     # produktionsbuild til dist/ (inkl. sw.js til offline)
npm run preview   # prøv produktionsbygget, fx på iPad via http://<mac-ip>:4173 med --host
```

Produktionsbygget lægges på GitHub Pages af `.github/workflows/pages.yml` og kan installeres på hjemmeskærmen (Del → Føj til hjemmeskærm) og spilles offline. Lydene kan høres uden spillet som WAV-filer i [docs/sounds/](docs/sounds/).

