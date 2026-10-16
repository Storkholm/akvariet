import { Drawing, DRAWING_SIZE } from '../drawing/Drawing';
import { CRAYONS, RAINBOW, type BrushIndex } from '../drawing/palette';
import { PATTERNS, patternCoverage, type PatternId } from '../drawing/patterns';
import { drawStamp, STAMPS, type StampId } from '../drawing/stamps';
import { MAX_NAME_LENGTH, sanitizeName } from '../creature/name';
import { clampView, IDENTITY_VIEW, isZoomed, panView, windowToDrawing, zoomAround, type View } from '../drawing/viewTransform';
import { getTemplate, type Species, type Template } from '../species';
import { h, svg } from './dom';
import { ICONS } from './icons';
import { ReleaseCountdown } from './releaseCountdown';
import { drawTemplate } from './thumbnail';

type Tool = 'crayon' | 'eraser' | 'bucket' | 'stamp' | 'pattern';
type Page = 'crayons' | 'patterns';

/**
 * CONTEXT: Tegnefladen. HTML layer on top of the (dimmed) aquarium: the template large in the
 * middle, a tray of 14 crayons bottom-left, tools on the tray, home/undo top-left, "Slip løs" bottom-right.
 */
export class DrawingPanel {
  readonly element: HTMLElement;
  onHome?: () => void;
  onRelease?: (drawing: Drawing, species: Species, name: string) => void;
  /** A crayon was picked by the child (not the automatic first one when the panel opens). */
  onCrayon?: (index: number) => void;
  /** A number of the "Slip løs" countdown appeared (3, 2, 1). */
  onCountdown?: (n: number) => void;

  private drawing: Drawing | null = null;
  private template: Template | null = null;
  private species: Species | null = null;
  private activePointer: number | null = null;
  private tool: Tool = 'crayon';
  private crayonIndex = 0;

  private readonly stage: HTMLElement;
  private readonly canvasWrap: HTMLElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly crayonButtons: HTMLButtonElement[] = [];
  private readonly eraserButton: HTMLButtonElement;
  private readonly bucketButton: HTMLButtonElement;
  private readonly brushButtons: HTMLButtonElement[] = [];
  private readonly confirm: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly releaseButton: HTMLButtonElement;
  private readonly releaseWrap: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private readonly countdown: ReleaseCountdown;
  private holdTimer: number | undefined;
  private holdPointer: number | 'key' | null = null;
  /** Zoom of the drawing surface (DESIGN 8.4) and the side of the square window it is seen through (CSS px). */
  private view: View = IDENTITY_VIEW;
  private side = 600;
  /** Every finger or button on the surface: one draws, two zoom and slide. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: { distance: number; mx: number; my: number; started: number; travelled: number } | null = null;
  /** After a pinch the last finger must lift before anything draws again. */
  private locked = false;
  private lastTwoFingerTap = 0;
  private panning: { id: number } | null = null;
  private spaceHeld = false;
  private page: Page = 'crayons';
  private readonly fitButton: HTMLButtonElement;
  private readonly nameInput: HTMLInputElement;
  private readonly tabButtons: Record<Page, HTMLButtonElement>;
  private readonly crayonsEl: HTMLElement;
  private readonly patternsEl: HTMLElement;
  private readonly patternButtons = new Map<string, HTMLButtonElement>();
  private readonly stampButtons = new Map<string, HTMLButtonElement>();
  private readonly swatch: HTMLButtonElement;
  private patternId: PatternId = 'stripes';
  private stampId: StampId = 'star';
  private suppressClickUntil = 0;

  constructor() {
    const homeButton = h('button', { class: 'round-btn home-btn', type: 'button', 'aria-label': 'Hjem' }, [svg(ICONS.home)]);
    this.undoButton = h('button', { class: 'round-btn undo-btn', type: 'button', 'aria-label': 'Fortryd', disabled: true }, [svg(ICONS.undo)]);

    this.fitButton = h('button', { class: 'fit-btn', type: 'button', 'aria-label': 'Hele dyret', hidden: true }, [svg(ICONS.fit)]);
    const tabCrayons = h('button', { class: 'round-btn tab-btn', type: 'button', 'aria-label': 'Blyanter', 'aria-pressed': true }, [svg(ICONS.pageCrayons)]);
    const tabPatterns = h('button', { class: 'round-btn tab-btn', type: 'button', 'aria-label': 'Mønstre og stempler', 'aria-pressed': false }, [svg(ICONS.pagePatterns)]);
    this.tabButtons = { crayons: tabCrayons, patterns: tabPatterns };
    const tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Bakkens sider' }, [tabCrayons, tabPatterns]);
    tabCrayons.addEventListener('click', () => this.setPage('crayons'));
    tabPatterns.addEventListener('click', () => this.setPage('patterns'));

    // CONTEXT: Navn – a small "Aa" field at the top: tap, type (at most 12 characters), done. Optional.
    this.nameInput = h('input', { class: 'name-input', type: 'text', placeholder: 'Aa', 'aria-label': 'Navn', autocomplete: 'off', autocapitalize: 'words', spellcheck: false, enterkeyhint: 'done', maxlength: String(MAX_NAME_LENGTH * 2) });
    this.nameInput.addEventListener('input', () => {
      const clean = sanitizeName(this.nameInput.value);
      // (A space at the end is allowed while typing: the next letter must be able to follow it.)
      const trailing = /[ ]$/.test(this.nameInput.value) && clean.length < MAX_NAME_LENGTH && clean !== '' ? ' ' : '';
      if (this.nameInput.value !== clean + trailing) this.nameInput.value = clean + trailing;
    });
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.nameInput.blur();
      }
    });
    this.nameInput.addEventListener('focus', () => this.setTyping(true));
    this.nameInput.addEventListener('blur', () => this.setTyping(false));

    this.overlay = h('canvas', { class: 'template-overlay' });
    this.canvasWrap = h('div', { class: 'canvas-wrap' }, [this.overlay, this.fitButton]);
    this.stage = h('div', { class: 'stage' }, [this.canvasWrap]);

    // --- tray with crayons ---
    const crayons = h('div', { class: 'crayons', role: 'radiogroup', 'aria-label': 'Farveblyanter' });
    CRAYONS.forEach((def, i) => {
      const b = h('button', { class: 'crayon', type: 'button', role: 'radio', 'aria-label': def.name, 'aria-checked': i === 0, 'data-rainbow': def.rainbow, style: def.rainbow ? undefined : `--c:${def.hex}` }, [
        h('span', { class: 'crayon-tip' }),
        h('span', { class: 'crayon-body' }, [h('span', { class: 'crayon-band' })]),
      ]);
      b.addEventListener('click', () => this.selectCrayon(i));
      this.crayonButtons.push(b);
      crayons.append(b);
    });
    this.crayonsEl = crayons;

    // --- the second page of the tray: patterns and stamps (DESIGN 8.4) ---
    const patterns = h('div', { class: 'patterns', role: 'group', 'aria-label': 'Mønstre og stempler' });
    this.swatch = h('button', { class: 'swatch', type: 'button', 'aria-label': 'Farve: tilbage til blyanterne' });
    this.swatch.addEventListener('click', () => this.setPage('crayons'));
    patterns.append(this.swatch);
    for (const p of PATTERNS) {
      const b = h('button', { class: 'pick-btn', type: 'button', 'aria-label': `Mønster: ${p.name}`, 'aria-pressed': false }, [h('canvas', { width: 64, height: 64 })]);
      b.addEventListener('click', () => this.pickPattern(p.id));
      this.patternButtons.set(p.id, b);
      patterns.append(b);
    }
    for (const s of STAMPS) {
      const b = h('button', { class: 'pick-btn stamp-btn', type: 'button', 'aria-label': `Stempel: ${s.name}`, 'aria-pressed': false }, [h('canvas', { width: 64, height: 64 })]);
      b.addEventListener('click', () => this.pickStamp(s.id));
      this.stampButtons.set(s.id, b);
      patterns.append(b);
    }
    this.patternsEl = patterns;

    // --- tools ---
    this.eraserButton = h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Viskelæder', 'aria-pressed': false }, [svg(ICONS.eraser)]);
    this.bucketButton = h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'Fyld-spand', 'aria-pressed': false }, [svg(ICONS.bucket)]);
    this.eraserButton.addEventListener('click', () => this.setTool(this.tool === 'eraser' ? 'crayon' : 'eraser'));
    this.bucketButton.addEventListener('click', () => this.setTool(this.tool === 'bucket' ? 'crayon' : 'bucket'));

    const brushGroup = h('div', { class: 'brush-group', role: 'radiogroup', 'aria-label': 'Stregtykkelse' });
    ([['Tynd', 3], ['Mellem', 5.5], ['Tyk', 8.5]] as const).forEach(([name, r], i) => {
      const b = h('button', { class: 'brush-btn', type: 'button', role: 'radio', 'aria-label': name, 'aria-checked': i === 1 }, [svg(ICONS.brush(r))]);
      b.addEventListener('click', () => this.setBrush(i as BrushIndex));
      this.brushButtons.push(b);
      brushGroup.append(b);
    });
    const tools = h('div', { class: 'tools' }, [this.eraserButton, this.bucketButton, brushGroup]);

    // DESIGN 8.1: "Slip løs" must be held down. The ring around it fills while the countdown runs.
    this.releaseButton = h('button', { class: 'release-btn', type: 'button' }, [svg(ICONS.release), h('span', {}, ['Slip løs'])]);
    this.releaseWrap = h('div', { class: 'release-wrap' }, [this.releaseButton]);
    this.countdownEl = h('div', { class: 'countdown', 'aria-hidden': true, hidden: true });
    this.countdown = new ReleaseCountdown({
      onNumber: (n) => this.showCountdownNumber(n),
      onCancel: () => this.hideCountdown(true),
      onDone: () => {
        this.endHold();
        this.hideCountdown(false);
        this.release();
      },
    });

    const bar = h('div', { class: 'bar' }, [tools, this.releaseWrap]);
    const bottom = h('div', { class: 'bottom', 'data-page': 'crayons' }, [crayons, patterns, bar]);

    // --- "Smid tegningen væk?" ---
    const yes = h('button', { class: 'confirm-btn yes', type: 'button', 'aria-label': 'Ja' }, [svg(ICONS.yes)]);
    const no = h('button', { class: 'confirm-btn no', type: 'button', 'aria-label': 'Nej' }, [svg(ICONS.no)]);
    this.confirm = h('div', { class: 'confirm', hidden: true }, [
      h('div', { class: 'confirm-box', role: 'dialog' }, [svg(ICONS.trash), h('p', {}, ['Smid tegningen væk?']), h('div', { class: 'confirm-actions' }, [no, yes])]),
    ]);

    this.element = h('div', { class: 'panel', hidden: true }, [
      this.stage,
      h('div', { class: 'top-buttons' }, [homeButton, tabs, this.nameInput, h('div', { class: 'top-right-buttons' }, [this.undoButton])]),
      bottom,
      this.countdownEl,
      this.confirm,
    ]);

    homeButton.addEventListener('click', () => this.requestHome());
    this.undoButton.addEventListener('click', () => this.drawing?.undo());
    this.fitButton.addEventListener('click', () => this.setView(IDENTITY_VIEW));
    this.releaseButton.addEventListener('pointerdown', this.onReleaseDown);
    this.releaseButton.addEventListener('keydown', this.onReleaseKeyDown);
    this.releaseButton.addEventListener('keyup', this.onReleaseKeyUp);
    this.releaseButton.addEventListener('blur', () => this.holdPointer === 'key' && this.cancelHold());
    this.releaseButton.addEventListener('contextmenu', (e) => e.preventDefault());
    // A plain click (a tap, or Enter/space released) never releases: only the held countdown does.
    this.releaseButton.addEventListener('click', (e) => e.preventDefault());
    yes.addEventListener('click', () => {
      this.confirm.hidden = true;
      this.onHome?.();
    });
    no.addEventListener('click', () => (this.confirm.hidden = true));

    this.stage.addEventListener('pointerdown', this.onPointerDown);
    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerup', this.onPointerEnd);
    this.stage.addEventListener('pointercancel', this.onPointerEnd);
    this.stage.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // The tray swipes between its two pages (and a swipe is never also a tap on a crayon).
    bottom.addEventListener('pointerdown', this.onTrayDown);
    bottom.addEventListener('pointerup', this.onTrayUp);
    bottom.addEventListener('pointercancel', () => (this.trayStart = null));
    bottom.addEventListener('click', (e) => {
      if (performance.now() < this.suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.stage);
  }

  /** The name typed so far (cleaned up; empty when there is none). */
  get name(): string {
    return sanitizeName(this.nameInput.value);
  }

  /**
   * While the name is typed the tray steps aside and the panel follows the part of the screen the keyboard leaves free
   * (`visualViewport`), so the animal is never hidden behind the keyboard (DESIGN 8.6).
   */
  private setTyping(on: boolean): void {
    this.element.classList.toggle('typing', on);
    const vv = window.visualViewport;
    if (this.typingFit) vv?.removeEventListener('resize', this.typingFit);
    this.typingFit = null;
    if (on && vv) {
      const fit = (): void => {
        this.element.style.height = `${Math.round(vv.height)}px`;
        this.element.style.transform = vv.offsetTop > 0 ? `translateY(${Math.round(vv.offsetTop)}px)` : '';
      };
      this.typingFit = fit;
      vv.addEventListener('resize', fit);
      fit();
    } else {
      this.element.style.height = '';
      this.element.style.transform = '';
      window.setTimeout(() => this.layout(), 0);
    }
  }

  private typingFit: (() => void) | null = null;

  get currentDrawing(): Drawing | null {
    return this.drawing;
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  /** Screen rectangle of the template (for the "Slip løs" transition in M3: same place, same size). */
  getTemplateRect(): DOMRect {
    return this.canvasWrap.getBoundingClientRect();
  }

  open(species: Species): void {
    this.species = species;
    this.template = getTemplate(species);
    this.drawing?.canvas.remove();
    this.drawing = new Drawing(this.template);
    this.drawing.canvas.classList.add('drawing-canvas');
    this.drawing.onChange = () => {
      this.undoButton.disabled = !this.drawing?.canUndo;
    };
    this.canvasWrap.insertBefore(this.drawing.canvas, this.overlay);
    this.pointers.clear();
    this.gesture = null;
    this.locked = false;
    this.panning = null;
    this.view = IDENTITY_VIEW;
    this.setPage('crayons');
    this.undoButton.disabled = true;
    this.activePointer = null;
    this.confirm.hidden = true;
    this.crayonIndex = 0;
    this.nameInput.value = '';
    this.cancelHold();
    this.setTool('crayon');
    this.selectCrayon(0, false);
    this.setBrush(1);
    this.drawing.stamp = this.stampId;
    this.drawing.pattern = this.patternId;
    this.markPicks();
    this.element.classList.remove('releasing');
    this.element.hidden = false;
    // Next frame so the CSS transition from the hidden state runs.
    requestAnimationFrame(() => this.element.classList.add('open'));
    this.layout();
  }

  /** "Slip løs" started: tray and buttons slide away, the drawing fades out (the 3D body is already underneath). */
  beginRelease(): void {
    this.activePointer = null;
    this.drawing?.discardStroke();
    // The transition starts from the flat, whole drawing (the same place and size as the template): so look at all of it.
    this.setView(IDENTITY_VIEW);
    this.element.classList.add('releasing');
  }

  close(): void {
    this.cancelHold();
    this.pointers.clear();
    this.gesture = null;
    this.panning = null;
    this.element.classList.remove('open', 'releasing');
    this.element.hidden = true;
    this.drawing?.canvas.remove();
    this.drawing = null;
    this.activePointer = null;
  }

  private requestHome(): void {
    this.cancelHold();
    if (this.drawing?.hasContent) this.confirm.hidden = false;
    else this.onHome?.();
  }

  private release(): void {
    this.nameInput.blur();
    if (this.drawing && this.species) this.onRelease?.(this.drawing, this.species, sanitizeName(this.nameInput.value));
  }

  private selectCrayon(i: number, sound = true): void {
    if (sound) this.onCrayon?.(i);
    this.crayonIndex = i;
    this.crayonButtons.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)));
    if (this.tool === 'eraser') this.setTool('crayon');
    if (this.drawing) this.drawing.color = this.crayonColor();
    this.paintPreviews();
  }

  private crayonColor(): string {
    const def = CRAYONS[this.crayonIndex];
    return def.rainbow ? RAINBOW : def.hex;
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.eraserButton.setAttribute('aria-pressed', String(tool === 'eraser'));
    this.bucketButton.setAttribute('aria-pressed', String(tool === 'bucket'));
    this.markPicks();
    this.element.dataset.tool = tool;
    if (this.drawing) {
      this.drawing.tool = tool;
      this.drawing.color = this.crayonColor();
    }
  }

  // --- the tray's two pages ---

  private setPage(page: Page): void {
    this.page = page;
    const bottom = this.crayonsEl.parentElement;
    if (bottom) bottom.dataset.page = page;
    this.crayonsEl.hidden = page !== 'crayons';
    this.patternsEl.hidden = page !== 'patterns';
    this.tabButtons.crayons.setAttribute('aria-pressed', String(page === 'crayons'));
    this.tabButtons.patterns.setAttribute('aria-pressed', String(page === 'patterns'));
    if (page === 'patterns') this.paintPreviews();
  }

  /** Tapping the picked pattern or stamp again goes back to the crayon, like the eraser and the bucket. */
  private pickPattern(id: PatternId): void {
    const same = this.tool === 'pattern' && this.patternId === id;
    this.patternId = id;
    if (this.drawing) this.drawing.pattern = id;
    this.setTool(same ? 'crayon' : 'pattern');
  }

  private pickStamp(id: StampId): void {
    const same = this.tool === 'stamp' && this.stampId === id;
    this.stampId = id;
    if (this.drawing) this.drawing.stamp = id;
    this.setTool(same ? 'crayon' : 'stamp');
  }

  private markPicks(): void {
    for (const [id, b] of this.patternButtons) b.setAttribute('aria-pressed', String(this.tool === 'pattern' && id === this.patternId));
    for (const [id, b] of this.stampButtons) b.setAttribute('aria-pressed', String(this.tool === 'stamp' && id === this.stampId));
  }

  /** The little pictures on the pattern page follow the chosen colour. */
  private paintPreviews(): void {
    const def = CRAYONS[this.crayonIndex];
    this.swatch.style.setProperty('--c', def.rainbow ? 'conic-gradient(#e8332a, #f9d21e, #3fb950, #2f7bdc, #8a45c6, #e8332a)' : def.hex);
    this.swatch.toggleAttribute('data-rainbow', !!def.rainbow);
    if (this.page !== 'patterns') return;
    const hex = def.rainbow ? '#8a45c6' : def.hex;
    for (const [id, b] of this.patternButtons) {
      const c = b.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      const img = ctx.createImageData(64, 64);
      const [r, g, bl] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const a = patternCoverage(id as PatternId, x * 1.6 + 14, y * 1.6 + 14);
          img.data.set([r, g, bl, Math.round(a * 255)], (y * 64 + x) * 4);
        }
      }
      ctx.clearRect(0, 0, 64, 64);
      ctx.putImageData(img, 0, 0);
    }
    for (const [id, b] of this.stampButtons) {
      const c = b.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, 64, 64);
      drawStamp(ctx, id as StampId, 32, 32, 50, hex);
    }
  }

  private trayStart: { x: number; y: number; id: number } | null = null;

  private readonly onTrayDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return; // (a mouse has the tabs; swiping is for fingers)
    this.trayStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  private readonly onTrayUp = (e: PointerEvent): void => {
    const s = this.trayStart;
    this.trayStart = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    this.suppressClickUntil = performance.now() + 120;
    this.setPage(dx < 0 ? 'patterns' : 'crayons');
  };

  private setBrush(i: BrushIndex): void {
    this.brushButtons.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)));
    if (this.drawing) this.drawing.brush = i;
  }

  /** Squares the template into the free area above the tray and redraws the contour/eyes overlay. */
  private layout(): void {
    // The free area is the stage minus its padding (portrait reserves a strip for the top buttons).
    const cs = getComputedStyle(this.stage);
    const w = this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const hgt = this.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!w || !hgt) return;
    const side = Math.max(120, Math.floor(Math.min(w, hgt)));
    this.canvasWrap.style.width = this.canvasWrap.style.height = `${side}px`;
    this.side = side;
    this.setView(this.view);
  }

  /** Shows the part of the drawing in `v` (clamped): the drawing canvas is moved and scaled, the contour and eyes are redrawn to match. */
  private setView(v: View): void {
    this.view = clampView(v, this.side);
    if (this.drawing) {
      this.drawing.zoom = this.view.zoom;
      this.drawing.pxPerCss = DRAWING_SIZE / this.side;
      const c = this.drawing.canvas.style;
      c.transformOrigin = '0 0';
      c.transform = isZoomed(this.view) ? `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.zoom})` : '';
    }
    this.fitButton.hidden = !isZoomed(this.view);
    this.element.classList.toggle('zoomed', isZoomed(this.view));
    this.drawOverlay();
  }

  private drawOverlay(): void {
    if (!this.template) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(this.side * dpr);
    if (this.overlay.width !== px) this.overlay.width = this.overlay.height = px;
    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, px, px);
    drawTemplate(ctx, this.template, px * this.view.zoom, this.view.x * dpr, this.view.y * dpr, { fill: false, lineWidth: Math.max(2, 3 * dpr) });
  }

  /** The current zoom (1…4), for tests. */
  get zoom(): number {
    return this.view.zoom;
  }

  /** Where the drawing is seen from, for tests. */
  get viewState(): View {
    return this.view;
  }

  // --- "Slip løs" is held down (DESIGN 8.1) ---

  private readonly onReleaseDown = (e: PointerEvent): void => {
    if (this.holdPointer !== null || !this.drawing || this.element.classList.contains('releasing')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.holdPointer = e.pointerId;
    window.addEventListener('pointermove', this.onHoldMove);
    window.addEventListener('pointerup', this.onHoldEnd);
    window.addEventListener('pointercancel', this.onHoldEnd);
    this.beginHold();
  };

  /** Sliding the finger off the button cancels (touch keeps the pointer on the button, so we test the position ourselves). */
  private readonly onHoldMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.holdPointer) return;
    const r = this.releaseButton.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.cancelHold();
  };

  private readonly onHoldEnd = (e: PointerEvent): void => {
    if (e.pointerId === this.holdPointer) this.cancelHold();
  };

  private readonly onReleaseKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.repeat || this.holdPointer !== null || !this.drawing) return;
    this.holdPointer = 'key';
    this.beginHold();
  };

  private readonly onReleaseKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (this.holdPointer === 'key') this.cancelHold();
  };

  private beginHold(): void {
    this.countdown.start(performance.now());
    this.releaseWrap.classList.add('holding');
    window.clearInterval(this.holdTimer);
    this.holdTimer = window.setInterval(() => {
      const now = performance.now();
      this.countdown.update(now);
      this.releaseWrap.style.setProperty('--p', String(this.countdown.progress(now)));
    }, 30);
  }

  /** Stops the clock and the listeners (the countdown itself is told separately). */
  private endHold(): void {
    window.clearInterval(this.holdTimer);
    this.holdPointer = null;
    window.removeEventListener('pointermove', this.onHoldMove);
    window.removeEventListener('pointerup', this.onHoldEnd);
    window.removeEventListener('pointercancel', this.onHoldEnd);
    this.releaseWrap.classList.remove('holding');
    this.releaseWrap.style.setProperty('--p', '0');
  }

  /** The button was let go (or the finger slid off): the number shrinks away and nothing happens. */
  private cancelHold(): void {
    if (this.holdPointer === null) return;
    this.endHold();
    this.countdown.cancel();
  }

  private showCountdownNumber(n: number): void {
    this.onCountdown?.(n);
    this.countdownEl.hidden = false;
    this.countdownEl.classList.remove('gone');
    this.countdownEl.textContent = String(n);
    // Restart the pop-in animation for every number.
    this.countdownEl.style.animation = 'none';
    void this.countdownEl.offsetWidth;
    this.countdownEl.style.animation = '';
  }

  private hideCountdown(cancelled: boolean): void {
    if (cancelled) {
      this.releaseWrap.classList.remove('wiggle');
      void this.releaseWrap.offsetWidth;
      this.releaseWrap.classList.add('wiggle'); // a little "hold me" shake
      this.countdownEl.classList.add('gone');
      window.setTimeout(() => this.countdownEl.classList.contains('gone') && (this.countdownEl.hidden = true), 260);
    } else {
      this.countdownEl.hidden = true;
    }
  }

  // --- input: Pointer Events, so finger, pen and mouse behave alike (ADR 0004) ---

  /** A point on the screen as a position inside the square window the drawing is seen through. */
  private local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.canvasWrap.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private toDrawing(lx: number, ly: number): [number, number] {
    return windowToDrawing(this.view, lx, ly, this.side);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.drawing || this.element.classList.contains('releasing')) return;
    // A tap on the picture while the name is typed only closes the keyboard (it must not also draw).
    if (document.activeElement === this.nameInput) {
      this.nameInput.blur();
      return;
    }
    if ((e.target as HTMLElement | null)?.closest('.fit-btn')) return; // (the "whole animal" button floats over the drawing)
    const [lx, ly] = this.local(e);
    if (e.pointerType === 'mouse') {
      // Mouse: the middle button (or space and the left button) slides the picture; the left button draws.
      if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
        e.preventDefault();
        if (this.pointers.size > 0) return;
        this.stage.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: lx, y: ly });
        this.panning = { id: e.pointerId };
        this.element.classList.add('panning');
        return;
      }
      if (e.button !== 0) return;
    }
    e.preventDefault();
    if (this.pointers.size >= 2) return; // a third finger is ignored
    this.stage.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: lx, y: ly });
    if (this.pointers.size === 2) {
      // A second finger: the child is pinching. What the first finger had begun is thrown away, so a pinch never leaves a stroke behind.
      if (this.activePointer !== null) {
        this.drawing.discardStroke();
        this.activePointer = null;
      }
      this.locked = true;
      this.startGesture();
      return;
    }
    if (this.locked) return;
    this.activePointer = e.pointerId;
    const [x, y] = this.toDrawing(lx, ly);
    this.drawing.pointerDown(x, y);
  };

  private startGesture(): void {
    const [a, b] = [...this.pointers.values()];
    this.gesture = { distance: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, started: performance.now(), travelled: 0 };
  }

  /** Two fingers: they zoom around the middle between them (pinch) and slide the picture (both moving the same way). */
  private updateGesture(): void {
    const g = this.gesture;
    if (!g || this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let v = this.view;
    if (g.distance > 8 && distance > 8) v = zoomAround(v, distance / g.distance, mx, my, this.side);
    v = panView(v, mx - g.mx, my - g.my, this.side);
    g.travelled += Math.hypot(mx - g.mx, my - g.my) + Math.abs(distance - g.distance);
    g.distance = distance;
    g.mx = mx;
    g.my = my;
    this.setView(v);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.drawing) return;
    const [lx, ly] = this.local(e);
    if (this.panning && this.panning.id === e.pointerId) {
      this.setView(panView(this.view, lx - p.x, ly - p.y, this.side));
      p.x = lx;
      p.y = ly;
      return;
    }
    if (this.gesture) {
      p.x = lx;
      p.y = ly;
      this.updateGesture();
      return;
    }
    if (e.pointerId !== this.activePointer) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) {
      const [cx, cy] = this.local(ev);
      p.x = cx;
      p.y = cy;
      const [x, y] = this.toDrawing(cx, cy);
      this.drawing.pointerMove(x, y);
    }
  };

  private readonly onPointerEnd = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.panning && this.panning.id === e.pointerId) {
      this.panning = null;
      this.element.classList.remove('panning');
    }
    if (this.gesture && this.pointers.size < 2) {
      const g = this.gesture;
      this.gesture = null;
      // Two quick taps with two fingers (each a short touch that hardly moved): back to the whole animal.
      if (e.type === 'pointerup' && performance.now() - g.started < 350 && g.travelled < 14) {
        const now = performance.now();
        if (now - this.lastTwoFingerTap < 600) {
          this.setView(IDENTITY_VIEW);
          this.lastTwoFingerTap = 0;
        } else this.lastTwoFingerTap = now;
      }
    }
    if (e.pointerId === this.activePointer) {
      this.activePointer = null;
      if (e.type === 'pointercancel') this.drawing?.discardStroke();
      else this.drawing?.pointerUp();
    }
    // The last finger up makes drawing possible again.
    if (this.pointers.size === 0) this.locked = false;
  };

  /** The mouse wheel zooms around the pointer (a pinch on a trackpad arrives as ctrl + wheel with small steps). */
  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.drawing || this.element.classList.contains('releasing')) return;
    e.preventDefault();
    const [lx, ly] = this.local(e);
    this.drawing.cancelStroke();
    this.setView(zoomAround(this.view, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), lx, ly, this.side));
  };

  /** Space + drag slides the picture with a mouse; + − 0 zoom from the keyboard. Not while the keys belong to a button or a field. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    const onControl = !!t && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName);
    if (e.key === ' ' && !onControl) {
      this.spaceHeld = true;
      this.element.classList.add('space');
      e.preventDefault();
      return;
    }
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const c = this.side / 2;
    if (e.key === '+' || e.key === '=') this.setView(zoomAround(this.view, 1.25, c, c, this.side));
    else if (e.key === '-' || e.key === '_') this.setView(zoomAround(this.view, 0.8, c, c, this.side));
    else if (e.key === '0') this.setView(IDENTITY_VIEW);
    else return;
    e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== ' ') return;
    this.spaceHeld = false;
    this.element.classList.remove('space');
  };
}
