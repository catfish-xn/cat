import { CanvasTexture, LinearFilter, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

/** Small generated stand-in for TFT13_Item_SquadStolenItem; no asset or 2D dependency. */
export function createConfiscationStamp() {
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (canvas) { canvas.width = 192; canvas.height = 64; }
  const g = canvas?.getContext('2d');
  if (g?.fillText) {
    g.fillStyle = '#291b0a'; g.fillRect(0, 0, 192, 64);
    g.fillStyle = '#ffd84d'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('已没收！', 96, 45);
  }
  const texture = canvas ? new CanvasTexture(canvas) : null;
  if (texture) { texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.generateMipmaps = false; }
  const material = new SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  const sprite = new Sprite(material); sprite.name = 'render3d-confiscated-items'; sprite.scale.set(48, 16, 1);
  sprite.visible = false; sprite.renderOrder = 1002;
  return { sprite, dispose() { sprite.removeFromParent(); material.dispose(); texture?.dispose(); } };
}
