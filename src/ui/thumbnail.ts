import type { Template } from '../species/types';

/** Draws the template (base colour, contour, eyes) onto `ctx` in a size×size box at (ox, oy). */
export function drawTemplate(ctx: CanvasRenderingContext2D, t: Template, size: number, ox = 0, oy = 0, opts: { fill?: boolean; lineWidth?: number } = {}): void {
  const path = new Path2D();
  for (const part of t.parts) {
    part.outline.forEach(([x, y], i) => (i === 0 ? path.moveTo(ox + x * size, oy + y * size) : path.lineTo(ox + x * size, oy + y * size)));
    path.closePath();
  }
  // Contour = outer silhouette only: inner part edges (e.g. where the tail joins the body) must not
  // show. Stroke wide, cut away the inside, then (optionally) put the base colour behind the ring.
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 * (opts.lineWidth ?? Math.max(1.5, size / 220));
  ctx.strokeStyle = 'rgba(28, 48, 84, 0.5)';
  ctx.stroke(path);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(path, 'nonzero');
  if (opts.fill !== false) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = t.baseColor;
    ctx.fill(path, 'nonzero');
  }
  ctx.restore();
  for (const e of t.eyes) {
    ctx.beginPath();
    ctx.ellipse(ox + e.x * size, oy + e.y * size, e.r * size * 1.15, e.r * size, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, size / 420);
    ctx.strokeStyle = 'rgba(28, 48, 84, 0.7)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox + e.x * size, oy + e.y * size, e.r * size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1b2438';
    ctx.fill();
  }
}

export function templateThumbnail(t: Template, px: number, dpr = window.devicePixelRatio || 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(px * dpr);
  c.style.width = c.style.height = `${px}px`;
  const ctx = c.getContext('2d');
  if (ctx) drawTemplate(ctx, t, c.width);
  return c;
}
