// REC ONLY (claude/rec-pxprobe, never merged): does the canvas blend particle layers in display (sRGB-encoded) values?
// Same WebGLRenderer options as the game; grounds drawn with three's own material (linear maths, sRGB output, like the
// board); overlays drawn the way the particle shaders draw (ShaderMaterial, raw gl_FragColor, no colour conversion) with
// the particle engine's own blend states (vfx-ltk/rendering/utils/blend.ts). Reads the canvas back and prints what it holds.
import { Color, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, SRGBColorSpace, WebGLRenderer } from 'three';
import { blendState } from '../../src/rendering/three-mode/vfx-ltk/rendering/utils/blend';
import { BLEND_MODE } from '../../src/rendering/three-mode/vfx-ltk/engine/model/enums';

const W = 600, H = 300, grounds = [0.2, 0.5, 0.8];
const overlays: { name: string; mode: number; rgb: [number, number, number]; a: number; premul: boolean }[] = [
  { name: 'alpha 1.0/0/0 a.5', mode: BLEND_MODE.alpha, rgb: [1, 0, 0], a: 0.5, premul: false },
  { name: 'alpha dark .1/.05/.15 a.6', mode: BLEND_MODE.alpha, rgb: [0.1, 0.05, 0.15], a: 0.6, premul: false },
  { name: 'add .5/.25/0 (premultiplied a.5)', mode: BLEND_MODE.add, rgb: [0.5, 0.25, 0], a: 0.5, premul: true },
  { name: 'alphaAdd .6/.6/.6 a.5', mode: BLEND_MODE.alphaAdd, rgb: [0.6, 0.6, 0.6], a: 0.5, premul: false },
];
const renderer = new WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
const scene = new Scene(), camera = new OrthographicCamera(0, W, H, 0, -10, 10);
const cw = W / grounds.length, rh = H / overlays.length;
grounds.forEach((g, i) => {
  const m = new Mesh(new PlaneGeometry(cw, H), new MeshBasicMaterial({ color: new Color().setRGB(g, g, g, SRGBColorSpace) }));
  m.position.set(cw * i + cw / 2, H / 2, 0); m.renderOrder = 0; scene.add(m);
});
const frag = `uniform vec4 c; void main() { gl_FragColor = c; }`, vert = `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
overlays.forEach((o, j) => {
  const s = blendState(o.mode as never), k = o.premul ? o.a : 1;
  const mat = new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { c: { value: [o.rgb[0] * k, o.rgb[1] * k, o.rgb[2] * k, o.a] } },
    transparent: true, depthTest: false, depthWrite: false, blending: s.blending, blendSrc: s.blendSrc, blendDst: s.blendDst, blendEquation: s.blendEquation,
    blendSrcAlpha: s.blendSrcAlpha, blendDstAlpha: s.blendDstAlpha });
  const m = new Mesh(new PlaneGeometry(W, rh * 0.5), mat); m.position.set(W / 2, rh * j + rh * 0.75, 1); m.renderOrder = 1; scene.add(m);
});
renderer.render(scene, camera);
const gl = renderer.getContext(), px = new Uint8Array(4);
const read = (x: number, y: number) => { gl.readPixels(Math.round(x), Math.round(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1], px[2]]; };
const enc = (l: number) => l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055, dec = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const rows: unknown[] = [];
grounds.forEach((g, i) => {
  const groundRead = read(cw * i + cw / 2, rh * 0.25);
  overlays.forEach((o, j) => {
    const got = read(cw * i + cw / 2, rh * j + rh * 0.75);
    const k = o.premul ? o.a : 1, src = o.rgb.map(v => v * k);
    const mix = (gv: number, cv: number, space: 'display' | 'linear') => {
      const G = space === 'display' ? gv : dec(gv), C = space === 'display' ? cv : dec(cv / (o.premul ? k : 1)) * (o.premul ? k : 1);
      const out = o.mode === BLEND_MODE.alpha ? o.a * C + (1 - o.a) * G : o.mode === BLEND_MODE.add ? C + G : o.a * C + G;
      return Math.round(255 * Math.min(1, space === 'display' ? out : enc(out)));
    };
    rows.push({ ground: g, groundRead, overlay: o.name, read: got, expectDisplay: src.map((_, ch) => mix(g, o.rgb[ch] * k, 'display')), expectLinear: src.map((_, ch) => mix(g, o.rgb[ch] * k, 'linear')) });
  });
});
const attrs = gl.getContextAttributes(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
(window as unknown as { __pxprobe: unknown }).__pxprobe = { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', outputColorSpace: renderer.outputColorSpace,
  drawingBufferColorSpace: (gl as unknown as { drawingBufferColorSpace?: string }).drawingBufferColorSpace, attrs, rows };
