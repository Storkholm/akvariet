# 0004 – Webspil med Three.js, udgivet på GitHub Pages

**Status:** Besluttet (2026-10-06). Lydfiler: se undtagelsen i ADR 0007.

## Kontekst
Spillet er til børn på tablet/mobil og skal også virke med mus. Det skal kunne bygges og testes af Claude Code i en cloud session uden en rigtig enhed.

## Beslutning
- **Vite + TypeScript + Three.js.** Tegnefladen er almindelig HTML/Canvas 2D oven på Three.js-scenen.
- **Pointer Events** til al input, så finger, pen og mus håndteres ens.
- **PWA** (installerbar på hjemmeskærmen, virker offline).
- **IndexedDB** til gemte dyr (via `idb-keyval` eller tilsvarende lille bibliotek).
- **Lyd genereres med Web Audio** (ingen lydfiler, ingen licenser).
- **GitHub Pages** via GitHub Actions ved push til `main`.
- **Test:** Vitest til logik og Playwright (headless Chromium med touch-emulering) til flowet og skærmbilleder.

## Konsekvenser
- Ingen app-butik, ingen server, ingen login.
- GitHub Pages fra et **privat** repo kræver et betalt GitHub-abonnement. Med en gratis konto skal repoet gøres offentligt før udgivelse (der er ingen hemmeligheder i projektet).
- Nye runtime-afhængigheder ud over ovenstående kræver et nyt ADR.
