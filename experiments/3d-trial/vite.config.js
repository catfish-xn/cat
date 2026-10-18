import { defineConfig } from 'vite';

// 独立于正式游戏的构建；产物在 experiments/3d-trial/dist，不进正式站点
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
