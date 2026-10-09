import { Drawing, DRAWING_SIZE } from '../drawing/Drawing';
import { CRAYONS, RAINBOW, type BrushIndex } from '../drawing/palette';
import { getTemplate, type Species, type Template } from '../species';
import { h, svg } from './dom';
import { ICONS } from './icons';
import { ReleaseCountdown } from './releaseCountdown';
import { drawTemplate } from './thumbnail';

type Tool = 'crayon' | 'eraser' | 'bucket';

/**
 * CONTEXT: Tegnefladen. HTML layer on top of the (dimmed) aquarium: the template large in the
 * middle, a tray of 14 crayons bottom-left, tools on the tray, home/undo top-left, "Slip løs" bottom-right.
 */
export class DrawingPanel {
  readonly element: HTMLElement;
  onHome?: () => void;
  onRelease?: (drawing: Drawing, species: Species) => void;
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

  constructor() {
    const homeButton = h('button', { class: 'round-btn home-btn', type: 'button', 'aria-label': 'Hjem' }, [svg(ICONS.home)]);
    this.undoButton = h('button', { class: 'round-btn undo-btn', type: 'button', 'aria-label': 'Fortryd', disabled: true }, [svg(ICONS.undo)]);

    this.overlay = h('canvas', { class: 'template-overlay' });
    this.canvasWrap = h('div', { class: 'canvas-wrap' }, [this.overlay]);
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
    const bottom = h('div', { class: 'bottom' }, [crayons, bar]);

    // --- "Smid tegningen væk?" ---
    const yes = h('button', { class: 'confirm-btn yes', type: 'button', 'aria-label': 'Ja' }, [svg(ICONS.yes)]);
    const no = h('button', { class: 'confirm-btn no', type: 'button', 'aria-label': 'Nej' }, [svg(ICONS.no)]);
    this.confirm = h('div', { class: 'confirm', hidden: true }, [
      h('div', { class: 'confirm-box', role: 'dialog' }, [svg(ICONS.trash), h('p', {}, ['Smid tegningen væk?']), h('div', { class: 'confirm-actions' }, [no, yes])]),
    ]);

    this.element = h('div', { class: 'panel', hidden: true }, [
      this.stage,
      h('div', { class: 'top-buttons' }, [homeButton, this.undoButton]),
      bottom,
      this.countdownEl,
      this.confirm,
    ]);

    homeButton.addEventListener('click', () => this.requestHome());
    this.undoButton.addEventListener('click', () => this.drawing?.undo());
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
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.stage);
  }

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
    this.undoButton.disabled = true;
    this.activePointer = null;
    this.confirm.hidden = true;
    this.crayonIndex = 0;
    this.cancelHold();
    this.setTool('crayon');
    this.selectCrayon(0, false);
    this.setBrush(1);
    this.element.classList.remove('releasing');
    this.element.hidden = false;
    // Next frame so the CSS transition from the hidden state runs.
    requestAnimationFrame(() => this.element.classList.add('open'));
    this.layout();
  }

  /** "Slip løs" started: tray and buttons slide away, the drawing fades out (the 3D body is already underneath). */
  beginRelease(): void {
    this.activePointer = null;
    this.element.classList.add('releasing');
  }

  close(): void {
    this.cancelHold();
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
    if (this.drawing && this.species) this.onRelease?.(this.drawing, this.species);
  }

  private selectCrayon(i: number, sound = true): void {
    if (sound) this.onCrayon?.(i);
    this.crayonIndex = i;
    this.crayonButtons.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)));
    if (this.tool === 'eraser') this.setTool('crayon');
    if (this.drawing) this.drawing.color = this.crayonColor();
  }

  private crayonColor(): string {
    const def = CRAYONS[this.crayonIndex];
    return def.rainbow ? RAINBOW : def.hex;
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.eraserButton.setAttribute('aria-pressed', String(tool === 'eraser'));
    this.bucketButton.setAttribute('aria-pressed', String(tool === 'bucket'));
    this.element.dataset.tool = tool;
    if (this.drawing) {
      this.drawing.tool = tool;
      this.drawing.color = this.crayonColor();
    }
  }

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
    if (!this.template) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = this.overlay.height = Math.round(side * dpr);
    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    drawTemplate(ctx, this.template, this.overlay.width, 0, 0, { fill: false, lineWidth: Math.max(2, 3 * dpr) });
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

  private toDrawing(e: PointerEvent): [number, number] {
    const r = this.canvasWrap.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * DRAWING_SIZE, ((e.clientY - r.top) / r.height) * DRAWING_SIZE];
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    // Only one finger draws; a second finger is ignored (no zoom in v1).
    if (this.activePointer !== null || !this.drawing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.activePointer = e.pointerId;
    this.stage.setPointerCapture(e.pointerId);
    const [x, y] = this.toDrawing(e);
    this.drawing.pointerDown(x, y);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer || !this.drawing) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) {
      const [x, y] = this.toDrawing(ev);
      this.drawing.pointerMove(x, y);
    }
  };

  private readonly onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.drawing?.pointerUp();
  };
}
