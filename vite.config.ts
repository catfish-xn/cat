import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// Phaser's source tree is written for its webpack DefinePlugin: `typeof FLAG`
// must become a literal, otherwise every optional branch (WebGL debug, FB
// Instant, Camera3D, sound) stays truthy and gets bundled.
const PHASER_FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: true, WEBGL_RENDERER: true, WEBGL_DEBUG: false,
  FEATURE_SOUND: false, PLUGIN_CAMERA3D: false, PLUGIN_FBINSTANT: false,
};
const PHASER_FLAG_PATTERN = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
const replacePhaserFlags = (code: string) => code.replace(PHASER_FLAG_PATTERN, (_, flag: string) => String(PHASER_FLAGS[flag]));
const PHASER_SRC = /[\\/]node_modules[\\/]phaser[\\/]src[\\/].*\.js$/;
const phaserFlags: Plugin = {
  name: 'phaser-flags', enforce: 'pre',
  transform: (code, id) => (PHASER_SRC.test(id) ? { code: replacePhaserFlags(code), map: null } : null),
};

// 3D 单独加载模式：three.js 和 3D 渲染代码只经 three-loader.ts 动态 import，统一落在 assets/3d/。
// scripts/m7-budget.cjs 只统计 assets/ 顶层的 JS 作为 2D 体积，assets/3d/ 单列报告。
const THREE_D_MODULE = /[\\/](?:node_modules[\\/]three[\\/]|src[\\/]rendering3d[\\/]|src[\\/]rendering[\\/]three-mode[\\/](?!three-loader\.ts$|contract\.ts$))/;

export default defineConfig(({ mode }) => ({
  // Pages has a fixed repository path; other builds remain portable to subpaths.
  // Runtime S13 icons use import.meta.env.BASE_URL in both modes.
  base: mode === 'pages' ? '/cat/' : './',
  // `import Phaser from 'phaser'` resolves to the trimmed build in dev and production alike.
  plugins: [phaserFlags],
  resolve: { alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/rendering/phaser-slim.js', import.meta.url)) }] },
  optimizeDeps: {
    // phaser-core.js ends with `global.Phaser = Phaser`; the production CommonJS transform maps it already.
    esbuildOptions: { define: { global: 'globalThis' }, plugins: [{ name: 'phaser-flags', setup(build) {
      build.onLoad({ filter: PHASER_SRC }, async args => ({ contents: replacePhaserFlags(await import('node:fs/promises').then(fs => fs.readFile(args.path, 'utf8'))), loader: 'js' }));
    } }] },
  },
  // Dev only (`npm run dev:online`): `?mode=online&server=ws` connects to ws://<dev host>/ws, forwarded to the game server.
  build: { rollupOptions: { output: {
    manualChunks: id => (THREE_D_MODULE.test(id) ? 'render3d' : undefined),
    chunkFileNames: chunk => (chunk.moduleIds.some(id => THREE_D_MODULE.test(id)) ? 'assets/3d/[name]-[hash].js' : 'assets/[name]-[hash].js'),
    // The Basis transcoder (KTX2 textures) is referenced only from the 3D chunk and fetched on the first KTX2 decode.
    assetFileNames: asset => (asset.names.some(name => name.startsWith('basis_transcoder')) ? 'assets/3d/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]'),
  } } },
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true, rewrite: path => path.replace(/^\/ws/, '') } } },
}));
