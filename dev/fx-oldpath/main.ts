/**
 * Dev-only still viewer for old-path effects (effect-library / particles-v2), for colour reviews; not part of any build.
 * /dev/fx-oldpath/?id=<effect id>&assets=<asset root url>&bg=<image url>[&scale=0.281&y=0&legacy=1 (extras look)]; then `await __show(seconds)`
 * renders the effect at that age over the background image with the board camera's tilt. Effects play the way the
 * renderer plays them (effect-library, FX_SCALE world scale), so a shader change shows as it does in game.
 */
import { PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer } from 'three';
import { createAssetReader } from '../../src/rendering/three-mode/asset-reader';
import { createEffectLibrary } from '../../src/rendering/three-mode/effect-library';

const params = new URLSearchParams(location.search);
const root = params.get('assets')!, id = params.get('id')!;
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(960, 720); document.body.appendChild(renderer.domElement);
const scene = new Scene();
const bg = params.get('bg');
if (bg) { const t = await new TextureLoader().loadAsync(bg); t.colorSpace = SRGBColorSpace; scene.background = t; }
const camera = new PerspectiveCamera(30, 960 / 720, 1, 5000);
camera.position.set(0, 330, 300); camera.lookAt(0, 20, 0);
const manifest = await (await fetch(root + 'manifest.json')).json();
const reader = createAssetReader(renderer, async url => { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.blob(); });
const library = createEffectLibrary(manifest, root, reader);
const fx = await library.load(id, 30, undefined, { quadReach: 2, legacyOutputEncode: params.get('legacy') === '1' });
fx.object.scale.setScalar(Number(params.get('scale') ?? 0.281)); fx.object.position.y = Number(params.get('y') ?? 0);
scene.add(fx.object);
let age = 0;
(window as unknown as { __show: (s: number) => void }).__show = (seconds: number) => {
  while (age < seconds) { const d = Math.min(1 / 60, seconds - age); fx.update(d, camera); age += d; }
  renderer.render(scene, camera);
};
(window as unknown as { __ready: boolean }).__ready = true;
