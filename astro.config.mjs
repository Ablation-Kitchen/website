// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import expressiveCode, { ExpressiveCodeTheme } from 'astro-expressive-code';
import securityHeaders from './integrations/security-headers.ts';
import {
  codeStyleOverrides,
  codeTheme,
  pluginTokenClasses,
} from './src/lib/markdown/code-theme.ts';
import remarkCaseStudy from './src/lib/markdown/remark-case-study.ts';
import remarkMermaid from './src/lib/markdown/remark-mermaid.ts';

export default defineConfig({
  site: 'https://ablation.kitchen',
  output: 'static',
  trailingSlash: 'never',
  // 'never': no inline <style>, so the CSP's style-src stays 'self' (#25).
  build: { inlineStylesheets: 'never' },
  // The remark pipeline (not Sätteri): build-time Mermaid and the case-study
  // sections are remark plugins, and the later launch stack (remark-math,
  // rehype-citation, #11) is too. MDX inherits these plugins (#31).
  markdown: { processor: unified({ remarkPlugins: [remarkMermaid, remarkCaseStudy] }) },
  integrations: [
    // Before mdx(), so code blocks in .mdx get Expressive Code too (#31).
    expressiveCode({
      // One theme of sentinel colours, mapped to classes: no inline styles (code-theme.ts).
      themes: [new ExpressiveCodeTheme(codeTheme)],
      minSyntaxHighlightingColorContrast: 0,
      plugins: [pluginTokenClasses()],
      styleOverrides: codeStyleOverrides,
    }),
    mdx(),
    sitemap(),
    // sitemap writes /sitemap-index.xml + /sitemap-0.xml; securityHeaders then writes the
    // security headers and the CSP's inline-script hashes into dist/_headers (#25).
    securityHeaders(),
  ],
  // assetsInlineLimit 0: keep bundled scripts external, so the CSP (#25) only hashes the theme head script.
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
