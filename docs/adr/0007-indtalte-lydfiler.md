# 0007 – Indtalte lydfiler til samurai-brøl

**Status:** Besluttet (2026-10-09). Undtagelse fra ADR 0004 ("ingen lydfiler").

## Kontekst
Samurai-mode skal have et brøl ("Hai-yaa!", "Kiai!"), når man hugger. En stemme kan ikke laves overbevisende med Web Audio.

## Beslutning
- Familien indtaler 3–4 brøl selv. De ligger som korte lydfiler i `public/sounds/kiai-1.mp3` … `kiai-4.mp3` (mp3 virker i Safari og Chrome; under 100 KB pr. fil).
- Ved hvert hug afspilles et tilfældigt brøl (dog ikke det samme to gange i træk) sammen med det kodelavede sværd-swoosh.
- Filerne indlæses først, når samurai-mode åbnes første gang, og caches af PWA'en til offline-brug.
- **Mangler filerne**, bruges kun swoosh. Spillet må aldrig fejle på grund af en manglende lydfil.
- Alle andre lyde laves fortsat i kode.

## Konsekvenser
- Ingen licensproblemer – optagelserne er familiens egne.
- (Udvidet af ADR 0010: også `haj-N.mp3`.) Martin uploader filerne via GitHub ("Add file → Upload files" i mappen `public/sounds/`).
