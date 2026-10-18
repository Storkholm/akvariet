/** CONTEXT: Navn – at most this many characters (ADR 0009). */
export const MAX_NAME_LENGTH = 12;

/**
 * What a name may contain: letters (also æ ø å and other letters), digits and single spaces; no spaces at the ends; at most
 * `MAX_NAME_LENGTH` characters. Anything else is dropped (the name field never shows a rejected character).
 */
export function sanitizeName(raw: string): string {
  const kept = Array.from(raw.normalize('NFC'))
    .filter((c) => /[\p{L}\p{N} ]/u.test(c))
    .join('')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '');
  return Array.from(kept).slice(0, MAX_NAME_LENGTH).join('').replace(/ $/, '');
}

/** The name as it is kept on a creature: `undefined` when there is none. */
export function nameOrUndefined(raw: string | undefined | null): string | undefined {
  const n = sanitizeName(raw ?? '');
  return n === '' ? undefined : n;
}
