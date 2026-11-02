/**
 * Optional original 14.24 art for the inspect panel (2D and 3D alike). Atlas coordinates live at the asset root
 * (`ui/unit-panel.json`, textures from `ui/manifest.json`); this file only knows the semantic keys. Missing or bad
 * files leave the CSS fallback in place.
 */
import { readAssetBase3d } from '../rendering/render-mode';

type Rect = readonly [number, number, number, number];
interface SkinSprite { url: string; slice?: Rect }
export interface UnitPanelSkin { sprites: ReadonlyMap<string, SkinSprite>; splash: ReadonlyMap<string, string> }
export const UNIT_PANEL_SPRITES = ['frame', 'item', 'item.hover', 'ability', 'ability.hover', 'cell', 'trait', 'hp', 'hp.enemy', 'mana', 'shield',
  'rarity.1', 'rarity.2', 'rarity.3', 'rarity.4', 'rarity.5', 'rarity.6', 'star.1', 'star.2', 'star.3', 'star.4'] as const;

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const rect = (v: unknown): v is Rect => Array.isArray(v) && v.length === 4 && v.every(n => Number.isSafeInteger(n) && n >= 0);
const safePath = (v: unknown): v is string => typeof v === 'string' && /^[\w-]+(?:\/[\w-]+)*\.png$/i.test(v);

let pending: Promise<UnitPanelSkin | null> | null = null;
export function loadUnitPanelSkin(base = readAssetBase3d()): Promise<UnitPanelSkin | null> {
  if (!base) return Promise.resolve(null);
  return pending ??= readSkin(base).catch(() => null);
}

async function readSkin(base: string): Promise<UnitPanelSkin | null> {
  const json = async (path: string) => { const r = await fetch(new URL(path, base).href, { cache: 'no-cache' }); if (!r.ok) throw new Error(path); return r.json(); };
  const [manifest, layout] = (await Promise.all([json('ui/manifest.json'), json('ui/unit-panel.json')])).map(record);
  if (manifest.schemaVersion !== 1 || layout.schemaVersion !== 1 || manifest.sourceVersion !== '14.24.6442327' || layout.sourceVersion !== manifest.sourceVersion) return null;
  const textures = record(manifest.textures), images = new Map<string, Promise<HTMLImageElement>>(), sprites = new Map<string, SkinSprite>();
  const texture = (id: string) => { const t = record(textures[id]); return safePath(t.path) ? new URL(`ui/${t.path}`, base).href : null; };
  const image = (url: string) => {
    let found = images.get(url);
    if (!found) { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; found = img.decode().then(() => img); images.set(url, found); }
    return found;
  };
  const entries = record(layout.sprites);
  await Promise.all(UNIT_PANEL_SPRITES.map(async key => {
    const s = record(entries[key]), url = typeof s.texture === 'string' ? texture(s.texture) : null;
    if (!url || !rect(s.rect) || (s.slice !== undefined && !rect(s.slice))) return;
    try {
      const img = await image(url), [x, y, w, h] = s.rect;
      if (!w || !h || x + w > img.naturalWidth || y + h > img.naturalHeight) return;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, -x, -y);
      sprites.set(key, { url: canvas.toDataURL('image/png'), ...(s.slice ? { slice: s.slice as Rect } : {}) });
    } catch { /* one bad sprite keeps its CSS fallback */ }
  }));
  const splash = new Map<string, string>();
  for (const [id, entry] of Object.entries(record(manifest.shopArt))) {
    const t = record(entry).texture, url = typeof t === 'string' ? texture(t) : null;
    if (url) splash.set(id, url);
  }
  return { sprites, splash };
}

/** Custom properties on the panel root; the stylesheet reads each with a CSS fallback. */
export function applyUnitPanelSkin(root: HTMLElement, skin: UnitPanelSkin): void {
  for (const [key, sprite] of skin.sprites) {
    const name = `--ui-${key.replace('.', '-')}`;
    root.style.setProperty(name, `url(${JSON.stringify(sprite.url)})`);
    if (sprite.slice) root.style.setProperty(`${name}-slice`, sprite.slice.join(' '));
  }
  root.classList.add('skinned');
}
