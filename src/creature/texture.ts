import * as THREE from 'three';
import type { Template } from '../species/types';

function context2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  return ctx;
}

/** The drawing scaled to the size kept per creature (DESIGN 4.3/4.4: 512×512). No eyes, no smear. */
export function downscaleDrawing(source: HTMLCanvasElement, size = 512): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = context2d(c);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, size, size);
  return c;
}

/** The template's eyes, painted on the back at their template positions. */
function paintEyes(ctx: CanvasRenderingContext2D, template: Template, size: number): void {
  for (const e of template.eyes) {
    ctx.beginPath();
    ctx.ellipse(e.x * size, e.y * size, e.r * size * 1.15, e.r * size, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, size / 380);
    ctx.strokeStyle = 'rgba(28, 48, 84, 0.75)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x * size, e.y * size, e.r * size * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#1b2438';
    ctx.fill();
  }
}

/**
 * Builds the body texture from the (512×512) drawing: the colours are smeared a few pixels outwards
 * past the outline – without that, bilinear filtering at the silhouette would blend in the transparent
 * outside and leave a pale/dark fringe – and the template's eyes are painted on top.
 */
export function createCreatureTexture(
  drawing: HTMLCanvasElement,
  template: Template,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const size = drawing.width;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = context2d(canvas);
  const k = size / 512;
  for (const r of [3, 2, 1]) {
    for (let a = 0; a < 8; a++) {
      ctx.drawImage(drawing, Math.round(Math.cos((a * Math.PI) / 4) * r * k), Math.round(Math.sin((a * Math.PI) / 4) * r * k));
    }
  }
  ctx.drawImage(drawing, 0, 0);
  paintEyes(ctx, template, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
