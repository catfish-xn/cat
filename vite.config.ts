import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Pages has a fixed repository path; other builds remain portable to subpaths.
  // Runtime S13 icons use import.meta.env.BASE_URL in both modes.
  base: mode === 'pages' ? '/cat/' : './',
}));
