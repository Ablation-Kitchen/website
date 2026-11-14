/**
 * Expressive Code, styled with the site's tokens and no inline styles (#25, #31).
 *
 * Expressive Code colours each token with an inline `style="--0:#…"`, which
 * `style-src 'self'` blocks. So syntax colours go through classes instead:
 *
 * 1. `codeTheme` gives every token role a sentinel colour (#000001, …).
 * 2. `pluginTokenClasses` swaps each sentinel `style` for a `tok-<role>`
 *    class while the block renders.
 * 3. Its `baseStyles` (emitted into EC's external stylesheet) colour those
 *    classes, per site theme, from `CODE_COLOURS`.
 *
 * Frame, background and UI colours are CSS variables from global.css (see
 * `codeStyleOverrides`), so one theme serves Light and Dark. A style this
 * plugin can't map stays in the HTML, and the build's inline-style guard
 * fails on it.
 */
import type { Element, ElementContent } from 'hast';

export const TOKEN_ROLES = ['comment', 'keyword', 'string', 'constant', 'entity'] as const;
export type TokenRole = (typeof TOKEN_ROLES)[number];

/** TextMate scopes per role. Anything unmatched is plain code text (ink). */
const SCOPES: Record<TokenRole, string[]> = {
  comment: ['comment', 'punctuation.definition.comment'],
  keyword: ['keyword', 'storage', 'keyword.operator.new', 'variable.language'],
  string: ['string', 'markup.inline.raw', 'punctuation.definition.string'],
  constant: ['constant', 'support.constant', 'variable.other.constant'],
  entity: [
    'entity.name',
    'support.function',
    'support.type',
    'support.class',
    'entity.other.attribute-name',
    'meta.object-literal.key',
  ],
};

/**
 * Text colours per role and theme. Code sits on `--color-surface`
 * (#ffffff / #141413); tests/contrast.test.ts holds each to 4.5:1 there.
 */
export const CODE_COLOURS: Record<TokenRole, { light: string; dark: string }> = {
  comment: { light: '#6a6a66', dark: '#9a9a95' },
  keyword: { light: '#4a6562', dark: '#85a6a3' },
  string: { light: '#7a5a1f', dark: '#d4b47c' },
  constant: { light: '#3e5c78', dark: '#93b2cd' },
  entity: { light: '#111111', dark: '#edebe6' },
};

const sentinel = (i: number) => `#${(i + 1).toString(16).padStart(6, '0')}`;
const ROLE_BY_SENTINEL = new Map(TOKEN_ROLES.map((role, i) => [sentinel(i), role]));

/** The theme's plain text colour. A span set to it just drops its style (codeForeground applies). */
const FOREGROUND = '#111111';

/** A minimal VS Code theme: only the sentinels matter; the rest is overridden by CSS variables. */
export const codeTheme = {
  name: 'kitchen',
  type: 'light',
  colors: { 'editor.background': '#ffffff', 'editor.foreground': FOREGROUND },
  tokenColors: TOKEN_ROLES.map((role, i) => ({
    scope: SCOPES[role],
    settings: { foreground: sentinel(i) },
  })),
};

/**
 * What a token span's `style` maps to: a role, `'plain'` for the theme's own
 * text colour, or undefined for anything else (left alone, so the build fails).
 */
export function roleForStyle(style: string): TokenRole | 'plain' | undefined {
  const colour = /^\s*--0\s*:\s*(#[0-9a-f]{6})\s*;?\s*$/i.exec(style)?.[1]?.toLowerCase();
  if (!colour) return undefined;
  return colour === FOREGROUND ? 'plain' : ROLE_BY_SENTINEL.get(colour);
}

/** Rewrites sentinel styles in a rendered line to `tok-<role>` classes, in place. */
export function classifyTokens(node: Element): void {
  const style = node.properties['style'];
  if (typeof style === 'string') {
    const role = roleForStyle(style);
    if (role) delete node.properties['style'];
    if (role && role !== 'plain') {
      const classes = node.properties['className'];
      node.properties['className'] = [
        ...(Array.isArray(classes) ? classes.map(String) : []),
        `tok-${role}`,
      ];
    }
  }
  node.children.forEach((c: ElementContent) => {
    if (c.type === 'element') classifyTokens(c);
  });
}

function colourRules(scheme: 'light' | 'dark'): string {
  return TOKEN_ROLES.map((r) => `.tok-${r} { color: ${CODE_COLOURS[r][scheme]}; }`).join('\n');
}

/** Same theme switch as global.css: `data-theme`, else the OS setting. */
const TOKEN_CSS = `
${colourRules('light')}
:root[data-theme='dark'] & {
${colourRules('dark')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) & {
${colourRules('dark')}
  }
}
`;

export function pluginTokenClasses() {
  return {
    name: 'Token classes (CSP)',
    baseStyles: TOKEN_CSS,
    hooks: {
      postprocessRenderedLine: ({ renderData }: { renderData: { lineAst: Element } }) => {
        classifyTokens(renderData.lineAst);
      },
    },
  };
}

/** Expressive Code's look from the site tokens; follows Light/Dark on its own. */
export const codeStyleOverrides = {
  borderRadius: '14px',
  borderColor: 'var(--color-rule)',
  codeBackground: 'var(--color-surface)',
  codeForeground: 'var(--color-ink)',
  codeFontFamily: 'var(--font-mono)',
  codeFontSize: '14px',
  codeSelectionBackground: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
  uiFontFamily: 'var(--font-sans)',
  uiFontSize: '13px',
  focusBorder: 'var(--color-accent-text)',
  scrollbarThumbColor: 'color-mix(in srgb, var(--color-meta) 40%, transparent)',
  scrollbarThumbHoverColor: 'color-mix(in srgb, var(--color-meta) 60%, transparent)',
  frames: {
    frameBoxShadowCssValue: 'none',
    editorBackground: 'var(--color-surface)',
    editorTabBarBackground: 'var(--color-bg)',
    editorTabBarBorderColor: 'var(--color-rule)',
    editorTabBarBorderBottomColor: 'var(--color-rule)',
    editorActiveTabBackground: 'var(--color-surface)',
    editorActiveTabForeground: 'var(--color-ink)',
    editorActiveTabBorderColor: 'var(--color-rule)',
    editorActiveTabIndicatorTopColor: 'var(--color-accent)',
    editorActiveTabIndicatorBottomColor: 'transparent',
    terminalBackground: 'var(--color-surface)',
    terminalTitlebarBackground: 'var(--color-bg)',
    terminalTitlebarForeground: 'var(--color-meta)',
    terminalTitlebarBorderBottomColor: 'var(--color-rule)',
    terminalTitlebarDotsForeground: 'var(--color-meta)',
    inlineButtonForeground: 'var(--color-soft)',
    inlineButtonBorder: 'var(--color-rule)',
    tooltipSuccessBackground: 'var(--color-accent-text)',
    tooltipSuccessForeground: 'var(--color-surface)',
    // Self-hosted, not EC's default data: URLs, which img-src 'self' blocks (#25).
    copyIcon: 'url("/code/copy.svg")',
    terminalIcon: 'url("/code/terminal.svg")',
  },
};
