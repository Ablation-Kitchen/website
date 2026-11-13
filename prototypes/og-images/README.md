# PROTOTYPE: OG images (ticket #19). Throwaway, never merge.

Open `index.html` (double-click; no build step). `?variant=A|B|C`, or use the blue bar / ← → keys. The PNGs in `out/` are committed, so you don't need to render anything to look.

To regenerate: `npm install && npm run render` (Node 22+). It writes `out/<variant>-<page>.png` plus `out/manifest.js` (sizes and timings for the gallery).

## Variants (each covers home, /work, case studies i–iv, /research, /about, default)

- **A · The ticket**: the page as a kitchen ticket tilted −1° on the cubist planes. Course + URL header, serif title, meta, then dotted-leader lines (metrics on case studies, the course list on /work) and "yes, chef →".
- **B · Masthead split**: big serif title on the left, with the eyebrow above and the meta under a hairline. On the right is a surface "glance" panel holding that page's own art: the still life (home), the course list (/work), the metrics (case study), ablation dots (/research), the split bottle (/about) and the egg (default).
- **C · The pass (dark)**: always-dark trace-panel colours. Wordmark plus "on the pass", a big title, then three trace lines (Ticket / Sous chef / The pass) carrying the course, org·years and metrics.

## What the build-time run showed (answers the "how")

- **Satori + resvg in plain Node works**, with no headless browser. That keeps OG out of the Chromium path #20 reserves for Mermaid. One image takes ~130 ms (B/C) to ~300 ms (A, the shadow filter), so the 27 images take ~5 s. PNGs are 26–90 KB.
- **Fonts:** Satori needs TTF/OTF/WOFF, not WOFF2. The `@fontsource/*` packages ship `.woff`, so the build reads them from `node_modules`. The latin subset has no `→` glyph, so arrows are drawn as SVG.
- **resvg 2.6.2 panics** (`geom.rs:27 unwrap on None`) on a box-shadow with a negative spread (`0 40px 70px -40px`). Use shadows without spread.
- **Satori layout quirks:** every multi-child `div` needs `display:flex`. Padding on the root box adds to the 1200×630 instead of fitting inside it, so put the padding on an inner flex-grow box. `lineClamp` works for long titles. There's no `color-mix()`, so colours are inlined from the tokens.
- **Rotation vs dotted leaders:** at −2° on a 900px ticket the value end rises ~31px, about a line height, so each value looks like it belongs to the row above. That's why it's −1°.
- In Astro this becomes a static endpoint, e.g. `src/pages/og/[...slug].png.ts`, using `getStaticPaths` over the same visibility helpers as the pages (#6), so a draft course gets no image.
