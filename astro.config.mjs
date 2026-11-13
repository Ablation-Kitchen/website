// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://ablation.kitchen',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'never' },
  // Writes /sitemap-index.xml + /sitemap-0.xml from the built pages (dev-only routes emit no pages).
  integrations: [sitemap()],
  // assetsInlineLimit 0: keep bundled scripts external, so the CSP (#25) only hashes the theme head script.
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
