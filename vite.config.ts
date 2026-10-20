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

// The S13 icon manifests keep `source`/`bytes`/`sha256` per row for the asset tests (vitest reads the source
// file); nothing at runtime reads them, so production builds drop those three keys. A manifest whose rows no
// longer match fails the build instead of silently shipping the checks again.
const ASSET_MANIFEST = /[\\/]src[\\/]presentation[\\/]s13-(augment-)?asset-manifest\.ts$/;
const ASSET_CHECK_KEY = /,\s*"(?:source|bytes|sha256)":\s*(?:"[^"\n]*"|\d+)/g;
const stripAssetChecks: Plugin = {
  name: 'strip-asset-checks', apply: 'build', enforce: 'pre',
  transform(code, id) {
    if (!ASSET_MANIFEST.test(id)) return null;
    const stripped = code.replace(ASSET_CHECK_KEY, '');
    if (stripped === code || /"sha256":/.test(stripped)) this.error(`strip-asset-checks: unexpected manifest layout in ${id}`);
    return { code: stripped, map: null };
  },
};

export default defineConfig(({ mode }) => ({
  // Pages has a fixed repository path; other builds remain portable to subpaths.
  // Runtime S13 icons use import.meta.env.BASE_URL in both modes.
  base: mode === 'pages' ? '/cat/' : './',
  // `import Phaser from 'phaser'` resolves to the trimmed build in dev and production alike.
  plugins: [phaserFlags, stripAssetChecks],
  build: { rollupOptions: { output: { manualChunks(id) {
    if (/[\\/]node_modules[\\/]phaser[\\/]/.test(id)) return 'phaser';
  } } } },
  resolve: { alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/rendering/phaser-slim.js', import.meta.url)) }] },
  optimizeDeps: {
    // phaser-core.js ends with `global.Phaser = Phaser`; the production CommonJS transform maps it already.
    esbuildOptions: { define: { global: 'globalThis' }, plugins: [{ name: 'phaser-flags', setup(build) {
      build.onLoad({ filter: PHASER_SRC }, async args => ({ contents: replacePhaserFlags(await import('node:fs/promises').then(fs => fs.readFile(args.path, 'utf8'))), loader: 'js' }));
    } }] },
  },
  // Dev only (`npm run dev:online`): `?mode=online&server=ws` connects to ws://<dev host>/ws, forwarded to the game server.
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true, rewrite: path => path.replace(/^\/ws/, '') } } },
}));
