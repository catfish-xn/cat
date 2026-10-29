import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { productionSizePlugins } from './scripts/vite-production-size';

// Phaser's source tree is written for its webpack DefinePlugin: `typeof FLAG`
// must become a literal, otherwise every optional branch (WebGL debug, FB
// Instant, Camera3D, sound) stays truthy and gets bundled.
const PHASER_FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: true, WEBGL_RENDERER: false, WEBGL_DEBUG: false,
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
// 3D 单独加载模式：three.js 和 3D 渲染代码只经 three-loader.ts 动态 import，统一落在 assets/3d/。
// scripts/m7-budget.cjs 统计 assets/ 顶层的 JS；按需 3D、单人应用分别单列。
// application-loader.ts 只在单人模式动态加载 application.ts，在线启动不请求 assets/solo/。
// augment-dynamic-values 的客户端计算只供单机显示，由强化文本 loader 按需加载。
// restore-checks 只被单人存档恢复引用，跟着 application 进 assets/solo/。
// 单独 manualChunks 会把共享依赖吸进入口的静态 import，所以不另开入口能直接 import 的包。
const AUGMENT_UI_DATA = /[\\/]src[\\/]presentation[\\/](?:augment-text-data|augment-pool-text|augment-zh|s13-augment-asset-manifest)\.ts$/;
const TOOLTIP_UI_DATA = /[\\/]src[\\/]presentation[\\/](?:tooltip-text-data|ability-zh|trait-official-text|unit-roles|trait-display-text|trait-extra-text|special-item-templates)\.ts$/;
const THREE_D_MODULE = /[\\/](?:node_modules[\\/]three[\\/]|src[\\/]rendering3d[\\/]|src[\\/]rendering[\\/]three-mode[\\/](?!three-loader\.ts$|contract\.ts$))/;

// 正式构建不带浏览器内本地房间（`?mode=online` 不加 server=ws 时，在页面里跑 src/server/room 整个房间）：
// local-room-client 换成 local-room-unavailable.ts，只在匹配页提示本站没有联机服务器。dev 服务器和 VITE_LOCAL_ROOM=1 的构建照旧带上。
const LOCAL_ROOM_CLIENT = /[\\/]src[\\/]rendering[\\/]online[\\/]local-room-client\.ts$/;
const localRoomOff: Plugin = {
  name: 'local-room-off', apply: 'build', enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!source.endsWith('/local-room-client')) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved && LOCAL_ROOM_CLIENT.test(resolved.id) ? fileURLToPath(new URL('./src/rendering/online/local-room-unavailable.ts', import.meta.url)) : null;
  },
};

export default defineConfig(({ mode }) => ({
  // Pages has a fixed repository path; other builds remain portable to subpaths.
  // Runtime S13 icons use import.meta.env.BASE_URL in both modes.
  base: mode === 'pages' ? '/cat/' : './',
  // `import Phaser from 'phaser'` resolves to the trimmed build in dev and production alike.
  plugins: [phaserFlags, stripAssetChecks, ...productionSizePlugins(), ...(loadEnv(mode, process.cwd(), 'VITE_').VITE_LOCAL_ROOM === '1' ? [] : [localRoomOff])],
  resolve: { alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/rendering/phaser-slim.js', import.meta.url)) }] },
  optimizeDeps: {
    // phaser-core.js ends with `global.Phaser = Phaser`; the production CommonJS transform maps it already.
    esbuildOptions: { define: { global: 'globalThis' }, plugins: [{ name: 'phaser-flags', setup(build) {
      build.onLoad({ filter: PHASER_SRC }, async args => ({ contents: replacePhaserFlags(await import('node:fs/promises').then(fs => fs.readFile(args.path, 'utf8'))), loader: 'js' }));
    } }] },
  },
  build: { rollupOptions: { output: {
    // One build key: a second one silently replaced this whole block and dropped the Phaser chunk (v16 trim).
    manualChunks: id => (AUGMENT_UI_DATA.test(id) ? 'augment-text' : TOOLTIP_UI_DATA.test(id) ? 'tooltip-text' : THREE_D_MODULE.test(id) ? 'render3d' : /[\\/]node_modules[\\/]phaser[\\/]/.test(id) ? 'phaser' : undefined),
    chunkFileNames: chunk => (['application', 'augment-dynamic-values'].includes(chunk.name) ? 'assets/solo/[name]-[hash].js' : ['augment-text', 'tooltip-text', 'unit-panel'].includes(chunk.name) ? 'assets/ui/[name]-[hash].js' : chunk.moduleIds.some(id => THREE_D_MODULE.test(id)) ? 'assets/3d/[name]-[hash].js' : 'assets/[name]-[hash].js'),
    // The Basis transcoder (KTX2 textures) is referenced only from the 3D chunk and fetched on the first KTX2 decode.
    assetFileNames: asset => (asset.names.some(name => name.startsWith('basis_transcoder')) ? 'assets/3d/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]'),
  } } },
  // Dev only (`npm run dev:online`): `?mode=online&server=ws` connects to ws://<dev host>/ws, forwarded to the game server.
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true, rewrite: path => path.replace(/^\/ws/, '') } } },
}));
