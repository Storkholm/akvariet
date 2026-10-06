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
  bucket: S(
    '<path d="M4.2 12.4 11 5.6a1.6 1.6 0 0 1 2.3 0l5.6 5.6a1.6 1.6 0 0 1 0 2.3l-5.4 5.4a1.6 1.6 0 0 1-2.3 0l-4.6-4.6" fill="#ffffff" stroke="#35507f" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.6 13.2h12.2" stroke="#35507f" stroke-width="1.4"/><path d="M20.4 14.4c1.3 1.7 2 2.8 2 3.7a2 2 0 0 1-4 0c0-.9.7-2 2-3.7z" fill="#2d9cf0" stroke="#1e6fb8" stroke-width=".8"/><path d="M4.2 12.4 8.6 8" stroke="#35507f" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  ),
  brush: (r: number): string => S(`<circle cx="12" cy="12" r="${r}" fill="currentColor"/>`),
  release: S(
    '<path d="M2.6 12c3.6-5.6 9.6-5.6 13.2 0-3.6 5.6-9.6 5.6-13.2 0z" fill="currentColor"/><path d="M15.2 12l5.2-4.4v8.8z" fill="currentColor"/><circle cx="7.2" cy="11" r="1.1" fill="#2f86d6"/>',
  ),
  yes: S('<path d="M5 12.5 10 17.5 19.5 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  no: S('<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>'),
  trash: S(
    '<path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.2a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
} as const;
