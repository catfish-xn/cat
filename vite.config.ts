import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Preserve the root URL used by local development and the existing CI.
  base: mode === 'pages' ? '/cat/' : '/',
}));
