/**
 * The OG cards' art and colours. Satori can't render Astro components or
 * resolve CSS variables, so the art pieces are drawn from the same geometry
 * as the site (`src/components/art/shapes.ts`) and painted here with the
 * Light tokens. The paint rules mirror each component's `<style>`; keep them
 * in step. `test/og.test.ts` checks the tokens against global.css.
 */
import {
  FORK_TOQUE,
  LAB_PLANES,
  SPLIT_BOTTLE,
  STILL_LIFE,
  type Shape,
} from '../../components/art/shapes';

/** Light tokens (global.css `@theme`). OG cards are one fixed theme: a crawler doesn't know the reader's. */
export const LIGHT = {
  bg: '#f7f6f3',
  surface: '#ffffff',
  ink: '#111111',
  soft: '#3b3b38',
  meta: '#6a6a66',
  rule: '#e4e2dc',
  accent: '#69908c',
  'accent-text': '#4a6562',
  ochre: '#c9a66b',
  slate: '#5b7c99',
} as const;

const T = LIGHT;

/** `color-mix(in srgb, a p%, b)` for two hex colours, as the site's `.flesh` uses. */
export function mix(a: string, b: string, p: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(ch(a, i) * p + ch(b, i) * (1 - p))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

// Paint per piece: the same rules as the component's <style>, with the Light values.
export const PAINT = {
  still: `
    .ink { stroke: ${T.ink}; stroke-width: 2.4; stroke-linejoin: round; }
    .ink-line { fill: none; stroke: ${T.ink}; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .ink-none { fill: none; }
    .ink-fill { fill: ${T.ink}; }
    .surface { fill: ${T.surface}; }
    .plane-a, .plane-a-solid { fill: ${T.ochre}; }
    .plane-b, .plane-b-solid { fill: ${T.slate}; }
    .accent-fill { fill: ${T.accent}; }
    .flesh { fill: ${mix(T.accent, T.surface, 0.35)}; }
    .segments line { stroke: ${T.accent}; stroke-width: 2; stroke-linecap: round; }`,
  bottle: `
    .ink { stroke: ${T.ink}; stroke-width: 1.2; stroke-linejoin: round; }
    .a { fill: ${T.ochre}; }
    .b { fill: ${T.slate}; }
    .surface { fill: ${T.surface}; }
    .accent { stroke: ${T.accent}; stroke-width: 2.2; stroke-linecap: round; }
    .faint { stroke: ${T.meta}; stroke-width: 1; stroke-linecap: round; }
    .line { fill: none; stroke: ${T.ink}; stroke-width: 1.2; stroke-linejoin: round; }`,
  planes: `
    .a { fill: ${T.ochre}; }
    .b { fill: ${T.slate}; }
    .accent { fill: ${T.accent}; }
    .line { fill: none; stroke: ${T.ink}; stroke-width: 0.8; stroke-opacity: 0.22; }`,
  toque: `
    svg { fill: none; stroke: ${T.ink}; stroke-width: 2; stroke-linecap: square; }
    .stroke-accent { stroke: ${T.accent}; }`,
};

/**
 * A piece as an `<img>` source: a standalone SVG document painted with its
 * stylesheet. resvg clips a nested SVG to its viewBox, where the site lets
 * the art overflow (`overflow: visible`), so `bleed` widens the viewBox on
 * every side by that many units.
 */
function piece(shape: Shape, css: string, bleed = 0) {
  const w = shape.width + 2 * bleed;
  const h = shape.height + 2 * bleed;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-bleed} ${-bleed} ${w} ${h}"><style>${css}</style>${shape.body}</svg>`;
  return {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    /** Height for a rendered width. */
    heightFor: (width: number) => Math.round((width * h) / w),
  };
}

// Built once per process: the strings never change.
export const ART = {
  // The knife handle and lemon sit just past the still life's viewBox.
  stillLife: piece(STILL_LIFE, PAINT.still, 24),
  bottle: piece(SPLIT_BOTTLE, PAINT.bottle, 4),
  planes: piece(LAB_PLANES, PAINT.planes),
  toque: piece(FORK_TOQUE, PAINT.toque),
};
