import type { Template } from '../species/types';
import { floodFill, parseHex, type Rect } from './floodFill';
import { signedArea } from './geometry';
import { rasterizeMask } from './mask';
import { BRUSH_SIZES, type BrushIndex } from './palette';
import { StrokeSmoother, type Segment } from './smoothing';
import { UndoStack } from './undoStack';

export const DRAWING_SIZE = 1024;
export type Tool = 'crayon' | 'eraser' | 'bucket';

/** Flood-fill colour tolerance (per channel, 0–255). */
const FILL_TOLERANCE = 36;

interface UndoEntry {
  rect: Rect;
  before: ImageData;
}

/**
 * CONTEXT: Tegning. A 1024×1024 canvas holding what the child has coloured. Everything is clipped
 * to the template outline, so colour outside the figure never exists (DESIGN 3.2).
 */
export class Drawing {
  readonly canvas: HTMLCanvasElement;
  /** Coverage of the template (255 inside the outline). */
  readonly mask: Uint8Array;
  tool: Tool = 'crayon';
  color = '#e8332a';
  brush: BrushIndex = 1;
  /** Called whenever the undo availability may have changed. */
  onChange?: () => void;

  private readonly ctx: CanvasRenderingContext2D;
  /** Copy of the last committed state; lets us snapshot just the changed rectangle for undo. */
  private readonly committed: HTMLCanvasElement;
  private readonly committedCtx: CanvasRenderingContext2D;
  private readonly clipPath: Path2D;
  private readonly undoStack = new UndoStack<UndoEntry>(30);
  private readonly grainCache = new Map<string, CanvasPattern>();
  private smoother = new StrokeSmoother();
  private stroking = false;
  private dirty: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private strokeStyle: string | CanvasPattern = '#000';
  private strokeWidth = 0;

  constructor(private readonly template: Template) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = DRAWING_SIZE;
    this.ctx = this.mustContext(this.canvas, true);
    this.committed = document.createElement('canvas');
    this.committed.width = this.committed.height = DRAWING_SIZE;
    this.committedCtx = this.mustContext(this.committed);

    const polys = template.parts.map((p) => p.outline);
    this.mask = rasterizeMask(polys, DRAWING_SIZE);
    // One path for the union of all parts; same winding lets 'nonzero' clip them together.
    this.clipPath = new Path2D();
    for (const poly of polys) {
      const pts = signedArea(poly) < 0 ? [...poly].reverse() : poly;
      pts.forEach(([x, y], i) => (i === 0 ? this.clipPath.moveTo(x * DRAWING_SIZE, y * DRAWING_SIZE) : this.clipPath.lineTo(x * DRAWING_SIZE, y * DRAWING_SIZE)));
      this.clipPath.closePath();
    }
    this.reset();
  }

  private mustContext(c: HTMLCanvasElement, readback = false): CanvasRenderingContext2D {
    const ctx = c.getContext('2d', readback ? { willReadFrequently: true } : undefined);
    if (!ctx) throw new Error('2d canvas unavailable');
    return ctx;
  }

  /** Paints the template's base colour and clears history. */
  reset(): void {
    this.ctx.clearRect(0, 0, DRAWING_SIZE, DRAWING_SIZE);
    this.ctx.save();
    this.ctx.clip(this.clipPath, 'nonzero');
    this.ctx.fillStyle = this.template.baseColor;
    this.ctx.fillRect(0, 0, DRAWING_SIZE, DRAWING_SIZE);
    this.ctx.restore();
    this.committedCtx.clearRect(0, 0, DRAWING_SIZE, DRAWING_SIZE);
    this.committedCtx.drawImage(this.canvas, 0, 0);
    this.undoStack.clear();
    this.onChange?.();
  }

  get canUndo(): boolean {
    return this.undoStack.size > 0;
  }

  /** True once the child has coloured something (used for the "throw away?" question). */
  get hasContent(): boolean {
    return this.undoStack.size > 0;
  }

  /** x, y in drawing pixels (0–1024). */
  pointerDown(x: number, y: number): void {
    if (this.tool === 'bucket') {
      this.fill(x, y);
      return;
    }
    const width = BRUSH_SIZES[this.brush] * (this.tool === 'eraser' ? 1.6 : 1);
    this.strokeWidth = width;
    this.strokeStyle = this.tool === 'eraser' ? this.template.baseColor : this.grain(this.color);
    this.stroking = true;
    this.dirty = null;
    this.smoother = new StrokeSmoother();
    this.smoother.start([x, y]);
    this.ctx.save();
    this.ctx.clip(this.clipPath, 'nonzero');
    this.ctx.fillStyle = this.strokeStyle;
    this.ctx.beginPath();
    this.ctx.arc(x, y, width / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.extendDirty(x, y);
  }

  pointerMove(x: number, y: number): void {
    if (!this.stroking) return;
    this.drawSegments(this.smoother.push([x, y]));
  }

  pointerUp(): void {
    if (!this.stroking) return;
    this.drawSegments(this.smoother.end());
    this.stroking = false;
    this.ctx.restore();
    if (this.dirty) {
      const pad = Math.ceil(this.strokeWidth / 2) + 2;
      const x = Math.max(0, Math.floor(this.dirty.minX - pad));
      const y = Math.max(0, Math.floor(this.dirty.minY - pad));
      const w = Math.min(DRAWING_SIZE, Math.ceil(this.dirty.maxX + pad)) - x;
      const h = Math.min(DRAWING_SIZE, Math.ceil(this.dirty.maxY + pad)) - y;
      this.commit({ x, y, w, h });
    }
    this.dirty = null;
  }

  /** Aborts a stroke in progress, keeping what was drawn so far as one undo step. */
  cancelStroke(): void {
    this.pointerUp();
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    const { rect, before } = entry;
    this.ctx.putImageData(before, rect.x, rect.y);
    this.committedCtx.putImageData(before, rect.x, rect.y);
    this.onChange?.();
    return true;
  }

  /** PNG of the drawing, scaled (CONTEXT: Tegning → Dyr stores 512×512). */
  toBlob(size = 512, type = 'image/png'): Promise<Blob> {
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const octx = this.mustContext(out);
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(this.canvas, 0, 0, size, size);
    return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type));
  }

  private drawSegments(segs: Segment[]): void {
    const ctx = this.ctx;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of segs) {
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1);
      ctx.stroke();
      this.extendDirty(s.x0, s.y0);
      this.extendDirty(s.cx, s.cy);
      this.extendDirty(s.x1, s.y1);
    }
  }

  private extendDirty(x: number, y: number): void {
    if (!this.dirty) this.dirty = { minX: x, minY: y, maxX: x, maxY: y };
    else {
      this.dirty.minX = Math.min(this.dirty.minX, x);
      this.dirty.minY = Math.min(this.dirty.minY, y);
      this.dirty.maxX = Math.max(this.dirty.maxX, x);
      this.dirty.maxY = Math.max(this.dirty.maxY, y);
    }
  }

  private fill(x: number, y: number): void {
    const img = this.ctx.getImageData(0, 0, DRAWING_SIZE, DRAWING_SIZE);
    const rect = floodFill(img.data, DRAWING_SIZE, DRAWING_SIZE, x, y, parseHex(this.color), this.mask, {
      tolerance: FILL_TOLERANCE,
      grain: true,
    });
    if (!rect) return;
    this.ctx.putImageData(img, 0, 0, rect.x, rect.y, rect.w, rect.h);
    this.commit(rect);
  }

  /** Records `rect` for undo (old pixels from `committed`) and syncs `committed` with the canvas. */
  private commit(rect: Rect): void {
    if (rect.w <= 0 || rect.h <= 0) return;
    const before = this.committedCtx.getImageData(rect.x, rect.y, rect.w, rect.h);
    this.undoStack.push({ rect, before });
    this.committedCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
    this.committedCtx.drawImage(this.canvas, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
    this.onChange?.();
  }

  /** Opaque crayon grain: speckled lighter/darker 2px cells of the colour (chalky, no alpha build-up). */
  private grain(hex: string): CanvasPattern {
    const cached = this.grainCache.get(hex);
    if (cached) return cached;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const tctx = this.mustContext(tile);
    const [r, g, b] = parseHex(hex);
    let seed = 1234567;
    const rnd = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let y = 0; y < 128; y += 2) {
      for (let x = 0; x < 128; x += 2) {
        const f = 1 + (rnd() - 0.5) * 0.14;
        const lighten = rnd() < 0.1 ? 0.28 : 0;
        const c = (v: number): number => Math.round(Math.min(255, v * f + (255 - v) * lighten));
        tctx.fillStyle = `rgb(${c(r)},${c(g)},${c(b)})`;
        tctx.fillRect(x, y, 2, 2);
      }
    }
    const pattern = this.ctx.createPattern(tile, 'repeat');
    if (!pattern) throw new Error('createPattern failed');
    this.grainCache.set(hex, pattern);
    return pattern;
  }
}
