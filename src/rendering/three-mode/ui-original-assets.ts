/** Optional UI sidecar. No client paths, atlas coordinates or 2D imports belong in this chunk. */
import { assetUrl } from '../../rendering3d/contracts';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
export interface UiTexture { path: string; width: number; height: number; bytes: number; sha256: string }
export interface UiSprite { texture: string; rect: [number, number, number, number]; states: Record<string, string> }
export interface UiManifest { textures: Map<string, UiTexture>; sprites: Map<string, UiSprite>; shopArt: Map<string, string> }

/** Bad individual entries stay unavailable; a wrong version/schema rejects the entire sidecar. */
export function readUiManifest(value: unknown): UiManifest {
  const raw = record(value), textures = new Map<string, UiTexture>(), sprites = new Map<string, UiSprite>(), shopArt = new Map<string, string>();
  if (raw.schemaVersion !== 1 || raw.sourceVersion !== '14.24.6442327') throw new Error('ui-version-mismatch');
  for (const [id, entry] of Object.entries(record(raw.textures))) {
    const t = record(entry);
    if (typeof t.path !== 'string' || !/\.png$/i.test(t.path) || !integer(t.width) || !integer(t.height)
      || t.width > 8192 || t.height > 8192 || !integer(t.bytes) || typeof t.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(t.sha256)) continue;
    try { assetUrl('', t.path); } catch { continue; }
    // Also reject dot/empty segments, controls and quotes before a path ever becomes a URL.
    if (t.path.split('/').some(part => !part || part === '.') || /[\x00-\x20"'<>]/.test(t.path)) continue;
    textures.set(id, t as unknown as UiTexture);
  }
  for (const [id, entry] of Object.entries(record(raw.shopArt))) {
    const art = record(entry);
    if (typeof art.texture === 'string' && textures.has(art.texture)) shopArt.set(id, art.texture);
  }
  for (const [id, entry] of Object.entries(record(raw.sprites))) {
    const s = record(entry), t = typeof s.texture === 'string' ? textures.get(s.texture) : undefined, rect = s.rect;
    if (!t || !Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isSafeInteger)
      || rect[0] < 0 || rect[1] < 0 || rect[2] <= 0 || rect[3] <= 0 || rect[0] + rect[2] > t.width || rect[1] + rect[3] > t.height) continue;
    const states: Record<string, string> = {};
    for (const [state, target] of Object.entries(record(s.states))) if (typeof target === 'string') states[state] = target;
    sprites.set(id, { texture: s.texture as string, rect: rect as UiSprite['rect'], states });
  }
  return { textures, sprites, shopArt };
}

export interface UiImage { url: string; width: number; height: number }
export interface UiImageDecoder {
  decode(blob: Blob, texture: UiTexture): Promise<UiImage>;
  crop(image: UiImage, rect: UiSprite['rect']): Promise<UiImage>;
  revoke(url: string): void;
}
/** DOM images and cropped atlas sprites own blob URLs until the 3D mount releases them. */
export const domUiImages: UiImageDecoder = {
  async decode(blob, texture) {
    const url = URL.createObjectURL(blob), image = new Image(); image.src = url;
    try {
      await image.decode();
      if (image.naturalWidth !== texture.width || image.naturalHeight !== texture.height) throw new Error('ui-image-size');
      return { url, width: image.naturalWidth, height: image.naturalHeight };
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  },
  async crop(source, rect) {
    const image = new Image(); image.src = source.url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = rect[2]; canvas.height = rect[3];
    const context = canvas.getContext('2d'); if (!context) throw new Error('ui-canvas-unavailable');
    context.drawImage(image, ...rect, 0, 0, rect[2], rect[3]);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('ui-crop-failed')), 'image/png'));
    return { url: URL.createObjectURL(blob), width: rect[2], height: rect[3] };
  },
  revoke: url => URL.revokeObjectURL(url),
};

export function createUiImages(manifest: UiManifest, read: (path: string) => Promise<Blob>, decoder = domUiImages) {
  let closed = false;
  const pending = new Map<string, Promise<UiImage | null>>(), urls = new Set<string>();
  const remember = (image: UiImage): UiImage | null => {
    if (closed) { decoder.revoke(image.url); return null; }
    urls.add(image.url); return image;
  };
  const once = (id: string, load: () => Promise<UiImage | null>) => {
    if (closed) return Promise.resolve(null);
    if (!pending.has(id)) pending.set(id, load().catch(() => null));
    return pending.get(id)!;
  };
  const texture = (id: string) => once(`texture:${id}`, async () => {
    const t = manifest.textures.get(id); if (!t) return null;
    const blob = await read(`ui/${t.path}`);
    if (closed) return null;
    if (blob.size !== t.bytes) throw new Error('ui-byte-length');
    // A sidecar may be absent from precache, or its cached version may lag behind it.
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (hex !== t.sha256) throw new Error('ui-hash-mismatch');
    }
    if (closed) return null;
    return remember(await decoder.decode(blob, t));
  });
  return {
    art: (definitionId: string) => texture(manifest.shopArt.get(definitionId) ?? ''),
    sprite: (id: string) => once(`sprite:${id}`, async () => {
      const sprite = manifest.sprites.get(id); if (!sprite) return null;
      const image = await texture(sprite.texture); if (!image || closed) return null;
      return remember(await decoder.crop(image, sprite.rect));
    }),
    dispose() { closed = true; for (const url of urls) decoder.revoke(url); urls.clear(); pending.clear(); },
  };
}
