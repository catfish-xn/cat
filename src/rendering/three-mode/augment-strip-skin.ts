/** Optional UI sidecar, following v26 UI-1/UI-2: runtime-only images, checked bytes, owned blob/style lifetimes. */
type Rect = readonly [number, number, number, number];
interface Frame { path: string; bytes: number; sha256: string; width: number; height: number; rect: Rect; inset: Rect }

// Visually reviewed original HUD *generic icon* gold frame, not an inferred augment-specific UV.
// This exact atlas digest is present in the UI-1/UI-2 sidecar. A changed atlas needs its own review
// or an explicit `augment.frame` sprite with a nine-slice inset in ui/manifest.json.
const REVIEWED_HUD_SHA = '15c5ee4651360b6534e3e7d07e45b7ccd0b95c657c175693b038a8f9bfeaa3d8';
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const rect = (value: unknown): value is [number, number, number, number] => Array.isArray(value) && value.length === 4 && value.every(n => Number.isSafeInteger(n) && n >= 0);

/** Reject unreviewed atlases/regions and unsafe paths; the existing CSS remains the fallback. */
export function readAugmentFrame(raw: unknown): Frame | null {
  const manifest = record(raw), textures = record(manifest?.textures), sprites = record(manifest?.sprites);
  if (manifest?.schemaVersion !== 1 || !textures) return null;
  const explicit = sprites?.['augment.frame'];
  const sprite = record(explicit);
  let texture: Record<string, unknown> | null = null, region: unknown, inset: unknown;
  if (explicit !== undefined) {
    if (!sprite || typeof sprite.texture !== 'string') return null;
    texture = record(textures[sprite.texture]); region = sprite.rect; inset = sprite.slice;
  } else {
    texture = Object.values(textures).map(record).find(t => t?.sha256 === REVIEWED_HUD_SHA && t.width === 2048 && t.height === 1024) ?? null;
    region = [1176, 408, 54, 54]; inset = [6, 6, 6, 6];
  }
  if (!texture || typeof texture.path !== 'string' || !/^textures\/[\w-]+\.png$/.test(texture.path)
    || !positive(texture.bytes) || typeof texture.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(texture.sha256)
    || !positive(texture.width) || !positive(texture.height) || !rect(region) || !rect(inset)) return null;
  const [x, y, w, h] = region, [top, right, bottom, left] = inset;
  if (!w || !h || x + w > texture.width || y + h > texture.height || left + right >= w || top + bottom >= h) return null;
  return { path: `ui/${texture.path}`, bytes: texture.bytes, sha256: texture.sha256, width: texture.width, height: texture.height, rect: region, inset };
}

export interface AugmentSkin { readonly ready: Promise<void>; readonly issues: readonly string[]; dispose(): void }
/** Only called from the lazy 3D renderer; neither 2D nor a missing asset root makes a request. */
export function startAugmentStripSkin(root: string | null): AugmentSkin {
  const issues: string[] = [], abort = new AbortController();
  let closed = false, style: HTMLStyleElement | undefined, url: string | undefined;
  const read = async (path: string) => {
    const response = await fetch(new URL(path, root!).href, { cache: 'no-cache', signal: abort.signal });
    if (!response.ok) throw new Error(`http-${response.status}`);
    return response.blob();
  };
  const ready = (async () => {
    if (!root || typeof document === 'undefined' || !document.head) return;
    const timer = setTimeout(() => abort.abort(new Error('read-timeout')), 10_000);
    let bitmap: ImageBitmap | undefined;
    try {
      const frame = readAugmentFrame(JSON.parse(await (await read('ui/manifest.json')).text()));
      if (closed) return;
      if (!frame) throw new Error('region-unverified');
      const blob = await read(frame.path);
      if (closed) return;
      if (blob.size !== frame.bytes) throw new Error('byte-length');
      // An unchecked atlas cannot establish that the reviewed UVs still name this frame.
      if (!globalThis.crypto?.subtle) throw new Error('sha256-unavailable');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
      if (Array.from(digest, n => n.toString(16).padStart(2, '0')).join('') !== frame.sha256) throw new Error('sha256');
      if (closed) return;
      bitmap = await createImageBitmap(blob);
      if (closed) return;
      if (bitmap.width !== frame.width || bitmap.height !== frame.height) throw new Error('image-size');
      const canvas = document.createElement('canvas'), [x, y, w, h] = frame.rect, [top, right, bottom, left] = frame.inset;
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d'); if (!g) throw new Error('canvas-unavailable');
      g.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
      // Keep the original border pixels; the live augment icon supplies the centre instead of the atlas's ivory fill.
      g.clearRect(left, top, w - left - right, h - top - bottom);
      const cropped = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('crop-failed'))));
      if (closed) return;
      url = URL.createObjectURL(cropped);
      style = document.createElement('style'); style.dataset.owner = 'render3d-augment-strip';
      const chip = 'body[data-online]:has(> .render3d-layer) .augment-strip > [data-augment]';
      style.textContent = `${chip}{background:#0b151fb3;box-shadow:none;border-radius:0}
${chip}::before{content:"";position:absolute;inset:0;background:url(${JSON.stringify(url)}) center/100% 100% no-repeat;pointer-events:none}
${chip} .augment-icon{border-radius:0;box-shadow:none}`;
      document.head.append(style);
    } finally { clearTimeout(timer); bitmap?.close(); }
  })().catch(error => { if (!closed) issues.push(error instanceof Error ? error.message : 'unavailable'); });
  return { ready, issues, dispose() {
    if (closed) return; closed = true; abort.abort(); style?.remove();
    if (url) URL.revokeObjectURL(url);
  } };
}
