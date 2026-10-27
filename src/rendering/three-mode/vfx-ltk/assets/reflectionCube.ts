import { CubeTexture, DataTexture, NoColorSpace, type Texture } from 'three';

/** The converter writes DDS cube faces as a vertical +X,-X,+Y,-Y,+Z,-Z PNG strip. */
export function reflectionCube(source: Texture): CubeTexture {
  const image = source.image as { width: number; height: number; data?: Uint8Array };
  const size = image.width;
  if (!size || image.height !== size * 6) throw new Error('reflection-cube-strip');
  const faces = Array.from({ length: 6 }, (_, face) => {
    if (image.data) return new DataTexture(image.data.slice(face * size * size * 4, (face + 1) * size * size * 4), size, size);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const context = canvas.getContext('2d'); if (!context) throw new Error('reflection-cube-canvas');
    context.drawImage(source.image as CanvasImageSource, 0, face * size, size, size, 0, 0, size, size);
    return canvas;
  });
  const cube = new CubeTexture(faces); cube.colorSpace = NoColorSpace; cube.needsUpdate = true;
  return cube;
}
