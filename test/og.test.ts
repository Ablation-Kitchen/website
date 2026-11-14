import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIGHT, PAINT, mix } from '../src/lib/og/art';
import {
  HOME_CARD,
  STATIC_CARDS,
  cardFor,
  checkCards,
  courseCard,
  ogImageAlt,
  ogImagePath,
  ogSlug,
  postCard,
  titleSize,
  workCard,
  writingCard,
  type OgCard,
} from '../src/lib/og/cards';
import { renderCard } from '../src/lib/og/render';

const course = (id: string, numeral: string, org = 'iCounter') => ({
  id,
  numeral,
  data: { title: 'One agent platform', org, role: 'Lead AI Engineer', years: '2025–now' },
});

describe('ogSlug / ogImagePath', () => {
  it('maps a page path to its card file', () => {
    expect(ogSlug('/')).toBe('home');
    expect(ogSlug('/about')).toBe('about');
    expect(ogSlug('/work/313x/')).toBe('work/313x');
    expect(ogImagePath({ path: '/' })).toBe('/og/home.png');
    expect(ogImagePath({ path: '/writing/a-post' })).toBe('/og/writing/a-post.png');
  });
});

describe('cardFor', () => {
  const about = STATIC_CARDS.find((c) => c.path === '/about')!;
  it("finds a page's own card, whatever the build format", () => {
    for (const p of ['/about', '/about/', '/about.html', '/about/index.html']) {
      expect(cardFor(p, STATIC_CARDS)).toBe(about);
    }
  });
  it('falls back to the home card (the default, #19)', () => {
    expect(cardFor('/404', STATIC_CARDS)).toBe(HOME_CARD);
    expect(cardFor('/404.html', STATIC_CARDS)).toBe(HOME_CARD);
    expect(cardFor('/not-listed', [])).toBe(HOME_CARD);
    expect(cardFor('/index.html', STATIC_CARDS)).toBe(HOME_CARD);
  });
});

describe('checkCards', () => {
  it('rejects two cards for one file', () => {
    const dup: OgCard = { ...HOME_CARD, path: '/about/' };
    expect(() => checkCards([...STATIC_CARDS, dup])).toThrow(/share \/og\/about\.png/);
    expect(checkCards(STATIC_CARDS)).toBe(STATIC_CARDS);
  });
});

describe('card builders', () => {
  it('a case study shows its numeral and org / years, never metrics', () => {
    const card = courseCard(course('agent-platform', 'i.'));
    expect(card).toMatchObject({
      path: '/work/agent-platform',
      eyebrow: 'Signature dishes · course i.',
      art: { kind: 'course', numeral: 'i.', org: 'iCounter', years: '2025–now' },
    });
    expect(JSON.stringify(card)).not.toMatch(/metric/i);
  });

  it('a post has the eyebrow "Recipes"', () => {
    const card = postCard({
      id: 'a-post',
      data: { title: 'A post', date: new Date('2026-11-12'), kind: 'design-doc', tags: ['a', 'b'] },
    });
    expect(card).toMatchObject({
      path: '/writing/a-post',
      eyebrow: 'Recipes',
      meta: '12 Nov 2026 · design doc',
      art: { kind: 'recipe', label: 'design doc', tags: ['a', 'b'] },
    });
  });

  it('/writing counts the posts and pools their tags', () => {
    const post = (id: string, tags: string[]) => ({
      id,
      data: { title: id, date: new Date('2026-11-12'), kind: 'essay', tags },
    });
    const card = writingCard([post('a', ['x', 'y']), post('b', ['y', 'z'])]);
    expect(card).toMatchObject({
      path: '/writing',
      eyebrow: 'Recipes · writing',
      meta: '2 recipes',
      art: { kind: 'recipe', label: 'the index', tags: ['x', 'y', 'z'] },
    });
    expect(writingCard([post('a', [])]).meta).toBe('1 recipe');
  });

  it('/work lists the courses', () => {
    const card = workCard([course('a', 'i.'), course('b', 'ii.', 'Fortinet')]);
    expect(card.meta).toBe('2 courses · i.–ii.');
    expect(card.art).toEqual({
      kind: 'menu',
      courses: [
        { numeral: 'i.', org: 'iCounter' },
        { numeral: 'ii.', org: 'Fortinet' },
      ],
    });
  });

  it('alt text names the card', () => {
    expect(ogImageAlt(HOME_CARD)).toBe(
      'ablation.kitchen · Dalmo Veras · Lead AI Engineer: I run the kitchen where agents cook.',
    );
  });
});

it('titles step down in size as they get longer', () => {
  const sizes = [10, 30, 50, 70, 90].map((n) => titleSize('x'.repeat(n)));
  expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  expect(new Set(sizes).size).toBe(sizes.length);
});

describe('colours', () => {
  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const theme = css.match(/@theme(?:\s+static)?\s*\{([^}]*)\}/)![1]!;
  const tokens = Object.fromEntries(
    [...theme.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [
      k,
      v!.toLowerCase(),
    ]),
  );

  it('the OG Light tokens match global.css', () => {
    for (const [name, hex] of Object.entries(LIGHT)) expect(tokens[name], name).toBe(hex);
  });

  it('mix() matches color-mix in srgb', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#69908c', '#ffffff', 1)).toBe('#69908c');
  });

  // The OG paint repeats each component's <style> with the Light values; this keeps them in step.
  const rules = (text: string) =>
    Object.fromEntries(
      [...text.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, sel, body]) =>
        sel!.split(',').map((s) => [
          s.trim().replace(/^\.\w+ :global\((.+)\)$/, '$1'),
          body!
            .replace(/var\(--[\w-]+,\s*(#[0-9a-f]+)\)/gi, '$1')
            .replace(/#111111/g, '#111')
            .replace(/#ffffff/g, '#fff')
            .split(';')
            .map((d) => d.trim().replace(/\s*:\s*/, ': '))
            .filter(Boolean)
            .sort()
            .join('; '),
        ]),
      ),
    );

  it.each([
    ['StillLife', 'still'],
    ['SplitBottle', 'bottle'],
    ['LabPlanes', 'planes'],
  ] as const)('%s paints like its OG copy', (component, key) => {
    const source = readFileSync(
      new URL(`../src/components/art/${component}.astro`, import.meta.url),
      'utf8',
    );
    const style = source
      .split('<style>')[1]!
      .split('</style>')[0]!
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const site = rules(style);
    const og = rules(PAINT[key].replace(/#111111/g, '#111').replace(/#ffffff/g, '#fff'));
    for (const [sel, decls] of Object.entries(og)) {
      if (sel === '.flesh') continue; // color-mix() on the site, mix() here
      expect(site[sel], sel).toBe(decls);
    }
    const painted = Object.keys(site).filter(
      (s) => s.startsWith('.') && !/^\.(still|bottle|planes|flip-[xy])$/.test(s),
    );
    expect(Object.keys(og).sort()).toEqual(painted.sort());
  });
});

it('renders a card to a 1200×630 PNG', async () => {
  const png = Buffer.from(await renderCard(courseCard(course('agent-platform', 'i.'))));
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
}, 20_000);
