// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import securityHeaders from './integrations/security-headers.ts';

export default defineConfig({
  site: 'https://ablation.kitchen',
  output: 'static',
  trailingSlash: 'never',
  // 'never': no inline <style>, so the CSP's style-src stays 'self' (#25).
  build: { inlineStylesheets: 'never' },
  // sitemap writes /sitemap-index.xml + /sitemap-0.xml; securityHeaders then writes the
  // security headers and the CSP's inline-script hashes into dist/_headers (#25).
  integrations: [sitemap(), securityHeaders()],
  // assetsInlineLimit 0: keep bundled scripts external, so the CSP (#25) only hashes the theme head script.
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
