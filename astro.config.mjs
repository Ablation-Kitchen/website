// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://ablation.kitchen',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'never' },
  vite: { plugins: [tailwindcss()] },
});
