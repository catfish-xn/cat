/** Optional UI sidecar. No client paths, atlas coordinates or 2D imports belong in this chunk. */
import { assetUrl } from '../../rendering3d/contracts';
import { HUD_SPRITES, readUiManifest as readHudUiManifest, type UiFile, type UiFont, type UiRect, type UiTexture as HudUiTexture } from '../../rendering3d/ui-assets';
import { originalHudRules } from './hud-style';

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

// UI-1 keeps its shop-art/state API above; UI-2 uses the HUD parser for slices, fonts and diagnostics.
export interface ReadyUiSprite { source: CanvasImageSource; url: string; width: number; height: number; slice?: UiRect; dispose(): void }
export interface OriginalUi {
  readonly ready: Promise<void>;
  readonly issues: readonly string[];
  sprite(id: string): ReadyUiSprite | undefined;
  font(role: 'title' | 'body'): string;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
/** Injectable platform boundary for synthetic tests (no client image, font or atlas-coordinate fixtures). */
export interface UiPlatform {
  image(blob: Blob, texture: HudUiTexture): Promise<{ source: CanvasImageSource; dispose(): void }>;
  crop(source: CanvasImageSource, rect: UiRect, slice?: UiRect): Promise<ReadyUiSprite>;
  font(key: string, blob: Blob, font: UiFont): { ready: Promise<string>; dispose(): void };
  style(): { set(css: string): void; dispose(): void };
}
const fontOwners = new WeakMap<FontFaceSet, Map<string, { refs: number; face: FontFace; ready: Promise<string>; url: string }>>();
// This project's DOM lib omits the writable setlike methods (they are available in desktop Chromium).
type WritableFontSet = FontFaceSet & { add(face: FontFace): void; delete(face: FontFace): boolean };
const browserPlatform: UiPlatform = {
  async image(blob, texture) {
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width !== texture.width || bitmap.height !== texture.height) { bitmap.close(); throw new Error('image-size'); }
    return { source: bitmap, dispose: () => bitmap.close() };
  },
  async crop(source, rect, slice) {
    const canvas = document.createElement('canvas'); canvas.width = rect[2]; canvas.height = rect[3];
    const g = canvas.getContext('2d'); if (!g) throw new Error('canvas-unavailable');
    g.drawImage(source, ...rect, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('crop-failed'))));
    const url = URL.createObjectURL(blob);
    return { source: canvas, url, width: canvas.width, height: canvas.height, slice,
      dispose() { URL.revokeObjectURL(url); canvas.width = canvas.height = 0; } };
  },
  font(key, blob, font) {
    if (typeof FontFace === 'undefined' || !document.fonts) throw new Error('fontface-unavailable');
    const set = document.fonts as WritableFontSet;
    let owners = fontOwners.get(set); if (!owners) { owners = new Map(); fontOwners.set(set, owners); }
    let owner = owners.get(key);
    if (!owner) {
      const url = URL.createObjectURL(blob), family = font.role === 'title' ? 'Render3dBeaufort' : 'Render3dSpiegel';
      const face = new FontFace(family, `url(${JSON.stringify(url)})`, { weight: font.weight, style: 'normal', unicodeRange: 'U+0000-024F' });
      owner = { refs: 0, face, url, ready: Promise.resolve('') };
      const entry = owner;
      entry.ready = face.load().then(() => { if (entry.refs > 0) set.add(face); return family; });
      owners.set(key, entry);
    }
    const entry = owner; entry.refs++;
    let disposed = false;
    return { ready: entry.ready, dispose() {
      if (disposed) return; disposed = true;
      if (--entry.refs === 0) { set.delete(entry.face); URL.revokeObjectURL(entry.url); owners!.delete(key); }
    } };
  },
  style() {
    const style = document.createElement('style'); style.dataset.owner = 'render3d-original-ui'; document.head.append(style);
    return { set(css) { style.textContent = css; }, dispose() { style.remove(); } };
  },
};

/** Reads may share AssetPreloader's cache. Files outside precache are checked here too, so stale bytes never get a skin. */
async function checkedBlob(read: (path: string) => Promise<Blob>, path: string, file: UiFile, hashUnavailable: () => void): Promise<Blob> {
  const blob = await read(path);
  if (blob.size !== file.bytes) throw new Error('byte-length');
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
    if (Array.from(digest, n => n.toString(16).padStart(2, '0')).join('') !== file.sha256) throw new Error('sha256');
  } else hashUnavailable();
  return blob;
}

const UI_READ_TIMEOUT_MS = 10_000;

/** root is the same configured HTTP asset root as the models; no root means no request and no style change. */
export function startOriginalUi(root: string | null, read?: (path: string) => Promise<Blob>, platform: UiPlatform = browserPlatform): OriginalUi {
  const sprites = new Map<string, ReadyUiSprite>(), fonts = new Map<string, string>(), listeners = new Set<() => void>();
  const issues: string[] = [], releases: (() => void)[] = [];
  const reads = new Set<AbortController>();
  let closed = false, updatePending = false, style: ReturnType<UiPlatform['style']> | undefined;
  const font = (role: 'title' | 'body') => fonts.get(role) ?? 'system-ui';
  const update = () => {
    if (closed || updatePending) return;
    updatePending = true;
    queueMicrotask(() => {
      updatePending = false;
      if (closed) return;
      style ??= platform.style(); style.set(originalHudRules(sprites, fonts));
      for (const listener of listeners) listener();
    });
  };
  const report = (id: string, error: unknown) => { if (!closed) issues.push(`${id}:${error instanceof Error ? error.message : 'unavailable'}`); };
  const hashUnavailable = () => { if (!closed && !issues.includes('sha256-unavailable')) issues.push('sha256-unavailable'); };
  const readPath = read ?? (async path => {
    if (closed) throw new Error('ui-disposed');
    const controller = new AbortController(); reads.add(controller);
    let onAbort!: () => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    // Bound both headers and the complete body; settle even if a fetch implementation ignores abort.
    const timer = setTimeout(() => controller.abort(new Error('read-timeout')), UI_READ_TIMEOUT_MS);
    try {
      return await Promise.race([aborted, (async () => {
        const response = await fetch(assetUrl(root!, path), { cache: 'no-cache', signal: controller.signal });
        if (!response.ok) throw new Error(`http-${response.status}`);
        return response.blob();
      })()]);
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort); reads.delete(controller);
    }
  });
  const ready = (async () => {
    if (!root || (platform === browserPlatform && (typeof document === 'undefined' || !document.head))) return;
    const manifest = readHudUiManifest(JSON.parse(await (await readPath('ui/manifest.json')).text()));
    if (closed) return;
    issues.push(...manifest.issues);
    const images = new Map<string, Promise<{ source: CanvasImageSource; dispose(): void }>>();
    const jobs = HUD_SPRITES.map(async id => {
      const sprite = manifest.sprites.get(id);
      if (!sprite) { issues.push(`${id}:region-unverified`); return; }
      try {
        let image = images.get(sprite.texture);
        if (!image) {
          const texture = manifest.textures.get(sprite.texture)!;
          image = checkedBlob(readPath, `ui/${texture.path}`, texture, hashUnavailable).then(blob => platform.image(blob, texture));
          images.set(sprite.texture, image);
        }
        const atlas = await image; if (closed) return;
        const ready = await platform.crop(atlas.source, sprite.rect, sprite.slice);
        if (closed) { ready.dispose(); return; }
        sprites.set(id, ready);
      } catch (error) { report(id, error); }
    });
    const fontJobs = manifest.fonts.map(async entry => {
      try {
        const blob = await checkedBlob(readPath, `ui/${entry.path}`, entry, hashUnavailable); if (closed) return;
        const lease = platform.font(`${assetUrl(root, `ui/${entry.path}`)}|${entry.sha256}|${entry.role}|${entry.weight}`, blob, entry);
        releases.push(() => lease.dispose());
        const family = await lease.ready; if (closed) return;
        fonts.set(entry.role, family);
      } catch (error) { report(entry.path, error); }
    });
    const imagesDone = Promise.all(jobs).finally(async () => {
      for (const image of images.values()) { try { (await image).dispose(); } catch { /* failed decode */ } }
    });
    await Promise.all([imagesDone, ...fontJobs]);
    // Publish the complete set once, including successful siblings when another asset failed.
    if (sprites.size || fonts.size) update();
  })().catch(error => report('ui', error));
  return { ready, issues, sprite: id => sprites.get(id), font,
    subscribe(listener) { if (closed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() {
      if (closed) return; closed = true; listeners.clear(); style?.dispose();
      for (const controller of reads) controller.abort(new Error('ui-disposed'));
      for (const sprite of sprites.values()) sprite.dispose(); sprites.clear(); fonts.clear();
      releases.splice(0).forEach(release => release());
    } };
}
