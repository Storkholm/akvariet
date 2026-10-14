/** The drawing (1024×1024 from M9, ADR 0009) as a PNG, for storage. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

/** A stored drawing back onto a canvas (what the body texture is built from). The canvas has the size the drawing was stored in: 1024 (from M9), or 512 for creatures saved before that. */
/** `maxSize` shrinks it on the way in (30 creatures at 1024×1024 would be 120 MB of canvases). */
export async function blobToCanvas(blob: Blob, maxSize = Infinity): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const size = Math.min(bitmap.width, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return canvas;
}
