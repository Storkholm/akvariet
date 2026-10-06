# CLAUDE.md – arbejdsregler for dette repo

## Læs først
1. `DESIGN.md` – hvad vi bygger og i hvilken rækkefølge (milepæle i afsnit 5).
2. `CONTEXT.md` – ordlisten. Brug præcis de begreber og kodenavne i kode, filnavne, kommentarer og commit-beskeder. Opstår et nyt begreb, tilføjes det til CONTEXT.md i samme commit.
3. `docs/adr/` – trufne beslutninger. Afvig ikke fra dem uden at skrive et nyt ADR (`docs/adr/NNNN-kort-titel.md`, samme format) og nævne det i commit-beskeden.
4. `docs/reference/` – fotos af forbilledet. Se dem før arbejde på tegnefladen, overgangen og akvariet.

## Sådan arbejder du
- Byg **én milepæl ad gangen** i rækkefølgen i DESIGN.md. Hver milepæl ender spilbar, testet og committet med en besked der starter med `M<n>:`.
- **Verificér visuelt:** kør spillet i headless Chromium via Playwright med touch-emulering (tablet-format, f.eks. 1180×820, og mobil, f.eks. 390×844), tag skærmbilleder og se på dem, før en milepæl erklæres færdig. Gem de endelige skærmbilleder i `docs/screenshots/M<n>-*.png`.
- **Test logik** med Vitest (f.eks. klip ved omrids, fyld-spand, fortryd-stak, loft på 30 dyr, generering af krop).
- Hold runtime-afhængigheder til dem i ADR 0004.
- UI-tekst på dansk; kode og kommentarer på engelsk.
- Er noget i DESIGN.md uklart eller umuligt, så vælg den enkleste løsning der holder designprincipperne (afsnit 2), skriv valget under "Åbne spørgsmål" i DESIGN.md, og fortsæt.

## Kommandoer
(udfyldes i M0: `npm run dev`, `npm test`, `npm run test:e2e`, `npm run build`)
