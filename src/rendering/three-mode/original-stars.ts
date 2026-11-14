import { CanvasTexture, Group, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';
import { createStarMark, type StarMark } from '../../rendering3d';
import type { OriginalUi } from './ui-original-assets';

/** Optional original star row around the existing geometric fallback; no level or promotion rules. */
export function createOriginalStarMark(options: {
  effectiveStarLevel: number; colorFor(level: number): string; ui?: Pick<OriginalUi, 'sprite' | 'subscribe'>;
}): StarMark {
  const fallback = createStarMark(options), object = new Group(); object.add(fallback.object);
  let level = Math.max(1, Math.min(4, Math.trunc(options.effectiveStarLevel))), closed = false, key = '';
  let texture: CanvasTexture | undefined, material: SpriteMaterial | undefined, row: Sprite | undefined;
  const clear = () => { row?.removeFromParent(); material?.dispose(); texture?.dispose(); row = undefined; material = undefined; texture = undefined; };
  const refresh = () => {
    if (closed) return;
    const sprite = options.ui?.sprite(`star.${level}`), next = `${level}|${sprite?.url ?? ''}`;
    if (key === next) return; key = next; clear(); fallback.object.visible = !sprite;
    if (!sprite) return;
    texture = new CanvasTexture(sprite.source as HTMLCanvasElement); texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter; texture.generateMipmaps = false;
    material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    row = new Sprite(material); row.name = 'render3d-original-stars'; row.renderOrder = 1000; row.frustumCulled = false;
    row.scale.set(level * 1.2, 1, 1); object.add(row);
  };
  const unsubscribe = options.ui?.subscribe(refresh); refresh();
  return { object, setLevel(next) {
    if (closed) return;
    fallback.setLevel(next); level = Math.max(1, Math.min(4, Math.trunc(next))); refresh();
  }, dispose() {
    if (closed) return; closed = true; unsubscribe?.(); clear(); fallback.dispose(); object.removeFromParent(); object.clear();
  } };
}
