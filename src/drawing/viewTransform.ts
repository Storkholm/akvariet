import { DRAWING_SIZE } from './Drawing';

/** Zoom limits of the drawing surface (DESIGN 8.4). */
export const DRAW_ZOOM_MIN = 1;
export const DRAW_ZOOM_MAX = 4;

/**
 * CONTEXT: Zoom (tegnefladen). Which part of the drawing is seen: `zoom` times, and where the drawing's top-left corner is in
 * the square window (CSS px, 0 or negative: the drawing always covers the window). Pure maths.
 */
export interface View {
  zoom: number;
  x: number;
  y: number;
}

export const IDENTITY_VIEW: View = { zoom: 1, x: 0, y: 0 };

/** Keeps the zoom in range and the drawing covering the whole window (`side` px square). */
export function clampView(v: View, side: number): View {
  const zoom = Math.min(DRAW_ZOOM_MAX, Math.max(DRAW_ZOOM_MIN, v.zoom));
  const min = side - side * zoom;
  return { zoom, x: Math.min(0, Math.max(min, v.x)), y: Math.min(0, Math.max(min, v.y)) };
}

/** Zooms by `factor` keeping the drawing point under window point (cx, cy) where it is. */
export function zoomAround(v: View, factor: number, cx: number, cy: number, side: number): View {
  const zoom = Math.min(DRAW_ZOOM_MAX, Math.max(DRAW_ZOOM_MIN, v.zoom * factor));
  const k = zoom / v.zoom;
  return clampView({ zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, side);
}

/** The picture moves with the fingers by (dx, dy) px. */
export function panView(v: View, dx: number, dy: number, side: number): View {
  return clampView({ zoom: v.zoom, x: v.x + dx, y: v.y + dy }, side);
}

/** Window point (px from the window's top-left) → drawing pixel (0…1024). */
export function windowToDrawing(v: View, lx: number, ly: number, side: number): [number, number] {
  return [((lx - v.x) / v.zoom / side) * DRAWING_SIZE, ((ly - v.y) / v.zoom / side) * DRAWING_SIZE];
}

export function isZoomed(v: View): boolean {
  return v.zoom > 1.001;
}
