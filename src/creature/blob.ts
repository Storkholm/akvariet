/** The 512×512 drawing as a PNG, for storage. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

/** A stored drawing back onto a canvas (what the body texture is built from). */
export async function blobToCanvas(blob: Blob, size = 512): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return canvas;
}
