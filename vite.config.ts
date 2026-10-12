import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Pages has a fixed repository path; other builds remain portable to subpaths.
  // Runtime S13 icons use import.meta.env.BASE_URL in both modes.
  base: mode === 'pages' ? '/cat/' : './',
  // Dev only (`npm run dev:online`): `?mode=online&server=ws` connects to ws://<dev host>/ws, forwarded to the game server.
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true, rewrite: path => path.replace(/^\/ws/, '') } } },
}));
