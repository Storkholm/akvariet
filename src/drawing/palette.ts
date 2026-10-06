/** CONTEXT: Farveblyant – the 12 crayons in tray order (DESIGN 3.2). Names are UI text (Danish). */
export interface CrayonDef {
  id: string;
  name: string;
  hex: string;
}

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
  { id: 'black', name: 'Sort', hex: '#222226' },
];

/** CONTEXT: Stregtykkelse – three fixed widths, in pixels of the 1024×1024 drawing. */
export const BRUSH_SIZES = [10, 24, 50] as const;
export type BrushIndex = 0 | 1 | 2;
