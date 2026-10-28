/** Optional, nonblocking UI skin. Only this 3D chunk owns DOM images, blob URLs and FontFace lifetimes. */
import { HUD_SPRITES, readUiManifest, type UiFile, type UiFont, type UiRect, type UiTexture } from '../../rendering3d/ui-assets';
import { assetUrl } from '../../rendering3d/contracts';
import { originalHudRules } from './hud-style';

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
  image(blob: Blob, texture: UiTexture): Promise<{ source: CanvasImageSource; dispose(): void }>;
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
async function checkedBlob(read: (path: string) => Promise<Blob>, path: string, file: UiFile): Promise<Blob> {
  const blob = await read(path);
  if (blob.size !== file.bytes) throw new Error('byte-length');
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
    if (Array.from(digest, n => n.toString(16).padStart(2, '0')).join('') !== file.sha256) throw new Error('sha256');
  }
  return blob;
}

/** root is the same configured HTTP asset root as the models; no root means no request and no style change. */
export function startOriginalUi(root: string | null, read?: (path: string) => Promise<Blob>, platform: UiPlatform = browserPlatform): OriginalUi {
  const sprites = new Map<string, ReadyUiSprite>(), fonts = new Map<string, string>(), listeners = new Set<() => void>();
  const issues: string[] = [], releases: (() => void)[] = [];
  let closed = false, style: ReturnType<UiPlatform['style']> | undefined;
  const font = (role: 'title' | 'body') => fonts.get(role) ?? 'system-ui';
  const update = () => {
    if (closed) return;
    style ??= platform.style(); style.set(originalHudRules(sprites, fonts));
    for (const listener of listeners) listener();
  };
  const report = (id: string, error: unknown) => { if (!closed) issues.push(`${id}:${error instanceof Error ? error.message : 'unavailable'}`); };
  const readPath = read ?? (async path => {
    const response = await fetch(assetUrl(root!, path), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`http-${response.status}`);
    return response.blob();
  });
  const ready = (async () => {
    if (!root || (platform === browserPlatform && (typeof document === 'undefined' || !document.head))) return;
    const manifest = readUiManifest(JSON.parse(await (await readPath('ui/manifest.json')).text()));
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
          image = checkedBlob(readPath, `ui/${texture.path}`, texture).then(blob => platform.image(blob, texture));
          images.set(sprite.texture, image);
        }
        const atlas = await image; if (closed) return;
        const ready = await platform.crop(atlas.source, sprite.rect, sprite.slice);
        if (closed) { ready.dispose(); return; }
        sprites.set(id, ready); update();
      } catch (error) { report(id, error); }
    });
    const fontJobs = manifest.fonts.map(async entry => {
      try {
        const blob = await checkedBlob(readPath, `ui/${entry.path}`, entry); if (closed) return;
        const lease = platform.font(`${assetUrl(root, `ui/${entry.path}`)}|${entry.sha256}|${entry.role}|${entry.weight}`, blob, entry);
        releases.push(() => lease.dispose());
        const family = await lease.ready; if (closed) return;
        fonts.set(entry.role, family); update();
      } catch (error) { report(entry.path, error); }
    });
    const imagesDone = Promise.all(jobs).finally(async () => {
      for (const image of images.values()) { try { (await image).dispose(); } catch { /* failed decode */ } }
    });
    await Promise.all([imagesDone, ...fontJobs]);
  })().catch(error => report('ui', error));
  return { ready, issues, sprite: id => sprites.get(id), font,
    subscribe(listener) { if (closed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() {
      if (closed) return; closed = true; listeners.clear(); style?.dispose();
      for (const sprite of sprites.values()) sprite.dispose(); sprites.clear(); fonts.clear();
      releases.splice(0).forEach(release => release());
    } };
}
