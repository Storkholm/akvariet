import { h, svg } from './dom';
import { ICONS } from './icons';

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

/** Is the Fullscreen API there? (Android Chrome, iPad Safari, desktop – not Safari on iPhone.) */
export function fullscreenSupported(doc: FsDocument = document): boolean {
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

/** DESIGN 8.1: a square-with-arrows button next to the sound button; only exists where the Fullscreen API does. */
export class FullscreenButton {
  readonly element: HTMLButtonElement;

  constructor() {
    this.element = h('button', { class: 'fullscreen-btn', type: 'button', 'aria-label': 'Fuldskærm', hidden: !fullscreenSupported() });
    this.element.addEventListener('click', () => this.toggle());
    document.addEventListener('fullscreenchange', () => this.render());
    document.addEventListener('webkitfullscreenchange', () => this.render());
    this.render();
  }

  get isFullscreen(): boolean {
    const d = document as FsDocument;
    return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
  }

  private toggle(): void {
    const d = document as FsDocument;
    const root = document.documentElement as FsElement;
    try {
      const result = this.isFullscreen ? (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.()) : (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.());
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      /* the browser said no (e.g. not allowed here) – the game still works */
    }
  }

  private render(): void {
    const on = this.isFullscreen;
    this.element.setAttribute('aria-pressed', String(on));
    this.element.replaceChildren(svg(on ? ICONS.exitFullscreen : ICONS.fullscreen));
  }
}
