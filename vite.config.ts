import { defineConfig } from 'vite';

// Relative asset URLs: the same build works at a domain root and under a project
// sub-path such as GitHub Pages' /cat/. Runtime S13 icons resolve via import.meta.env.BASE_URL.
export default defineConfig({ base: './' });
