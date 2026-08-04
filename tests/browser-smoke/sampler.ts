/**
 * Decode a PNG through a canvas and sample it in viewport CSS px. `origin` is
 * the rect of the captured element; scoping capture to an element rather than
 * the viewport keeps the mapping exact across engines, whose scrollbar width
 * and device pixel ratio differ.
 */
export async function sampler(base64: string, origin: DOMRect) {
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ratio = img.width / origin.width;
  return (cssX: number, cssY: number) => {
    const x = Math.floor((cssX - origin.left) * ratio);
    const y = Math.floor((cssY - origin.top) * ratio);
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
}

export type Pixel = { r: number; g: number; b: number };

/** Anything meaningfully off a white backdrop. */
export const isPaint = (p: Pixel) => 255 - p.r + (255 - p.g) + (255 - p.b) > 60;
