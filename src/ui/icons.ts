/** Inline SVG icons (the UI has no text except "Slip løs" and the throw-away question). */
const S = (inner: string, extra = ''): string =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" ${extra}>${inner}</svg>`;

export const ICONS = {
  home: S('<path d="M3.5 11.2 12 3.6l8.5 7.6V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" fill="currentColor"/>'),
  undo: S(
    '<path d="M9 5 4 10l5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10h8.5a5.5 5.5 0 0 1 0 11H10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  ),
  eraser: S(
    '<g transform="rotate(-38 12 12)"><rect x="2.5" y="7.5" width="19" height="9.5" rx="2.4" fill="#f59ab4"/><rect x="2.5" y="7.5" width="7.5" height="9.5" rx="2.4" fill="#ffffff"/><rect x="2.5" y="7.5" width="19" height="9.5" rx="2.4" fill="none" stroke="#4a5a78" stroke-width="1.1"/></g>',
  ),
  // A paint bucket tipped over to the left with a drop of paint falling out of its lip (readable for a 4-year-old).
  bucket: S(
    '<g transform="rotate(-38 13.5 12)"><path d="M5.2 6.6c.8-6.4 16.2-6.4 17 0" fill="none" stroke="#35507f" stroke-width="1.6" stroke-linecap="round"/><path d="M6.6 8.4 8.8 19.6a1.6 1.6 0 0 0 1.6 1.3h6.2a1.6 1.6 0 0 0 1.6-1.3l2.2-11.2z" fill="#ffffff" stroke="#35507f" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.5 12.4h13l-.9 4.6H8.5z" fill="#2d9cf0"/><ellipse cx="13.5" cy="8.4" rx="7.1" ry="2.3" fill="#9fd4ff" stroke="#35507f" stroke-width="1.5"/></g><path d="M4.2 13.2c1.6 2.2 2.5 3.6 2.5 4.8a2.5 2.5 0 0 1-5 0c0-1.2.9-2.6 2.5-4.8z" fill="#2d9cf0" stroke="#1e6fb8" stroke-width=".9" stroke-linejoin="round"/>',
  ),
  brush: (r: number): string => S(`<circle cx="12" cy="12" r="${r}" fill="currentColor"/>`),
  release: S(
    '<path d="M2.6 12c3.6-5.6 9.6-5.6 13.2 0-3.6 5.6-9.6 5.6-13.2 0z" fill="currentColor"/><path d="M15.2 12l5.2-4.4v8.8z" fill="currentColor"/><circle cx="7.2" cy="11" r="1.1" fill="#2f86d6"/>',
  ),
  yes: S('<path d="M5 12.5 10 17.5 19.5 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  no: S('<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>'),
  soundOn: S(
    '<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="currentColor"/><path d="M15.6 8.6a5 5 0 0 1 0 6.8M18.2 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ),
  soundOff: S(
    '<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  ),
  lock: S(
    '<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ),
  unlock: S(
    '<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ),
  fullscreen: S(
    '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  exitFullscreen: S(
    '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  trash: S(
    '<path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.2a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
} as const;
