/**
 * Renders an OG card to a 1200×630 PNG: Satori (layout → SVG), then resvg
 * (SVG → PNG), in plain Node with no browser (#19, spec: Tech stack → OG
 * images). Layout is #19's variant B, "masthead split".
 *
 * Satori notes (from the #19 prototype): every element with more than one
 * child needs `display: flex`; fonts must be WOFF/TTF, not WOFF2; there's no
 * `color-mix()` or CSS variables. resvg 2.6 panics on a box-shadow with a
 * negative spread, so there are no shadows at all.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { ABLATION_ROWS, type Dot } from '../../components/art/shapes';
import { ART, LIGHT as T } from './art';
import { OG_HEIGHT, OG_WIDTH, titleSize, type OgArt, type OgCard } from './cards';

type Style = Record<string, string | number>;
type Child = Node | string | null | undefined | false;
interface Node {
  type: string;
  props: { style?: Style; children?: (Node | string)[]; [attr: string]: unknown };
}

const h = (type: string, style: Style, ...children: Child[]): Node => ({
  type,
  props: { style, children: children.filter((c): c is Node | string => !!c) },
});
const row = (style: Style, ...c: Child[]) => h('div', { display: 'flex', ...style }, ...c);
const col = (style: Style, ...c: Child[]) =>
  h('div', { display: 'flex', flexDirection: 'column', ...style }, ...c);
const img = (src: string, width: number, height: number, style: Style = {}): Node => ({
  type: 'img',
  props: { src, width, height, style },
});

const mono: Style = { fontFamily: 'JetBrains Mono', fontWeight: 400 };
const serif: Style = { fontFamily: 'Instrument Serif', fontWeight: 400 };

const PANEL = 420;

// ---------- the panel art, one per template ----------

function dot(d: Dot): Node {
  const border =
    d === 'removed' ? `2px dashed ${T.accent}` : d === 'gone' ? `2px solid ${T.rule}` : 'none';
  return h('div', {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: d === 'on' ? T.accent : 'transparent',
    border,
  });
}

const panelLabel = (text: string) =>
  row({ ...mono, fontSize: 18, color: T.meta, marginBottom: 8 }, text);

function panelArt(art: OgArt): Node {
  switch (art.kind) {
    case 'still-life':
      return img(ART.stillLife.src, 320, ART.stillLife.heightFor(320));
    case 'bottle':
      return img(ART.bottle.src, 200, ART.bottle.heightFor(200));
    case 'ablation':
      // The same rows as AblationGraphic.astro, at OG scale.
      return col(
        { gap: 22 },
        ...ABLATION_ROWS.map((r) =>
          row(
            { alignItems: 'center', gap: 20 },
            row({ ...mono, fontSize: 18, color: T.meta, width: 170 }, r.label),
            row({ gap: 12 }, ...r.dots.map(dot)),
          ),
        ),
      );
    case 'menu':
      return col(
        { gap: 14, width: '100%' },
        panelLabel('tasting menu'),
        ...art.courses.map((c) =>
          row(
            { alignItems: 'baseline', gap: 16 },
            row(
              { ...serif, fontStyle: 'italic', fontSize: 34, color: T.meta, width: 64 },
              c.numeral,
            ),
            row({ ...mono, fontSize: 18, color: T.soft }, c.org),
          ),
        ),
      );
    case 'course':
      return col(
        { width: '100%' },
        panelLabel('course'),
        row(
          {
            ...serif,
            fontStyle: 'italic',
            fontSize: 168,
            lineHeight: 1,
            color: T.ink,
            marginTop: 4,
          },
          art.numeral,
        ),
        col(
          { ...mono, fontSize: 20, color: T.soft, gap: 6, marginTop: 24 },
          row({}, art.org),
          row({ color: T.meta }, art.years),
        ),
      );
    case 'recipe':
      return col(
        { width: '100%' },
        panelLabel('from the recipe book'),
        row(
          { ...serif, fontStyle: 'italic', fontSize: 64, lineHeight: 1.1, color: T.ink },
          art.label,
        ),
        col(
          { ...mono, fontSize: 18, color: T.soft, gap: 10, marginTop: 28 },
          ...art.tags.map((t) => row({}, `— ${t}`)),
        ),
      );
  }
}

// ---------- the card ----------

function wordmark(): Node {
  return row(
    { alignItems: 'center', gap: 14 },
    img(ART.toque.src, 40, 40),
    row(
      { ...mono, fontSize: 24, color: T.ink },
      'ablation',
      row({ color: T['accent-text'] }, '.'),
      'kitchen',
    ),
  );
}

export function cardTree(card: OgCard): Node {
  const size = titleSize(card.title);
  const planesW = 260;
  return row(
    { width: OG_WIDTH, height: OG_HEIGHT, background: T.bg },
    col(
      {
        flexGrow: 1,
        flexShrink: 1,
        padding: '56px 56px 52px 64px',
        justifyContent: 'space-between',
      },
      wordmark(),
      col(
        {},
        row({ ...mono, fontSize: 20, color: T.meta, marginBottom: 20 }, card.eyebrow),
        h(
          'div',
          {
            display: 'block',
            ...serif,
            fontSize: size,
            lineHeight: 1.02,
            letterSpacing: '-0.025em',
            color: T.ink,
            lineClamp: 3,
          },
          card.title,
        ),
      ),
      row(
        {
          ...mono,
          fontSize: 20,
          color: T.meta,
          borderTop: `1px solid ${T.rule}`,
          paddingTop: 22,
        },
        card.meta,
      ),
    ),
    col(
      {
        width: PANEL,
        flexShrink: 0,
        boxSizing: 'border-box',
        height: '100%',
        background: T.surface,
        borderLeft: `1px solid ${T.rule}`,
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      },
      img(ART.planes.src, planesW, ART.planes.heightFor(planesW), {
        position: 'absolute',
        right: 0,
        bottom: 0,
      }),
      panelArt(card.art),
    ),
  );
}

// ---------- fonts and rendering ----------

const require = createRequire(import.meta.url);
const FONT_FILES = [
  [
    'Instrument Serif',
    400,
    'normal',
    '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff',
  ],
  [
    'Instrument Serif',
    400,
    'italic',
    '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff',
  ],
  [
    'JetBrains Mono',
    400,
    'normal',
    '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
  ],
] as const;

type Fonts = Parameters<typeof satori>[1]['fonts'];
let fonts: Promise<Fonts> | undefined;

/** The `.woff` files from @fontsource (Satori can't read WOFF2), read once per build. */
function loadFonts(): Promise<Fonts> {
  fonts ??= Promise.all(
    FONT_FILES.map(async ([name, weight, style, file]) => ({
      name,
      weight,
      style,
      data: await readFile(require.resolve(file)),
    })),
  );
  return fonts;
}

/** The card as a 1200×630 PNG. */
export async function renderCard(card: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(cardTree(card) as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(),
  });
  // Satori has already turned the text into paths, so resvg needs no fonts:
  // skipping the system font scan saves ~1 s per card.
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
  // A plain Uint8Array (not a Buffer over a shared pool) is a valid Response body.
  return new Uint8Array(png);
}
