import type { Element, ElementContent } from 'hast';
import { describe, expect, it } from 'vitest';
import { captionFromMeta, cleanMermaidSvg } from '../src/lib/markdown/mermaid-svg';

// Trimmed from real mermaid-isomorphic output (flowchart, htmlLabels: false).
const SVG = `<svg id="d-0" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart"
  style="max-width: 320.5px;" viewBox="0 0 320.5 120" role="graphics-document document"
  aria-roledescription="flowchart-v2" aria-labelledby="chart-title-d-0" aria-describedby="chart-desc-d-0">
  <title id="chart-title-d-0">Teams to orchestrator</title>
  <desc id="chart-desc-d-0">Teams send tasks to the orchestrator.</desc>
  <style>#d-0{fill:#333;}</style>
  <g><marker id="d-0_pointEnd" class="marker"><path class="arrowMarkerPath" style="stroke-width: 1;"/></marker>
  <!-- a comment -->
  <g class="node accent" data-look="classic" transform="translate(10, 10)">
    <rect class="basic label-container" style="fill:#f9f" x="0" y="0" width="80" height="40"/>
    <text style="">Teams</text>
  </g>
  <path class="flowchart-link" style=";" data-points="W3siIjoxfV0=" d="M0,0L10,10"/></g>
</svg>`;

function all(node: Element): Element[] {
  return [
    node,
    ...node.children.flatMap((c: ElementContent) => (c.type === 'element' ? all(c) : [])),
  ];
}

describe('cleanMermaidSvg', () => {
  const svg = cleanMermaidSvg(SVG, { width: 320.5, height: 120 });
  const els = all(svg);

  it('drops every <style> element and style attribute (CSP: style-src self)', () => {
    expect(els.some((e) => e.tagName === 'style')).toBe(false);
    expect(els.some((e) => 'style' in e.properties)).toBe(false);
  });

  it('drops data-* layout hints and comments', () => {
    expect(els.some((e) => Object.keys(e.properties).some((k) => /^data[A-Z]/.test(k)))).toBe(
      false,
    );
    expect(JSON.stringify(svg)).not.toContain('"comment"');
  });

  it('keeps classes, geometry and the title/desc', () => {
    const node = els.find(
      (e) => e.tagName === 'g' && String(e.properties['className']).includes('node'),
    );
    expect(node?.properties['className']).toEqual(['node', 'accent']);
    expect(els.find((e) => e.tagName === 'rect')?.properties['width']).toBe('80');
    expect(els.map((e) => e.tagName)).toEqual(expect.arrayContaining(['title', 'desc']));
  });

  it('sets an image role, its intrinsic size and the diagram-svg class', () => {
    expect(svg.properties).toMatchObject({
      role: 'img',
      width: 321,
      height: 120,
      ariaLabelledBy: ['chart-title-d-0'],
      className: ['flowchart', 'diagram-svg'],
    });
    expect(svg.properties['ariaRoleDescription']).toBeUndefined();
  });

  it('requires a text alternative', () => {
    const bare = SVG.replace(/ aria-labelledby="[^"]*"| aria-describedby="[^"]*"/g, '');
    expect(() => cleanMermaidSvg(bare, { width: 1, height: 1 })).toThrow(/accTitle/);
  });

  it('refuses HTML labels', () => {
    const html = SVG.replace(
      '<text style="">Teams</text>',
      '<foreignObject><div>Teams</div></foreignObject>',
    );
    expect(() => cleanMermaidSvg(html, { width: 1, height: 1 })).toThrow(/htmlLabels/);
  });
});

describe('captionFromMeta', () => {
  it('reads caption="…" from the fence meta', () => {
    expect(captionFromMeta('caption="Fig. 1 · The platform"')).toBe('Fig. 1 · The platform');
    expect(captionFromMeta('title="x" caption=" padded "')).toBe('padded');
    expect(captionFromMeta('caption=""')).toBeUndefined();
    expect(captionFromMeta(null)).toBeUndefined();
  });
});
