/**
 * Turns Mermaid's SVG into markup the CSP allows (#25, #31).
 *
 * Mermaid styles its output with a `<style>` element and `style` attributes;
 * `style-src 'self'` blocks both. This drops them, and the `data-*` layout
 * hints, so the diagram is styled only by `src/styles/content.css` from the
 * colour tokens (and so follows Light/Dark and the always-dark brigade band).
 *
 * Pure: no browser, no Astro. `remark-mermaid.ts` feeds it the rendered SVG.
 */
import type { Element, ElementContent, Root, RootContent } from 'hast';
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';

/** Elements removed outright. `<style>` would be blocked; scripts never belong in a diagram. */
const DROP = new Set(['style', 'script']);

const isDataProp = (key: string) => /^data[A-Z]/.test(key);

function clean(node: Element): Element {
  if (node.tagName === 'foreignObject') {
    throw new Error(
      'the diagram has HTML labels (<foreignObject>); they carry inline styles. Keep `htmlLabels: false`.',
    );
  }
  for (const key of Object.keys(node.properties)) {
    if (key === 'style' || isDataProp(key)) delete node.properties[key];
  }
  node.children = node.children
    .filter((c): c is ElementContent => !(c.type === 'element' && DROP.has(c.tagName)))
    .filter((c) => c.type !== 'comment')
    .map((c) => (c.type === 'element' ? clean(c) : c));
  return node;
}

function findSvg(nodes: readonly (Root | RootContent)[]): Element | undefined {
  for (const n of nodes) {
    if (n.type === 'element' && n.tagName === 'svg') return n;
    if ('children' in n) {
      const found = findSvg(n.children);
      if (found) return found;
    }
  }
  return undefined;
}

export interface DiagramSize {
  width: number;
  height: number;
}

/**
 * Parses and cleans one Mermaid SVG. The result has its intrinsic size as
 * `width`/`height` (CSS scales it down), `role="img"`, and the
 * `<title>`/`<desc>` Mermaid wrote from `accTitle`/`accDescr`. Throws when the
 * diagram has neither, since it would have no text alternative.
 */
export function cleanMermaidSvg(svg: string, size: DiagramSize): Element {
  const root = findSvg([fromHtmlIsomorphic(svg, { fragment: true })]);
  if (!root) throw new Error('Mermaid returned no <svg>.');
  const el = clean(root);
  const p = el.properties;
  if (!p['ariaLabelledBy'] && !p['ariaDescribedBy']) {
    throw new Error(
      'the diagram has no text alternative. Add `accTitle: …` and `accDescr: …` lines to it.',
    );
  }
  delete p['ariaRoleDescription'];
  p['role'] = 'img';
  p['width'] = Math.ceil(size.width);
  p['height'] = Math.ceil(size.height);
  const classes = Array.isArray(p['className']) ? p['className'] : [];
  p['className'] = [...classes.map(String), 'diagram-svg'];
  return el;
}

/** `caption="…"` from a code fence's meta string (```mermaid caption="Fig. 1 · …"). */
export function captionFromMeta(meta: string | null | undefined): string | undefined {
  return /\bcaption="([^"]*)"/.exec(meta ?? '')?.[1]?.trim() || undefined;
}
