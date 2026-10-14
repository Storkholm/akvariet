/** CONTEXT: Stempel – the ten stamps (DESIGN 8.4). Each is drawn in a unit space centred on (0, 0) that reaches from −1 to 1. */
export const STAMPS = [
  { id: 'star', name: 'Stjerne' },
  { id: 'heart', name: 'Hjerte' },
  { id: 'dot', name: 'Prik' },
  { id: 'flower', name: 'Blomst' },
  { id: 'eye', name: 'Øje' },
  { id: 'scale', name: 'Skæl' },
  { id: 'sun', name: 'Sol' },
  { id: 'moon', name: 'Måne' },
  { id: 'bolt', name: 'Lyn' },
  { id: 'smile', name: 'Smil' },
] as const;
export type StampId = (typeof STAMPS)[number]['id'];

type Paint = string | CanvasGradient | CanvasPattern;

const INK = '#2a2a33';

function star(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 1 : 0.46;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function heart(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  ctx.moveTo(0, 0.95);
  ctx.bezierCurveTo(-1.25, 0.1, -0.85, -0.95, 0, -0.35);
  ctx.bezierCurveTo(0.85, -0.95, 1.25, 0.1, 0, 0.95);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function dot(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  ctx.arc(0, 0, 0.85, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function flower(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.fillStyle = fill;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3b8';
  ctx.fill();
}

function eye(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, 1, 0.78, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 0.08;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0.14, -0.16, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function scale(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.strokeStyle = fill;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.22;
  for (const r of [0.85, 0.52, 0.2]) {
    ctx.beginPath();
    ctx.arc(0, -0.3, r, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
  }
}

function sun(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.2) * 0.66, Math.sin(a - 0.2) * 0.66);
    ctx.lineTo(Math.cos(a) * 1, Math.sin(a) * 1);
    ctx.lineTo(Math.cos(a + 0.2) * 0.66, Math.sin(a + 0.2) * 0.66);
    ctx.closePath();
    ctx.fill();
  }
}

function moon(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  ctx.arc(0.42, -0.2, 0.74, 0, Math.PI * 2, true);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
}

function bolt(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  ctx.moveTo(0.25, -1);
  ctx.lineTo(-0.6, 0.12);
  ctx.lineTo(-0.08, 0.12);
  ctx.lineTo(-0.3, 1);
  ctx.lineTo(0.65, -0.18);
  ctx.lineTo(0.1, -0.18);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function smile(ctx: CanvasRenderingContext2D, fill: Paint): void {
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = INK;
  for (const x of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(x, -0.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0.05, 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 0.1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
}

const DRAWERS: Record<StampId, (ctx: CanvasRenderingContext2D, fill: Paint) => void> = { star, heart, dot, flower, eye, scale, sun, moon, bolt, smile };

/** Draws the stamp centred on (x, y), `size` px across, rotated by `angle`, in `fill` (a colour or the crayon grain). */
export function drawStamp(ctx: CanvasRenderingContext2D, id: StampId, x: number, y: number, size: number, fill: Paint, angle = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size / 2, size / 2);
  DRAWERS[id](ctx, fill);
  ctx.restore();
}

/** A tiny deterministic tilt per stamp position, so a row of stars does not look stamped by a machine (−0.18…0.18 rad). */
export function stampTilt(x: number, y: number): number {
  const h = Math.imul(Math.round(x), 374761393) ^ Math.imul(Math.round(y), 668265263);
  return ((((h ^ (h >>> 15)) >>> 0) % 1000) / 1000 - 0.5) * 0.36;
}

/** Stamp sizes for the three brushes, in screen pixels (they follow the zoom: a stamp is smaller on the drawing when zoomed in). */
export const STAMP_SCREEN_SIZES = [34, 62, 104] as const;
