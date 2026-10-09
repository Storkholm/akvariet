# 0010 – Indtalte lyde til rensehajernes "nam"

**Status:** Besluttet (2026-10-09). Udvider [ADR 0007](0007-indtalte-lydfiler.md).

## Kontekst
Martin lagde fire optagelser i `public/sounds/`: to brøl (`kiai-1.mp3`, `kiai-2.mp3`) og to lyde til, når rensehajerne spiser (`haj-1.mp3`, `haj-2.mp3`). ADR 0007 nævner kun brøl, og at der kunne være 3–4 af dem.

## Beslutning
- Samme regler som i ADR 0007 gælder for alle optagelser: familiens egne, korte mp3-filer i `public/sounds/`, indlæses først når samurai-mode åbnes, caches af PWA'en, og **mangler de, bruger spillet kun en lyd lavet i kode** – spillet fejler aldrig på en manglende fil.
- **To slags optagelser:** `kiai-N.mp3` (brøl ved hvert hug) og `haj-N.mp3` (når en rensehaj bider et stykke). Spillet leder efter `<navn>-1.mp3` … `<navn>-4.mp3` og bruger dem, der findes; der må altså gerne komme flere, uden at koden ændres. Der er ikke krav om fire – to af hver virker.
- Et tilfældigt brøl pr. hug, aldrig det samme to gange i træk. Mangler brølene: sværdets swoosh og ping. Mangler haj-lydene: et blødt "nam" lavet i kode.
- Haj-optagelserne er 3–4 sekunder lange, og fem hajer bider ofte inden for få sekunder. Mens én optagelse stadig spiller, er næste bid derfor lydløst (visuelt sker det stadig), så det ikke bliver et virvar.

## Konsekvenser
- Filerne er lidt større end ADR 0007's 100 KB (de to haj-lyde er 140 og 170 KB). Det er stadig små og forsvinder ved siden af resten af spillet (JS ca. 170 KB gzip).
- Nye optagelser lægges bare i mappen (Add file → Upload files) – de bliver hentet ved næste byg/indlæsning.
