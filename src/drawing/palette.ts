/** CONTEXT: Farveblyant – the 14 crayons in tray order (DESIGN 3.2, 8.1). Names are UI text (Danish). */
export interface CrayonDef {
  id: string;
  name: string;
  /** Display colour; for the rainbow crayon only a stand-in (its colour runs through the rainbow). */
  hex: string;
  rainbow?: boolean;
}

/** `Drawing.color` value that means "the rainbow crayon" (CONTEXT: Regnbueblyant). */
export const RAINBOW = 'rainbow';

export const CRAYONS: readonly CrayonDef[] = [
  { id: 'red', name: 'Rød', hex: '#e8332a' },
  { id: 'orange', name: 'Orange', hex: '#f58a1f' },
  { id: 'yellow', name: 'Gul', hex: '#f9d21e' },
  { id: 'lightGreen', name: 'Lysegrøn', hex: '#8fd43a' },
  { id: 'darkGreen', name: 'Mørkegrøn', hex: '#1f8f4a' },
  { id: 'turquoise', name: 'Turkis', hex: '#19bfb0' },
  { id: 'lightBlue', name: 'Lyseblå', hex: '#6cc4f2' },
  { id: 'darkBlue', name: 'Mørkeblå', hex: '#2150c8' },
  { id: 'purple', name: 'Lilla', hex: '#8a45c6' },
  { id: 'pink', name: 'Lyserød', hex: '#f7a6c8' },
  { id: 'brown', name: 'Brun', hex: '#8a5530' },
  { id: 'grey', name: 'Grå', hex: '#8d9096' },
  { id: 'black', name: 'Sort', hex: '#222226' },
  { id: 'rainbow', name: 'Regnbue', hex: '#e8332a', rainbow: true },
];

/** A stroke runs through one whole round of the rainbow per this many drawing pixels (DESIGN 8.1). */
export const RAINBOW_PERIOD = 600;
/** Number of distinct colours a rainbow stroke is quantised to (keeps the number of crayon-grain tiles small). */
export const RAINBOW_STEPS = 48;

/** The six horizontal bands the bucket paints with the rainbow crayon, top to bottom. */
export const RAINBOW_BANDS = ['#e8332a', '#f58a1f', '#f9d21e', '#3fb950', '#2f7bdc', '#8a45c6'] as const;

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): string => {
    const k = (n + h * 12) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Colour of the rainbow crayon after `distance` drawing pixels of stroke (one full round per RAINBOW_PERIOD). */
export function rainbowColor(distance: number, phase = 0): string {
  const t = (((distance / RAINBOW_PERIOD + phase) % 1) + 1) % 1;
  const step = Math.floor(t * RAINBOW_STEPS) / RAINBOW_STEPS;
  return hslToHex(step, 0.85, 0.55);
}

/** Band colour (index into RAINBOW_BANDS) for row `y` of a region spanning minY..maxY. */
export function rainbowBand(y: number, minY: number, maxY: number): number {
  const span = Math.max(1, maxY - minY + 1);
  return Math.min(RAINBOW_BANDS.length - 1, Math.max(0, Math.floor(((y - minY) / span) * RAINBOW_BANDS.length)));
}

/** CONTEXT: Stregtykkelse – three fixed widths, in pixels of the 1024×1024 drawing. */
export const BRUSH_SIZES = [10, 24, 50] as const;
export type BrushIndex = 0 | 1 | 2;
