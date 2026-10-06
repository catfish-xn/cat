/**
 * Local Riot S13 (14.24) icons, used under Riot's policy for free non-commercial fan
 * projects. Only files listed in the generated manifest are referenced; everything has a
 * code-drawn fallback (hero emblem / text), so missing assets never block play.
 */
import Phaser from 'phaser';
import { S13_ASSETS, type S13Asset } from './s13-asset-manifest';

const BASE = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const index = new Map<string, S13Asset>(S13_ASSETS.map(asset => [`${asset.kind}:${asset.id}`, asset]));

export function s13AssetUrl(kind: S13Asset['kind'], id: string): string | null {
  const asset = index.get(`${kind}:${id}`);
  return asset ? `${BASE}${asset.path}` : null;
}
export const championTextureKey = (id: string) => `s13-champion-${id}`;
export const championPortraitKey = (id: string) => `s13-champion-round-${id}`;

/** Phaser preload: queue every available champion portrait (no-op when none are bundled). */
export function preloadS13Assets(scene: Phaser.Scene): void {
  for (const asset of S13_ASSETS) if (asset.kind === 'champion' && !scene.textures.exists(championTextureKey(asset.id)))
    scene.load.image(championTextureKey(asset.id), `${BASE}${asset.path}`);
}

/** Once per game: circle-clipped portrait textures so pieces need no per-token masks. */
export function buildPortraitTextures(scene: Phaser.Scene, size = 108): void {
  for (const asset of S13_ASSETS) {
    if (asset.kind !== 'champion') continue;
    const source = championTextureKey(asset.id), target = championPortraitKey(asset.id);
    if (!scene.textures.exists(source) || scene.textures.exists(target)) continue;
    const texture = scene.textures.createCanvas(target, size, size);
    if (!texture) continue;
    const context = texture.getContext(), image = scene.textures.get(source).getSourceImage() as CanvasImageSource & { width: number; height: number };
    context.save(); context.beginPath(); context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); context.clip();
    // TFT square icons frame the face in the upper-middle: crop slightly toward it.
    const crop = Math.min(image.width, image.height) * 0.86;
    context.drawImage(image, (image.width - crop) / 2, (image.height - crop) * 0.35, crop, crop, 0, 0, size, size);
    context.restore(); texture.refresh();
  }
}

/** DOM portrait chip: official icon when bundled, else the given fallback markup. */
export function heroPortraitHtml(definitionId: string, size: number, fallback: string): string {
  const url = s13AssetUrl('champion', definitionId);
  return url ? `<img class="hero-portrait" src="${url}" width="${size}" height="${size}" alt="" draggable="false">` : fallback;
}
