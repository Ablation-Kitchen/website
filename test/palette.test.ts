import { describe, expect, it } from 'vitest';
import { servedUrl } from '../integrations/pagefind.ts';
import {
  excerptHtml,
  filterItems,
  isApple,
  isTyping,
  noMatch,
  shortcut,
  type KeyLike,
  type PaletteItem,
} from '../src/lib/palette';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('shortcut', () => {
  it('⌘K and Ctrl+K toggle, even while typing', () => {
    expect(shortcut(key('k', { metaKey: true }), false)).toBe('toggle');
    expect(shortcut(key('k', { ctrlKey: true }), true)).toBe('toggle');
    expect(shortcut(key('K', { metaKey: true }), false)).toBe('toggle');
  });
  it('/ opens, but not while typing or with a modifier', () => {
    expect(shortcut(key('/'), false)).toBe('open');
    expect(shortcut(key('/'), true)).toBeNull();
    expect(shortcut(key('/', { ctrlKey: true }), false)).toBeNull();
  });
  it('ignores other keys and ⌘⇧K', () => {
    expect(shortcut(key('k'), false)).toBeNull();
    expect(shortcut(key('k', { metaKey: true, shiftKey: true }), false)).toBeNull();
  });
});

describe('isTyping', () => {
  it('is true in text fields and contenteditable', () => {
    expect(isTyping({ tagName: 'INPUT' })).toBe(true);
    expect(isTyping({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTyping({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
  it('is false elsewhere', () => {
    expect(isTyping(null)).toBe(false);
    expect(isTyping({ tagName: 'BUTTON', isContentEditable: false })).toBe(false);
  });
});

describe('filterItems', () => {
  const items: PaletteItem[] = [
    { kind: 'goto', label: 'Research', href: '/research' },
    { kind: 'action', label: 'Copy email', action: 'email', hint: 'dalmo@ablation.kitchen' },
    { kind: 'goto', label: 'Café menu', href: '/cafe' },
  ];
  it('keeps everything for an empty query', () => {
    expect(filterItems(items, '  ')).toHaveLength(3);
  });
  it('matches every word, any order, ignoring case, accents and the hint', () => {
    expect(filterItems(items, 'RESEA').map((i) => i.label)).toEqual(['Research']);
    expect(filterItems(items, 'email copy').map((i) => i.label)).toEqual(['Copy email']);
    expect(filterItems(items, 'ablation.kitchen').map((i) => i.label)).toEqual(['Copy email']);
    expect(filterItems(items, 'cafe').map((i) => i.label)).toEqual(['Café menu']);
    expect(filterItems(items, 'zzz')).toEqual([]);
  });
});

describe('noMatch', () => {
  it("is the 86'd line with the trimmed query", () => {
    expect(noMatch('  soufflé ')).toBe('86’d: nothing on the menu for ‘soufflé’');
  });
});

describe('excerptHtml', () => {
  it('keeps bare <mark> tags', () => {
    expect(excerptHtml('a <mark>b</mark> c')).toBe('a <mark>b</mark> c');
  });
  it('escapes every other tag, so nothing else can be parsed', () => {
    expect(excerptHtml('<img src=x onerror=alert(1)><mark>x</mark>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;<mark>x</mark>',
    );
    expect(excerptHtml('<mark onclick="x">y</mark>')).toBe('&lt;mark onclick="x"&gt;y</mark>');
    expect(excerptHtml('</script><script>')).toBe('&lt;/script&gt;&lt;script&gt;');
  });
  it('leaves entities alone, so escaped text decodes once', () => {
    expect(excerptHtml('R&amp;D &lt;3')).toBe('R&amp;D &lt;3');
  });
});

describe('isApple', () => {
  it('spots macOS and iOS', () => {
    expect(isApple('macOS')).toBe(true);
    expect(isApple('MacIntel')).toBe(true);
    expect(isApple('iPhone')).toBe(true);
    expect(isApple('Windows')).toBe(false);
    expect(isApple('Linux x86_64')).toBe(false);
  });
});

describe('servedUrl', () => {
  it('maps built files to their served paths', () => {
    expect(servedUrl('index.html')).toBe('/');
    expect(servedUrl('about.html')).toBe('/about');
    expect(servedUrl('work/agent-platform.html')).toBe('/work/agent-platform');
    expect(servedUrl('writing/index.html')).toBe('/writing');
  });
});
