/** Optional UI sidecar. Region coordinates and client data live at the asset root, never in this chunk. */
import { assetUrl } from './contracts';

export type UiRect = readonly [number, number, number, number];
export interface UiFile { path: string; bytes: number; sha256: string }
export interface UiTexture extends UiFile { width: number; height: number }
export interface UiSprite { texture: string; rect: UiRect; slice?: UiRect }
export interface UiFont extends UiFile { role: 'title' | 'body'; weight: '400' | '700' }
export interface UiManifest {
  textures: Map<string, UiTexture>;
  sprites: Map<string, UiSprite>;
  fonts: UiFont[];
  issues: string[];
}
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
function file(v: Record<string, unknown>): v is Record<string, unknown> & UiFile {
  if (typeof v.path !== 'string' || !integer(v.bytes) || !v.bytes || typeof v.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.sha256)) return false;
  try { assetUrl('', v.path); return true; } catch { return false; }
}
const tuple = (v: unknown): v is UiRect => Array.isArray(v) && v.length === 4 && v.every(integer);

/** Invalid entries fail individually, so one missing/unsafe sprite cannot disable a readable font or sibling frame. */
export function readUiManifest(value: unknown): UiManifest {
  const raw = record(value), result: UiManifest = { textures: new Map(), sprites: new Map(), fonts: [], issues: [] };
  if (raw.schemaVersion !== 1 || raw.sourceVersion !== '14.24.6442327') throw new Error('ui-manifest-version');
  for (const [id, value] of Object.entries(record(raw.textures))) {
    const v = record(value);
    if (!file(v) || !integer(v.width) || !integer(v.height) || !v.width || !v.height
      || v.width > 8192 || v.height > 8192 || !/\.(png|webp)$/i.test(v.path)) { result.issues.push(`texture:${id}`); continue; }
    result.textures.set(id, { path: v.path, bytes: v.bytes, sha256: v.sha256, width: v.width, height: v.height });
  }
  for (const [id, value] of Object.entries(record(raw.sprites))) {
    const v = record(value), t = typeof v.texture === 'string' ? result.textures.get(v.texture) : undefined;
    if (!t || !tuple(v.rect) || !v.rect[2] || !v.rect[3] || v.rect[0] + v.rect[2] > t.width || v.rect[1] + v.rect[3] > t.height
      || (v.slice !== undefined && (!tuple(v.slice) || v.slice[0] + v.slice[2] >= v.rect[3] || v.slice[1] + v.slice[3] >= v.rect[2]))) {
      result.issues.push(`sprite:${id}`); continue;
    }
    result.sprites.set(id, { texture: v.texture as string, rect: v.rect, ...(v.slice === undefined ? {} : { slice: v.slice as UiRect }) });
  }
  // The extraction manifest deliberately does not claim Chinese coverage. Use these Latin faces with a Unicode range;
  // Chinese and all other characters continue through the existing system font stack.
  for (const [id, value] of Object.entries(record(raw.fonts))) {
    const v = record(value), source = typeof v.sourcePath === 'string' ? v.sourcePath.split('/').at(-1) : '';
    const role = source === 'spiegel-regular.otf' ? 'body' : source === 'beaufortforlol-bold.otf' || source === 'beaufortforlol-regular.otf' ? 'title' : null;
    if (!role) continue;
    if (!file(v) || !/\.otf$/i.test(v.path)) { result.issues.push(`font:${id}`); continue; }
    result.fonts.push({ path: v.path, bytes: v.bytes, sha256: v.sha256, role, weight: source === 'beaufortforlol-bold.otf' ? '700' : '400' });
  }
  return result;
}

/** Public semantic keys for UI-2; unknown or not-yet-reviewed regions are never downloaded. */
export const HUD_SPRITES = [
  'hud.panel', 'hud.level', 'hud.gold', 'hud.gold-icon', 'hud.xp-track', 'hud.xp-fill', 'hud.timer',
  'health.frame', 'health.hp-player', 'health.hp-enemy', 'health.mana', 'health.mana-full', 'health.shield',
] as const;
